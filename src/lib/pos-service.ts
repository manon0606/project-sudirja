import "server-only";

import { execute, query } from "@/lib/db";
import { DUMMY_PASSWORD_HASH, findAdminByUsername, verifyPassword } from "@/lib/auth";
import type { RowDataPacket } from "mysql2/promise";
import type { PosApprovalMetode, PosUserDTO } from "@/lib/pos-types";

/** Role yang boleh mengoperasikan aplikasi POS (login kasir). */
export const POS_KASIR_ROLES = ["kasir"] as const;

/** Role yang boleh memberi persetujuan (approval) di aplikasi POS. */
export const POS_MANAGER_ROLES = ["manajer", "manajemen"] as const;

export type PosAuthResult =
  | { ok: true; user: PosUserDTO }
  | {
      ok: false;
      code: "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "ROLE_NOT_ALLOWED";
      message: string;
    };

interface PosUserRow extends RowDataPacket {
  user_id: number;
  username: string;
  full_name: string;
  is_active: number;
  role: string;
  role_label: string;
}

const POS_USER_SELECT = `SELECT u.id AS user_id, u.username, u.full_name, u.is_active, u.role,
        COALESCE(r.label, u.role) AS role_label
   FROM users u
   LEFT JOIN roles r ON r.name = u.role`;

/**
 * Verifikasi kredensial POS: password bcrypt + role user harus termasuk
 * `diizinkan`. Sengaja TIDAK membuat session — identitas kasir dikirim POS pada
 * tiap transaksi (lihat `kasirNama`/`kasirUsername` di POST /pesanan).
 */
export async function authenticatePos(
  username: string,
  password: string,
  diizinkan: readonly string[],
): Promise<PosAuthResult> {
  const admin = await findAdminByUsername(username);
  // Samakan waktu respons saat username tidak ada, supaya waktu respons tidak
  // membocorkan username mana yang terdaftar (sama dengan auth/login).
  const passwordOk = verifyPassword(password, admin ? admin.password_hash : DUMMY_PASSWORD_HASH);
  if (!admin || !passwordOk) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Username atau password salah." };
  }
  if (admin.is_active !== 1) {
    return {
      ok: false,
      code: "ACCOUNT_DISABLED",
      message: "Akun ini dinonaktifkan. Hubungi superadmin.",
    };
  }

  // Role dari user profil terkait (users.admin_id → admins.id) — sumber ACL yang
  // sama dengan resolveAdminAccess() di backoffice.
  const { rows } = await query<PosUserRow[]>(`${POS_USER_SELECT} WHERE u.admin_id = ? LIMIT 1`, [
    admin.id,
  ]);
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      code: "ROLE_NOT_ALLOWED",
      message: "Akun ini belum terhubung ke data user. Hubungi superadmin.",
    };
  }
  if (!diizinkan.includes(row.role)) {
    return {
      ok: false,
      code: "ROLE_NOT_ALLOWED",
      message: `Role "${row.role}" tidak berwenang untuk aksi ini.`,
    };
  }
  return {
    ok: true,
    user: {
      id: row.user_id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      roleLabel: row.role_label,
      isActive: row.is_active === 1,
    },
  };
}

/** Login kasir untuk aplikasi POS — hanya role `kasir` yang diterima. */
export async function loginPos(username: string, password: string): Promise<PosAuthResult> {
  return authenticatePos(username, password, POS_KASIR_ROLES);
}

/** Daftar user POS aktif (kasir + manajer) untuk cache offline di perangkat. */
export async function listPosUsers(): Promise<PosUserDTO[]> {
  const diizinkan: string[] = [...POS_KASIR_ROLES, ...POS_MANAGER_ROLES];
  const { rows } = await query<PosUserRow[]>(
    `${POS_USER_SELECT} WHERE u.is_active = 1 AND u.role IN (${diizinkan.map(() => "?").join(",")})
     ORDER BY u.full_name ASC`,
    diizinkan,
  );
  return rows.map((row) => ({
    id: row.user_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    roleLabel: row.role_label,
    isActive: row.is_active === 1,
  }));
}

export interface CatatApprovalInput {
  aksi: string;
  refNo?: string | null;
  catatan?: string | null;
  dimintaOleh?: string | null;
  disetujuiOleh: string;
  disetujuiNama: string;
  /** Kunci idempotensi dari perangkat POS. */
  clientRef?: string | null;
  /** `password` = diverifikasi server; `pin_offline` = PIN manajer di perangkat. */
  metode: PosApprovalMetode;
}

/**
 * Catat persetujuan manajer ke `approval_log` dan kembalikan id barisnya.
 * `clientRef` = kunci idempotensi push offline: bila sudah tercatat, tidak
 * dicatat dua kali.
 */
export async function catatApproval(input: CatatApprovalInput): Promise<number> {
  const clientRef = (input.clientRef ?? "").trim().slice(0, 64) || null;
  if (clientRef) {
    const { rows } = await query<RowDataPacket[]>(
      `SELECT id FROM approval_log WHERE client_ref = ? LIMIT 1`,
      [clientRef],
    );
    const ada = rows[0] as { id: number } | undefined;
    if (ada) return ada.id;
  }
  const hasil = await execute(
    `INSERT INTO approval_log
       (aksi, ref_no, catatan, diminta_oleh, disetujui_oleh, disetujui_nama, client_ref, metode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.aksi.trim().slice(0, 50),
      input.refNo?.trim().slice(0, 32) || null,
      input.catatan?.trim().slice(0, 255) || null,
      input.dimintaOleh?.trim().slice(0, 100) || null,
      input.disetujuiOleh.trim().slice(0, 100),
      input.disetujuiNama.trim().slice(0, 100),
      clientRef,
      input.metode,
    ],
  );
  return hasil.insertId;
}
