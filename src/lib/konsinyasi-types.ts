/**
 * Shared API contract untuk fitur admin konsinyasi.
 *
 * Konsinyasi = titipan barang dari supplier (pemasok). Header menyimpan
 * supplier_id (FK ke tabel supplier — tidak input bebas) & item menyimpan
 * produk + qty (konsinyasi/terjual/dikembalikan) + harga beli/jual snapshot.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type KonsinyasiStatus = "aktif" | "selesai";

export type KonsinyasiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SUPPLIER_NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface KonsinyasiItemDTO {
  id: number;
  produkId: number | null;
  produkSatuanId: number | null;
  satuanNama: string | null;
  sku: string;
  namaProduk: string;
  qtyKonsinyasi: number;
  qtyTerjual: number;
  qtyDikembalikan: number;
  hargaBeli: number;
  hargaJual: number;
}

/** Info supplier ter-join (dari tabel supplier). */
export interface SupplierRingkas {
  id: number;
  kode: string;
  nama: string;
  kota: string | null;
  telepon: string | null;
}

export interface KonsinyasiDTO {
  id: number;
  noKonsinyasi: string;
  tanggal: string;
  supplier: SupplierRingkas;
  catatan: string | null;
  status: KonsinyasiStatus;
  createdAt: string;
  items: KonsinyasiItemDTO[];
}

export interface CreateKonsinyasiItemInput {
  produkId?: number | null;
  /** Satuan produk (produk_satuan.id) — stok konsinyasi ditambah ke satuan ini. */
  produkSatuanId?: number | null;
  sku: string;
  namaProduk: string;
  qtyKonsinyasi: number;
  hargaBeli: number;
  hargaJual: number;
}

export interface CreateKonsinyasiInput {
  tanggal: string;            // ISO datetime
  supplierId: number;
  catatan?: string | null;
  items: CreateKonsinyasiItemInput[];
}

export interface KonsinyasiListResponse {
  items: KonsinyasiDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BulkKonsinyasiResult {
  success: number;
  failures: Array<{ row: number; noKonsinyasi: string; message: string }>;
}
