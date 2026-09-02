/**
 * Shared API contract for the admin products feature (satuan, merk,
 * kategori, produk + per-satuan harga & kode_item).
 *
 * Envelope is identical to the auth feature:
 *   success → { ok: true, data: ... }
 *   failure → { ok: false, error: { code, message, details? } }
 *
 * Design notes:
 * - Resources are identified by their UI codes ("SAT-001", "MRK-001",
 *   "KAT-001", product SKU) — the identifiers the backoffice UI already
 *   passes around — not by numeric DB ids.
 * - API field names are camelCase and do NOT mirror DB columns.
 * - 1 produk can have many (satuan → harga + kode_item) rows; kode_item
 *   is globally unique because it is printed as a scannable barcode.
 *
 * Client-safe: type-only, no server imports.
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type ProductErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "SKU_TAKEN"
  | "KODE_ITEM_TAKEN"
  | "IN_USE"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ---------------------------------------------------------------------------
// Satuan (unit of measure — drives pricing & kode_item config per product)
// ---------------------------------------------------------------------------

export interface SatuanDTO {
  kode: string; // "SAT-001"
  nama: string;
  jumlahUnit: number; // base units inside this satuan, >= 1
  isActive: boolean;
  createdAt: string;
}

export interface CreateSatuanInput {
  nama: string;
  jumlahUnit: number;
}

export interface UpdateSatuanInput {
  nama?: string;
  jumlahUnit?: number;
  isActive?: boolean;
}

/** Query params for reference list endpoints (?activeOnly=1 feeds dropdowns). */
export interface ReferenceListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  activeOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Merk & Kategori (simple reference data)
// ---------------------------------------------------------------------------

export interface MerkDTO {
  kode: string; // "MRK-001"
  nama: string;
  isActive: boolean;
  createdAt: string;
}

export interface KategoriDTO {
  kode: string; // "KAT-001"
  nama: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateMerkInput {
  nama: string;
}

export interface UpdateMerkInput {
  nama?: string;
  isActive?: boolean;
}

export interface CreateKategoriInput {
  nama: string;
}

export interface UpdateKategoriInput {
  nama?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Produk
// ---------------------------------------------------------------------------

export type ProdukStatus = "active" | "inactive";

/** One pricing/identity row per configured satuan. */
export interface ProdukSatuanDTO {
  /** produk_satuan.id — utk konsinyasi/pesanan mengurangi stok per satuan. */
  id: number;
  satuanKode: string; // "SAT-001"
  satuanNama: string;
  jumlahUnit: number;
  kodeItem: string; // globally unique, printed as barcode
  harga: number;
}

export interface ProdukDTO {
  id: number;
  sku: string;
  nama: string;
  deskripsi: string;
  /** dataURL WebP (dikonversi otomatis server saat upload/disimpan) atau URL eksternal. */
  gambarUrl: string;
  kategoriKode: string;
  kategoriNama: string;
  merkKode: string;
  merkNama: string;
  status: ProdukStatus;
  createdAt: string;
  satuan: ProdukSatuanDTO[];
}

export interface ProdukSatuanInput {
  satuanKode: string;
  kodeItem: string;
  harga: number;
}

export interface CreateProdukInput {
  sku: string;
  nama: string;
  deskripsi?: string;
  gambarUrl?: string;
  kategoriKode: string;
  merkKode: string;
  status?: ProdukStatus;
  satuan: ProdukSatuanInput[];
}

export interface UpdateProdukInput {
  sku?: string;
  nama?: string;
  deskripsi?: string;
  gambarUrl?: string;
  kategoriKode?: string;
  merkKode?: string;
  status?: ProdukStatus;
  /** When provided, replaces the full satuan/harga/kodeItem set. */
  satuan?: ProdukSatuanInput[];
}

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

export type BarcodeFormat = "CODE128" | "EAN13" | "QRCODE";

export interface BarcodeRequest {
  kodeItem: string;
  format?: BarcodeFormat;
  /** false → bar saja tanpa teks di bawahnya (dipakai label cetak yang
   *  menyusun kodeItem/satuan sendiri). Default true. */
  includeText?: boolean;
}

export interface BarcodeResponse {
  kodeItem: string;
  format: BarcodeFormat;
  dataUrl: string; // PNG data URL, ready for <img src> / print window
}
