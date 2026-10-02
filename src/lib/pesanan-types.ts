/**
 * Shared API contract for the admin order feature (pesanan).
 *
 * Envelope identical to auth/products/stok:
 *   success → { ok: true, data: ... }
 *   failure → { ok: false, error: { code, message, details? } }
 *
 * Design notes:
 * - Orders are addressed by `noPesanan` ("ORD-YYYYMMDD-NNN") at the API edge —
 *   the identifier the UI already shows — not numeric DB ids.
 * - Status values are display strings the frontend badge map already handles:
 *   "Menunggu Pembayaran", "Diproses", "Selesai", "Dibatalkan",
 *   "Dikembalikan", "Menunggu Konfirmasi".
 * - Metode bayar is a display string ("Tunai", "QRIS", "Bank Transfer",
 *   "Kredit — Cicil 6 Bulan").
 *
 * Client-safe: type-only, no server imports.
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type PesananErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INVALID_VOUCHER"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PesananPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Pesanan
// ---------------------------------------------------------------------------

export type PesananStatus =
  | "Menunggu Pembayaran"
  | "Diproses"
  | "Selesai"
  | "Dibatalkan"
  | "Dikembalikan"
  | "Menunggu Konfirmasi";

/** Asal pesanan: offline (POS/kasir) atau commerce (toko online). */
export type PesananAsal = "offline" | "commerce";

/** Status pengiriman pesanan commerce (terpisah dari status utama). */
export type StatusPengiriman = "Menunggu Kurir" | "Diantar" | "Selesai";

/** Kurir yang memproses pengiriman (dari users, role kurir). */
export interface KurirDTO {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  role: string;
}

export interface PesananItemDTO {
  id: number;
  produkId: number | null;
  produkSatuanId: number | null;
  satuanNama: string | null;
  namaProduk: string;
  qty: number;
  harga: number;
  subtotal: number;
}

/** Pelanggan ter-join (dari tabel pelanggan via pelanggan_id). */
export interface PelangganRingkas {
  id: number;
  kode: string;
  nama: string;
  email: string | null;
  telepon: string | null;
  alamat: string | null;
  kecamatan: string | null;
  isMember: boolean;
}

export interface PesananDTO {
  id: number;
  noPesanan: string;
  asal: PesananAsal;
  kasirNama: string;
  kasirUsername: string;
  status: PesananStatus;
  metodeBayar: string;
  periodeKredit: string | null;
  voucher: string | null;
  diskonPersen: number;
  subtotal: number;
  diskonAmount: number;
  total: number;
  uangDiterima: number;
  kembalian: number;
  /** Cash in / out opsional dari POS (untuk laporan keuangan). */
  cashIn: number | null;
  cashOut: number | null;
  catatan: string | null;
  createdAt: string;
  items: PesananItemDTO[];
  // Pelanggan commerce (opsional, dari JOIN pelanggan_id → pelanggan)
  pelanggan: PelangganRingkas | null;
  statusPengiriman: StatusPengiriman | null;
  kurir: KurirDTO | null;
  catatanPengiriman: string | null;
  dikirimAt: string | null;
  selesaiAt: string | null;
}

export interface CreatePesananItemInput {
  produkId?: number | null;
  /** Satuan produk terpilih (produk_satuan.id) — utk mengurangi stok dari satuan yg benar. */
  produkSatuanId?: number | null;
  namaProduk: string;
  qty: number;
  harga: number;
}

export interface CreatePesananInput {
  items: CreatePesananItemInput[];
  metodeBayar: string;
  periodeKredit?: string | null;
  voucher?: string | null;
  uangDiterima?: number;
  catatan?: string | null;
  // Asal & commerce (default offline). Commerce WAJIB pelangganId.
  asal?: PesananAsal;
  pelangganId?: number | null;
  /** Cash in / out opsional dari POS. */
  cashIn?: number | null;
  cashOut?: number | null;
  // --- Tambahan aplikasi POS (opsional; tidak dikirim → perilaku lama) ---
  /** Nomor pesanan dari perangkat POS — kunci idempotensi push offline. */
  noPesanan?: string | null;
  /** Waktu transaksi terjadi di perangkat (ISO-8601), bukan waktu push. */
  terjadiAt?: string | null;
}

/** Update pengiriman commerce (assign kurir / ubah status). */
export interface UpdatePengirimanInput {
  kurirId?: number | null;
  statusPengiriman?: StatusPengiriman;
}

// ---------------------------------------------------------------------------
// Retur
// ---------------------------------------------------------------------------

export interface ReturItemInput {
  pesananItemId?: number | null;
  namaProduk: string;
  qty: number;
  harga: number;
}

export interface CreateReturInput {
  tipe: "semua" | "sebagian";
  alasan: string;
  catatan?: string | null;
  items: ReturItemInput[];
  /** Nomor retur dari perangkat POS — kunci idempotensi push offline. */
  noRetur?: string | null;
}

export interface ReturItemDTO {
  id: number;
  pesananItemId: number | null;
  namaProduk: string;
  qty: number;
  harga: number;
  subtotal: number;
}

export interface ReturDTO {
  id: number;
  noRetur: string;
  noPesanan: string;
  tipe: "semua" | "sebagian";
  alasan: string;
  catatan: string | null;
  totalRefund: number;
  status: "Selesai" | "Diproses";
  createdAt: string;
  kasirNama: string;
  kasirUsername: string;
  items: ReturItemDTO[];
}

// ---------------------------------------------------------------------------
// Produk untuk search di form buat pesanan
// ---------------------------------------------------------------------------

export interface PesananProdukOption {
  produkId: number;
  sku: string;
  nama: string;
  harga: number;      // harga satuan pertama (harga terkecil)
  stok: number;       // total stok (semua satuan)
  /** Satuan produk utk dipilih saat menambah item pesanan. */
  satuan: Array<{ produkSatuanId: number; satuanNama: string; harga: number }>;
}

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export interface PesananListParams {
  page?: number;
  pageSize?: number;
  search?: string;      // no_pesanan
  status?: string;
  asal?: PesananAsal;
  statusPengiriman?: string;
  dateFrom?: string;    // ISO date (YYYY-MM-DD)
  dateTo?: string;      // ISO date (YYYY-MM-DD)
  sortBy?: "no_pesanan" | "created_at" | "kasir_nama" | "total" | "metode_bayar";
  sortOrder?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Kredit (pesanan dengan metode bayar Kredit + pembayaran angsuran)
// ---------------------------------------------------------------------------

/** Satu catatan pembayaran angsuran kredit. */
export interface KreditPembayaranDTO {
  id: number;
  jumlah: number;
  dicatatOleh: string;
  catatan: string | null;
  createdAt: string;
}

/** Pesanan kredit + agregat pembayaran (terbayar / sisa). */
export interface KreditDTO {
  id: number;
  noPesanan: string;
  kasirNama: string;
  kasirUsername: string;
  status: PesananStatus;
  metodeBayar: string;          // "Kredit — Cicil 6 Bulan"
  periodeKredit: string | null; // "Cicil 6 Bulan"
  total: number;
  subtotal: number;
  diskonAmount: number;
  createdAt: string;
  items: PesananItemDTO[];
  totalDibayar: number;
  sisa: number;
  isLunas: boolean;
  pembayaran: KreditPembayaranDTO[];
}

export interface KreditListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "no_pesanan" | "created_at" | "kasir_nama" | "total" | "totalDibayar";
  sortOrder?: "asc" | "desc";
}

export interface AddKreditPembayaranInput {
  jumlah: number;
  catatan?: string | null;
  /** Ref dari perangkat POS — kunci idempotensi push offline angsuran. */
  clientRef?: string | null;
}

// ---------------------------------------------------------------------------
// Pengembalian (retur) — list
// ---------------------------------------------------------------------------

export interface ReturListParams {
  page?: number;
  pageSize?: number;
  search?: string;      // no_retur / no_pesanan
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "no_retur" | "created_at" | "no_pesanan" | "total_refund";
  sortOrder?: "asc" | "desc";
}
