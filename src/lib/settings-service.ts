import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { execute, query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { ApiKeyGeneratedDTO, ApiKeyVerifyResult, SettingsDTO } from "@/lib/settings-types";

interface SettingsRow extends RowDataPacket {
  id: number;
  is_online: number;
  api_key_hash: string | null;
  api_key_hint: string | null;
  updated_at: Date | string;
}

const API_KEY_PREFIX = "sk_pos_";        // format key: sk_pos_<random hex>
const API_KEY_RANDOM_BYTES = 32;         // 64 hex chars

function hashKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function randomApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString("hex")}`;
}

function hintOf(apiKey: string): string {
  // Tampilkan 4 karakter pertama + "…" → "sk_p…"
  return `${apiKey.slice(0, 4)}…`;
}

async function getRow(): Promise<SettingsRow> {
  const result = await query<SettingsRow[]>("SELECT id, is_online, api_key_hash, api_key_hint, updated_at FROM app_settings WHERE id = 1 LIMIT 1");
  return result.rows[0];
}

/** DTO aman untuk UI — tanpa hash, hanya hint. */
export async function getSettings(): Promise<SettingsDTO> {
  const row = await getRow();
  if (!row) {
    // Defensive: baris seed hilang → buat ulang.
    await execute("INSERT INTO app_settings (id, is_online) VALUES (1, 0)");
    return { isOnline: false, apiKeyHint: null, hasApiKey: false, updatedAt: new Date().toISOString() };
  }
  return {
    isOnline: row.is_online === 1,
    apiKeyHint: row.api_key_hint,
    hasApiKey: !!row.api_key_hash,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

/** Set mode online/offline (tanpa mengubah key). */
export async function setOnline(isOnline: boolean): Promise<SettingsDTO> {
  await execute("UPDATE app_settings SET is_online = ? WHERE id = 1", [isOnline ? 1 : 0]);
  return getSettings();
}

/**
 * Generate / regenerate API key. Key plaintext dikembalikan SEKALI (untuk
 * disalin user); yang disimpan di DB hanya hash + hint.
 */
export async function regenerateApiKey(): Promise<ApiKeyGeneratedDTO> {
  const apiKey = randomApiKey();
  await execute(
    "UPDATE app_settings SET api_key_hash = ?, api_key_hint = ? WHERE id = 1",
    [hashKey(apiKey), hintOf(apiKey)],
  );
  return { apiKey, hint: hintOf(apiKey) };
}

/**
 * Verifikasi API key POS (dipakai guard endpoint yang diakses POS).
 * Berlaku hanya jika is_online = 1 DAN key cocok (constant-time compare).
 */
export async function verifyPosApiKey(apiKey: string | null): Promise<ApiKeyVerifyResult> {
  if (!apiKey) return { valid: false, isOnline: false };
  const row = await getRow();
  if (!row || !row.api_key_hash) return { valid: false, isOnline: row?.is_online === 1 };
  const expected = Buffer.from(row.api_key_hash, "hex");
  const actual = Buffer.from(hashKey(apiKey), "hex");
  const keyOk = expected.length === actual.length && timingSafeEqual(expected, actual);
  return { valid: keyOk && row.is_online === 1, isOnline: row.is_online === 1 };
}
