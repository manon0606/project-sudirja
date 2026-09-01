/**
 * Shared API contract untuk fitur admin user operasional.
 *
 * "User" di sini BUKAN admin login (tabel admins) — melainkan pengguna
 * operasional (kasir, kurir, gudang, supervisor, owner) yang punya role
 * sendiri dan dapat menerima komisi dari transaksi.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type UserRole = "kasir" | "kurir" | "gudang" | "supervisor" | "owner";

export const USER_ROLES: UserRole[] = ["kasir", "kurir", "gudang", "supervisor", "owner"];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  kasir: "Kasir",
  kurir: "Kurir",
  gudang: "Gudang",
  supervisor: "Supervisor",
  owner: "Owner",
};

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type UserErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export interface UserDTO {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Input untuk create user (password wajib). */
export interface CreateUserInput {
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}

/** Input untuk update user (partial; password opsional). */
export interface UpdateUserInput {
  username?: string;
  password?: string;
  fullName?: string;
  role?: UserRole;
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
