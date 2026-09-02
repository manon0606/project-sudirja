/**
 * Shared API contract untuk fitur admin user & role.
 *
 * Desain (hasil konfirmasi flow):
 *  - Admin = akun login (username + password di tabel `admins`).
 *  - Setiap admin punya 1 baris `users` terkait (FK admin_id) yang
 *    menyimpan data pribadi (nama, HP, email) + role.
 *  - Role bersifat dinamis (tabel `roles`) + permission (kode fitur).
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

/** Role dinamis — cukup pakai string kode role. */
export type UserRole = string;

/** Kode fitur admin (identik dgn id menu di AdminSidebar). */
export const FEATURE_CODES = [
  "dashboard",
  "pesanan",
  "produk",
  "stok",
  "promo",
  "user",
  "pembelian",
  "konsinyasi",
  "laporan",
  "pelanggan",
  "commerce",
  "pemetaan",
  "settings",
] as const;

export type FeatureCode = (typeof FEATURE_CODES)[number];

export type UserErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "ROLE_NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface UserDTO {
  id: number;
  adminId: number | null;
  username: string;
  fullName: string;
  role: string;           // kode role (dinamis)
  roleLabel: string;      // label role dari tabel roles
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Input create user — password disimpan di admins (akun login). */
export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

/** Input update user — password opsional (di admins). */
export interface UpdateUserInput {
  username?: string;
  password?: string;
  fullName?: string;
  role?: string;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

export interface UserListResponse {
  items: UserDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface BulkUserResult {
  success: number;
  failures: Array<{ row: number; username: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface RoleDTO {
  id: number;
  name: string;           // kode role
  label: string;
  permissions: string[];  // daftar kode fitur
  isSystem: boolean;
}

export interface CreateRoleInput {
  name: string;
  label: string;
  permissions: string[];
}

export type UpdateRoleInput = Partial<Pick<CreateRoleInput, "label" | "permissions">>;
