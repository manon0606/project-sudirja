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

export interface PembelianPecahanDTO {
  id: number;
  produkSatuanId: number;
  satuanNama: string | null;
  qty: number;
  /** Gramasi/isi (mis. 250, 500, 750) — dasar alokasi harga beli. */
  isiBase: number | null;
  /** HPP per unit pecahan (hasil alokasi harga beli item). */
  hargaBeliAlokasi: number;
  subtotalAlokasi: number;
  /** Harga jual satuan pecahan saat pembelian; null bila tidak diketahui. */
  hargaJualSatuan: number | null;
}

export interface PembelianBahanDTO {
  id: number;
  namaBarang: string;
  biaya: number;
}

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
  /** Baris hasil pecahan/repack — kosong bila item langsung masuk satuan beli. */
  pecahan: PembelianPecahanDTO[];
  /** Toggle repack (desain V3.1) + target jumlah hasil repack. */
  isRepack: boolean;
  jumlahRepack: number;
  /** Bahan kebutuhan repack (tidak masuk stok, menambah biaya & mengurangi laba). */
  bahan: PembelianBahanDTO[];
  /** Σ biaya bahan item ini (server-computed). */
  biayaRepack: number;
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
  totalPembelian: number;      // subtotal items + biaya repack (sebelum ppn)
  totalBiayaRepack: number;    // Σ biaya bahan repack
  totalPpn: number;
  grandTotal: number;
  estimasiLaba: number;        // jika semua qty terjual dgn harga jual
}

export interface CreatePembelianPecahanInput {
  produkSatuanId: number;
  qty: number;
  /** Gramasi/isi; dipakai untuk alokasi proporsional bila hargaBeliAlokasi kosong. */
  isiBase?: number | null;
  /** HPP per unit pecahan; kosong → alokasi otomatis proporsional. */
  hargaBeliAlokasi?: number | null;
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
  /** Bila diisi: stok masuk ke satuan-satuan pecahan, bukan ke produkSatuanId item. */
  pecahan?: CreatePembelianPecahanInput[];
  /** Toggle repack + target jumlah hasil (desain V3.1). */
  isRepack?: boolean;
  jumlahRepack?: number;
  /** Bahan kebutuhan repack; biaya menambah biaya pembelian item. */
  bahan?: CreatePembelianBahanInput[];
}

export interface CreatePembelianBahanInput {
  namaBarang: string;
  biaya: number;
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
