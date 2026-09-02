/**
 * Shared API contract untuk fitur admin settings — konfigurasi API key
 * aplikasi POS.
 *
 * API Key inilah yang dipakai aplikasi POS (yang belum dibuat) untuk
 * mengakses seluruh API (menambah pesanan, dll). Tanpa API key yang valid,
 * aplikasi POS tidak mendapat akses. URL server tidak diperlukan — key
 * dipakai terhadap server ini sendiri.
 *
 * Envelope konsisten: { ok: true, data } / { ok: false, error }.
 * Client-safe: type-only, tanpa server imports.
 */

export type SettingsErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** Representasi settings yang aman dikirim ke client (tanpa hash). */
export interface SettingsDTO {
  isOnline: boolean;
  apiKeyHint: string | null;   // "abcd…" — hanya petunjuk, bukan key penuh
  hasApiKey: boolean;
  updatedAt: string;
}

/** Hasil generate/regenerate API key — key penuh hanya muncul di sini. */
export interface ApiKeyGeneratedDTO {
  apiKey: string;              // ditampilkan sekali, tidak pernah disimpan plaintext
  hint: string;
}

/** Hasil verifikasi API key (dipakai guard POS). */
export interface ApiKeyVerifyResult {
  valid: boolean;
  isOnline: boolean;
}
