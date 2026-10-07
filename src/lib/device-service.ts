import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { execute, query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { PosDeviceDTO, PosDeviceRegisteredDTO } from "@/lib/sync-types";

/**
 * Token per perangkat POS (FR-02) — menggantikan satu API key global supaya
 * satu perangkat yang bermasalah bisa dicabut tanpa memutus perangkat lain.
 *
 * Format token: `dev_<64 hex>` (dibedakan dari key global `sk_pos_…`).
 * Yang disimpan hanya SHA-256 token — sama seperti key global di Settings.
 */

const DEVICE_TOKEN_PREFIX = "dev_";

interface DeviceRow extends RowDataPacket {
  id: number;
  device_id: string;
  nama: string;
  token_hash: string;
  token_hint: string;
  is_active: number;
  last_seen_at: Date | string | null;
  created_at: Date | string;
  revoked_at: Date | string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function randomToken(): string {
  return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
}

function hintOf(token: string): string {
  // Tampilkan `dev_a1b2…` — cukup utk mengenali, tak cukup utk dipakai.
  return `${token.slice(0, 8)}…`;
}

function iso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function isoOrNull(v: Date | string | null): string | null {
  return v === null ? null : iso(v);
}

function toDTO(row: DeviceRow): PosDeviceDTO {
  return {
    id: row.id,
    deviceId: row.device_id,
    nama: row.nama,
    tokenHint: row.token_hint,
    isActive: row.is_active === 1,
    lastSeenAt: isoOrNull(row.last_seen_at),
    createdAt: iso(row.created_at),
    revokedAt: isoOrNull(row.revoked_at),
  };
}

/**
 * Daftarkan (atau daftarkan ulang) satu perangkat POS.
 *
 * Token plaintext hanya dikembalikan SEKALI di sini; memanggil lagi dengan
 * `device_id` yang sama akan MENGELUARKAN token baru dan menonaktifkan yang lama
 * (cara mengganti token yang hilang).
 */
export async function registerDevice(
  deviceId: string,
  nama: string,
): Promise<PosDeviceRegisteredDTO> {
  const token = randomToken();
  await execute(
    `INSERT INTO pos_device (device_id, nama, token_hash, token_hint, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       nama = VALUES(nama),
       token_hash = VALUES(token_hash),
       token_hint = VALUES(token_hint),
       is_active = 1,
       revoked_at = NULL`,
    [deviceId, nama, hashToken(token), hintOf(token)],
  );
  const daftar = await listDevices();
  const device = daftar.find((d) => d.deviceId === deviceId);
  if (!device) throw new Error("Perangkat gagal dicatat.");
  return { device, token };
}

/** Cabut token satu perangkat. Idempoten — mencabut yang sudah cabut tidak apa-apa. */
export async function revokeDevice(deviceId: string): Promise<PosDeviceDTO | null> {
  await execute(
    `UPDATE pos_device
     SET is_active = 0, revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
     WHERE device_id = ?`,
    [deviceId],
  );
  const daftar = await listDevices();
  return daftar.find((d) => d.deviceId === deviceId) ?? null;
}

/** Daftar seluruh perangkat terdaftar — hanya metadata, tanpa token. */
export async function listDevices(): Promise<PosDeviceDTO[]> {
  const { rows } = await query<DeviceRow[]>(
    `SELECT id, device_id, nama, token_hash, token_hint, is_active, last_seen_at, created_at, revoked_at
     FROM pos_device ORDER BY id ASC`,
  );
  return rows.map(toDTO);
}

/**
 * Verifikasi token perangkat dari header `X-API-Key`.
 * Lookup berdasarkan hash token (bukan perbandingan string) — token yang dicabut
 * atau tidak dikenal selalu ditolak.
 */
export async function verifyDeviceToken(token: string | null): Promise<boolean> {
  if (!token || !token.startsWith(DEVICE_TOKEN_PREFIX)) return false;
  const { rows } = await query<(RowDataPacket & { id: number; is_active: number; revoked_at: Date | string | null })[]>(
    `SELECT id, is_active, revoked_at FROM pos_device WHERE token_hash = ? LIMIT 1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.is_active !== 1 || row.revoked_at !== null) return false;
  // Catat "terakhir terlihat" utk halaman daftar perangkat.
  await execute("UPDATE pos_device SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
  return true;
}
