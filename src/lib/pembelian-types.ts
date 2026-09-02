/**
 * Shared API contract untuk fitur admin pembelian.
 *
 * Pembelian = pencatatan pembelian produk dari supplier (pemasok), agar
 * keuntungan bisa dihitung (harga jual vs harga beli). Pembelian menambah
 * stok produk ke satuan terpilih.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type PembelianErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "SUPPLIER_NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface PembelianItemDTO {
  id: number;
  produkId: number | null;
  produkSatuanId: number | null;
  satuanNama: string | null;
  sku: string;
  namaProduk: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  diskon: number;         // persen
  subtotal: number;       // setelah diskon (per baris)
}

export interface SupplierRingkas {
  id: number;
  kode: string;
  nama: string;
  kota: string | null;
  telepon: string | null;
}

export interface PembelianDTO {
  id: number;
  noPembelian: string;
  tanggal: string;
  supplier: SupplierRingkas;
  ppn: number;            // persen
  catatan: string | null;
  createdAt: string;
  items: PembelianItemDTO[];
  /** Ringkasan (server-computed). */
  totalPembelian: number;      // subtotal items (sebelum ppn)
  totalPpn: number;
  grandTotal: number;
  estimasiLaba: number;        // jika semua qty terjual dgn harga jual
}

export interface CreatePembelianItemInput {
  produkId?: number | null;
  produkSatuanId?: number | null;
  sku: string;
  namaProduk: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  diskon?: number;
}

export interface CreatePembelianInput {
  tanggal: string;
  supplierId: number;
  ppn?: number;
  catatan?: string | null;
  items: CreatePembelianItemInput[];
}

export interface PembelianListResponse {
  items: PembelianDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
