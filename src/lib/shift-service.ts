import "server-only";

import { execute, query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  BukaShiftInput,
  RekapShiftDTO,
  ShiftDetailDTO,
  ShiftDTO,
  ShiftKasDTO,
  ShiftKasInput,
  TutupShiftInput,
} from "@/lib/shift-types";

interface ShiftRow extends RowDataPacket {
  id: number;
  kode: string;
  device_id: string;
  cashier_id: number | null;
  cashier_username: string;
  cashier_nama: string;
  status: "Buka" | "Tutup";
  opening_balance: string;
  closing_balance: string | null;
  setoran: string | null;
  selisih: string | null;
  catatan: string | null;
  opened_at: Date | string;
  closed_at: Date | string | null;
}

interface ShiftKasRow extends RowDataPacket {
  id: number;
  tipe: "masuk" | "keluar";
  jumlah: string;
  catatan: string | null;
  dicatat_oleh: string;
  occurred_at: Date | string;
}

/** Nilai uang selalu string desimal 2 angka (mengikuti `decimal(14,2)`). */
function uang(v: unknown): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function iso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function isoOrNull(v: Date | string | null): string | null {
  return v === null ? null : iso(v);
}

function toDTO(row: ShiftRow): ShiftDTO {
  return {
    id: row.id,
    kode: row.kode,
    deviceId: row.device_id,
    cashierId: row.cashier_id,
    cashierUsername: row.cashier_username,
    cashierNama: row.cashier_nama,
    status: row.status,
    openingBalance: uang(row.opening_balance),
    closingBalance: row.closing_balance === null ? null : uang(row.closing_balance),
    setoran: row.setoran === null ? null : uang(row.setoran),
    selisih: row.selisih === null ? null : uang(row.selisih),
    catatan: row.catatan,
    openedAt: iso(row.opened_at),
    closedAt: isoOrNull(row.closed_at),
  };
}

function toKasDTO(row: ShiftKasRow): ShiftKasDTO {
  return {
    id: row.id,
    tipe: row.tipe,
    jumlah: uang(row.jumlah),
    catatan: row.catatan,
    dicatatOleh: row.dicatat_oleh,
    occurredAt: iso(row.occurred_at),
  };
}

const SELECT_SHIFT = `SELECT id, kode, device_id, cashier_id, cashier_username, cashier_nama,
        status, opening_balance, closing_balance, setoran, selisih, catatan, opened_at, closed_at
  FROM shift`;

async function ambilShift(kode: string): Promise<ShiftRow | null> {
  const { rows } = await query<ShiftRow[]>(`${SELECT_SHIFT} WHERE kode = ? LIMIT 1`, [kode]);
  return rows[0] ?? null;
}

/**
 * Rekap satu shift: transaksi dari `pesanan` pada jendela shift, refund yang
 * selesai, dan pergerakan kas dari `shift_kas`.
 */
export async function hitungRekap(shiftId: number, cashierUsername: string, openedAt: Date | string, closedAt: Date | string | null, openingBalance: unknown): Promise<RekapShiftDTO> {
  const mulai = new Date(openedAt);
  const selesai = closedAt ? new Date(closedAt) : new Date();

  const { rows: jualRows } = await query<(RowDataPacket & { jumlah_transaksi: number; total_penjualan: string; total_tunai: string; total_kredit: string })[]>(
    `SELECT COUNT(*) AS jumlah_transaksi,
            COALESCE(SUM(p.total), 0) AS total_penjualan,
            COALESCE(SUM(CASE WHEN LOWER(p.metode_bayar) = 'tunai' THEN p.total ELSE 0 END), 0) AS total_tunai,
            COALESCE(SUM(CASE WHEN LOWER(p.metode_bayar) LIKE 'kredit%' THEN p.total ELSE 0 END), 0) AS total_kredit
     FROM pesanan p
     WHERE p.kasir_username = ? AND p.created_at >= ? AND p.created_at < ?
       AND p.status <> 'Dibatalkan'`,
    [cashierUsername, mulai, selesai],
  );
  const j = jualRows[0];

  const { rows: retRows } = await query<(RowDataPacket & { retur: string })[]>(
    `SELECT COALESCE(SUM(r.total_refund), 0) AS retur
     FROM retur_pesanan r
     JOIN pesanan p ON p.id = r.pesanan_id
     WHERE p.kasir_username = ? AND r.created_at >= ? AND r.created_at < ?
       AND r.status = 'Selesai'`,
    [cashierUsername, mulai, selesai],
  );

  const { rows: kasRows } = await query<(RowDataPacket & { kas_masuk: string; kas_keluar: string })[]>(
    `SELECT COALESCE(SUM(CASE WHEN tipe = 'masuk' THEN jumlah ELSE 0 END), 0) AS kas_masuk,
            COALESCE(SUM(CASE WHEN tipe = 'keluar' THEN jumlah ELSE 0 END), 0) AS kas_keluar
     FROM shift_kas WHERE shift_id = ?`,
    [shiftId],
  );

  const totalPenjualan = Number(j.total_penjualan);
  const totalTunai = Number(j.total_tunai);
  const totalKredit = Number(j.total_kredit);
  const retur = Number(retRows[0].retur);
  const kasMasuk = Number(kasRows[0].kas_masuk);
  const kasKeluar = Number(kasRows[0].kas_keluar);
  const harapanKas = Number(openingBalance ?? 0) + totalTunai + kasMasuk - kasKeluar - retur;

  return {
    jumlahTransaksi: Number(j.jumlah_transaksi),
    totalPenjualan: uang(totalPenjualan),
    totalTunai: uang(totalTunai),
    totalNonTunai: uang(totalPenjualan - totalTunai - totalKredit),
    totalKredit: uang(totalKredit),
    retur: uang(retur),
    kasMasuk: uang(kasMasuk),
    kasKeluar: uang(kasKeluar),
    harapanKas: uang(harapanKas),
  };
}

/** Kode shift server: `SHIFT-YYYYMMDD-NNN` (urut per hari). */
async function generateKodeShift(): Promise<string> {
  const now = new Date();
  const tgl = now.toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM shift WHERE kode LIKE ?`,
    [`SHIFT-${tgl}-%`],
  );
  const n = Number(rows[0]?.n ?? 0) + 1;
  return `SHIFT-${tgl}-${String(n).padStart(3, "0")}`;
}

/**
 * Buka shift baru. Idempoten pada `clientRef` — push ulang mengembalikan shift
 * yang sama tanpa membuat baris kedua. Selama masih ada shift `Buka` untuk
 * kasir yang sama, permintaan ditolak (satu kasir satu shift terbuka).
 */
export async function bukaShift(input: BukaShiftInput): Promise<{ shift: ShiftDTO; created: boolean }> {
  const clientRef = (input.clientRef ?? "").trim().slice(0, 64) || null;
  if (clientRef) {
    const { rows } = await query<ShiftRow[]>(`${SELECT_SHIFT} WHERE client_ref = ? LIMIT 1`, [clientRef]);
    if (rows[0]) return { shift: toDTO(rows[0]), created: false };
  }

  const masihBuka = await ambilShiftBuka(input.cashierUsername.trim());
  if (masihBuka) {
    throw new Error(`Shift ${masihBuka.kode} masih Buka untuk kasir ini. Tutup dulu sebelum membuka yang baru.`);
  }

  const kode = (input.kode ?? "").trim().slice(0, 32) || (await generateKodeShift());
  if (await ambilShift(kode)) throw new Error(`Kode shift ${kode} sudah dipakai.`);

  const hasil = await execute(
    `INSERT INTO shift
       (kode, device_id, cashier_id, cashier_username, cashier_nama, opening_balance,
        catatan, client_ref, opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      kode,
      input.deviceId.trim().slice(0, 32),
      input.cashierId ?? null,
      input.cashierUsername.trim().slice(0, 50),
      input.cashierNama.trim().slice(0, 100),
      uang(input.openingBalance),
      null,
      clientRef,
      input.openedAt ? new Date(input.openedAt) : new Date(),
    ],
  );
  const baris = await ambilShift(kode);
  if (!baris) throw new Error("Shift gagal dicatat.");
  void hasil;
  return { shift: toDTO(baris), created: true };
}

async function ambilShiftBuka(cashierUsername: string): Promise<ShiftRow | null> {
  const { rows } = await query<ShiftRow[]>(
    `${SELECT_SHIFT} WHERE cashier_username = ? AND status = 'Buka' ORDER BY id DESC LIMIT 1`,
    [cashierUsername],
  );
  return rows[0] ?? null;
}

/**
 * Tutup shift: hitung rekap, simpan `closing_balance` / `setoran` / `selisih`,
 * lalu kunci shift. Idempoten pada `clientRef`.
 */
export async function tutupShift(input: TutupShiftInput): Promise<ShiftDTO> {
  const clientRef = (input.clientRef ?? "").trim().slice(0, 64) || null;
  const baris = await ambilShift(input.kode.trim());
  if (!baris) throw new Error(`Shift ${input.kode} tidak ditemukan.`);
  if (baris.status === "Tutup") {
    // Push ulang / permintaan ganda — kembalikan keadaan akhir, jangan hitung ulang.
    return toDTO(baris);
  }

  const closing = uang(input.closingBalance);
  const rekap = await hitungRekap(
    baris.id,
    baris.cashier_username,
    baris.opened_at,
    baris.closed_at,
    baris.opening_balance,
  );
  const setoran = input.setoran?.trim() ? uang(input.setoran) : rekap.harapanKas;
  const selisih = uang(Number(closing) - Number(rekap.harapanKas));

  await execute(
    `UPDATE shift
     SET status = 'Tutup', closing_balance = ?, setoran = ?, selisih = ?, catatan = ?,
         client_ref_tutup = ?, closed_at = ?
     WHERE id = ?`,
    [
      closing,
      setoran,
      selisih,
      input.catatan?.trim().slice(0, 255) || null,
      clientRef,
      input.closedAt ? new Date(input.closedAt) : new Date(),
      baris.id,
    ],
  );

  const sesudah = await ambilShift(baris.kode);
  const dto = toDTO(sesudah!);
  return { ...dto, rekap };
}

/**
 * Catat kas masuk/keluar pada shift yang sedang berjalan.
 * Idempoten pada `clientRef`.
 */
export async function catatKas(input: ShiftKasInput): Promise<ShiftKasDTO> {
  const clientRef = input.clientRef.trim().slice(0, 64);
  if (!clientRef) throw new Error("clientRef wajib diisi.");
  const baris = await ambilShift(input.kode.trim());
  if (!baris) throw new Error(`Shift ${input.kode} tidak ditemukan.`);
  if (baris.status === "Tutup") throw new Error(`Shift ${baris.kode} sudah ditutup.`);

  const { rows: sudah } = await query<ShiftKasRow[]>(
    `SELECT id, tipe, jumlah, catatan, dicatat_oleh, occurred_at FROM shift_kas WHERE client_ref = ? LIMIT 1`,
    [clientRef],
  );
  if (sudah[0]) return toKasDTO(sudah[0]);

  if (!["masuk", "keluar"].includes(input.tipe)) throw new Error("Tipe kas harus 'masuk' atau 'keluar'.");
  const jumlah = Number(input.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error("Jumlah kas harus lebih dari nol.");

  await execute(
    `INSERT INTO shift_kas (shift_id, tipe, jumlah, catatan, dicatat_oleh, client_ref, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      baris.id,
      input.tipe,
      uang(jumlah),
      input.catatan?.trim().slice(0, 255) || null,
      input.dicatatOleh.trim().slice(0, 100),
      clientRef,
      input.occurredAt ? new Date(input.occurredAt) : new Date(),
    ],
  );
  const { rows } = await query<ShiftKasRow[]>(
    `SELECT id, tipe, jumlah, catatan, dicatat_oleh, occurred_at FROM shift_kas WHERE client_ref = ? LIMIT 1`,
    [clientRef],
  );
  return toKasDTO(rows[0]);
}

export interface ListShiftParams {
  status?: "Buka" | "Tutup" | null;
  cashierUsername?: string | null;
  limit?: number;
}

export async function listShift(params: ListShiftParams = {}): Promise<ShiftDTO[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.status) {
    where.push("status = ?");
    args.push(params.status);
  }
  if (params.cashierUsername) {
    where.push("cashier_username = ?");
    args.push(params.cashierUsername.trim());
  }
  args.push(Math.min(Math.max(params.limit ?? 50, 1), 200));
  const { rows } = await query<ShiftRow[]>(
    `${SELECT_SHIFT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`,
    args,
  );
  return rows.map(toDTO);
}

/** Detail satu shift + rekap + seluruh pergerakan kas di dalamnya. */
export async function getShiftDetail(kode: string): Promise<ShiftDetailDTO | null> {
  const baris = await ambilShift(kode.trim());
  if (!baris) return null;
  const rekap = await hitungRekap(
    baris.id,
    baris.cashier_username,
    baris.opened_at,
    baris.closed_at,
    baris.opening_balance,
  );
  const { rows } = await query<ShiftKasRow[]>(
    `SELECT id, tipe, jumlah, catatan, dicatat_oleh, occurred_at
     FROM shift_kas WHERE shift_id = ? ORDER BY id ASC`,
    [baris.id],
  );
  return { ...toDTO(baris), rekap, kas: rows.map(toKasDTO) };
}
