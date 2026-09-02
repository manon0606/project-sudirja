import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query, execute, withTransaction } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type { AdminProfile } from "@/lib/auth-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_COST = 12;
export const SESSION_COOKIE_NAME = "sudirja_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const USERNAME_RE = /^[a-zA-Z0-9._]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

export interface DbAdmin {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: "manajemen" | "superadmin";
  is_active: number;
  created_at: Date;
}

export interface DbSession {
  id: string;
  admin_id: number;
  expires_at: Date;
}

// ---------------------------------------------------------------------------
// Validation (runs only at API boundaries, never inside internal helpers)
// ---------------------------------------------------------------------------

export interface ValidationResult<T> {
  ok: boolean;
  data?: T;
  details?: Record<string, string>;
}

export function validateRegister(body: unknown): ValidationResult<{
  username: string;
  email: string;
  password: string;
  fullName: string;
}> {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const username = typeof b.username === "string" ? b.username.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";

  if (!USERNAME_RE.test(username)) {
    details.username = "Username 3-50 karakter, hanya huruf, angka, titik, underscore.";
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    details.email = "Format email tidak valid.";
  }
  if (
    password.length < PASSWORD_MIN ||
    !/[a-zA-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    details.password = "Password minimal 8 karakter dan mengandung huruf serta angka.";
  }
  if (fullName.length < 2 || fullName.length > 100) {
    details.fullName = "Nama lengkap wajib diisi (2-100 karakter).";
  }

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }
  return { ok: true, data: { username, email, password, fullName } };
}

export function validateLogin(body: unknown): ValidationResult<{ username: string; password: string }> {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;

  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (username.length === 0) details.username = "Username wajib diisi.";
  if (password.length === 0) details.password = "Password wajib diisi.";

  if (Object.keys(details).length > 0) {
    return { ok: false, details };
  }
  return { ok: true, data: { username, password } };
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ---------------------------------------------------------------------------
// Session token handling — raw token lives ONLY in the cookie.
// The database stores sha256(token), so a DB leak is not replayable.
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Admin data access
// ---------------------------------------------------------------------------

const ADMIN_COLUMNS = `id, username, email, password_hash, full_name, role, is_active, created_at`;

export function toProfile(
  admin: DbAdmin,
  access: { role: string; roleLabel: string; permissions: string[]; isSuperadmin: boolean } = { role: "superadmin", roleLabel: "Super Admin", permissions: [], isSuperadmin: true },
): AdminProfile {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    fullName: admin.full_name,
    role: access.role,
    roleLabel: access.roleLabel,
    permissions: access.permissions,
    isSuperadmin: access.isSuperadmin,
    createdAt: admin.created_at.toISOString(),
  };
}

export async function findAdminByUsername(username: string): Promise<DbAdmin | null> {
  const { rows } = await query<DbAdmin[]>(
    `SELECT ${ADMIN_COLUMNS} FROM admins WHERE username = ? LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

export async function findAdminByEmail(email: string): Promise<DbAdmin | null> {
  const { rows } = await query<DbAdmin[]>(
    `SELECT ${ADMIN_COLUMNS} FROM admins WHERE email = ? LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createAdmin(input: {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
}): Promise<DbAdmin> {
  const result = await execute(
    `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
     VALUES (?, ?, ?, ?, 'manajemen', 1)`,
    [input.username, input.email, input.passwordHash, input.fullName],
  );
  const { rows } = await query<DbAdmin[]>(`SELECT ${ADMIN_COLUMNS} FROM admins WHERE id = ?`, [
    result.insertId,
  ]);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

export async function createSession(input: {
  adminId: number;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex"); // 256-bit entropy
  const expiresAt = sessionExpiry();
  await execute(
    `INSERT INTO admin_sessions (id, admin_id, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [hashToken(token), input.adminId, input.userAgent, input.ipAddress, expiresAt],
  );
  return { token, expiresAt };
}

export async function getSessionAdmin(token: string): Promise<DbAdmin | null> {
  const { rows } = await query<DbSession[]>(
    `SELECT id, admin_id, expires_at FROM admin_sessions WHERE id = ? LIMIT 1`,
    [hashToken(token)],
  );
  const session = rows[0];
  if (!session) return null;
  if (session.expires_at.getTime() <= Date.now()) {
    await execute(`DELETE FROM admin_sessions WHERE id = ?`, [session.id]);
    return null;
  }
  const { rows: admins } = await query<DbAdmin[]>(
    `SELECT ${ADMIN_COLUMNS} FROM admins WHERE id = ? LIMIT 1`,
    [session.admin_id],
  );
  const admin = admins[0];
  if (!admin || admin.is_active !== 1) return null;
  return admin;
}

export async function deleteSession(token: string): Promise<void> {
  await execute(`DELETE FROM admin_sessions WHERE id = ?`, [hashToken(token)]);
}

/**
 * Removes every other session belonging to the admin — call on password
 * change; not wired to any endpoint yet (future-proofing for per-feature work).
 */
export async function deleteOtherSessions(adminId: number, currentToken: string): Promise<void> {
  await withTransaction(async (conn) => {
    await conn.query(`DELETE FROM admin_sessions WHERE admin_id = ? AND id <> ?`, [
      adminId,
      hashToken(currentToken),
    ]);
  });
}

/**
 * Opportunistic cleanup of expired sessions. Runs on login only (low cost,
 * index-backed), so no background worker is needed for this feature.
 */
export async function purgeExpiredSessions(): Promise<void> {
  await execute(`DELETE FROM admin_sessions WHERE expires_at <= NOW()`);
}

// ---------------------------------------------------------------------------
// Cookie helpers — Next 16: cookies() is async (await it).
// ---------------------------------------------------------------------------

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Local dev runs on http://localhost — secure would break the login flow.
    // Flip to true (or derive from protocol) when deploying behind HTTPS.
    secure: false,
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Authenticated-request resolution for route handlers
// ---------------------------------------------------------------------------

export interface CurrentAdmin {
  admin: DbAdmin;
  token: string;
  /** Role user terkait (dari users JOIN roles) — sumber ACL. */
  role: string;
  /** Label role user terkait. */
  roleLabel: string;
  /** Daftar kode fitur yang boleh diakses (dari roles.permissions). */
  permissions: string[];
  /** Superadmin selalu punya semua fitur. */
  isSuperadmin: boolean;
}

interface UserAccessRow extends RowDataPacket {
  role: string;
  role_label: string;
  permissions: string | null;
}

/**
 * Resolve akses (role + permissions) untuk seorang admin dari user profil
 * terkait (users.admin_id → admins.id). Bila admin belum punya user terkait,
 * fallback: role lama admins ('superadmin'/'manajemen') dengan akses penuh.
 */
export async function resolveAdminAccess(admin: DbAdmin): Promise<{
  role: string;
  roleLabel: string;
  permissions: string[];
  isSuperadmin: boolean;
}> {
  const { rows } = await query<UserAccessRow[]>(
    `SELECT u.role, COALESCE(r.label, u.role) AS role_label, r.permissions
     FROM users u
     LEFT JOIN roles r ON r.name = u.role
     WHERE u.admin_id = ? LIMIT 1`,
    [admin.id],
  );
  const row = rows[0];
  if (row) {
    const perms = row.permissions ? row.permissions.split(",").map((s) => s.trim()).filter(Boolean) : [];
    return {
      role: row.role,
      roleLabel: row.role_label ?? row.role,
      permissions: perms,
      isSuperadmin: row.role === "superadmin",
    };
  }
  // Fallback untuk admin tanpa user profil — akses penuh.
  return { role: "superadmin", roleLabel: "Super Admin", permissions: [], isSuperadmin: true };
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = await readSessionToken();
  if (!token || token.length !== 64) return null;
  const admin = await getSessionAdmin(token);
  if (!admin) return null;
  const access = await resolveAdminAccess(admin);
  return { admin, token, ...access };
}

// Re-exported for tests/tools that need constant-time comparison.
export { constantTimeEquals };
