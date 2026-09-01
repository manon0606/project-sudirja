/**
 * Shared API contract untuk fitur komisi.
 *
 * Komisi: user operasional (kasir, kurir, dll) yang terlibat dalam proses
 * order dapat memperoleh komisi berdasarkan aturan (persen per role) dari
 * dasar komisi (subtotal/total pesanan).
 *
 * Client-safe: type-only, tanpa server imports.
 */

import type { UserRole } from "@/lib/user-types";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface KomisiSettingDTO {
  role: UserRole;
  persenKomisi: number;
  aktif: boolean;
}

export type KomisiSettingsMap = Record<UserRole, KomisiSettingDTO>;

// ---------------------------------------------------------------------------
// Transaksi komisi
// ---------------------------------------------------------------------------

export interface KomisiTransaksiDTO {
  id: number;
  userId: number;
  userName: string;
  userRole: UserRole;
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
  role: UserRole;
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
