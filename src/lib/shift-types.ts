/**
 * Kontrak shift kasir & kas (Fase 4).
 *
 *   POST /api/backoffice-sudirja/shift/buka   → buka shift (idempoten `clientRef`)
 *   POST /api/backoffice-sudirja/shift/tutup  → tutup shift + rekap setoran
 *   POST /api/backoffice-sudirja/shift/kas    → catat kas masuk/keluar
 *   GET  /api/backoffice-sudirja/shift        → daftar shift
 *   GET  /api/backoffice-sudirja/shift/[kode] → detail + rekap + pergerakan kas
 *
 * Semua endpoint tulis menerima `clientRef` sebagai kunci idempotensi push
 * offline — mengirim ulang tidak membuat baris kedua.
 *
 * Catatan rekap:
 * * Transaksi dihitung dari `pesanan` pada jendela `opened_at .. closed_at`
 *   untuk `kasir_username` yang sama (bukan per perangkat).
 * * Kas masuk/keluar dihitung dari tabel `shift_kas` (aksi Cash In/Out),
 *   BUKAN dari kolom `cash_in`/`cash_out` pada `pesanan`.
 * * Asumsi setoran: seluruh refund keluar sebagai uang tunai dari laci.
 *
 * Client-safe: type-only, tanpa server imports.
 */

export type ShiftErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

/** Rekap satu shift — dipakai laporan setoran saat tutup shift. */
export interface RekapShiftDTO {
  jumlahTransaksi: number;
  totalPenjualan: string;
  totalTunai: string;
  totalNonTunai: string;
  totalKredit: string;
  /** Nilai refund yang sudah selesai pada jendela shift ini. */
  retur: string;
  kasMasuk: string;
  kasKeluar: string;
  /** Uang yang seharusnya ada di laci: uang awal + tunai + kas masuk − kas keluar − retur. */
  harapanKas: string;
}

export interface ShiftKasDTO {
  id: number;
  tipe: "masuk" | "keluar";
  jumlah: string;
  catatan: string | null;
  dicatatOleh: string;
  occurredAt: string;
}

export interface ShiftDTO {
  id: number;
  kode: string;
  deviceId: string;
  cashierId: number | null;
  cashierUsername: string;
  cashierNama: string;
  status: "Buka" | "Tutup";
  openingBalance: string;
  /** Uang fisik yang dihitung saat tutup. */
  closingBalance: string | null;
  /** Yang disetor/diserahkan — default sama dengan `harapanKas`. */
  setoran: string | null;
  /** `closingBalance` − `harapanKas` (negatif = kurang). */
  selisih: string | null;
  catatan: string | null;
  openedAt: string;
  closedAt: string | null;
  /** Hanya diisi pada detail & saat tutup. */
  rekap?: RekapShiftDTO;
}

export interface ShiftDetailDTO extends ShiftDTO {
  kas: ShiftKasDTO[];
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface BukaShiftInput {
  /** Kode shift; bila kosong dihasilkan server (`SHIFT-YYYYMMDD-NNN`). */
  kode?: string | null;
  deviceId: string;
  cashierId?: number | null;
  cashierUsername: string;
  cashierNama: string;
  /** Nominal uang awal di kasir. */
  openingBalance: string;
  clientRef?: string | null;
  /** Waktu shift dibuka di perangkat (ISO-8601) — untuk transaksi offline. */
  openedAt?: string | null;
}

export interface TutupShiftInput {
  kode: string;
  /** Uang fisik hasil hitungan saat tutup. */
  closingBalance: string;
  setoran?: string | null;
  catatan?: string | null;
  clientRef?: string | null;
  closedAt?: string | null;
}

export interface ShiftKasInput {
  /** Kode shift pemilik pergerakan kas ini. */
  kode: string;
  tipe: "masuk" | "keluar";
  jumlah: string;
  catatan?: string | null;
  dicatatOleh: string;
  clientRef: string;
  occurredAt?: string | null;
}

// ---------------------------------------------------------------------------
// Endpoint map
// ---------------------------------------------------------------------------

// POST /api/backoffice-sudirja/shift/buka    → 201 { ok, data: ShiftDTO } | 200 bila duplikat
// POST /api/backoffice-sudirja/shift/tutup   → 200 { ok, data: ShiftDTO } (berisi rekap)
// POST /api/backoffice-sudirja/shift/kas     → 201 { ok, data: ShiftKasDTO }
// GET  /api/backoffice-sudirja/shift         → 200 { ok, data: { shifts } }
// GET  /api/backoffice-sudirja/shift/[kode]  → 200 { ok, data: ShiftDetailDTO }
