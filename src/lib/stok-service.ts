import "server-only";

import { query, execute, withTransaction } from "@/lib/db";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  StokDTO,
  StokHistoryDTO,
  StokPaginationMeta,
  StokSatuanDTO,
} from "@/lib/stok-types";

// ---------------------------------------------------------------------------
// Auto-create stok rows when produk_satuan rows are inserted.
// Called inside the same transaction as createProdukTx / updateProdukTx so a
// product always has a stok row per satuan (task #4).
// ---------------------------------------------------------------------------

export async function insertStokForProdukSatuan(
  conn: PoolConnection,
  produkSatuanIds: number[],
): Promise<void> {
  if (produkSatuanIds.length === 0) return;
  await conn.query(
    `INSERT INTO stok (produk_satuan_id, qty, buffer_stok) VALUES ${produkSatuanIds
      .map(() => "(?, 0, 0)")
      .join(", ")}`,
    produkSatuanIds,
  );
}

/** Get the freshly-inserted produk_satuan ids for a product (in insert order). */
export async function getProdukSatuanIdsByProdukId(
  conn: PoolConnection,
  produkId: number,
): Promise<number[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM produk_satuan WHERE produk_id = ? ORDER BY id ASC`,
    [produkId],
  );
  return (rows as Array<{ id: number }>).map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

export interface StokRow {
  produk_id: number;
  sku: string;
  nama: string;
  kategori_kode: string;
  kategori_nama: string;
  merk_kode: string;
  merk_nama: string;
  status: "active" | "inactive";
  gambar_url: string | null;
  satuan_kode: string;
  satuan_nama: string;
  jumlah_unit: number;
  kode_item: string;
  harga: string; // DECIMAL → string
  qty: number;
  buffer_stok: number;
  batas_bawah: number | null;
}

export function toStokSatuanDTO(row: StokRow): StokSatuanDTO {
  const batasBawah = row.batas_bawah ?? null;
  return {
    satuanKode: row.satuan_kode,
    satuanNama: row.satuan_nama,
    jumlahUnit: row.jumlah_unit,
    kodeItem: row.kode_item,
    harga: Number(row.harga),
    qty: row.qty,
    bufferStok: row.buffer_stok,
    batasBawah,
    isLow: batasBawah !== null && row.qty <= batasBawah,
  };
}

export function toStokDTO(rows: StokRow[]): StokDTO | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const satuan = rows.map(toStokSatuanDTO);
  return {
    sku: first.sku,
    nama: first.nama,
    kategoriKode: first.kategori_kode,
    kategoriNama: first.kategori_nama,
    merkKode: first.merk_kode,
    merkNama: first.merk_nama,
    status: first.status,
    gambarUrl: first.gambar_url ?? "",
    totalQty: satuan.reduce((sum, s) => sum + s.qty, 0),
    totalBuffer: satuan.reduce((sum, s) => sum + s.bufferStok, 0),
    isLow: satuan.some((s) => s.isLow),
    satuan,
  };
}

// ---------------------------------------------------------------------------
// List (dengan pagination, search, filter, sort)
// ---------------------------------------------------------------------------

const STOK_SELECT = `
  SELECT p.id AS produk_id, p.sku, p.nama, p.status, p.gambar_url,
         k.kode AS kategori_kode, k.nama AS kategori_nama,
         m.kode AS merk_kode, m.nama AS merk_nama,
         s.kode AS satuan_kode, s.nama AS satuan_nama, s.jumlah_unit,
         ps.kode_item, ps.harga,
         st.qty, st.buffer_stok, st.batas_bawah
  FROM stok st
  JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
  JOIN produk p ON p.id = ps.produk_id
  JOIN kategori k ON k.id = p.kategori_id
  JOIN merk m ON m.id = p.merk_id
  JOIN satuan s ON s.id = ps.satuan_id`;

const STOK_SORT_COLUMNS: Record<string, string> = {
  sku: "p.sku",
  nama: "p.nama",
  kategori: "k.nama",
  // Total per produk = agregat SEMUA satuan (dihitung via SUM di query halaman).
  totalQty: "total_qty",
  totalBuffer: "total_buffer",
};

export function parseStokListParams(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 100);
  const kategoriKode = (params.get("kategoriKode") ?? "").trim();
  const merkKode = (params.get("merkKode") ?? "").trim();
  const statusRaw = params.get("status");
  const status =
    statusRaw === "inactive" || statusRaw === "active" ? statusRaw : "";
  const lowOnly = params.get("lowOnly") === "1" || params.get("lowOnly") === "true";
  const sortByRaw = params.get("sortBy") ?? "nama";
  const sortBy = sortByRaw in STOK_SORT_COLUMNS ? sortByRaw : "nama";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  return { page, pageSize, search, kategoriKode, merkKode, status, lowOnly, sortBy, sortOrder };
}

function buildMeta(total: number, page: number, pageSize: number): StokPaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Grouped list — returns one StokDTO per produk, with per-satuan rows inside.
 * `lowOnly` filters to products that have at least one low satuan.
 */
export async function listStok(
  opts: ReturnType<typeof parseStokListParams>,
): Promise<{ items: StokDTO[]; pagination: StokPaginationMeta }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.search) {
    where.push("(p.sku LIKE ? OR p.nama LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.kategoriKode) {
    where.push("k.kode = ?");
    params.push(opts.kategoriKode);
  }
  if (opts.merkKode) {
    where.push("m.kode = ?");
    params.push(opts.merkKode);
  }
  if (opts.status) {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Count distinct products matching the filters.
  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM stok st
     JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
     JOIN produk p ON p.id = ps.produk_id
     JOIN kategori k ON k.id = p.kategori_id
     JOIN merk m ON m.id = p.merk_id
     ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  // Page of distinct product ids (deterministic ordering).
  // totalQty/totalBuffer diurutkan berdasarkan AGREGAT seluruh satuan produk
  // (bukan satu baris satuan), sehingga sorting kolom total benar.
  const sortColumn = STOK_SORT_COLUMNS[opts.sortBy] ?? "p.nama";
  const dir = opts.sortOrder === "asc" ? "ASC" : "DESC";
  const offset = (opts.page - 1) * opts.pageSize;
  const pageResult = await query<RowDataPacket[]>(
    `SELECT p.id,
            COALESCE(SUM(st.qty), 0) AS total_qty,
            COALESCE(SUM(st.buffer_stok), 0) AS total_buffer,
            MIN(p.nama) AS nama, MIN(p.sku) AS sku,
            MIN(k.nama) AS kategori
     FROM stok st
     JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
     JOIN produk p ON p.id = ps.produk_id
     JOIN kategori k ON k.id = p.kategori_id
     JOIN merk m ON m.id = p.merk_id
     ${whereSql}
     GROUP BY p.id
     ORDER BY ${sortColumn} ${dir}, p.id ${dir}
     LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  const orderedIds = (pageResult.rows as Array<{ id: number }>).map((r) => Number(r.id));
  if (orderedIds.length === 0) {
    return { items: [], pagination: buildMeta(total, opts.page, opts.pageSize) };
  }

  const { rows } = await query<StokRow[]>(
    `${STOK_SELECT}
     WHERE p.id IN (${orderedIds.map(() => "?").join(",")})
     ORDER BY p.id ASC, st.id ASC`,
    orderedIds,
  );

  // Group baris per produk (produk_id) → satu StokDTO per produk.
  const groups = new Map<number, StokRow[]>();
  for (const row of rows) {
    const key = Number(row.produk_id);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  // Kembalikan SESUAI urutan hasil sorting dari query halaman — query detail di
  // atas selalu ORDER BY p.id, jadi urutan asli harus dipulihkan di sini.
  const items = orderedIds
    .map((id) => {
      const group = groups.get(id);
      return group ? toStokDTO(group) : null;
    })
    .filter((d): d is StokDTO => d !== null);

  const filtered = opts.lowOnly ? items.filter((d) => d.isLow) : items;

  return { items: filtered, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

// ---------------------------------------------------------------------------
// Single product stock
// ---------------------------------------------------------------------------

export async function getStokBySku(sku: string): Promise<StokDTO | null> {
  const { rows } = await query<StokRow[]>(`${STOK_SELECT} WHERE p.sku = ? ORDER BY st.id ASC`, [sku]);
  return toStokDTO(rows);
}

// ---------------------------------------------------------------------------
// Mutasi stok (PATCH) — update qty / buffer / batas bawah per satuan,
// mencatat stok_history untuk setiap perubahan qty.
// ---------------------------------------------------------------------------

export interface StokMutationInput {
  catatan?: string;
  satuan: Array<{
    satuanKode: string;
    qty?: number;
    bufferStok?: number;
    batasBawah?: number | null;
  }>;
}

export async function updateStokBySku(sku: string, input: StokMutationInput): Promise<StokDTO | null> {
  const found = await withTransaction<boolean>(async (conn) => {
    // Resolve product + its produk_satuan rows.
    const [produkRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM produk WHERE sku = ? LIMIT 1`,
      [sku],
    );
    const produk = (produkRows as Array<{ id: number }>)[0];
    if (!produk) return false;

    const [psRows] = await conn.query<RowDataPacket[]>(
      `SELECT ps.id, s.kode AS satuan_kode
       FROM produk_satuan ps JOIN satuan s ON s.id = ps.satuan_id
       WHERE ps.produk_id = ?`,
      [produk.id],
    );
    const psByKode = new Map<string, number>(
      (psRows as Array<{ id: number; satuan_kode: string }>).map((r) => [r.satuan_kode, r.id]),
    );

    for (const row of input.satuan) {
      const psId = psByKode.get(row.satuanKode);
      if (!psId) continue; // satuan not configured for this product — skip

      // Current stok row.
      let stok = (
        await conn.query<RowDataPacket[]>(
          `SELECT id, qty, buffer_stok, batas_bawah FROM stok WHERE produk_satuan_id = ? LIMIT 1`,
          [psId],
        )
      )[0][0] as { id: number; qty: number; buffer_stok: number; batas_bawah: number | null } | undefined;
      if (!stok) {
        // Defensive: row missing (e.g. created before migration) — create it.
        const [ins] = await conn.query<ResultSetHeader>(
          `INSERT INTO stok (produk_satuan_id, qty, buffer_stok) VALUES (?, 0, 0)`,
          [psId],
        );
        stok = (
          await conn.query<RowDataPacket[]>(
            `SELECT id, qty, buffer_stok, batas_bawah FROM stok WHERE id = ? LIMIT 1`,
            [ins.insertId],
          )
        )[0][0] as { id: number; qty: number; buffer_stok: number; batas_bawah: number | null };
      }

      const sets: string[] = [];
      const setParams: unknown[] = [];
      if (row.qty !== undefined) {
        if (row.qty < 0) {
          throw new StokValidationError("NEGATIVE_STOCK", `Stok tidak boleh negatif untuk satuan ${row.satuanKode}.`);
        }
        sets.push("qty = ?");
        setParams.push(row.qty);
      }
      if (row.bufferStok !== undefined) {
        if (row.bufferStok < 0) {
          throw new StokValidationError("VALIDATION_ERROR", `Stok cadangan tidak boleh negatif.`);
        }
        sets.push("buffer_stok = ?");
        setParams.push(row.bufferStok);
      }
      if (row.batasBawah !== undefined) {
        if (row.batasBawah !== null && row.batasBawah < 0) {
          throw new StokValidationError("VALIDATION_ERROR", `Batas bawah tidak boleh negatif.`);
        }
        sets.push("batas_bawah = ?");
        setParams.push(row.batasBawah);
      }

      if (sets.length > 0) {
        await conn.query(`UPDATE stok SET ${sets.join(", ")} WHERE id = ?`, [...setParams, stok.id]);
      }

      // History: only when qty actually changed.
      if (row.qty !== undefined && row.qty !== stok.qty) {
        const delta = row.qty - stok.qty;
        const tipe = delta > 0 ? "in" : "out";
        await conn.query(
          `INSERT INTO stok_history (stok_id, tipe, qty_delta, qty_sebelum, qty_sesudah, catatan)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [stok.id, tipe, delta, stok.qty, row.qty, input.catatan?.slice(0, 255) ?? null],
        );
      }
    }
    return true;
  });
  // Baca ulang SETELAH commit — di dalam transaksi, koneksi pool lain bisa
  // membaca state pre-commit sehingga hasil update tampak tidak berubah.
  if (!found) return null;
  return getStokBySku(sku);
}

/**
 * Hapus data stok produk (semua satuan + riwayat, cascade) — fitur "Hapus Stok".
 * Baris `produk_satuan` TIDAK disentuh (satuan melekat di produk); stok bisa
 * dibuat ulang lewat edit stok / mutasi berikutnya.
 */
export async function deleteStokBySku(sku: string): Promise<boolean> {
  return withTransaction<boolean>(async (conn) => {
    const [produkRows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM produk WHERE sku = ? LIMIT 1`,
      [sku],
    );
    const produk = (produkRows as Array<{ id: number }>)[0];
    if (!produk) return false;
    await conn.query(
      `DELETE st FROM stok st
       JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
       WHERE ps.produk_id = ?`,
      [produk.id],
    );
    return true;
  });
}

export class StokValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StokValidationError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// History (riwayat stok) — per produk, terbaru dulu.
// ---------------------------------------------------------------------------

export async function listStokHistory(
  sku: string,
  limit = 50,
): Promise<StokHistoryDTO[]> {
  const { rows } = await query<RowDataPacket[]>(
    `SELECT h.id, h.tipe, h.qty_delta, h.qty_sebelum, h.qty_sesudah, h.catatan, h.created_at,
            p.sku, p.nama, s.nama AS satuan_nama, ps.kode_item
     FROM stok_history h
     JOIN stok st ON st.id = h.stok_id
     JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
     JOIN produk p ON p.id = ps.produk_id
     JOIN satuan s ON s.id = ps.satuan_id
     WHERE p.sku = ?
     ORDER BY h.id DESC
     LIMIT ?`,
    [sku, Math.min(500, Math.max(1, limit))],
  );
  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    tipe: r.tipe as "in" | "out" | "adjust",
    qtyDelta: Number(r.qty_delta),
    qtySebelum: Number(r.qty_sebelum),
    qtySesudah: Number(r.qty_sesudah),
    catatan: r.catatan as string | null,
    createdAt: (r.created_at as Date).toISOString(),
    sku: r.sku as string,
    nama: r.nama as string,
    satuanNama: r.satuan_nama as string,
    kodeItem: r.kode_item as string,
  }));
}

// ---------------------------------------------------------------------------
// Bulk update stok (CSV): template SKU, Satuan, Stok Baru, Catatan
// ---------------------------------------------------------------------------

export async function bulkUpdateStok(
  rows: Array<{ sku: string; qty: number; satuan?: string; catatan?: string }>,
): Promise<{ success: number; failures: Array<{ row: number; sku: string; message: string }> }> {
  let success = 0;
  const failures: Array<{ row: number; sku: string; message: string }> = [];
  // Sequential — bulk is admin-initiated and modest in size; keeps history
  // ordering deterministic and avoids thundering the connection pool.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const stok = await getStokBySku(row.sku);
      if (!stok) {
        failures.push({ row: i + 1, sku: row.sku, message: "Produk tidak ditemukan — stok tidak dapat dibuat untuk SKU yang belum ada. Buat produknya terlebih dahulu." });
        continue;
      }
      if (stok.satuan.length === 0) {
        failures.push({ row: i + 1, sku: row.sku, message: "Produk belum memiliki satuan — tambahkan satuan lewat menu Produk." });
        continue;
      }

      // Resolve satuan tujuan: by nama (flexible) atau by kode; default satuan pertama.
      let target = stok.satuan[0];
      if (row.satuan && row.satuan.trim()) {
        const q = row.satuan.trim();
        const byNama = stok.satuan.find((s) => s.satuanNama.toLowerCase() === q.toLowerCase());
        const byKode = stok.satuan.find((s) => s.satuanKode.toLowerCase() === q.toLowerCase());
        const found = byNama ?? byKode;
        if (!found) {
          const available = stok.satuan.map((s) => `${s.satuanNama} (${s.satuanKode})`).join(", ");
          failures.push({ row: i + 1, sku: row.sku, message: `Satuan "${row.satuan}" tidak ada pada produk ini. Satuan tersedia: ${available}.` });
          continue;
        }
        target = found;
      }

      const updated = await updateStokBySku(row.sku, {
        catatan: row.catatan,
        satuan: [{ satuanKode: target.satuanKode, qty: row.qty }],
      });
      if (!updated) {
        failures.push({ row: i + 1, sku: row.sku, message: "Produk tidak ditemukan." });
        continue;
      }
      success++;
    } catch (err) {
      const msg = err instanceof StokValidationError ? err.message : "Gagal memperbarui stok.";
      failures.push({ row: i + 1, sku: row.sku, message: msg });
    }
  }
  return { success, failures };
}

export { execute };
