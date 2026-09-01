/**
 * Shared API contract for the admin stock feature (stok).
 *
 * Envelope identical to auth/products:
 *   success → { ok: true, data: ... }
 *   failure → { ok: false, error: { code, message, details? } }
 *
 * Design notes:
 * - Stock lives per (produk × satuan) — one row in `stok` per row in
 *   `produk_satuan`. A product with 2 satuan has 2 stok rows.
 * - Resources are addressed by product SKU at the API edge; the client does
 *   not need numeric DB ids.
 * - Mutations (PATCH) record a stok_history row so the UI can show an
 *   audit trail and the CSV report stays real.
 *
 * Client-safe: type-only, no server imports.
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type StokErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NEGATIVE_STOCK"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface StokPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Stok (per produk × satuan)
// ---------------------------------------------------------------------------

/** Satu baris stok untuk satu satuan dari sebuah produk. */
export interface StokSatuanDTO {
  satuanKode: string;   // "SAT-003"
  satuanNama: string;   // "Pcs"
  jumlahUnit: number;   // unit dasar di dalam satuan ini
  kodeItem: string;     // identitas barcode (dari produk_satuan)
  harga: number;        // harga per satuan
  qty: number;          // stok fisik saat ini
  bufferStok: number;   // stok cadangan
  batasBawah: number | null; // batas bawah utk tanda restock
  /** true bila qty <= batasBawah (untuk pewarnaan merah di tabel). */
  isLow: boolean;
}

export interface StokDTO {
  sku: string;
  nama: string;
  kategoriKode: string;
  kategoriNama: string;
  merkKode: string;
  merkNama: string;
  status: "active" | "inactive";
  gambarUrl: string;
  /** Total stok = penjumlahan qty semua satuan (tampilan tabel). */
  totalQty: number;
  /** Total buffer = penjumlahan bufferStok semua satuan. */
  totalBuffer: number;
  /** true bila ada satuan dengan qty <= batas_bawah. */
  isLow: boolean;
  satuan: StokSatuanDTO[];
}

// ---------------------------------------------------------------------------
// Mutasi stok
// ---------------------------------------------------------------------------

export interface StokHistoryDTO {
  id: number;
  tipe: "in" | "out" | "adjust";
  qtyDelta: number;
  qtySebelum: number;
  qtySesudah: number;
  catatan: string | null;
  createdAt: string;
  // denormalized utk tabel riwayat (diisi server via join)
  sku: string;
  nama: string;
  satuanNama: string;
  kodeItem: string;
}

export interface UpdateStokSatuanInput {
  satuanKode: string;
  qty?: number;
  bufferStok?: number;
  batasBawah?: number | null;
}

export interface UpdateStokInput {
  /** Catatan mutasi — wajib bila ada perubahan qty (untuk riwayat). */
  catatan?: string;
  satuan: UpdateStokSatuanInput[];
}

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export interface StokListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  kategoriKode?: string;
  merkKode?: string;
  status?: "active" | "inactive" | "";
  lowOnly?: boolean;
  sortBy?: "sku" | "nama" | "kategori" | "totalQty" | "totalBuffer";
  sortOrder?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Bulk upload stok (CSV) — template: SKU, Stok Baru, Catatan
// ---------------------------------------------------------------------------

export interface BulkUpdateStokInput {
  rows: Array<{
    sku: string;
    qty: number;
    /** Nama/kode satuan tujuan (opsional). Kosong → satuan pertama produk. */
    satuan?: string;
    catatan?: string;
  }>;
}

export interface BulkUpdateStokResult {
  success: number;
  failures: Array<{ row: number; sku: string; message: string }>;
}
