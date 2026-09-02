/**
 * Shared API contract untuk fitur dashboard admin.
 *
 * Dashboard menampilkan ringkasan aktivitas toko dari data REAL (pesanan,
 * produk, pelanggan) pada rentang waktu tertentu — bukan angka dummy.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type DashboardErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** Satu titik grafik penjualan per hari. */
export interface GrafikPenjualanPoint {
  label: string;       // "01 Agu" / "Sen" — utk sumbu X
  tanggal: string;     // ISO yyyy-MM-dd
  total: number;       // total nominal penjualan hari itu
  jumlah: number;      // jumlah pesanan hari itu
}

export interface PesananTerbaruRow {
  noPesanan: string;
  asal: "offline" | "commerce";
  nama: string;        // pelanggan (commerce) / kasir (offline)
  total: number;
  status: string;
  waktu: string;       // ISO datetime
}

export interface DashboardSummary {
  totalPenjualan: number;    // nominal total pesanan (non-dibatalkan) pada rentang
  totalPesanan: number;      // jumlah pesanan pada rentang
  produkTerjual: number;     // total qty barang terjual pada rentang
  pelangganBaru: number;     // pelanggan baru (commerce) pada rentang
  /** Naik/turun persen vs periode sebelumnya (null bila tak ada data). */
  pertumbuhan: {
    totalPenjualan: number | null;
    totalPesanan: number | null;
    produkTerjual: number | null;
    pelangganBaru: number | null;
  };
}

export interface DashboardStatusRingkasan {
  selesai: number;
  diproses: number;
  lainnya: number;
  total: number;
}

export interface DashboardDTO {
  range: "7" | "30" | "year";
  summary: DashboardSummary;
  grafik: GrafikPenjualanPoint[];
  statusHariIni: DashboardStatusRingkasan;
  pesananTerbaru: PesananTerbaruRow[];
}
