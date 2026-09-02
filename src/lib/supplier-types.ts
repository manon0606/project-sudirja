/**
 * Shared API contract untuk fitur admin supplier (pemasok barang).
 *
 * Supplier menyimpan data pemasok lengkap sesuai format:
 * NAMA, ALAMAT, KOTA, PROVINSI, NEGARA, KODEPOS, TELEPON, FAX, BANK,
 * NOREK, ATASNAMA, KONTAK, EMAIL, KETERANGAN.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type SupplierErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DUPLICATE_KODE"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export interface SupplierDTO {
  id: number;
  kode: string;
  nama: string;
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  negara: string | null;
  kodepos: string | null;
  telepon: string | null;
  fax: string | null;
  bank: string | null;
  norek: string | null;
  atasnama: string | null;
  kontak: string | null;
  email: string | null;
  keterangan: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSupplierInput {
  kode?: string;            // optional — auto "SUP-xxx" bila kosong
  nama: string;
  alamat?: string | null;
  kota?: string | null;
  provinsi?: string | null;
  negara?: string | null;
  kodepos?: string | null;
  telepon?: string | null;
  fax?: string | null;
  bank?: string | null;
  norek?: string | null;
  atasnama?: string | null;
  kontak?: string | null;
  email?: string | null;
  keterangan?: string | null;
  isActive?: boolean;
}

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, "kode">>;

export interface SupplierListResponse {
  items: SupplierDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BulkSupplierResult {
  success: number;
  failures: Array<{ row: number; nama: string; message: string }>;
}
