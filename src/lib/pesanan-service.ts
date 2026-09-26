import "server-only";

import { query, execute, withTransaction } from "@/lib/db";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  AddKreditPembayaranInput,
  CreatePesananInput,
  CreateReturInput,
  KreditDTO,
  KreditPembayaranDTO,
  KurirDTO,
  PesananDTO,
  PesananItemDTO,
  PesananPaginationMeta,
  PesananProdukOption,
  PesananStatus,
  ReturDTO,
  ReturItemDTO,
  StatusPengiriman,
} from "@/lib/pesanan-types";
import { validatePromoVoucher } from "@/lib/promo-service";
import { catatKomisiPesanan } from "@/lib/komisi-service";
import { getUserByUsername } from "@/lib/user-service";
import { getPelanggan } from "@/lib/pelanggan-service";

// ---------------------------------------------------------------------------
// DTO mappers
// ---------------------------------------------------------------------------

export interface PesananRow {
  id: number;
  no_pesanan: string;
  asal_pesanan: "offline" | "commerce";
  pelanggan_id: number | null;
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
  cash_in: number | string | null;
  cash_out: number | string | null;
  catatan: string | null;
  created_at: Date;
  status_pengiriman: "Menunggu Kurir" | "Diantar" | "Selesai" | null;
  kurir_id: number | null;
  catatan_pengiriman: string | null;
  dikirim_at: Date | null;
  selesai_at: Date | null;
  // Pelanggan ter-join (LEFT JOIN pelanggan)
  pel_kode: string | null;
  pel_nama: string | null;
  pel_email: string | null;
  pel_telepon: string | null;
  pel_alamat: string | null;
  pel_kecamatan: string | null;
  pel_is_member: number | null;
  // Kurir ter-join (LEFT JOIN users)
  kurir_username: string | null;
  kurir_full_name: string | null;
  kurir_phone: string | null;
}

interface KurirRow extends RowDataPacket {
  id: number;
  username: string;
  full_name: string;
  phone: string | null;
  role: string;
}

export async function getKurirById(id: number | null): Promise<KurirDTO | null> {
  if (!id) return null;
  const { rows } = await query<KurirRow[]>(
    `SELECT id, username, full_name, phone, role FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  const r = rows[0];
  return r ? { id: r.id, username: r.username, fullName: r.full_name, phone: r.phone, role: r.role } : null;
}

const KURIR_ROLE = "kurir";

/** Daftar user ber-role kurir (aktif) — untuk dipilih saat memproses pengiriman. */
export async function listKurir(): Promise<KurirDTO[]> {
  const { rows } = await query<KurirRow[]>(
    `SELECT id, username, full_name, phone, role FROM users WHERE role = ? AND is_active = 1 ORDER BY full_name ASC`,
    [KURIR_ROLE],
  );
  return rows.map((r) => ({ id: r.id, username: r.username, fullName: r.full_name, phone: r.phone, role: r.role }));
}

export function toPesananDTO(row: PesananRow, items: PesananItemDTO[], kurir?: KurirDTO | null): PesananDTO {
  const pelanggan = row.pelanggan_id && row.pel_nama
    ? {
        id: row.pelanggan_id,
        kode: row.pel_kode ?? "",
        nama: row.pel_nama,
        email: row.pel_email,
        telepon: row.pel_telepon,
        alamat: row.pel_alamat,
        kecamatan: row.pel_kecamatan,
        isMember: row.pel_is_member === 1,
      }
    : null;
  return {
    id: row.id,
    noPesanan: row.no_pesanan,
    asal: row.asal_pesanan,
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
    cashIn: row.cash_in == null ? null : Number(row.cash_in),
    cashOut: row.cash_out == null ? null : Number(row.cash_out),
    catatan: row.catatan,
    createdAt: row.created_at.toISOString(),
    items,
    pelanggan,
    statusPengiriman: row.status_pengiriman,
    kurir: kurir ?? (row.kurir_full_name ? { id: row.kurir_id as number, username: row.kurir_username ?? "", fullName: row.kurir_full_name, phone: row.kurir_phone, role: "kurir" } : null),
    catatanPengiriman: row.catatan_pengiriman,
    dikirimAt: row.dikirim_at ? (row.dikirim_at instanceof Date ? row.dikirim_at.toISOString() : new Date(row.dikirim_at).toISOString()) : null,
    selesaiAt: row.selesai_at ? (row.selesai_at instanceof Date ? row.selesai_at.toISOString() : new Date(row.selesai_at).toISOString()) : null,
  };
}

export function toPesananItemDTO(row: {
  id: number;
  produk_id: number | null;
  produk_satuan_id?: number | null;
  satuan_nama?: string | null;
  nama_produk: string;
  qty: number;
  harga: number | string;
  subtotal: number | string;
}): PesananItemDTO {
  return {
    id: row.id,
    produkId: row.produk_id,
    produkSatuanId: row.produk_satuan_id ?? null,
    satuanNama: row.satuan_nama ?? null,
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

/** SELECT pesanan + LEFT JOIN pelanggan & kurir (utk DTO lengkap). */
const PESANAN_SELECT = `
  SELECT p.*,
         pg.kode AS pel_kode, pg.nama AS pel_nama, pg.email AS pel_email,
         pg.telepon AS pel_telepon, pg.alamat AS pel_alamat,
         pg.kecamatan AS pel_kecamatan, pg.is_member AS pel_is_member,
         u.username AS kurir_username, u.full_name AS kurir_full_name, u.phone AS kurir_phone
  FROM pesanan p
  LEFT JOIN pelanggan pg ON pg.id = p.pelanggan_id
  LEFT JOIN users u ON u.id = p.kurir_id`;

export function parsePesananListParams(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 50);
  const status = (params.get("status") ?? "").trim();
  const asal = (params.get("asal") ?? "").trim();
  const statusPengiriman = (params.get("statusPengiriman") ?? "").trim();
  const dateFrom = (params.get("dateFrom") ?? "").trim();
  const dateTo = (params.get("dateTo") ?? "").trim();
  const sortByRaw = params.get("sortBy") ?? "created_at";
  const sortBy = sortByRaw in PESANAN_SORT_COLUMNS ? sortByRaw : "created_at";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  // Jaga-jaga: tanggal akhir tidak boleh lebih kecil dari tanggal mulai.
  // Bila invalid, filter tanggal diabaikan (semua data) + flag peringatan.
  let dateRangeInvalid = false;
  if (dateFrom && dateTo && dateTo < dateFrom) {
    dateRangeInvalid = true;
    return { page, pageSize, search, status, asal, statusPengiriman, dateFrom: "", dateTo: "", sortBy, sortOrder, dateRangeInvalid };
  }
  return { page, pageSize, search, status, asal, statusPengiriman, dateFrom, dateTo, sortBy, sortOrder, dateRangeInvalid: false };
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
  if (opts.asal === "offline" || opts.asal === "commerce") {
    where.push("p.asal_pesanan = ?");
    params.push(opts.asal);
  }
  if (opts.statusPengiriman) {
    where.push("p.status_pengiriman = ?");
    params.push(opts.statusPengiriman);
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
    `${PESANAN_SELECT}
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
    `SELECT pi.id, pi.pesanan_id, pi.produk_id, pi.produk_satuan_id, s.nama AS satuan_nama,
            pi.nama_produk, pi.qty, pi.harga, pi.subtotal
     FROM pesanan_item pi
     LEFT JOIN produk_satuan ps ON ps.id = pi.produk_satuan_id
     LEFT JOIN satuan s ON s.id = ps.satuan_id
     WHERE pi.pesanan_id IN (${ids.map(() => "?").join(",")})
     ORDER BY pi.id ASC`,
    ids,
  );
  const byOrder = new Map<number, PesananItemDTO[]>();
  for (const r of itemResult.rows as RowDataPacket[]) {
    const dto = toPesananItemDTO(r as never);
    const list = byOrder.get(Number(r.pesanan_id)) ?? [];
    list.push(dto);
    byOrder.set(Number(r.pesanan_id), list);
  }

  const finalItems = rows.map((row) => toPesananDTO(row, byOrder.get(row.id) ?? []));
  return { items: finalItems, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

// ---------------------------------------------------------------------------
// Get single pesanan (detail + items)
// ---------------------------------------------------------------------------

export async function getPesananByNo(noPesanan: string): Promise<PesananDTO | null> {
  const { rows } = await query<PesananRow[]>(`${PESANAN_SELECT} WHERE p.no_pesanan = ? LIMIT 1`, [noPesanan]);
  const row = rows[0];
  if (!row) return null;
  const { rows: itemRows } = await query<RowDataPacket[]>(
    `SELECT pi.id, pi.produk_id, pi.produk_satuan_id, s.nama AS satuan_nama,
            pi.nama_produk, pi.qty, pi.harga, pi.subtotal
     FROM pesanan_item pi
     LEFT JOIN produk_satuan ps ON ps.id = pi.produk_satuan_id
     LEFT JOIN satuan s ON s.id = ps.satuan_id
     WHERE pi.pesanan_id = ? ORDER BY pi.id ASC`,
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

    // Asal pesanan & relasi pelanggan commerce.
    const asal = input.asal === "commerce" ? "commerce" : "offline";
    const isCommerce = asal === "commerce";
    const isKreditBayar = input.metodeBayar.trim().toLowerCase().startsWith("kredit");
    // Status utama:
    //  - commerce       → 'Diproses' (diproses + dikirim kurir)
    //  - kredit (POS)   → 'Diproses' — BELUM lunas, bukan 'Selesai'
    //  - lainnya (tunai dll) → 'Selesai'
    const statusUtama: PesananStatus = isCommerce || isKreditBayar ? "Diproses" : "Selesai";

    // Commerce WAJIB terkait pelanggan dari master (pelanggan_id), bukan input bebas.
    let pelangganId: number | null = null;
    if (isCommerce) {
      if (input.pelangganId == null || !Number.isInteger(input.pelangganId)) {
        throw new Error("PELANGGAN_REQUIRED");
      }
      // Validasi pelanggan terdaftar di master.
      const existing = await getPelanggan(input.pelangganId);
      if (!existing) throw new Error("PELANGGAN_NOT_FOUND");
      pelangganId = existing.id;
    }

    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO pesanan
        (no_pesanan, asal_pesanan, pelanggan_id, kasir_nama, kasir_username, status, metode_bayar, periode_kredit,
         voucher, diskon_persen, subtotal, diskon_amount, total, uang_diterima, kembalian, catatan,
         cash_in, cash_out, status_pengiriman, catatan_pengiriman)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generated,
        asal,
        pelangganId,
        kasir.nama,
        kasir.username,
        statusUtama,
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
        input.cashIn != null && Number.isFinite(Number(input.cashIn)) ? Number(input.cashIn) : null,
        input.cashOut != null && Number.isFinite(Number(input.cashOut)) ? Number(input.cashOut) : null,
        isCommerce ? "Menunggu Kurir" : null,
        null,
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
      // Satuan yg dipilih di form pesanan (produk_satuan_id) — dipakai utk
      // mengurangi stok dari satuan yg benar & mencatat nama satuan snapshot.
      let produkSatuanId: number | null = null;
      let satuanNama: string | null = null;
      const rawPsId = it.produkSatuanId;
      if (rawPsId && Number.isInteger(Number(rawPsId)) && Number(rawPsId) > 0) {
        const psIdNum = Number(rawPsId);
        // Pastikan satuan milik produk ini (bila produkId diketahui).
        const psWhere = produkId != null ? "ps.id = ? AND ps.produk_id = ?" : "ps.id = ?";
        const psArgs = produkId != null ? [psIdNum, produkId] : [psIdNum];
        const [psRows] = await conn.query<RowDataPacket[]>(
          `SELECT ps.id, s.nama AS satuan_nama FROM produk_satuan ps JOIN satuan s ON s.id = ps.satuan_id WHERE ${psWhere} LIMIT 1`,
          psArgs,
        );
        const ps = psRows[0] as { id: number; satuan_nama: string } | undefined;
        if (ps) {
          produkSatuanId = ps.id;
          satuanNama = ps.satuan_nama;
        }
      }
      await conn.query(
        `INSERT INTO pesanan_item (pesanan_id, produk_id, produk_satuan_id, nama_produk, qty, harga, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, produkId, produkSatuanId, it.namaProduk, it.qty, it.harga, it.harga * it.qty],
      );

      // Kurangi stok dari satuan terpilih (bila ada & produk dikenal).
      if (produkSatuanId != null) {
        await mutasiStokPesanan(conn, produkSatuanId, it.qty, `${generated} — jual ${it.namaProduk} (${satuanNama ?? ""})`);
      } else if (produkId != null) {
        // Fallback legacy (tanpa satuan): kurangi dari satuan stok > 0 (FIFO per satuan).
        await kurangiStokProdukOtomatis(conn, produkId, it.qty, `${generated} — jual ${it.namaProduk}`);
      }

      // Catat qty terjual ke konsinyasi AKTIF utk produk ini (first-in) bila ada.
      if (produkId != null) {
        await catatTerjualKonsinyasi(conn, produkId, produkSatuanId, it.qty, generated);
      }
    }

    return generated;
  });
  // Baca ulang SETELAH commit — di dalam transaksi, koneksi pool lain bisa
  // membaca state pre-commit sehingga hasil tampak null/tidak berubah.
  return getPesananByNo(noPesanan);
}

/** Kurangi qty stok satuan (pastikan tidak negatif) + catat history. */
async function mutasiStokPesanan(conn: PoolConnection, produkSatuanId: number, qty: number, catatan: string): Promise<void> {
  if (qty <= 0) return;
  const [stokRows] = await conn.query<RowDataPacket[]>(
    `SELECT id, qty FROM stok WHERE produk_satuan_id = ? LIMIT 1`,
    [produkSatuanId],
  );
  let stok = stokRows[0] as { id: number; qty: number } | undefined;
  if (!stok) return; // tak ada stok utk satuan ini → biarkan (pesanan tetap jalan)
  const delta = -Math.min(qty, stok.qty);
  if (delta === 0) return;
  const qtyBaru = stok.qty + delta;
  await conn.query(`UPDATE stok SET qty = ? WHERE id = ?`, [qtyBaru, stok.id]);
  await conn.query(
    `INSERT INTO stok_history (stok_id, tipe, qty_delta, qty_sebelum, qty_sesudah, catatan)
     VALUES (?, 'out', ?, ?, ?, ?)`,
    [stok.id, delta, stok.qty, qtyBaru, catatan.slice(0, 255)],
  );
}

/** Legacy tanpa satuan: kurangi dari satuan2 produk yg punya stok (FIFO by harga). */
async function kurangiStokProdukOtomatis(conn: PoolConnection, produkId: number, qty: number, catatan: string): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ps.id, COALESCE(st.qty, 0) AS qty
     FROM produk_satuan ps
     LEFT JOIN stok st ON st.produk_satuan_id = ps.id
     WHERE ps.produk_id = ? ORDER BY ps.harga ASC, ps.id ASC`,
    [produkId],
  );
  let sisa = qty;
  for (const r of rows as Array<{ id: number; qty: number }>) {
    if (sisa <= 0) break;
    const ambil = Math.min(sisa, r.qty);
    if (ambil > 0) {
      await mutasiStokPesanan(conn, r.id, ambil, catatan);
      sisa -= ambil;
    }
  }
}

/** Catat qty terjual ke konsinyasi aktif (first-in) utk produk & satuan tsb. */
async function catatTerjualKonsinyasi(conn: PoolConnection, produkId: number, produkSatuanId: number | null, qty: number, noPesanan: string): Promise<void> {
  if (qty <= 0) return;
  // Konsinyasi aktif yg itemnya memuat produk ini (dan satuan cocok bila ada).
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ki.id, ki.qty_konsinyasi, ki.qty_terjual, ki.qty_dikembalikan, k.no_konsinyasi
     FROM konsinyasi_item ki
     JOIN konsinyasi k ON k.id = ki.konsinyasi_id AND k.status = 'aktif'
     WHERE ki.produk_id = ?
       AND (ki.produk_satuan_id = ? OR (? IS NULL AND ki.produk_satuan_id IS NULL))
     ORDER BY k.tanggal ASC, k.id ASC`,
    [produkId, produkSatuanId, produkSatuanId],
  );
  let sisa = qty;
  for (const r of rows as Array<{ id: number; qty_konsinyasi: number; qty_terjual: number; qty_dikembalikan: number; no_konsinyasi: string }>) {
    if (sisa <= 0) break;
    const sisaKuota = Math.max(0, r.qty_konsinyasi - r.qty_terjual - r.qty_dikembalikan);
    const catat = Math.min(sisa, sisaKuota);
    if (catat > 0) {
      await conn.query(`UPDATE konsinyasi_item SET qty_terjual = qty_terjual + ? WHERE id = ?`, [catat, r.id]);
      sisa -= catat;
    }
  }
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

      // Kembalikan efek penjualan atas stok — kebalikan dari yang dicatat saat
      // pesanan dibuat: stok satuan +qty (stok_history 'in') dan hitungan
      // qty_terjual konsinyasi aktif dibatalkan.
      const pi = await resolvePesananItemRetur(conn, pesananId, it.pesananItemId ?? null, it.namaProduk);
      if (pi) {
        // Tujuan pengembalian stok: satuan asal; fallback legacy (pesanan_item
        // tanpa satuan) = satuan pertama urutan FIFO (kebalikan kurangiStokProdukOtomatis).
        let stokSatuanId = pi.produk_satuan_id;
        if (stokSatuanId == null && pi.produk_id != null) {
          const [psRows] = await conn.query<RowDataPacket[]>(
            `SELECT ps.id FROM produk_satuan ps WHERE ps.produk_id = ? ORDER BY ps.harga ASC, ps.id ASC LIMIT 1`,
            [pi.produk_id],
          );
          stokSatuanId = (psRows as Array<{ id: number }>)[0]?.id ?? null;
        }
        if (stokSatuanId != null) {
          await kembalikanStokRetur(conn, stokSatuanId, it.qty, `${noRetur} — retur ${it.namaProduk}`);
        }
        // Pencatatan terjual konsinyasi memakai produk_satuan_id pesanan_item
        // apa adanya (bisa null) — pembatalannya harus memakai nilai yang sama.
        if (pi.produk_id != null) {
          await batalkanTerjualKonsinyasi(conn, pi.produk_id, pi.produk_satuan_id, it.qty);
        }
      }
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

/** Cari pesanan_item terkait item retur (untuk resolusi stok & konsinyasi). */
async function resolvePesananItemRetur(
  conn: PoolConnection,
  pesananId: number,
  pesananItemId: number | null,
  namaProduk: string,
): Promise<{ produk_id: number | null; produk_satuan_id: number | null } | null> {
  if (pesananItemId != null) {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT produk_id, produk_satuan_id FROM pesanan_item WHERE id = ? AND pesanan_id = ? LIMIT 1`,
      [pesananItemId, pesananId],
    );
    const r = rows[0] as { produk_id: number | null; produk_satuan_id: number | null } | undefined;
    if (r) return r;
  }
  // Fallback: item retur tanpa pesananItemId — cocokkan nama produk pada pesanan
  // yang sama (bisa ambigu bila nama sama dengan satuan berbeda; jalur UI selalu
  // mengirim pesananItemId sehingga fallback ini jarang dipakai).
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT produk_id, produk_satuan_id FROM pesanan_item
     WHERE pesanan_id = ? AND nama_produk = ? LIMIT 1`,
    [pesananId, namaProduk],
  );
  const r = rows[0] as { produk_id: number | null; produk_satuan_id: number | null } | undefined;
  return r ?? null;
}

/** Kembalikan qty stok akibat retur (kebalikan mutasiStokPesanan) + catat history. */
async function kembalikanStokRetur(
  conn: PoolConnection,
  produkSatuanId: number,
  qty: number,
  catatan: string,
): Promise<void> {
  if (qty <= 0) return;
  const [stokRows] = await conn.query<RowDataPacket[]>(
    `SELECT id, qty FROM stok WHERE produk_satuan_id = ? LIMIT 1`,
    [produkSatuanId],
  );
  let stok = stokRows[0] as { id: number; qty: number } | undefined;
  if (!stok) {
    const [ins] = await conn.query<ResultSetHeader>(
      `INSERT INTO stok (produk_satuan_id, qty, buffer_stok) VALUES (?, 0, 0)`,
      [produkSatuanId],
    );
    stok = { id: ins.insertId, qty: 0 };
  }
  const qtyBaru = stok.qty + qty;
  await conn.query(`UPDATE stok SET qty = ? WHERE id = ?`, [qtyBaru, stok.id]);
  await conn.query(
    `INSERT INTO stok_history (stok_id, tipe, qty_delta, qty_sebelum, qty_sesudah, catatan)
     VALUES (?, 'in', ?, ?, ?, ?)`,
    [stok.id, qty, stok.qty, qtyBaru, catatan.slice(0, 255)],
  );
}

/**
 * Batalkan hitungan qty terjual konsinyasi akibat retur (kebalikan
 * catatTerjualKonsinyasi). Hanya menyentuh konsinyasi AKTIF — yang sudah
 * 'selesai' dianggap sudah diselesaikan dengan supplier dan tidak ditarik
 * kembali. Urutan pengurangan mengikuti pencatatan (first-in), sehingga agregat
 * per produk+satuan tetap konsisten walau atribusi per konsinyasi tidak eksak.
 */
async function batalkanTerjualKonsinyasi(
  conn: PoolConnection,
  produkId: number,
  produkSatuanId: number | null,
  qty: number,
): Promise<void> {
  if (qty <= 0) return;
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ki.id, ki.qty_terjual
     FROM konsinyasi_item ki
     JOIN konsinyasi k ON k.id = ki.konsinyasi_id AND k.status = 'aktif'
     WHERE ki.produk_id = ?
       AND (ki.produk_satuan_id = ? OR (? IS NULL AND ki.produk_satuan_id IS NULL))
     ORDER BY k.tanggal ASC, k.id ASC`,
    [produkId, produkSatuanId, produkSatuanId],
  );
  let sisa = qty;
  for (const r of rows as Array<{ id: number; qty_terjual: number }>) {
    if (sisa <= 0) break;
    const kembalikan = Math.min(sisa, r.qty_terjual);
    if (kembalikan > 0) {
      await conn.query(`UPDATE konsinyasi_item SET qty_terjual = qty_terjual - ? WHERE id = ?`, [
        kembalikan,
        r.id,
      ]);
      sisa -= kembalikan;
    }
  }
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
  const base = rows as Array<{ produk_id: number; sku: string; nama: string; harga: number; stok: number }>;
  // Load satuan utk semua produk hasil (sekali query).
  const ids = base.map((r) => r.produk_id);
  const satuanMap = new Map<number, Array<{ produkSatuanId: number; satuanNama: string; harga: number }>>();
  if (ids.length) {
    const { rows: satRows } = await query<RowDataPacket[]>(
      `SELECT ps.id AS ps_id, ps.produk_id AS pid, s.nama AS satuan_nama, ps.harga
       FROM produk_satuan ps JOIN satuan s ON s.id = ps.satuan_id
       WHERE ps.produk_id IN (${ids.map(() => "?").join(",")})
       ORDER BY ps.id ASC`,
      ids,
    );
    for (const r of satRows as Array<{ ps_id: number; pid: number; satuan_nama: string; harga: number }>) {
      const list = satuanMap.get(r.pid) ?? [];
      list.push({ produkSatuanId: Number(r.ps_id), satuanNama: r.satuan_nama, harga: Number(r.harga) });
      satuanMap.set(r.pid, list);
    }
  }
  return base.map((r) => ({
    produkId: Number(r.produk_id),
    sku: r.sku as string,
    nama: r.nama as string,
    harga: Number(r.harga),
    stok: Number(r.stok),
    satuan: satuanMap.get(Number(r.produk_id)) ?? [],
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
  // Sama dgn pesanan: tanggal akhir tidak boleh < tanggal mulai → abaikan filter.
  let dateRangeInvalid = false;
  if (dateFrom && dateTo && dateTo < dateFrom) {
    dateRangeInvalid = true;
    return { page, pageSize, search, dateFrom: "", dateTo: "", sortBy, sortOrder, dateRangeInvalid };
  }
  return { page, pageSize, search, dateFrom, dateTo, sortBy, sortOrder, dateRangeInvalid: false };
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
    dateRangeInvalid: false,
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
    // Bila angsuran ini melunasi seluruh sisa → tandai pesanan 'Selesai'.
    if (input.jumlah >= sisa) {
      await conn.query(`UPDATE pesanan SET status = 'Selesai' WHERE id = ?`, [pesanan.id]);
    }
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

// ---------------------------------------------------------------------------
// Commerce — proses pengiriman (assign kurir & ubah status pengiriman)
// ---------------------------------------------------------------------------

/**
 * Assign kurir / ubah status pengiriman untuk pesanan commerce.
 * - kurirId diberikan & status menjadi 'Diantar' (atau status yang diminta)
 * - status 'Selesai' → set selesai_at
 * Hanya berlaku utk pesanan asal='commerce'.
 */
export async function updatePengirimanPesanan(
  noPesanan: string,
  input: { kurirId?: number | null; statusPengiriman?: StatusPengiriman },
): Promise<PesananDTO | null> {
  const pesanan = await getPesananByNo(noPesanan);
  if (!pesanan) return null;
  if (pesanan.asal !== "commerce") throw new Error("NOT_COMMERCE");

  const sets: string[] = [];
  const args: unknown[] = [];

  if (input.kurirId !== undefined) {
    // Validasi kurir adalah user aktif role kurir.
    const kurir = await getKurirById(input.kurirId);
    if (input.kurirId != null && (!kurir || kurir.role !== "kurir")) throw new Error("INVALID_KURIR");
    sets.push("kurir_id = ?");
    args.push(input.kurirId ?? null);
  }

  if (input.statusPengiriman !== undefined) {
    sets.push("status_pengiriman = ?");
    args.push(input.statusPengiriman);
    // Transisi otomatis status utama & timestamp.
    if (input.statusPengiriman === "Diantar") {
      sets.push("dikirim_at = NOW()");
      sets.push("status = 'Diproses'");
    } else if (input.statusPengiriman === "Selesai") {
      sets.push("selesai_at = NOW()");
      sets.push("status = 'Selesai'");
    } else if (input.statusPengiriman === "Menunggu Kurir") {
      sets.push("kurir_id = NULL");
      sets.push("dikirim_at = NULL");
      sets.push("selesai_at = NULL");
      sets.push("status = 'Diproses'");
    }
  } else if (input.kurirId !== undefined && input.kurirId != null) {
    // Assign kurir tanpa status eksplisit → otomatis Diantar.
    sets.push("status_pengiriman = 'Diantar'");
    sets.push("dikirim_at = NOW()");
    sets.push("status = 'Diproses'");
  }

  if (sets.length === 0) return pesanan;
  await execute(`UPDATE pesanan SET ${sets.join(", ")} WHERE no_pesanan = ?`, [...args, noPesanan]);
  return getPesananByNo(noPesanan);
}

export { execute };
