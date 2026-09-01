/**
 * Shared API contract for the admin auth feature.
 *
 * Every endpoint returns the same envelope:
 *   success → { ok: true, data: ... }
 *   failure → { ok: false, error: { code, message, details? } }
 *
 * Input types = what the caller sends. Output types = what the server
 * returns (server-generated fields included, secrets excluded).
 *
 * NOTE: intentionally free of server-only imports — the client login page
 * imports these types (type-only, erased at compile time).
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface RegisterAdminInput {
  /** 3–50 chars: letters, digits, dot, underscore. */
  username: string;
  email: string;
  /** Min 8 chars, at least one letter and one digit. */
  password: string;
  fullName: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export interface AdminProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "manajemen" | "superadmin";
  createdAt: string;
}

export interface AuthSuccess {
  admin: AdminProfile;
}

// ---------------------------------------------------------------------------
// Error codes (single consistent set across all auth endpoints)
// ---------------------------------------------------------------------------

export type AuthErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "USERNAME_TAKEN"
  | "EMAIL_TAKEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: AuthErrorCode;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Endpoint map (implementation of this contract)
// ---------------------------------------------------------------------------

// POST   /api/backoffice-sudirja/auth/register → 201 { ok, data: { admin } }
// POST   /api/backoffice-sudirja/auth/login    → 200 { ok, data: { admin } }   + Set-Cookie
// POST   /api/backoffice-sudirja/auth/logout   → 200 { ok, data: { message } } + clears cookie
// GET    /api/backoffice-sudirja/auth/me       → 200 { ok, data: { admin } } | 401
