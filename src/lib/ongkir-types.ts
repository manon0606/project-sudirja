/**
 * Shared API contract untuk fitur admin pemetaan & ongkir.
 *
 * Memetakan kecamatan → biaya ongkos kirim. Envelope konsisten:
 * { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type OngkirErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_CODE"
  | "DUPLICATE_KECAMATAN"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface OngkirDTO {
  id: number;
  kode: string;
  kecamatan: string;
  ongkir: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateOngkirInput {
  kode: string;
  kecamatan: string;
  ongkir: number;
  isActive?: boolean;
}

export type UpdateOngkirInput = Partial<CreateOngkirInput>;

export interface OngkirListResponse {
  items: OngkirDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BulkOngkirResult {
  success: number;
  failures: Array<{ row: number; kode: string; message: string }>;
}
