/**
 * Shared API contract untuk fitur admin pelanggan.
 *
 * Pelanggan adalah entitas master yang dipakai pesanan commerce (toko online).
 * Saat pesanan ber-flag asal='commerce', wajib terkait pelanggan via FK
 * pesanan.pelanggan_id. Pelanggan dibuat manual oleh admin, dan nanti via
 * API register toko online (createPelanggan tersedia).
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type PelangganErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_KODE"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface PelangganDTO {
  id: number;
  kode: string;
  nama: string;
  email: string | null;
  telepon: string | null;
  alamat: string | null;
  kecamatan: string | null;
  isMember: boolean;
  isActive: boolean;
  createdAt: string;
  /** Statistik pesanan commerce terkait (opsional, diisi saat detail). */
  totalTransaksi?: number;
  totalBelanja?: number;
}

export interface CreatePelangganInput {
  kode?: string;            // optional — auto "CUST-xxx" bila kosong
  nama: string;
  email?: string | null;
  telepon?: string | null;
  alamat?: string | null;
  kecamatan?: string | null;
  isMember?: boolean;
  isActive?: boolean;
}

export type UpdatePelangganInput = Partial<Omit<CreatePelangganInput, "kode">>;

export interface PelangganListResponse {
  items: PelangganDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BulkPelangganResult {
  success: number;
  failures: Array<{ row: number; nama: string; message: string }>;
}
