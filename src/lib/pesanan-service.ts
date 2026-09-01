import "server-only";

import { query, execute, withTransaction } from "@/lib/db";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AddKreditPembayaranInput,
  CreatePesananInput,
  CreateReturInput,
  KreditDTO,
  KreditPembayaranDTO,
  PesananDTO,
  PesananItemDTO,
  PesananPaginationMeta,
  PesananProdukOption,
  PesananStatus,
  ReturDTO,
  ReturItemDTO,
} from "@/lib/pesanan-types";
import { validatePromoVoucher } from "@/lib/promo-service";
import { catatKomisiPesanan } from "@/lib/komisi-service";
import { getUserByUsername } from "@/lib/user-service";

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

export interface PesananRow {
  id: number;
  no_pesanan: string;
  kasir_nama: string;
  kasir_username: string;
  status: PesananStatus;
  metode_bayar: string;
  periode_kredit: string | null;
  voucher: string | null;
  diskon_persen: number | string;
  subtotal: number | string;
  diskon_amount: number | string;
  total: number | string;
  uang_diterima: number | string;
  kembalian: number | string;
  catatan: string | null;
  created_at: Date;
}

export function toPesananDTO(row: PesananRow, items: PesananItemDTO[]): PesananDTO {
  return {
    id: row.id,
    noPesanan: row.no_pesanan,
    kasirNama: row.kasir_nama,
    kasirUsername: row.kasir_username,
    status: row.status,
    metodeBayar: row.metode_bayar,
    periodeKredit: row.periode_kredit,
    voucher: row.voucher,
    diskonPersen: Number(row.diskon_persen),
    subtotal: Number(row.subtotal),
    diskonAmount: Number(row.diskon_amount),
    total: Number(row.total),
    uangDiterima: Number(row.uang_diterima),
    kembalian: Number(row.kembalian),
    catatan: row.catatan,
    createdAt: row.created_at.toISOString(),
    items,
  };
}

export function toPesananItemDTO(row: {
  id: number;
  produk_id: number | null;
  nama_produk: string;
  qty: number;
  harga: number | string;
  subtotal: number | string;
}): PesananItemDTO {
  return {
    id: row.id,
    produkId: row.produk_id,
    namaProduk: row.nama_produk,
    qty: row.qty,
    harga: Number(row.harga),
    subtotal: Number(row.subtotal),
  };
}

export function toReturItemDTO(row: {
  id: number;
  pesanan_item_id: number | null;
  nama_produk: string;
  qty: number;
  harga: number | string;
  subtotal: number | string;
}): ReturItemDTO {
  return {
    id: row.id,
    pesananItemId: row.pesanan_item_id,
    namaProduk: row.nama_produk,
    qty: row.qty,
    harga: Number(row.harga),
    subtotal: Number(row.subtotal),
  };
}

export function toReturDTO(
  row: { id: number; no_retur: string; pesanan_id: number; tipe: "semua" | "sebagian"; alasan: string; catatan: string | null; total_refund: number | string; status: "Selesai" | "Diproses"; created_at: Date; no_pesanan: string; kasir_nama?: string; kasir_username?: string },
  items: ReturItemDTO[],
): ReturDTO {
  return {
    id: row.id,
    noRetur: row.no_retur,
    noPesanan: row.no_pesanan,
    tipe: row.tipe,
    alasan: row.alasan,
    catatan: row.catatan,
    totalRefund: Number(row.total_refund),
    status: row.status,
    createdAt: row.created_at.toISOString(),
    kasirNama: row.kasir_nama ?? "",
    kasirUsername: row.kasir_username ?? "",
    items,
  };
}

// ---------------------------------------------------------------------------
// List (dengan pagination, search no_pesanan, filter status & tanggal, sort)
// ---------------------------------------------------------------------------

const PESANAN_SORT_COLUMNS: Record<string, string> = {
  no_pesanan: "p.no_pesanan",
  created_at: "p.created_at",
  kasir_nama: "p.kasir_nama",
  total: "p.total",
  metode_bayar: "p.metode_bayar",
};

export function parsePesananListParams(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 50);
  const status = (params.get("status") ?? "").trim();
  const dateFrom = (params.get("dateFrom") ?? "").trim();
  const dateTo = (params.get("dateTo") ?? "").trim();
  const sortByRaw = params.get("sortBy") ?? "created_at";
  const sortBy = sortByRaw in PESANAN_SORT_COLUMNS ? sortByRaw : "created_at";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  return { page, pageSize, search, status, dateFrom, dateTo, sortBy, sortOrder };
}

function buildMeta(total: number, page: number, pageSize: number): PesananPaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listPesanan(
  opts: ReturnType<typeof parsePesananListParams>,
): Promise<{ items: PesananDTO[]; pagination: PesananPaginationMeta }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.search) {
    where.push("p.no_pesanan LIKE ?");
    params.push(`%${opts.search}%`);
  }
  if (opts.status) {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  if (opts.dateFrom) {
    where.push("p.created_at >= ?");
    params.push(`${opts.dateFrom} 00:00:00`);
  }
  if (opts.dateTo) {
    where.push("p.created_at <= ?");
    params.push(`${opts.dateTo} 23:59:59`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM pesanan p ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const sortColumn = PESANAN_SORT_COLUMNS[opts.sortBy] ?? "p.created_at";
  const dir = opts.sortOrder === "asc" ? "ASC" : "DESC";
  const offset = (opts.page - 1) * opts.pageSize;
  const { rows } = await query<PesananRow[]>(
    `SELECT p.* FROM pesanan p
     ${whereSql}
     ORDER BY ${sortColumn} ${dir}, p.id ${dir}
     LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  if (rows.length === 0) {
    return { items: [], pagination: buildMeta(total, opts.page, opts.pageSize) };
  }

  // Load items for all rows in one query (avoid N+1).
  const ids = rows.map((r) => r.id);
  const itemResult = await query<RowDataPacket[]>(
    `SELECT id, produk_id, nama_produk, qty, harga, subtotal
     FROM pesanan_item WHERE pesanan_id IN (${ids.map(() => "?").join(",")})
     ORDER BY id ASC`,
    ids,
  );
  const byOrder = new Map<number, PesananItemDTO[]>();
  for (const r of itemResult.rows as RowDataPacket[]) {
    const dto = toPesananItemDTO(r as never);
    const list = byOrder.get(Number(r.pesanan_id)) ?? [];
    list.push(dto);
    byOrder.set(Number(r.pesanan_id), list);
  }

  const items = rows.map((row) => toPesananDTO(row, byOrder.get(row.id) ?? []));
  return { items, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

// ---------------------------------------------------------------------------
// Get single pesanan (detail + items)
// ---------------------------------------------------------------------------

export async function getPesananByNo(noPesanan: string): Promise<PesananDTO | null> {
  const { rows } = await query<PesananRow[]>(`SELECT p.* FROM pesanan p WHERE p.no_pesanan = ? LIMIT 1`, [noPesanan]);
  const row = rows[0];
  if (!row) return null;
  const { rows: itemRows } = await query<RowDataPacket[]>(
    `SELECT id, produk_id, nama_produk, qty, harga, subtotal
     FROM pesanan_item WHERE pesanan_id = ? ORDER BY id ASC`,
    [row.id],
  );
  return toPesananDTO(row, (itemRows as RowDataPacket[]).map((r) => toPesananItemDTO(r as never)));
}

// ---------------------------------------------------------------------------
// Generate nomor urut ("ORD-YYYYMMDD-NNN" / "RTR-YYYYMMDD-NNN")
// ---------------------------------------------------------------------------

export async function generateNoPesanan(): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const { rows } = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM pesanan WHERE no_pesanan LIKE ?`,
    [`ORD-${ymd}-%`],
  );
  const next = Number(rows[0]?.total ?? 0) + 1;
  return `ORD-${ymd}-${String(next).padStart(3, "0")}`;
}

export async function generateNoRetur(): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const { rows } = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM retur_pesanan WHERE no_retur LIKE ?`,
    [`RTR-${ymd}-%`],
  );
  const next = Number(rows[0]?.total ?? 0) + 1;
  return `RTR-${ymd}-${String(next).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Create pesanan (transaksi)
// ---------------------------------------------------------------------------

export async function createPesananTx(
  input: CreatePesananInput,
  kasir: { nama: string; username: string },
): Promise<PesananDTO | null> {
  const noPesanan = await withTransaction<string>(async (conn) => {
    const generated = await generateNoPesanan();
    const subtotal = input.items.reduce((sum, it) => sum + it.harga * it.qty, 0);

    // Voucher → diskon dari tabel promo (aktif, periode berlaku, kuota, minimal belanja).
    let diskonPersen = 0;
    let diskonAmount = 0;
    let voucherKode: string | null = null;
    let promoId: number | null = null;
    if (input.voucher) {
      const valid = await validatePromoVoucher(input.voucher, subtotal);
      if (!valid.valid || !valid.promo) {
        throw new Error(`VOUCHER_INVALID:${valid.message}`);
      }
      voucherKode = valid.promo.kode;
      promoId = valid.promo.id;
      diskonPersen = valid.promo.tipe === "Diskon %" ? valid.promo.nilaiDiskon : 0;
      diskonAmount = valid.promo.diskonAmount;
    }
    const total = subtotal - diskonAmount;
    const uangDiterima = input.uangDiterima ?? 0;
    const kembalian = metodeBayarTunai(input.metodeBayar) ? Math.max(0, uangDiterima - total) : 0;

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO pesanan
        (no_pesanan, kasir_nama, kasir_username, status, metode_bayar, periode_kredit,
         voucher, diskon_persen, subtotal, diskon_amount, total, uang_diterima, kembalian, catatan)
       VALUES (?, ?, ?, 'Selesai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generated,
        kasir.nama,
        kasir.username,
        input.metodeBayar,
        input.periodeKredit ?? null,
        voucherKode,
        diskonPersen,
        subtotal,
        diskonAmount,
        total,
        uangDiterima,
        kembalian,
        input.catatan?.slice(0, 255) || null,
      ],
    );

    // Tandai voucher terpakai (kuota berkurang 1).
    if (promoId != null) {
      await conn.query(`UPDATE promo SET jumlah_digunakan = jumlah_digunakan + 1 WHERE id = ?`, [promoId]);
    }

    // Komisi: jika kasir yang login punya akun user operasional (username sama),
    // catat komisi sesuai aturan role user tersebut.
    const kasirUser = await getUserByUsername(kasir.username);
    if (kasirUser) {
      await catatKomisiPesanan(conn, {
        userId: kasirUser.id,
        pesananId: result.insertId,
        role: kasirUser.role,
        dasarKomisi: subtotal,
      });
    }

    // Hanya simpan produk_id yang benar-benar ada (FK di pesanan_item);
    // id yang tidak valid / tidak dikenal disimpan sebagai NULL agar tidak
    // memicu foreign key violation, nama produk tetap tersimpan.
    const produkIds = [...new Set(
      input.items
        .map((it) => it.produkId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    )];
    const validIds = new Set<number>();
    if (produkIds.length > 0) {
      const [validRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM produk WHERE id IN (${produkIds.map(() => "?").join(",")})`,
        produkIds,
      );
      for (const r of validRows as Array<{ id: number }>) validIds.add(r.id);
    }

    for (const it of input.items) {
      const produkId = typeof it.produkId === "number" && validIds.has(it.produkId) ? it.produkId : null;
      await conn.query(
        `INSERT INTO pesanan_item (pesanan_id, produk_id, nama_produk, qty, harga, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.insertId, produkId, it.namaProduk, it.qty, it.harga, it.harga * it.qty],
      );
    }

    return generated;
  });
  // Baca ulang SETELAH commit — di dalam transaksi, koneksi pool lain bisa
  // membaca state pre-commit sehingga hasil tampak null/tidak berubah.
  return getPesananByNo(noPesanan);
}

function metodeBayarTunai(metode: string): boolean {
  return metode.trim().toLowerCase() === "tunai";
}

// ---------------------------------------------------------------------------
// Retur (transaksi) — insert retur + retur_item, update status pesanan.
// ---------------------------------------------------------------------------

export async function createReturTx(
  noPesanan: string,
  input: CreateReturInput,
): Promise<ReturDTO | null> {
  return withTransaction(async (conn) => {
    const [pesananRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM pesanan WHERE no_pesanan = ? LIMIT 1`,
      [noPesanan],
    );
    const pesananId = (pesananRows as Array<{ id: number }>)[0]?.id;
    if (!pesananId) return null;

    const noRetur = await generateNoRetur();
    const totalRefund = input.items.reduce((sum, it) => sum + it.harga * it.qty, 0);

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO retur_pesanan (no_retur, pesanan_id, tipe, alasan, catatan, total_refund)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [noRetur, pesananId, input.tipe, input.alasan, input.catatan?.slice(0, 255) || null, totalRefund],
    );

    for (const it of input.items) {
      await conn.query(
        `INSERT INTO retur_item (retur_id, pesanan_item_id, nama_produk, qty, harga, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [result.insertId, it.pesananItemId ?? null, it.namaProduk, it.qty, it.harga, it.harga * it.qty],
      );
    }

    // Status pesanan → "Dikembalikan" (perilaku UI: retur menandai pesanan retur).
    await conn.query(`UPDATE pesanan SET status = 'Dikembalikan' WHERE id = ?`, [pesananId]);

    // Baca retur lengkap utk respons — pakai conn (koneksi transaksi) agar
    // membaca state yg belum commit, bukan pool lain.
    const [returRows] = await conn.query<RowDataPacket[]>(
      `SELECT r.id, r.no_retur, r.pesanan_id, r.tipe, r.alasan, r.catatan, r.total_refund, r.status, r.created_at,
              p.no_pesanan
       FROM retur_pesanan r JOIN pesanan p ON p.id = r.pesanan_id
       WHERE r.no_retur = ? LIMIT 1`,
      [noRetur],
    );
    const returRow = (returRows as RowDataPacket[])[0];
    const [itemRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, pesanan_item_id, nama_produk, qty, harga, subtotal
       FROM retur_item WHERE retur_id = ? ORDER BY id ASC`,
      [result.insertId],
    );
    return toReturDTO(
      returRow as never,
      (itemRows as RowDataPacket[]).map((r) => toReturItemDTO(r as never)),
    );
  });
}

// ---------------------------------------------------------------------------
// Produk untuk search di form buat pesanan (aktif, dengan harga & stok).
// ---------------------------------------------------------------------------

export async function searchPesananProduk(
  search: string,
  limit = 10,
): Promise<PesananProdukOption[]> {
  const q = search.trim();
  const params: unknown[] = [];
  let whereSql = "WHERE p.status = 'active'";
  if (q) {
    whereSql += " AND (p.sku LIKE ? OR p.nama LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }

  const { rows } = await query<RowDataPacket[]>(
    `SELECT p.id AS produk_id, p.sku, p.nama,
            MIN(ps.harga) AS harga,
            COALESCE((SELECT SUM(st.qty) FROM stok st JOIN produk_satuan ps2 ON ps2.id = st.produk_satuan_id WHERE ps2.produk_id = p.id), 0) AS stok
     FROM produk p
     JOIN produk_satuan ps ON ps.produk_id = p.id
     ${whereSql}
     GROUP BY p.id, p.sku, p.nama
     HAVING stok > 0
     ORDER BY p.nama ASC
     LIMIT ?`,
    [...params, Math.min(50, Math.max(1, limit))],
  );
  return (rows as RowDataPacket[]).map((r) => ({
    produkId: Number(r.produk_id),
    sku: r.sku as string,
    nama: r.nama as string,
    harga: Number(r.harga),
    stok: Number(r.stok),
  }));
}

// ---------------------------------------------------------------------------
// Kredit — list pesanan kredit + agregat pembayaran angsuran
// ---------------------------------------------------------------------------

export function parseKreditListParams(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 50);
  const dateFrom = (params.get("dateFrom") ?? "").trim();
  const dateTo = (params.get("dateTo") ?? "").trim();
  const sortByRaw = params.get("sortBy") ?? "created_at";
  const allowed = ["no_pesanan", "created_at", "kasir_nama", "total", "totalDibayar"];
  const sortBy = allowed.includes(sortByRaw) ? sortByRaw : "created_at";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  return { page, pageSize, search, dateFrom, dateTo, sortBy, sortOrder };
}

export async function listKredit(
  opts: ReturnType<typeof parseKreditListParams>,
): Promise<{ items: KreditDTO[]; pagination: PesananPaginationMeta }> {
  const where: string[] = ["p.metode_bayar LIKE 'Kredit%'"];
  const params: unknown[] = [];
  if (opts.search) {
    where.push("p.no_pesanan LIKE ?");
    params.push(`%${opts.search}%`);
  }
  if (opts.dateFrom) {
    where.push("p.created_at >= ?");
    params.push(`${opts.dateFrom} 00:00:00`);
  }
  if (opts.dateTo) {
    where.push("p.created_at <= ?");
    params.push(`${opts.dateTo} 23:59:59`);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM pesanan p ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const sortColumn =
    opts.sortBy === "totalDibayar"
      ? "COALESCE((SELECT SUM(jumlah) FROM kredit_pembayaran k WHERE k.pesanan_id = p.id), 0)"
      : opts.sortBy === "created_at" ? "p.created_at" : `p.${opts.sortBy}`;
  const dir = opts.sortOrder === "asc" ? "ASC" : "DESC";
  const offset = (opts.page - 1) * opts.pageSize;
  const { rows } = await query<PesananRow[]>(
    `SELECT p.* FROM pesanan p ${whereSql}
     ORDER BY ${sortColumn} ${dir}, p.id ${dir}
     LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  if (rows.length === 0) {
    return { items: [], pagination: buildMeta(total, opts.page, opts.pageSize) };
  }

  // Items + pembayaran utk semua baris dalam 2 query batch (hindari N+1).
  const ids = rows.map((r) => r.id);
  const itemResult = await query<RowDataPacket[]>(
    `SELECT id, produk_id, nama_produk, qty, harga, subtotal, pesanan_id
     FROM pesanan_item WHERE pesanan_id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`,
    ids,
  );
  const itemsByOrder = new Map<number, PesananItemDTO[]>();
  for (const r of itemResult.rows as RowDataPacket[]) {
    const dto = toPesananItemDTO(r as never);
    const list = itemsByOrder.get(Number(r.pesanan_id)) ?? [];
    list.push(dto);
    itemsByOrder.set(Number(r.pesanan_id), list);
  }
  const payResult = await query<RowDataPacket[]>(
    `SELECT id, pesanan_id, jumlah, dicatat_oleh, catatan, created_at
     FROM kredit_pembayaran WHERE pesanan_id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`,
    ids,
  );
  const payByOrder = new Map<number, KreditPembayaranDTO[]>();
  for (const r of payResult.rows as RowDataPacket[]) {
    const dto: KreditPembayaranDTO = {
      id: Number(r.id),
      jumlah: Number(r.jumlah),
      dicatatOleh: r.dicatat_oleh as string,
      catatan: r.catatan as string | null,
      createdAt: (r.created_at as Date).toISOString(),
    };
    const list = payByOrder.get(Number(r.pesanan_id)) ?? [];
    list.push(dto);
    payByOrder.set(Number(r.pesanan_id), list);
  }

  const items = rows.map((row) => {
    const pembayaran = payByOrder.get(row.id) ?? [];
    const totalDibayar = pembayaran.reduce((s, p) => s + p.jumlah, 0);
    const sisa = Math.max(0, Number(row.total) - totalDibayar);
    return {
      ...toPesananDTO(row, itemsByOrder.get(row.id) ?? []),
      totalDibayar,
      sisa,
      isLunas: sisa === 0,
      pembayaran,
      periodeKredit: row.periode_kredit,
    } as KreditDTO;
  });
  return { items, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

/** Ambil satu pesanan kredit + pembayarannya. */
export async function getKreditByNo(noPesanan: string): Promise<KreditDTO | null> {
  const list = await listKredit({
    page: 1,
    pageSize: 1,
    search: noPesanan,
    dateFrom: "",
    dateTo: "",
    sortBy: "created_at",
    sortOrder: "desc",
  });
  const found = list.items.find((k) => k.noPesanan === noPesanan);
  return found ?? null;
}

/** Catat pembayaran angsuran kredit (transaksi) — tidak boleh melebihi sisa. */
export async function addKreditPembayaranTx(
  noPesanan: string,
  input: AddKreditPembayaranInput,
  dicatatOleh: string,
): Promise<KreditDTO | null> {
  const found = await withTransaction<boolean>(async (conn) => {
    const [pesananRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, total, metode_bayar FROM pesanan WHERE no_pesanan = ? LIMIT 1`,
      [noPesanan],
    );
    const pesanan = (pesananRows as Array<{ id: number; total: number; metode_bayar: string }>)[0];
    if (!pesanan) return false;
    if (!pesanan.metode_bayar.toLowerCase().startsWith("kredit")) {
      throw new Error("Pesanan ini bukan pesanan kredit.");
    }
    const [payRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(jumlah), 0) AS terbayar FROM kredit_pembayaran WHERE pesanan_id = ?`,
      [pesanan.id],
    );
    const terbayar = Number((payRows as RowDataPacket[])[0]?.terbayar ?? 0);
    const sisa = Math.max(0, Number(pesanan.total) - terbayar);
    if (input.jumlah <= 0) throw new Error("Jumlah pembayaran harus lebih dari 0.");
    if (input.jumlah > sisa) {
      throw new Error(`Jumlah pembayaran melebihi sisa (${sisa}).`);
    }
    await conn.query(
      `INSERT INTO kredit_pembayaran (pesanan_id, jumlah, dicatat_oleh, catatan) VALUES (?, ?, ?, ?)`,
      [pesanan.id, input.jumlah, dicatatOleh, input.catatan?.slice(0, 255) || null],
    );
    return true;
  });
  if (!found) return null;
  return getKreditByNo(noPesanan);
}

// ---------------------------------------------------------------------------
// Pengembalian (retur) — list
// ---------------------------------------------------------------------------

export function parseReturListParams(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 50);
  const dateFrom = (params.get("dateFrom") ?? "").trim();
  const dateTo = (params.get("dateTo") ?? "").trim();
  const sortByRaw = params.get("sortBy") ?? "created_at";
  const allowed = ["no_retur", "created_at", "no_pesanan", "total_refund"];
  const sortBy = allowed.includes(sortByRaw) ? sortByRaw : "created_at";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  return { page, pageSize, search, dateFrom, dateTo, sortBy, sortOrder };
}

export async function listRetur(
  opts: ReturnType<typeof parseReturListParams>,
): Promise<{ items: ReturDTO[]; pagination: PesananPaginationMeta }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.search) {
    where.push("(r.no_retur LIKE ? OR p.no_pesanan LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.dateFrom) {
    where.push("r.created_at >= ?");
    params.push(`${opts.dateFrom} 00:00:00`);
  }
  if (opts.dateTo) {
    where.push("r.created_at <= ?");
    params.push(`${opts.dateTo} 23:59:59`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM retur_pesanan r JOIN pesanan p ON p.id = r.pesanan_id ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const sortColumn =
    opts.sortBy === "total_refund" ? "r.total_refund"
      : opts.sortBy === "no_pesanan" ? "p.no_pesanan"
      : opts.sortBy === "no_retur" ? "r.no_retur"
      : "r.created_at";
  const dir = opts.sortOrder === "asc" ? "ASC" : "DESC";
  const offset = (opts.page - 1) * opts.pageSize;
  const { rows } = await query<RowDataPacket[]>(
    `SELECT r.id, r.no_retur, r.pesanan_id, r.tipe, r.alasan, r.catatan, r.total_refund, r.status, r.created_at,
            p.no_pesanan, p.kasir_nama, p.kasir_username
     FROM retur_pesanan r JOIN pesanan p ON p.id = r.pesanan_id
     ${whereSql}
     ORDER BY ${sortColumn} ${dir}, r.id ${dir}
     LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  if (rows.length === 0) {
    return { items: [], pagination: buildMeta(total, opts.page, opts.pageSize) };
  }

  const returIds = (rows as RowDataPacket[]).map((r) => Number(r.id));
  const itemResult = await query<RowDataPacket[]>(
    `SELECT id, retur_id, pesanan_item_id, nama_produk, qty, harga, subtotal
     FROM retur_item WHERE retur_id IN (${returIds.map(() => "?").join(",")}) ORDER BY id ASC`,
    returIds,
  );
  const itemsByRetur = new Map<number, ReturItemDTO[]>();
  for (const r of itemResult.rows as RowDataPacket[]) {
    const dto = toReturItemDTO(r as never);
    const list = itemsByRetur.get(Number(r.retur_id)) ?? [];
    list.push(dto);
    itemsByRetur.set(Number(r.retur_id), list);
  }

  const items = (rows as RowDataPacket[]).map((r) =>
    toReturDTO(
      r as never,
      itemsByRetur.get(Number(r.id)) ?? [],
    ),
  );
  return { items, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

export { execute };
