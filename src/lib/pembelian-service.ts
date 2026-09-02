import "server-only";

import { execute, query, withTransaction } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import type {
  CreatePembelianInput,
  CreatePembelianItemInput,
  PembelianDTO,
  PembelianItemDTO,
  PembelianListResponse,
  SupplierRingkas,
} from "@/lib/pembelian-types";

interface PembelianRow extends RowDataPacket {
  id: number;
  no_pembelian: string;
  tanggal: Date | string;
  supplier_id: number;
  ppn: string | number;
  catatan: string | null;
  created_at: Date | string;
  sup_kode: string;
  sup_nama: string;
  sup_kota: string | null;
  sup_telepon: string | null;
}

interface ItemRow extends RowDataPacket {
  id: number;
  pembelian_id: number;
  produk_id: number | null;
  produk_satuan_id: number | null;
  satuan_nama: string | null;
  sku: string;
  nama_produk: string;
  qty: number;
  harga_beli: string | number;
  harga_jual: string | number;
  diskon: string | number;
  subtotal: string | number;
}

const HEADER_SELECT = `
  SELECT pb.*, s.kode AS sup_kode, s.nama AS sup_nama, s.kota AS sup_kota, s.telepon AS sup_telepon
  FROM pembelian pb
  LEFT JOIN supplier s ON s.id = pb.supplier_id`;

function toItemDTO(r: ItemRow): PembelianItemDTO {
  return {
    id: r.id,
    produkId: r.produk_id,
    produkSatuanId: r.produk_satuan_id,
    satuanNama: r.satuan_nama,
    sku: r.sku,
    namaProduk: r.nama_produk,
    qty: Number(r.qty),
    hargaBeli: Number(r.harga_beli),
    hargaJual: Number(r.harga_jual),
    diskon: Number(r.diskon),
    subtotal: Number(r.subtotal),
  };
}

function computeRingkasan(items: PembelianItemDTO[], ppn: number): { totalPembelian: number; totalPpn: number; grandTotal: number; estimasiLaba: number } {
  const totalPembelian = items.reduce((sum, it) => sum + it.subtotal, 0);
  const totalPpn = Math.round(totalPembelian * ppn) / 100;
  const grandTotal = totalPembelian + totalPpn;
  // Laba estimasi = (harga jual - harga beli efektif setelah diskon) * qty
  const estimasiLaba = items.reduce((sum, it) => {
    const beliEfektif = it.hargaBeli * (1 - it.diskon / 100);
    return sum + Math.round((it.hargaJual - beliEfektif) * it.qty * 100) / 100;
  }, 0);
  return { totalPembelian, totalPpn, grandTotal, estimasiLaba };
}

function toDTO(row: PembelianRow, items: PembelianItemDTO[]): PembelianDTO {
  const supplier: SupplierRingkas = {
    id: row.supplier_id,
    kode: row.sup_kode,
    nama: row.sup_nama,
    kota: row.sup_kota,
    telepon: row.sup_telepon,
  };
  const ppn = Number(row.ppn);
  const ringkas = computeRingkasan(items, ppn);
  return {
    id: row.id,
    noPembelian: row.no_pembelian,
    tanggal: row.tanggal instanceof Date ? row.tanggal.toISOString() : new Date(row.tanggal).toISOString(),
    supplier,
    ppn,
    catatan: row.catatan,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    items,
    ...ringkas,
  };
}

// ---------------------------------------------------------------------------
// List & get
// ---------------------------------------------------------------------------

export function parseListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    dateFrom: q.get("dateFrom") ?? "",
    dateTo: q.get("dateTo") ?? "",
    sortBy: q.get("sortBy") ?? "created_at",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

async function loadItems(ids: number[]): Promise<Map<number, PembelianItemDTO[]>> {
  const map = new Map<number, PembelianItemDTO[]>();
  if (!ids.length) return map;
  const { rows } = await query<ItemRow[]>(
    `SELECT * FROM pembelian_item WHERE pembelian_id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`,
    ids,
  );
  for (const r of rows) {
    const list = map.get(Number(r.pembelian_id)) ?? [];
    list.push(toItemDTO(r));
    map.set(Number(r.pembelian_id), list);
  }
  return map;
}

export async function listPembelian(params: ReturnType<typeof parseListParams>): Promise<PembelianListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(pb.no_pembelian LIKE ? OR s.nama LIKE ? OR s.kode LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
  }
  if (params.dateFrom) { where.push("pb.tanggal >= ?"); args.push(`${params.dateFrom} 00:00:00`); }
  if (params.dateTo) { where.push("pb.tanggal <= ?"); args.push(`${params.dateTo} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM pembelian pb LEFT JOIN supplier s ON s.id = pb.supplier_id ${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sortCols: Record<string, string> = { created_at: "pb.created_at", tanggal: "pb.tanggal", no_pembelian: "pb.no_pembelian", supplier: "s.nama" };
  const sort = sortCols[params.sortBy] ?? "pb.created_at";
  const dir = params.sortOrder;
  const offset = (params.page - 1) * params.pageSize;
  const { rows } = await query<PembelianRow[]>(
    `${HEADER_SELECT} ${whereSql} ORDER BY ${sort} ${dir}, pb.id ${dir} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, offset],
  );
  if (!rows.length) return { items: [], pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) } };

  const itemsMap = await loadItems(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toDTO(r, itemsMap.get(r.id) ?? [])),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getPembelianById(id: number): Promise<PembelianDTO | null> {
  const { rows } = await query<PembelianRow[]>(`${HEADER_SELECT} WHERE pb.id = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const itemsMap = await loadItems([row.id]);
  return toDTO(row, itemsMap.get(row.id) ?? []);
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface PembelianValidation {
  ok: boolean;
  data?: CreatePembelianInput;
  details?: Record<string, string>;
}

export function validatePembelian(body: unknown): PembelianValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const tanggal = typeof b.tanggal === "string" && b.tanggal.trim() ? b.tanggal.trim() : "";
  const supplierId = typeof b.supplierId === "number" ? b.supplierId : Number(b.supplierId);
  const items = Array.isArray(b.items) ? b.items : [];
  const ppn = b.ppn === undefined || b.ppn === null ? 0 : (typeof b.ppn === "number" ? b.ppn : Number(b.ppn));
  const catatan = typeof b.catatan === "string" && b.catatan.trim() ? b.catatan.trim() : null;

  if (!tanggal || Number.isNaN(Date.parse(tanggal))) details.tanggal = "Tanggal wajib diisi dan valid.";
  if (!Number.isInteger(supplierId) || supplierId <= 0) details.supplierId = "Supplier wajib dipilih.";
  if (!Number.isFinite(ppn) || ppn < 0 || ppn > 100) details.ppn = "PPn harus 0-100%.";
  if (!items.length) details.items = "Minimal 1 produk harus ditambahkan.";

  const parsedItems: CreatePembelianItemInput[] = [];
  if (items.length) {
    items.forEach((raw, idx) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      const sku = typeof it.sku === "string" ? it.sku.trim() : "";
      const namaProduk = typeof it.namaProduk === "string" ? it.namaProduk.trim() : "";
      const qty = Number(it.qty);
      const hargaBeli = Number(it.hargaBeli);
      const hargaJual = Number(it.hargaJual);
      const diskon = it.diskon === undefined || it.diskon === null ? 0 : Number(it.diskon);
      const rawPs = it.produkSatuanId;
      const produkSatuanId = typeof rawPs === "number" && Number.isInteger(rawPs) && rawPs > 0
        ? rawPs
        : typeof rawPs === "string" && rawPs ? Number(rawPs) : null;
      if (!sku || !namaProduk) { details[`items[${idx}]`] = "Produk tidak valid."; return; }
      if (!Number.isInteger(qty) || qty <= 0) { details[`items[${idx}]`] = "Qty wajib angka bulat > 0."; return; }
      if (!Number.isFinite(hargaBeli) || hargaBeli < 0) { details[`items[${idx}]`] = "Harga beli wajib angka >= 0."; return; }
      if (!Number.isFinite(hargaJual) || hargaJual < 0) { details[`items[${idx}]`] = "Harga jual wajib angka >= 0."; return; }
      if (!Number.isFinite(diskon) || diskon < 0 || diskon > 100) { details[`items[${idx}]`] = "Diskon harus 0-100%."; return; }
      parsedItems.push({
        produkId: typeof it.produkId === "number" && it.produkId > 0 ? it.produkId : null,
        produkSatuanId,
        sku, namaProduk, qty, hargaBeli, hargaJual, diskon,
      });
    });
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data: { tanggal, supplierId, ppn, catatan, items: parsedItems } };
}

// ---------------------------------------------------------------------------
// Generate nomor & create
// ---------------------------------------------------------------------------

async function generateNo(conn?: PoolConnection): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const q = `SELECT COUNT(*) total FROM pembelian WHERE no_pembelian LIKE ?`;
  const next = async (): Promise<number> => {
    if (conn) {
      const [rows] = await conn.query<RowDataPacket[]>(q, [`PO-${ymd}-%`]);
      return Number(rows[0]?.total ?? 0);
    }
    const { rows } = await query<RowDataPacket[]>(q, [`PO-${ymd}-%`]);
    return Number(rows[0]?.total ?? 0);
  };
  return `PO-${ymd}-${String((await next()) + 1).padStart(3, "0")}`;
}

async function supplierExists(id: number, conn?: PoolConnection): Promise<boolean> {
  const q = `SELECT id FROM supplier WHERE id = ? AND is_active = 1 LIMIT 1`;
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(q, [id]);
    return rows.length > 0;
  }
  const { rows } = await query<RowDataPacket[]>(q, [id]);
  return rows.length > 0;
}

/** Mutasi stok satuan (tambah utk pembelian) + catat stok_history. */
async function mutasiStok(conn: PoolConnection, produkSatuanId: number, delta: number, catatan: string | null): Promise<void> {
  if (delta === 0) return;
  const [stokRows] = await conn.query<RowDataPacket[]>(`SELECT id, qty FROM stok WHERE produk_satuan_id = ? LIMIT 1`, [produkSatuanId]);
  let stok = stokRows[0] as { id: number; qty: number } | undefined;
  if (!stok) {
    const [ins] = await conn.query<ResultSetHeader>(`INSERT INTO stok (produk_satuan_id, qty, buffer_stok) VALUES (?, 0, 0)`, [produkSatuanId]);
    stok = { id: ins.insertId, qty: 0 };
  }
  const qtyBaru = Math.max(0, stok.qty + delta);
  await conn.query(`UPDATE stok SET qty = ? WHERE id = ?`, [qtyBaru, stok.id]);
  await conn.query(
    `INSERT INTO stok_history (stok_id, tipe, qty_delta, qty_sebelum, qty_sesudah, catatan) VALUES (?, ?, ?, ?, ?, ?)`,
    [stok.id, delta > 0 ? "in" : "out", delta, stok.qty, qtyBaru, (catatan ?? "").slice(0, 255)],
  );
}

/** Resolve info satuan (pastikan satuan milik produk/sku). */
async function resolveSatuan(conn: PoolConnection, produkSatuanId: number, sku: string): Promise<{ nama: string; produkId: number } | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT s.nama AS satuan_nama, p.id AS produk_id
     FROM produk_satuan ps JOIN satuan s ON s.id = ps.satuan_id JOIN produk p ON p.id = ps.produk_id
     WHERE ps.id = ? AND p.sku = ? LIMIT 1`,
    [produkSatuanId, sku],
  );
  const r = rows[0] as { satuan_nama: string; produk_id: number } | undefined;
  return r ? { nama: r.satuan_nama, produkId: r.produk_id } : null;
}

export async function createPembelian(input: CreatePembelianInput): Promise<PembelianDTO> {
  const id = await withTransaction<number>(async (conn) => {
    if (!await supplierExists(input.supplierId, conn)) throw new Error("SUPPLIER_NOT_FOUND");
    const no = await generateNo(conn);
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO pembelian (no_pembelian, tanggal, supplier_id, ppn, catatan) VALUES (?, ?, ?, ?, ?)`,
      [no, new Date(input.tanggal), input.supplierId, input.ppn ?? 0, input.catatan ?? null],
    );
    for (const it of input.items) {
      // Default satuan pertama bila tidak diberikan.
      let produkSatuanId = it.produkSatuanId ?? null;
      if (!produkSatuanId) {
        const [defRows] = await conn.query<RowDataPacket[]>(
          `SELECT ps.id FROM produk_satuan ps JOIN produk p ON p.id = ps.produk_id WHERE p.sku = ? ORDER BY ps.id ASC LIMIT 1`,
          [it.sku],
        );
        produkSatuanId = (defRows[0] as { id: number } | undefined)?.id ?? null;
      }
      if (!produkSatuanId) throw new Error("SATUAN_REQUIRED");
      const satuan = await resolveSatuan(conn, produkSatuanId, it.sku);
      if (!satuan) throw new Error("SATUAN_INVALID");
      const diskon = it.diskon ?? 0;
      const subtotal = Math.round((it.hargaBeli * it.qty * (1 - diskon / 100)) * 100) / 100;
      await conn.query<ResultSetHeader>(
        `INSERT INTO pembelian_item (pembelian_id, produk_id, produk_satuan_id, satuan_nama, sku, nama_produk, qty, harga_beli, harga_jual, diskon, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [result.insertId, satuan.produkId, produkSatuanId, satuan.nama, it.sku, it.namaProduk, it.qty, it.hargaBeli, it.hargaJual, diskon, subtotal],
      );
      // Tambah stok dari pembelian.
      await mutasiStok(conn, produkSatuanId, it.qty, `Pembelian ${no} — ${it.namaProduk} (${satuan.nama})`);
    }
    return result.insertId;
  });
  const created = await getPembelianById(id);
  if (!created) throw new Error("Gagal membuat pembelian.");
  return created;
}

export async function deletePembelian(id: number): Promise<boolean> {
  const current = await getPembelianById(id);
  if (!current) return false;
  await withTransaction(async (conn) => {
    // Batalkan stok: kurangi qty yg dibeli dari satuan masing-masing.
    for (const it of current.items) {
      if (!it.produkSatuanId) continue;
      await mutasiStok(conn, it.produkSatuanId, -it.qty, `Pembelian ${current.noPembelian} dihapus — ${it.namaProduk}`);
    }
    await conn.query(`DELETE FROM pembelian WHERE id = ?`, [id]);
  });
  return true;
}
