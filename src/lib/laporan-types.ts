/**
 * Shared API contract untuk fitur admin laporan keuangan.
 *
 * Laporan mencatat semua pemasukan & pengeluaran agar keuangan bisa
 * dimonitor jelas. Nilai dihitung REAL-TIME dari data transaksi (pesanan,
 * pembelian, konsinyasi, cash in/out) pada periode tertentu — bukan mock.
 *
 * Definisi:
 *  - Pemasukan  = total penjualan (offline + commerce) + total cash_in pesanan
 *  - Pengeluaran = total pembelian (PO incl. PPN) + konsinyasi yg dibayar ke
 *                  supplier + total cash_out pesanan
 *  - Laba bersih = Pemasukan − Pengeluaran
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type LaporanTipe = "daily" | "monthly" | "yearly" | "custom";

export type LaporanErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// Baris rincian
// ---------------------------------------------------------------------------

export interface LaporanPenjualanRow {
  noPesanan: string;
  tanggal: string;
  asal: "offline" | "commerce";
  kasir: string;
  namaPelanggan: string | null;
  metodeBayar: string;
  subtotal: number;
  diskon: number;
  total: number;
}

export interface LaporanPembelianRow {
  noPembelian: string;
  tanggal: string;
  supplier: string;
  totalPembelian: number;   // subtotal item + biaya bahan repack
  biayaRepack: number;      // Σ biaya bahan repack
  ppn: number;
  grandTotal: number;
  estimasiLaba: number;     // memakai alokasi pecahan (alokasi sudah termasuk biaya repack)
}

export interface LaporanKonsinyasiRow {
  noKonsinyasi: string;
  tanggal: string;
  supplier: string;
  totalNilaiKonsinyasi: number;   // Σ harga_beli × qty_konsinyasi
  totalDibayar: number;           // Σ harga_beli × qty_terjual (yg dibayar ke supplier)
  totalDikembalikan: number;      // Σ harga_beli × qty_dikembalikan
}

export interface LaporanCashRow {
  tanggal: string;
  noPesanan: string;
  tipe: "in" | "out";
  jumlah: number;
  keterangan: string;
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

export interface LaporanSummary {
  totalPenjualanOffline: number;
  totalPenjualanOnline: number;
  totalPenjualan: number;
  totalCashIn: number;
  totalPemasukan: number;
  totalPembelian: number;
  totalKonsinyasiDibayar: number;
  totalCashOut: number;
  totalPengeluaran: number;
  labaBersih: number;
  jumlahTransaksi: number;    // total pesanan (bukan dibatalkan/dikembalikan)
}

// ---------------------------------------------------------------------------
// DTO laporan
// ---------------------------------------------------------------------------

export interface LaporanDTO {
  id: string;                 // "LAP-YYYYMMDD-HHMMSS"
  tipe: LaporanTipe;
  tanggalPembuatan: string;
  periodeMulai: string;
  periodeAkhir: string;
  summary: LaporanSummary;
  rincian: {
    penjualan: LaporanPenjualanRow[];
    pembelian: LaporanPembelianRow[];
    konsinyasi: LaporanKonsinyasiRow[];
    cashFlow: LaporanCashRow[];
  };
}
