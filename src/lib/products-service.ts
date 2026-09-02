import "server-only";

import { query, execute, withTransaction } from "@/lib/db";
import type { ListResponse, PaginationMeta, SatuanDTO, MerkDTO, KategoriDTO, ProdukDTO, ProdukSatuanDTO } from "@/lib/product-types";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

// ---------------------------------------------------------------------------
// DTO mappers (DB row → API shape). Kept here because Next 16 route files
// may only export HTTP handlers.
// ---------------------------------------------------------------------------

export function toSatuanDTO(row: {
  kode: string;
  nama: string;
  jumlah_unit: number | null;
  is_active: number;
  created_at: Date;
}): SatuanDTO {
  return {
    kode: row.kode,
    nama: row.nama,
    jumlahUnit: row.jumlah_unit ?? 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at.toISOString(),
  };
}

export function toMerkDTO(row: { kode: string; nama: string; is_active: number; created_at: Date }): MerkDTO {
  return { kode: row.kode, nama: row.nama, isActive: row.is_active === 1, createdAt: row.created_at.toISOString() };
}

export function toKategoriDTO(row: { kode: string; nama: string; is_active: number; created_at: Date }): KategoriDTO {
  return { kode: row.kode, nama: row.nama, isActive: row.is_active === 1, createdAt: row.created_at.toISOString() };
}

export function toProdukSatuanDTO(row: ProdukSatuanRow): ProdukSatuanDTO {
  return {
    id: row.id,
    satuanKode: row.satuan_kode,
    satuanNama: row.satuan_nama,
    jumlahUnit: row.jumlah_unit,
    kodeItem: row.kode_item,
    harga: Number(row.harga),
  };
}

export function toProdukDTO(row: ProdukRow, satuanRows: ProdukSatuanRow[]): ProdukDTO {
  return {
    id: row.id,
    sku: row.sku,
    nama: row.nama,
    deskripsi: row.deskripsi ?? "",
    gambarUrl: row.gambar_url ?? "",
    kategoriKode: row.kategori_kode,
    kategoriNama: row.kategori_nama,
    merkKode: row.merk_kode,
    merkNama: row.merk_nama,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    satuan: satuanRows.map(toProdukSatuanDTO),
  };
}


// ---------------------------------------------------------------------------
// Shared reference-table service (satuan / merk / kategori are the same shape
// except satuan has jumlah_unit). One implementation, three resources.
// ---------------------------------------------------------------------------

export interface ReferenceRow {
  id: number;
  kode: string;
  nama: string;
  jumlah_unit: number | null;
  is_active: number;
  created_at: Date;
}

export type ReferenceTable = "satuan" | "merk" | "kategori";

interface ListOptions {
  page: number;
  pageSize: number;
  search: string;
  sortBy: "kode" | "nama" | "created_at";
  sortOrder: "asc" | "desc";
  activeOnly?: boolean;
}

function parsePagination(params: URLSearchParams): { page: number; pageSize: number; search: string } {
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  const search = (params.get("search") ?? "").trim().slice(0, 100);
  return { page, pageSize, search };
}

function parseSort(params: URLSearchParams, allowed: string[], fallback: string): { sortBy: string; sortOrder: "asc" | "desc" } {
  const sortByRaw = params.get("sortBy") ?? fallback;
  const sortBy = allowed.includes(sortByRaw) ? sortByRaw : fallback;
  const sortOrder = params.get("sortOrder") === "desc" ? "desc" : "asc";
  return { sortBy, sortOrder };
}

export function parseListParams(
  params: URLSearchParams,
  sortFields: string[],
  defaultSort: string,
): ListOptions & { page: number; pageSize: number; search: string } {
  const { page, pageSize, search } = parsePagination(params);
  const { sortBy, sortOrder } = parseSort(params, sortFields, defaultSort);
  const activeOnly = params.get("activeOnly") === "1" || params.get("activeOnly") === "true";
  return { page, pageSize, search, sortBy, sortOrder, activeOnly } as ListOptions & { page: number; pageSize: number; search: string };
}

/** Whitelisted identifiers only — never interpolate user input into ORDER BY. */
function buildMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function listReference(
  table: ReferenceTable,
  opts: ListOptions,
): Promise<ListResponse<ReferenceRow>> {
  const offset = (opts.page - 1) * opts.pageSize;
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.search) {
    where.push("(kode LIKE ? OR nama LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.activeOnly) {
    where.push("is_active = 1");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ${table} ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const { rows } = await query<ReferenceRow[]>(
    `SELECT id, kode, nama, ${table === "satuan" ? "jumlah_unit, " : "NULL AS jumlah_unit, "}is_active, created_at
     FROM ${table} ${whereSql}
     ORDER BY ${opts.sortBy} ${opts.sortOrder.toUpperCase()}, id ${opts.sortOrder.toUpperCase()}
     LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  return { items: rows, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

export async function getReferenceByKode(
  table: ReferenceTable,
  kode: string,
): Promise<ReferenceRow | null> {
  const { rows } = await query<ReferenceRow[]>(
    `SELECT id, kode, nama, ${table === "satuan" ? "jumlah_unit, " : "NULL AS jumlah_unit, "}is_active, created_at
     FROM ${table} WHERE kode = ? LIMIT 1`,
    [kode],
  );
  return rows[0] ?? null;
}

/** Next display code ("SAT-007") = prefix + pad(MAX(numeric suffix)+1).
 *  Offset is prefix.length + 2 to skip the dash: SUBSTRING("SAT-001", 5) = "001". */
export async function generateKode(table: ReferenceTable, prefix: string): Promise<string> {
  const { rows } = await query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(kode, ${prefix.length + 2}) AS UNSIGNED)), 0) + 1 AS next
     FROM ${table} WHERE kode LIKE '${prefix}-%'`,
  );
  const next = Number(rows[0]?.next ?? 1);
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

async function referenceNameExists(
  table: ReferenceTable,
  nama: string,
  excludeId?: number,
): Promise<boolean> {
  const sql = excludeId
    ? `SELECT id FROM ${table} WHERE LOWER(nama) = LOWER(?) AND id <> ? LIMIT 1`
    : `SELECT id FROM ${table} WHERE LOWER(nama) = LOWER(?) LIMIT 1`;
  const params = excludeId ? [nama, excludeId] : [nama];
  const { rows } = await query<RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

export async function createReference(
  table: ReferenceTable,
  prefix: string,
  input: { nama: string; jumlahUnit?: number },
): Promise<ReferenceRow> {
  const kode = await generateKode(table, prefix);
  const jumlahUnit = table === "satuan" ? Math.trunc(input.jumlahUnit ?? 1) : null;
  const result = await execute(
    table === "satuan"
      ? `INSERT INTO satuan (kode, nama, jumlah_unit) VALUES (?, ?, ?)`
      : `INSERT INTO ${table} (kode, nama) VALUES (?, ?)`,
    table === "satuan" ? [kode, input.nama, jumlahUnit] : [kode, input.nama],
  );
  const created = await getReferenceById(table, result.insertId);
  if (!created) throw new Error(`${table} insert reported success but row not found`);
  return created;
}

export async function getReferenceById(
  table: ReferenceTable,
  id: number,
): Promise<ReferenceRow | null> {
  const { rows } = await query<ReferenceRow[]>(
    `SELECT id, kode, nama, ${table === "satuan" ? "jumlah_unit, " : "NULL AS jumlah_unit, "}is_active, created_at
     FROM ${table} WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateReference(
  table: ReferenceTable,
  id: number,
  input: { nama?: string; jumlahUnit?: number; isActive?: boolean },
): Promise<ReferenceRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.nama !== undefined) {
    sets.push("nama = ?");
    params.push(input.nama);
  }
  if (table === "satuan" && input.jumlahUnit !== undefined) {
    sets.push("jumlah_unit = ?");
    params.push(Math.trunc(input.jumlahUnit));
  }
  if (input.isActive !== undefined) {
    sets.push("is_active = ?");
    params.push(input.isActive ? 1 : 0);
  }
  if (sets.length === 0) {
    return getReferenceById(table, id);
  }
  await execute(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  return getReferenceById(table, id);
}

/** Count rows in produk_satuan (satuan) or produk (merk/kategori) referencing this row. */
export async function countReferenceUsage(
  table: ReferenceTable,
  id: number,
): Promise<number> {
  const sql =
    table === "satuan"
      ? `SELECT COUNT(*) AS total FROM produk_satuan WHERE satuan_id = ?`
      : table === "merk"
        ? `SELECT COUNT(*) AS total FROM produk WHERE merk_id = ?`
        : `SELECT COUNT(*) AS total FROM produk WHERE kategori_id = ?`;
  const { rows } = await query<RowDataPacket[]>(sql, [id]);
  return Number(rows[0]?.total ?? 0);
}

export async function deleteReference(table: ReferenceTable, id: number): Promise<boolean> {
  const result = await execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
}

export { referenceNameExists, buildMeta };

// ---------------------------------------------------------------------------
// Validation at API boundaries (reference tables)
// ---------------------------------------------------------------------------

const NAMA_MAX = 100;

export interface RefValidation {
  ok: boolean;
  nama?: string;
  jumlahUnit?: number;
  isActive?: boolean;
  details?: Record<string, string>;
}

export function validateRefCreate(body: unknown, table: ReferenceTable): RefValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const nama = typeof b.nama === "string" ? b.nama.trim() : "";
  if (nama.length < 1 || nama.length > NAMA_MAX) {
    details.nama = "Nama wajib diisi (maks 100 karakter).";
  }
  let jumlahUnit: number | undefined;
  if (table === "satuan") {
    jumlahUnit = typeof b.jumlahUnit === "number" ? b.jumlahUnit : Number(b.jumlahUnit);
    if (!Number.isInteger(jumlahUnit) || (jumlahUnit as number) < 1 || (jumlahUnit as number) > 1_000_000) {
      details.jumlahUnit = "Jumlah unit wajib angka bulat >= 1.";
    }
  }
  if (Object.keys(details).length > 0) return { ok: false, details };
  return { ok: true, nama, ...(jumlahUnit !== undefined ? { jumlahUnit } : {}) };
}

export function validateRefUpdate(body: unknown, table: ReferenceTable): RefValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const out: RefValidation = { ok: true };
  if (b.nama !== undefined) {
    const nama = typeof b.nama === "string" ? b.nama.trim() : "";
    if (nama.length < 1 || nama.length > NAMA_MAX) {
      details.nama = "Nama wajib diisi (maks 100 karakter).";
    } else {
      out.nama = nama;
    }
  }
  if (table === "satuan" && b.jumlahUnit !== undefined) {
    const jumlahUnit = typeof b.jumlahUnit === "number" ? b.jumlahUnit : Number(b.jumlahUnit);
    if (!Number.isInteger(jumlahUnit) || jumlahUnit < 1 || jumlahUnit > 1_000_000) {
      details.jumlahUnit = "Jumlah unit wajib angka bulat >= 1.";
    } else {
      out.jumlahUnit = jumlahUnit;
    }
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") {
      details.isActive = "isActive wajib boolean.";
    } else {
      out.isActive = b.isActive;
    }
  }
  if (Object.keys(details).length > 0) return { ok: false, details };
  return out;
}

// ---------------------------------------------------------------------------
// Produk data access
// ---------------------------------------------------------------------------

export interface ProdukRow {
  id: number;
  sku: string;
  nama: string;
  deskripsi: string | null;
  gambar_url: string | null;
  kategori_id: number;
  merk_id: number;
  status: "active" | "inactive";
  created_at: Date;
  kategori_kode: string;
  kategori_nama: string;
  merk_kode: string;
  merk_nama: string;
}

export interface ProdukSatuanRow {
  id: number;
  satuan_kode: string;
  satuan_nama: string;
  jumlah_unit: number;
  kode_item: string;
  harga: string; // DECIMAL comes back as string
}

const PRODUK_SELECT = `
  SELECT p.id, p.sku, p.nama, p.deskripsi, p.gambar_url, p.kategori_id, p.merk_id,
         p.status, p.created_at,
         k.kode AS kategori_kode, k.nama AS kategori_nama,
         m.kode AS merk_kode, m.nama AS merk_nama
  FROM produk p
  JOIN kategori k ON k.id = p.kategori_id
  JOIN merk m ON m.id = p.merk_id`;

export interface ProdukListOptions {
  page: number;
  pageSize: number;
  search: string;
  kategoriKode: string;
  merkKode: string;
  status: string;
  sortBy: string; // whitelisted in parseProdukListParams
  sortOrder: "asc" | "desc";
}

const PRODUK_SORT_COLUMNS: Record<string, string> = {
  sku: "p.sku",
  nama: "p.nama",
  status: "p.status",
  created_at: "p.id", // newest first == highest id first
};

export function parseProdukListParams(params: URLSearchParams): ProdukListOptions {
  const { page, pageSize, search } = parsePagination(params);
  const sortByRaw = params.get("sortBy") ?? "created_at";
  return {
    page,
    pageSize,
    search,
    kategoriKode: (params.get("kategoriKode") ?? "").trim(),
    merkKode: (params.get("merkKode") ?? "").trim(),
    status: params.get("status") === "inactive" || params.get("status") === "active" ? params.get("status") as string : "",
    sortBy: sortByRaw in PRODUK_SORT_COLUMNS ? sortByRaw : "created_at",
    sortOrder: params.get("sortOrder") === "asc" ? "asc" : "desc",
  };
}

export async function listProduk(opts: ProdukListOptions): Promise<ListResponse<ProdukRow>> {
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
  const offset = (opts.page - 1) * opts.pageSize;

  const countResult = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM produk p
     JOIN kategori k ON k.id = p.kategori_id
     JOIN merk m ON m.id = p.merk_id ${whereSql}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const sortColumn = PRODUK_SORT_COLUMNS[opts.sortBy] ?? "p.id";
  const dir = opts.sortOrder === "asc" ? "ASC" : "DESC";
  const { rows } = await query<ProdukRow[]>(
    `${PRODUK_SELECT} ${whereSql} ORDER BY ${sortColumn} ${dir}, p.id ${dir} LIMIT ? OFFSET ?`,
    [...params, opts.pageSize, offset],
  );
  return { items: rows, pagination: buildMeta(total, opts.page, opts.pageSize) };
}

export async function getProdukById(id: number): Promise<ProdukRow | null> {
  const { rows } = await query<ProdukRow[]>(`${PRODUK_SELECT} WHERE p.id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function getProdukBySku(sku: string): Promise<ProdukRow | null> {
  const { rows } = await query<ProdukRow[]>(`${PRODUK_SELECT} WHERE p.sku = ? LIMIT 1`, [sku]);
  return rows[0] ?? null;
}

export async function getProdukSatuanByProdukId(produkId: number): Promise<ProdukSatuanRow[]> {
  const { rows } = await query<ProdukSatuanRow[]>(
    `SELECT ps.id, s.kode AS satuan_kode, s.nama AS satuan_nama, s.jumlah_unit,
            ps.kode_item, ps.harga
     FROM produk_satuan ps
     JOIN satuan s ON s.id = ps.satuan_id
     WHERE ps.produk_id = ?
     ORDER BY ps.id ASC`,
    [produkId],
  );
  return rows;
}

/** Bulk variant for list endpoints — avoids N+1 when assembling page DTOs. */
export async function getProdukSatuanByProdukIds(
  produkIds: number[],
): Promise<Map<number, ProdukSatuanRow[]>> {
  const map = new Map<number, ProdukSatuanRow[]>();
  if (produkIds.length === 0) return map;
  const { rows } = await query<(ProdukSatuanRow & { produk_id: number })[]>(
    `SELECT ps.id, ps.produk_id, s.kode AS satuan_kode, s.nama AS satuan_nama, s.jumlah_unit,
            ps.kode_item, ps.harga
     FROM produk_satuan ps
     JOIN satuan s ON s.id = ps.satuan_id
     WHERE ps.produk_id IN (${produkIds.map(() => "?").join(",")})
     ORDER BY ps.id ASC`,
    produkIds,
  );
  for (const row of rows) {
    const list = map.get(row.produk_id) ?? [];
    list.push(row);
    map.set(row.produk_id, list);
  }
  return map;
}

/** Look up satuan rows by their codes; returns map kode → {id, jumlah_unit}. */
export async function getSatuanMapByKode(
  kodes: string[],
): Promise<Map<string, { id: number; jumlahUnit: number }>> {
  const map = new Map<string, { id: number; jumlahUnit: number }>();
  if (kodes.length === 0) return map;
  const { rows } = await query<RowDataPacket[]>(
    `SELECT id, kode, jumlah_unit FROM satuan WHERE kode IN (${kodes.map(() => "?").join(",")})`,
    kodes,
  );
  for (const row of rows as Array<{ id: number; kode: string; jumlah_unit: number }>) {
    map.set(row.kode, { id: row.id, jumlahUnit: row.jumlah_unit });
  }
  return map;
}

async function kodeItemExists(kodeItem: string, excludeProdukId?: number): Promise<boolean> {
  const sql = excludeProdukId
    ? `SELECT ps.id FROM produk_satuan ps WHERE ps.kode_item = ? AND ps.produk_id <> ? LIMIT 1`
    : `SELECT ps.id FROM produk_satuan ps WHERE ps.kode_item = ? LIMIT 1`;
  const params = excludeProdukId ? [kodeItem, excludeProdukId] : [kodeItem];
  const { rows } = await query<RowDataPacket[]>(sql, params);
  return rows.length > 0;
}

export async function insertProdukSatuan(
  conn: PoolConnection,
  produkId: number,
  rows: Array<{ satuanId: number; kodeItem: string; harga: number }>,
): Promise<void> {
  if (rows.length === 0) return;
  await conn.query(
    `INSERT INTO produk_satuan (produk_id, satuan_id, kode_item, harga) VALUES ${rows
      .map(() => "(?, ?, ?, ?)")
      .join(", ")}`,
    rows.flatMap((r) => [produkId, r.satuanId, r.kodeItem, r.harga]),
  );
  // Feedback #4 — setiap produk (manual/bulk) otomatis mendapat baris stok
  // per satuan (qty 0). Di sini karena dipanggil dalam transaksi yang sama
  // dengan createProdukTx / updateProdukTx.
  const [satuanRows] = await conn.query<RowDataPacket[]>(
    `SELECT id FROM produk_satuan WHERE produk_id = ? ORDER BY id ASC`,
    [produkId],
  );
  const ids = (satuanRows as Array<{ id: number }>).map((r) => r.id);
  if (ids.length > 0) {
    await conn.query(
      `INSERT INTO stok (produk_satuan_id, qty, buffer_stok) VALUES ${ids
        .map(() => "(?, 0, 0)")
        .join(", ")}`,
      ids,
    );
  }
}

export { kodeItemExists };

// ---------------------------------------------------------------------------
// Validation at API boundaries (produk)
// ---------------------------------------------------------------------------

export interface ProdukSatuanValidated {
  satuanKode: string;
  kodeItem: string;
  harga: number;
}

export interface ProdukValidation {
  ok: boolean;
  details?: Record<string, string>;
  data?: {
    sku: string;
    nama: string;
    deskripsi: string;
    gambarUrl: string;
    kategoriKode: string;
    merkKode: string;
    status: "active" | "inactive";
    satuan: ProdukSatuanValidated[];
  };
}

const SKU_RE = /^[A-Za-z0-9_-]{1,50}$/;
const KODE_ITEM_RE = /^[A-Za-z0-9_-]{1,64}$/;
const HARGA_MAX = 99_999_999_999; // DECIMAL(12,2)

export function validateProdukBody(body: unknown, partial: boolean): ProdukValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

  const sku = str(b.sku);
  const nama = str(b.nama);
  const deskripsi = str(b.deskripsi);
  const gambarUrl = str(b.gambarUrl);
  const kategoriKode = str(b.kategoriKode);
  const merkKode = str(b.merkKode);
  const status = str(b.status);

  if (!partial || sku !== undefined) {
    if (!sku || !SKU_RE.test(sku)) details.sku = "SKU wajib diisi (huruf/angka/-/_ , maks 50).";
  }
  if (!partial || nama !== undefined) {
    if (!nama || nama.length < 1 || nama.length > 200) details.nama = "Nama produk wajib diisi (maks 200 karakter).";
  }
  if (deskripsi !== undefined && deskripsi.length > 2000) {
    details.deskripsi = "Deskripsi maksimal 2000 karakter.";
  }
  if (gambarUrl !== undefined && gambarUrl !== "") {
    if (gambarUrl.startsWith("data:image/")) {
      // Upload dari UI: dataURL (JPEG/PNG/WebP) yang nanti dikonversi ke WebP
      // oleh server. Batas 2MB file → base64 membesar ~4/3 → ~2.8 juta karakter.
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(gambarUrl)) {
        details.gambarUrl = "Data URL gambar tidak valid (harus JPEG, PNG, atau WebP).";
      } else if (gambarUrl.length > 2_800_000) {
        details.gambarUrl = "Ukuran gambar maksimal 2MB.";
      }
    } else if (!/^https?:\/\/\S+$/.test(gambarUrl) || gambarUrl.length > 500) {
      details.gambarUrl = "Gambar harus data URL (JPEG/PNG/WebP) atau URL http(s) maksimal 500 karakter.";
    }
  }
  if (!partial || kategoriKode !== undefined) {
    if (!kategoriKode) details.kategoriKode = "Kategori wajib dipilih.";
  }
  if (!partial || merkKode !== undefined) {
    if (!merkKode) details.merkKode = "Merk wajib dipilih.";
  }
  let statusValue: "active" | "inactive" | undefined;
  if (status !== undefined) {
    if (status !== "active" && status !== "inactive") {
      details.status = "Status wajib 'active' atau 'inactive'.";
    } else {
      statusValue = status;
    }
  }

  // satuan rows
  let satuan: ProdukSatuanValidated[] | undefined;
  if (!partial || b.satuan !== undefined) {
    satuan = [];
    if (!Array.isArray(b.satuan) || b.satuan.length === 0) {
      details.satuan = "Tambahkan minimal 1 satuan dengan kode item dan harga.";
    } else {
      const seenSatuan = new Set<string>();
      const seenKodeItem = new Set<string>();
      b.satuan.forEach((row: unknown, index: number) => {
        const r = (row ?? {}) as Record<string, unknown>;
        const satuanKode = str(r.satuanKode);
        const kodeItem = str(r.kodeItem);
        const harga = typeof r.harga === "number" ? r.harga : Number(r.harga);
        const label = `satuan[${index}]`;
        if (!satuanKode) {
          details[label] = "Satuan wajib dipilih.";
          return;
        }
        if (seenSatuan.has(satuanKode)) {
          details[label] = `Satuan ${satuanKode} lebih dari satu kali.`;
          return;
        }
        if (!kodeItem || !KODE_ITEM_RE.test(kodeItem)) {
          details[label] = "Kode item wajib diisi (huruf/angka/-/_ , maks 64).";
          return;
        }
        if (seenKodeItem.has(kodeItem)) {
          details[label] = `Kode item ${kodeItem} duplikat dalam payload.`;
          return;
        }
        if (!Number.isFinite(harga) || harga < 0 || harga > HARGA_MAX) {
          details[label] = "Harga wajib angka >= 0.";
          return;
        }
        seenSatuan.add(satuanKode);
        seenKodeItem.add(kodeItem);
        satuan!.push({ satuanKode, kodeItem, harga: Math.round(harga * 100) / 100 });
      });
    }
  }

  if (Object.keys(details).length > 0) return { ok: false, details };
  return {
    ok: true,
    data: {
      sku: sku!,
      nama: nama!,
      deskripsi: deskripsi ?? "",
      gambarUrl: gambarUrl ?? "",
      kategoriKode: kategoriKode!,
      merkKode: merkKode!,
      status: statusValue ?? "active",
      satuan: satuan ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Produk mutations (transactional)
// ---------------------------------------------------------------------------

export async function createProdukTx(
  input: {
    sku: string;
    nama: string;
    deskripsi: string;
    gambarUrl: string;
    kategoriId: number;
    merkId: number;
    status: "active" | "inactive";
    satuan: Array<{ satuanId: number; kodeItem: string; harga: number }>;
  },
): Promise<number> {
  return withTransaction(async (conn) => {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO produk (sku, nama, deskripsi, gambar_url, kategori_id, merk_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.sku, input.nama, input.deskripsi || null, input.gambarUrl || null, input.kategoriId, input.merkId, input.status],
    );
    await insertProdukSatuan(conn, result.insertId, input.satuan);
    return result.insertId;
  });
}

export async function updateProdukTx(
  produkId: number,
  input: {
    sku?: string;
    nama?: string;
    deskripsi?: string;
    gambarUrl?: string;
    kategoriId?: number;
    merkId?: number;
    status?: "active" | "inactive";
    satuan?: Array<{ satuanId: number; kodeItem: string; harga: number }>;
  },
): Promise<void> {
  await withTransaction(async (conn) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.sku !== undefined) { sets.push("sku = ?"); params.push(input.sku); }
    if (input.nama !== undefined) { sets.push("nama = ?"); params.push(input.nama); }
    if (input.deskripsi !== undefined) { sets.push("deskripsi = ?"); params.push(input.deskripsi || null); }
    if (input.gambarUrl !== undefined) { sets.push("gambar_url = ?"); params.push(input.gambarUrl || null); }
    if (input.kategoriId !== undefined) { sets.push("kategori_id = ?"); params.push(input.kategoriId); }
    if (input.merkId !== undefined) { sets.push("merk_id = ?"); params.push(input.merkId); }
    if (input.status !== undefined) { sets.push("status = ?"); params.push(input.status); }
    if (sets.length > 0) {
      await conn.query(`UPDATE produk SET ${sets.join(", ")} WHERE id = ?`, [...params, produkId]);
    }
    if (input.satuan) {
      // Full replacement semantics — documented in the contract.
      await conn.query(`DELETE FROM produk_satuan WHERE produk_id = ?`, [produkId]);
      await insertProdukSatuan(conn, produkId, input.satuan);
    }
  });
}

export async function deleteProduk(produkId: number): Promise<boolean> {
  const result = await execute(`DELETE FROM produk WHERE id = ?`, [produkId]);
  return result.affectedRows > 0;
}

// ---------------------------------------------------------------------------
// Upsert produk (bulk upload) — SKU sudah ada → update, belum ada → create.
// Memakai jalur transaksi yang sama dengan manual create/update sehingga
// perilaku (termasuk auto-create stok per satuan) konsisten.
// ---------------------------------------------------------------------------

export interface UpsertProdukInput {
  sku: string;
  nama: string;
  deskripsi: string;
  gambarUrl: string;
  kategoriKode: string;
  merkKode: string;
  status: "active" | "inactive";
  satuan: Array<{ satuanKode: string; kodeItem: string; harga: number }>;
}

export type UpsertProdukResult =
  | { action: "created"; produkId: number }
  | { action: "updated"; produkId: number };

export async function upsertProdukBySku(input: UpsertProdukInput): Promise<UpsertProdukResult> {
  // Resolve master ids (kategori, merk, satuan) di luar transaksi; query read-only.
  const kategoriResult = await query<RowDataPacket[]>(
    `SELECT id FROM kategori WHERE kode = ? LIMIT 1`,
    [input.kategoriKode],
  );
  const merkResult = await query<RowDataPacket[]>(
    `SELECT id FROM merk WHERE kode = ? LIMIT 1`,
    [input.merkKode],
  );
  const kategoriId = kategoriResult.rows[0]?.id as number | undefined;
  const merkId = merkResult.rows[0]?.id as number | undefined;
  if (!kategoriId || !merkId) {
    const missing = !kategoriId && !merkId ? "Kategori dan Merk" : !kategoriId ? "Kategori" : "Merk";
    throw new Error(`${missing} tidak ditemukan di master data.`);
  }

  const satuanKodes = input.satuan.map((s) => s.satuanKode);
  const satuanMap = await getSatuanMapByKode(satuanKodes);
  for (const kode of satuanKodes) {
    if (!satuanMap.has(kode)) {
      throw new Error(`Satuan ${kode} tidak ditemukan di master data.`);
    }
  }
  const satuanRows = input.satuan.map((row) => ({
    satuanId: satuanMap.get(row.satuanKode)!.id,
    kodeItem: row.kodeItem,
    harga: row.harga,
  }));

  const existing = await getProdukBySku(input.sku);
  if (existing) {
    // Update — full replacement of satuan set (sama seperti PATCH manual).
    // Kode item yang dipakai produk lain (bukan produk ini) harus ditolak.
    for (const row of satuanRows) {
      if (await kodeItemExists(row.kodeItem, existing.id)) {
        throw new Error(`Kode item ${row.kodeItem} sudah digunakan produk lain.`);
      }
    }
    await updateProdukTx(existing.id, {
      sku: input.sku,
      nama: input.nama,
      deskripsi: input.deskripsi,
      gambarUrl: input.gambarUrl,
      kategoriId,
      merkId,
      status: input.status,
      satuan: satuanRows,
    });
    return { action: "updated", produkId: existing.id };
  }

  // Create — kode item harus global unik.
  for (const row of satuanRows) {
    if (await kodeItemExists(row.kodeItem)) {
      throw new Error(`Kode item ${row.kodeItem} sudah digunakan produk lain.`);
    }
  }
  const produkId = await createProdukTx({
    sku: input.sku,
    nama: input.nama,
    deskripsi: input.deskripsi,
    gambarUrl: input.gambarUrl,
    kategoriId,
    merkId,
    status: input.status,
    satuan: satuanRows,
  });
  return { action: "created", produkId };
}
