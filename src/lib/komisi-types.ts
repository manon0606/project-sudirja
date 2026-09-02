/**
 * Shared API contract untuk fitur komisi.
 *
 * Komisi: user (kasir, kurir, dll) yang terlibat dalam proses order dapat
 * memperoleh komisi berdasarkan aturan (persen per role) dari dasar komisi
 * (subtotal/total pesanan). Role bersifat dinamis (tabel `roles`); setiap
 * role otomatis punya baris di komisi_settings.
 *
 * Client-safe: type-only, tanpa server imports.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface KomisiSettingDTO {
  role: string;             // kode role (dinamis)
  roleLabel: string;        // label dari roles
  persenKomisi: number;
  aktif: boolean;
}

/** Daftar setting komisi — semua role yang ada (termasuk role dinamis). */
export type KomisiSettingsList = KomisiSettingDTO[];

// ---------------------------------------------------------------------------
// Transaksi komisi
// ---------------------------------------------------------------------------

export interface KomisiTransaksiDTO {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  noPesanan: string;
  dasarKomisi: number;
  persenKomisi: number;
  nominalKomisi: number;
  status: "terhitung" | "dibayar";
  createdAt: string;
}

export interface KomisiRekapDTO {
  userId: number;
  userName: string;
  role: string;
  roleLabel: string;
  totalTransaksi: number;
  totalNominal: number;
  totalDibayar: number;
  totalBelumDibayar: number;
}

export interface KomisiRekapResponse {
  items: KomisiRekapDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type KomisiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";
