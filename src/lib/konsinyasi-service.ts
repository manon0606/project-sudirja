import "server-only";

import { execute, query, withTransaction } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import type {
  BulkKonsinyasiResult,
  CreateKonsinyasiInput,
  CreateKonsinyasiItemInput,
  ReturKonsinyasiItemInput,
  KonsinyasiDTO,
  KonsinyasiItemDTO,
  KonsinyasiListResponse,
  KonsinyasiStatus,
  SupplierRingkas,
} from "@/lib/konsinyasi-types";

interface KonsinyasiRow extends RowDataPacket {
  id: number;
  no_konsinyasi: string;
  tanggal: Date | string;
  supplier_id: number;
  catatan: string | null;
  status: KonsinyasiStatus;
  created_at: Date | string;
  sup_kode: string;
  sup_nama: string;
  sup_kota: string | null;
  sup_telepon: string | null;
}

interface ItemRow extends RowDataPacket {
  id: number;
  konsinyasi_id: number;
  produk_id: number | null;
  produk_satuan_id: number | null;
  satuan_nama: string | null;
  sku: string;
  nama_produk: string;
  qty_konsinyasi: number;
  qty_terjual: number;
  qty_dikembalikan: number;
  harga_beli: string | number;
  harga_jual: string | number;
}

const HEADER_SELECT = `
  SELECT k.*, s.kode AS sup_kode, s.nama AS sup_nama, s.kota AS sup_kota, s.telepon AS sup_telepon
  FROM konsinyasi k
  LEFT JOIN supplier s ON s.id = k.supplier_id`;

function toItemDTO(r: ItemRow): KonsinyasiItemDTO {
  return {
    id: r.id,
    produkId: r.produk_id,
    produkSatuanId: r.produk_satuan_id,
    satuanNama: r.satuan_nama,
    sku: r.sku,
    namaProduk: r.nama_produk,
    qtyKonsinyasi: Number(r.qty_konsinyasi),
    qtyTerjual: Number(r.qty_terjual),
    qtyDikembalikan: Number(r.qty_dikembalikan),
    hargaBeli: Number(r.harga_beli),
    hargaJual: Number(r.harga_jual),
  };
}

function toDTO(row: KonsinyasiRow, items: KonsinyasiItemDTO[]): KonsinyasiDTO {
  const supplier: SupplierRingkas = {
    id: row.supplier_id,
    kode: row.sup_kode,
    nama: row.sup_nama,
    kota: row.sup_kota,
    telepon: row.sup_telepon,
  };
  return {
    id: row.id,
    noKonsinyasi: row.no_konsinyasi,
    tanggal: row.tanggal instanceof Date ? row.tanggal.toISOString() : new Date(row.tanggal).toISOString(),
    supplier,
    catatan: row.catatan,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    items,
  };
}

// ---------------------------------------------------------------------------
// List & get
// ---------------------------------------------------------------------------

/** Batas hari (YYYY-MM-DD) zona WIB (UTC+7) → instan UTC (kolom DATETIME tersimpan UTC). */
function wibDayBoundary(ymd: string, endOfDay: boolean): Date | string {
  const d = new Date(`${ymd}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  // Fallback: bila tanggal tidak valid, pakai perilaku lama (string apa adanya).
  return Number.isNaN(d.getTime()) ? `${ymd} ${endOfDay ? "23:59:59" : "00:00:00"}` : d;
}

export function parseListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    status: q.get("status") ?? "",
    dateFrom: q.get("dateFrom") ?? "",
    dateTo: q.get("dateTo") ?? "",
    sortBy: q.get("sortBy") ?? "created_at",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

async function loadItems(ids: number[]): Promise<Map<number, KonsinyasiItemDTO[]>> {
  const map = new Map<number, KonsinyasiItemDTO[]>();
  if (!ids.length) return map;
  const { rows } = await query<ItemRow[]>(
    `SELECT * FROM konsinyasi_item WHERE konsinyasi_id IN (${ids.map(() => "?").join(",")}) ORDER BY id ASC`,
    ids,
  );
  for (const r of rows) {
    const list = map.get(Number(r.konsinyasi_id)) ?? [];
    list.push(toItemDTO(r));
    map.set(Number(r.konsinyasi_id), list);
  }
  return map;
}

export async function listKonsinyasi(params: ReturnType<typeof parseListParams>): Promise<KonsinyasiListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(k.no_konsinyasi LIKE ? OR s.nama LIKE ? OR s.kode LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`);
  }
  if (params.status === "aktif" || params.status === "selesai") {
    where.push("k.status = ?");
    args.push(params.status);
  }
  // Filter tanggal = hari WIB (UTC+7); kolom DATETIME tersimpan UTC sehingga
  // batas hari dikonversi ke instan UTC (27 Sep WIB = 26 Sep 17:00 UTC s/d 27 Sep 16:59 UTC).
  if (params.dateFrom) { where.push("k.tanggal >= ?"); args.push(wibDayBoundary(params.dateFrom, false)); }
  if (params.dateTo) { where.push("k.tanggal <= ?"); args.push(wibDayBoundary(params.dateTo, true)); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM konsinyasi k LEFT JOIN supplier s ON s.id = k.supplier_id ${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sortCols: Record<string, string> = { created_at: "k.created_at", tanggal: "k.tanggal", no_konsinyasi: "k.no_konsinyasi", supplier: "s.nama", status: "k.status" };
  const sort = sortCols[params.sortBy] ?? "k.created_at";
  const dir = params.sortOrder;
  const offset = (params.page - 1) * params.pageSize;
  const { rows } = await query<KonsinyasiRow[]>(
    `${HEADER_SELECT} ${whereSql} ORDER BY ${sort} ${dir}, k.id ${dir} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, offset],
  );
  if (!rows.length) return { items: [], pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) } };

  const itemsMap = await loadItems(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toDTO(r, itemsMap.get(r.id) ?? [])),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getKonsinyasiById(id: number): Promise<KonsinyasiDTO | null> {
  const { rows } = await query<KonsinyasiRow[]>(`${HEADER_SELECT} WHERE k.id = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (!row) return null;
  const itemsMap = await loadItems([row.id]);
  return toDTO(row, itemsMap.get(row.id) ?? []);
}

export async function getKonsinyasiByNo(no: string): Promise<KonsinyasiDTO | null> {
  const { rows } = await query<KonsinyasiRow[]>(`${HEADER_SELECT} WHERE k.no_konsinyasi = ? LIMIT 1`, [no]);
  const row = rows[0];
  if (!row) return null;
  const itemsMap = await loadItems([row.id]);
  return toDTO(row, itemsMap.get(row.id) ?? []);
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface KonsinyasiValidation {
  ok: boolean;
  data?: CreateKonsinyasiInput;
  details?: Record<string, string>;
}

export function validateKonsinyasi(body: unknown): KonsinyasiValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const tanggal = typeof b.tanggal === "string" && b.tanggal.trim() ? b.tanggal.trim() : "";
  const supplierId = typeof b.supplierId === "number" ? b.supplierId : Number(b.supplierId);
  const items = Array.isArray(b.items) ? b.items : [];
  const catatan = typeof b.catatan === "string" && b.catatan.trim() ? b.catatan.trim() : null;

  if (!tanggal || Number.isNaN(Date.parse(tanggal))) details.tanggal = "Tanggal wajib diisi dan valid.";
  if (!Number.isInteger(supplierId) || supplierId <= 0) details.supplierId = "Supplier wajib dipilih.";
  if (!items.length) details.items = "Minimal 1 produk harus ditambahkan.";

  const parsedItems: CreateKonsinyasiItemInput[] = [];
  if (items.length) {
    items.forEach((raw, idx) => {
      const it = (raw ?? {}) as Record<string, unknown>;
      const sku = typeof it.sku === "string" ? it.sku.trim() : "";
      const namaProduk = typeof it.namaProduk === "string" ? it.namaProduk.trim() : "";
      const qtyKonsinyasi = Number(it.qtyKonsinyasi);
      const hargaBeli = Number(it.hargaBeli);
      const hargaJual = Number(it.hargaJual);
      if (!sku || !namaProduk) {
        details[`items[${idx}]`] = "Produk tidak valid.";
        return;
      }
      if (!Number.isInteger(qtyKonsinyasi) || qtyKonsinyasi <= 0) {
        details[`items[${idx}]`] = "Qty konsinyasi wajib angka bulat > 0.";
        return;
      }
      if (!Number.isFinite(hargaBeli) || hargaBeli < 0) {
        details[`items[${idx}]`] = "Harga beli wajib angka >= 0.";
        return;
      }
      if (!Number.isFinite(hargaJual) || hargaJual < 0) {
        details[`items[${idx}]`] = "Harga jual wajib angka >= 0.";
        return;
      }
      const produkSatuanId = typeof it.produkSatuanId === "number" && it.produkSatuanId > 0
        ? it.produkSatuanId
        : typeof it.produkSatuanId === "string" && it.produkSatuanId
          ? Number(it.produkSatuanId)
          : null;
      parsedItems.push({
        produkId: typeof it.produkId === "number" && it.produkId > 0 ? it.produkId : null,
        produkSatuanId,
        sku,
        namaProduk,
        qtyKonsinyasi,
        hargaBeli,
        hargaJual,
      });
    });
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data: { tanggal, supplierId, catatan, items: parsedItems } };
}

// ---------------------------------------------------------------------------
// Generate nomor & create
// ---------------------------------------------------------------------------

export async function generateNoKonsinyasi(conn?: PoolConnection): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const countQ = `SELECT COUNT(*) total FROM konsinyasi WHERE no_konsinyasi LIKE ?`;
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(countQ, [`KON-${ymd}-%`]);
    const next = Number(rows[0]?.total ?? 0) + 1;
    return `KON-${ymd}-${String(next).padStart(3, "0")}`;
  }
  const { rows } = await query<RowDataPacket[]>(countQ, [`KON-${ymd}-%`]);
  const next = Number(rows[0]?.total ?? 0) + 1;
  return `KON-${ymd}-${String(next).padStart(3, "0")}`;
}

async function supplierExists(id: number, conn?: PoolConnection): Promise<boolean> {
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM supplier WHERE id = ? AND is_active = 1 LIMIT 1", [id]);
    return rows.length > 0;
  }
  const { rows } = await query<RowDataPacket[]>("SELECT id FROM supplier WHERE id = ? AND is_active = 1 LIMIT 1", [id]);
  return rows.length > 0;
}

/** Resolve info produk_satuan (nama satuan) & validasi satuan milik produk/sku. */
async function resolveSatuanInfo(conn: PoolConnection, produkSatuanId: number, sku: string): Promise<{ nama: string; produkId: number } | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT ps.id, s.nama AS satuan_nama, p.id AS produk_id
     FROM produk_satuan ps
     JOIN satuan s ON s.id = ps.satuan_id
     JOIN produk p ON p.id = ps.produk_id
     WHERE ps.id = ? AND p.sku = ?
     LIMIT 1`,
    [produkSatuanId, sku],
  );
  const r = rows[0] as { satuan_nama: string; produk_id: number } | undefined;
  return r ? { nama: r.satuan_nama, produkId: r.produk_id } : null;
}

/**
 * Mutasi stok satuan produk (delta bisa +/−) di dalam transaksi yang sama.
 * Membuat baris stok bila belum ada; mencatat stok_history.
 */
async function mutasiStok(conn: PoolConnection, produkSatuanId: number, delta: number, catatan: string | null): Promise<void> {
  if (delta === 0) return;
  // Pastikan baris stok ada.
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
  const qtyBaru = Math.max(0, stok.qty + delta);
  await conn.query(`UPDATE stok SET qty = ? WHERE id = ?`, [qtyBaru, stok.id]);
  await conn.query(
    `INSERT INTO stok_history (stok_id, tipe, qty_delta, qty_sebelum, qty_sesudah, catatan)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [stok.id, delta > 0 ? "in" : "out", delta, stok.qty, qtyBaru, (catatan ?? "").slice(0, 255)],
  );
}

export async function createKonsinyasi(input: CreateKonsinyasiInput): Promise<KonsinyasiDTO> {
  const id = await withTransaction<number>(async (conn) => {
    if (!await supplierExists(input.supplierId, conn)) throw new Error("SUPPLIER_NOT_FOUND");
    const no = await generateNoKonsinyasi(conn);
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO konsinyasi (no_konsinyasi, tanggal, supplier_id, catatan, status) VALUES (?, ?, ?, ?, 'aktif')`,
      [no, new Date(input.tanggal), input.supplierId, input.catatan ?? null],
    );
    for (const it of input.items) {
      // Satuan: wajib dari form manual; bulk bisa tanpa → default satuan pertama produk by sku.
      let produkSatuanId = it.produkSatuanId ?? null;
      if (!produkSatuanId) {
        const [defRows] = await conn.query<RowDataPacket[]>(
          `SELECT ps.id FROM produk_satuan ps JOIN produk p ON p.id = ps.produk_id WHERE p.sku = ? ORDER BY ps.id ASC LIMIT 1`,
          [it.sku],
        );
        produkSatuanId = (defRows[0] as { id: number } | undefined)?.id ?? null;
      }
      if (!produkSatuanId) throw new Error("SATUAN_REQUIRED");
      const satuan = await resolveSatuanInfo(conn, produkSatuanId, it.sku);
      if (!satuan) throw new Error("SATUAN_INVALID");
      await conn.query<ResultSetHeader>(
        `INSERT INTO konsinyasi_item (konsinyasi_id, produk_id, produk_satuan_id, satuan_nama, sku, nama_produk, qty_konsinyasi, qty_terjual, qty_dikembalikan, harga_beli, harga_jual)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        [result.insertId, satuan.produkId, produkSatuanId, satuan.nama, it.sku, it.namaProduk, it.qtyKonsinyasi, it.hargaBeli, it.hargaJual],
      );
      // Tambah stok ke satuan terpilih sebesar qty konsinyasi.
      await mutasiStok(conn, produkSatuanId, it.qtyKonsinyasi, `Konsinyasi ${no} — ${it.namaProduk} (${satuan.nama})`);
    }
    return result.insertId;
  });
  const created = await getKonsinyasiById(id);
  if (!created) throw new Error("Gagal membuat konsinyasi.");
  return created;
}

/**
 * Selesaikan konsinyasi: kurangi stok utk sisa yg TIDAK terjual & tidak
 * dikembalikan (barang sisa dianggap dikembalikan ke supplier), set
 * qty_dikembalikan = sisa, lalu status = selesai.
 */
export async function selesaikanKonsinyasi(id: number): Promise<KonsinyasiDTO | null> {
  const current = await getKonsinyasiById(id);
  if (!current) return null;
  if (current.status === "selesai") return current;
  await withTransaction(async (conn) => {
    for (const it of current.items) {
      if (!it.produkSatuanId) continue;
      const sisa = Math.max(0, it.qtyKonsinyasi - it.qtyTerjual - it.qtyDikembalikan);
      if (sisa > 0) {
        await mutasiStok(conn, it.produkSatuanId, -sisa, `Sisa konsinyasi ${current.noKonsinyasi} dikembalikan — ${it.namaProduk} (${it.satuanNama ?? ""})`);
        await conn.query(
          `UPDATE konsinyasi_item SET qty_dikembalikan = qty_dikembalikan + ? WHERE id = ?`,
          [sisa, it.id],
        );
      }
    }
    await conn.query(`UPDATE konsinyasi SET status = 'selesai' WHERE id = ?`, [id]);
  });
  return getKonsinyasiById(id);
}

/** Tandai selesai (status) via PATCH — delegasi ke selesaikanKonsinyasi utk konsisten. */
export async function updateKonsinyasiStatus(id: number, status: KonsinyasiStatus): Promise<KonsinyasiDTO | null> {
  if (status === "selesai") return selesaikanKonsinyasi(id);
  const current = await getKonsinyasiById(id);
  if (!current) return null;
  await execute(`UPDATE konsinyasi SET status = ? WHERE id = ?`, [status, id]);
  return getKonsinyasiById(id);
}

/**
 * Pengembalian (retur) sisa konsinyasi — sebagian atau penuh: kurangi stok utk
 * qty yang dikembalikan, tambah qty_dikembalikan per item. Bila seluruh item
 * tuntas (qtyKonsinyasi = qtyTerjual + qtyDikembalikan) → status otomatis
 * 'selesai'.
 */
export async function returKonsinyasi(
  id: number,
  items: ReturKonsinyasiItemInput[],
): Promise<KonsinyasiDTO | null> {
  const current = await getKonsinyasiById(id);
  if (!current) return null;
  if (current.status === "selesai") throw new Error("SUDAH_SELESAI");
  const byId = new Map(current.items.map((it) => [it.id, it]));
  let totalQty = 0;
  for (const r of items) {
    const it = byId.get(r.id);
    if (!it) throw new Error("ITEM_NOT_FOUND");
    if (!Number.isInteger(r.qtyReturn) || r.qtyReturn <= 0) throw new Error("QTY_INVALID");
    const sisa = Math.max(0, it.qtyKonsinyasi - it.qtyTerjual - it.qtyDikembalikan);
    if (r.qtyReturn > sisa) throw new Error("QTY_MELEBIHI_SISA");
    totalQty += r.qtyReturn;
  }
  if (totalQty === 0) throw new Error("QTY_KOSONG");
  await withTransaction(async (conn) => {
    for (const r of items) {
      const it = byId.get(r.id);
      if (!it) continue;
      if (it.produkSatuanId) {
        await mutasiStok(conn, it.produkSatuanId, -r.qtyReturn, `Retur konsinyasi ${current.noKonsinyasi} — ${it.namaProduk} (${it.satuanNama ?? ""})`);
      }
      await conn.query(
        `UPDATE konsinyasi_item SET qty_dikembalikan = qty_dikembalikan + ? WHERE id = ?`,
        [r.qtyReturn, r.id],
      );
    }
    const tuntas = current.items.every((it) => {
      const tambahan = items.find((r) => r.id === it.id)?.qtyReturn ?? 0;
      return it.qtyKonsinyasi <= it.qtyTerjual + it.qtyDikembalikan + tambahan;
    });
    if (tuntas) await conn.query(`UPDATE konsinyasi SET status = 'selesai' WHERE id = ?`, [id]);
  });
  return getKonsinyasiById(id);
}

/**
 * Hapus konsinyasi (aktif): kembalikan stok — kurangi qty yang belum
 * terjual & belum dikembalikan (barang titipan ditarik kembali).
 */
export async function deleteKonsinyasi(id: number): Promise<boolean> {
  const current = await getKonsinyasiById(id);
  if (!current) return false;
  await withTransaction(async (conn) => {
    for (const it of current.items) {
      if (!it.produkSatuanId) continue;
      const sisa = Math.max(0, it.qtyKonsinyasi - it.qtyTerjual - it.qtyDikembalikan);
      if (sisa > 0) {
        await mutasiStok(conn, it.produkSatuanId, -sisa, `Konsinyasi ${current.noKonsinyasi} dihapus — barang ditarik (${it.namaProduk})`);
      }
    }
    await conn.query(`DELETE FROM konsinyasi WHERE id = ?`, [id]);
  });
  return true;
}

// ---------------------------------------------------------------------------
// Bulk create
// ---------------------------------------------------------------------------

export async function bulkCreateKonsinyasi(rows: CreateKonsinyasiInput[]): Promise<BulkKonsinyasiResult> {
  const results: BulkKonsinyasiResult = { success: 0, failures: [] };
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as unknown as Record<string, unknown>;
    try {
      const parsed = validateKonsinyasi(raw);
      if (!parsed.ok || !parsed.data) {
        results.failures.push({ row: i + 1, noKonsinyasi: String(raw.noKonsinyasi ?? ""), message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      await createKonsinyasi(parsed.data);
      results.success++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      results.failures.push({
        row: i + 1,
        noKonsinyasi: String(raw.noKonsinyasi ?? ""),
        message: msg === "SUPPLIER_NOT_FOUND" ? "Supplier tidak ditemukan." : "Gagal membuat konsinyasi.",
      });
    }
  }
  return results;
}
