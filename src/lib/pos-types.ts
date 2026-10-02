/**
 * Shared API contract untuk fitur aplikasi POS (sudirja-pos, Tauri).
 *
 * Tiga kebutuhan:
 *  1. Login kasir memakai kredensial `users` ber-role kasir di sudirja-next.
 *  2. Persetujuan manajer (tutup shift, cash in/out, diskon, dll.) memakai
 *     password user ber-role manajer — dicatat ke `approval_log`.
 *  3. Daftar user POS untuk cache offline (`users_cache` di SQLite POS).
 *
 * Endpoint POS diakses memakai API key dari halaman Settings (header
 * `X-API-Key`), sama seperti jalur transaksi Fase 1.
 *
 * Client-safe: type-only, tanpa server imports.
 */

export type PosErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "ROLE_NOT_ALLOWED"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/**
 * Ringkasan user POS — sengaja tanpa email/HP dan tanpa hash password.
 * `id` = `users.id` (konsisten dengan `users_cache.server_id` di POS).
 */
export interface PosUserDTO {
  id: number;
  username: string;
  fullName: string;
  /** Kode role dinamis (mis. "kasir", "manajer"). */
  role: string;
  roleLabel: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Login kasir
// ---------------------------------------------------------------------------

export interface PosLoginInput {
  username: string;
  password: string;
}

export interface PosLoginSuccess {
  user: PosUserDTO;
}

// ---------------------------------------------------------------------------
// Persetujuan manajer
// ---------------------------------------------------------------------------

/** Aksi yang lazim butuh persetujuan manajer (bisa ditambah dari POS). */
export const POS_AKSI = [
  "tutup_shift",
  "cash_in",
  "cash_out",
  "diskon",
  "harga_bawah",
  "retur",
] as const;
export type PosAksi = (typeof POS_AKSI)[number];

export interface PosApprovalInput {
  /** Kredensial manajer (role manajer/manajemen). */
  username: string;
  password: string;
  /** Aksi yang disetujui. */
  aksi: string;
  /** Nomor referensi terkait (no_pesanan / kode shift), opsional. */
  refNo?: string | null;
  catatan?: string | null;
  /** Siapa yang mengajukan (username kasir), opsional. */
  dimintaOleh?: string | null;
  /** Kunci idempotensi dari perangkat POS. */
  clientRef?: string | null;
}

export interface PosApprovalSuccess {
  /** Siapa yang menyetujui. */
  disetujui: {
    username: string;
    fullName: string;
    role: string;
    roleLabel: string;
  };
  /** Id baris `approval_log` (untuk jejak audit). */
  logId: number;
  /** Cara persetujuan diberikan — `password` = diverifikasi server. */
  metode: "password";
}

// ---------------------------------------------------------------------------
// Persetujuan yang diperoleh OFFLINE (PIN manajer diverifikasi di perangkat)
// ---------------------------------------------------------------------------

/**
 * Cara persetujuan diberikan — disimpan di `approval_log.metode` supaya audit
 * bisa membedakan yang diverifikasi password server dengan yang cukup dengan
 * PIN manajer di perangkat saat internet mati.
 */
export type PosApprovalMetode = "password" | "pin_offline";

/**
 * Push jejak persetujuan yang diperoleh saat offline. Perangkat sudah
 * memverifikasi PIN manajer lokal (`users_cache.pin_hash`), jadi server hanya
 * mencatat — tidak memverifikasi password.
 */
export interface PosApprovalLogInput {
  /** Username manajer penyetuju (dari `users_cache` perangkat). */
  username: string;
  fullName?: string | null;
  role?: string | null;
  roleLabel?: string | null;
  aksi: string;
  refNo?: string | null;
  catatan?: string | null;
  dimintaOleh?: string | null;
  /** Kunci idempotensi dari perangkat POS. */
  clientRef?: string | null;
}

export interface PosApprovalLogSuccess {
  logId: number;
  metode: PosApprovalMetode;
}

// ---------------------------------------------------------------------------
// Endpoint map (implementasi kontrak ini)
// ---------------------------------------------------------------------------

// POST /api/backoffice-sudirja/pos/auth/login      → 200 { ok, data: { user } }
// POST /api/backoffice-sudirja/pos/approval/verify → 200 { ok, data: { disetujui, logId } }
// GET  /api/backoffice-sudirja/pos/users           → 200 { ok, data: { users } }
