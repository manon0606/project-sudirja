import "server-only";

import bcrypt from "bcryptjs";
import { execute, query, withTransaction } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import type {
  BulkUserResult,
  CreateUserInput,
  RoleDTO,
  UpdateUserInput,
  UserDTO,
  UserListResponse,
} from "@/lib/user-types";

const BCRYPT_COST = 12;

interface UserRow extends RowDataPacket {
  id: number;
  admin_id: number | null;
  username: string;
  full_name: string;
  role: string;
  role_label: string;
  phone: string | null;
  email: string | null;
  is_active: number;
  created_at: Date | string;
}

const USERNAME_RE = /^[a-zA-Z0-9._]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_RE = /^[a-z][a-z0-9_-]{1,49}$/;

// ---------------------------------------------------------------------------
// Roles (dinamis)
// ---------------------------------------------------------------------------

interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
  label: string;
  permissions: string | null;
  is_system: number;
}

export function parsePermissions(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function roleToDTO(row: RoleRow): RoleDTO {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    permissions: parsePermissions(row.permissions),
    isSystem: row.is_system === 1,
  };
}

export async function listRoles(): Promise<RoleDTO[]> {
  const result = await query<RoleRow[]>("SELECT id, name, label, permissions, is_system FROM roles ORDER BY is_system DESC, id ASC");
  return result.rows.map(roleToDTO);
}

export async function getRoleByName(name: string): Promise<RoleDTO | null> {
  const result = await query<RoleRow[]>("SELECT id, name, label, permissions, is_system FROM roles WHERE name = ? LIMIT 1", [name]);
  return result.rows[0] ? roleToDTO(result.rows[0]) : null;
}

export function validateRoleCreate(body: unknown): { ok: boolean; data?: { name: string; label: string; permissions: string[] }; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().toLowerCase() : "";
  const label = typeof b.label === "string" ? b.label.trim() : "";
  const permissions = Array.isArray(b.permissions) ? b.permissions.filter((p): p is string => typeof p === "string") : [];

  if (!ROLE_RE.test(name)) details.name = "Kode role huruf kecil, angka, _ atau - (2-50).";
  if (!label || label.length > 100) details.label = "Label role wajib diisi.";
  if (!details.name && ["superadmin", "supervisor", "kasir", "kurir", "gudang", "owner"].includes(name)) {
    details.name = "Kode role sudah dipakai sistem.";
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data: { name, label, permissions } };
}

export function validateRoleUpdate(body: unknown): { ok: boolean; data?: { label?: string; permissions?: string[] }; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const data: { label?: string; permissions?: string[] } = {};
  if (b.label !== undefined) {
    const label = typeof b.label === "string" ? b.label.trim() : "";
    if (!label || label.length > 100) details.label = "Label role wajib diisi.";
    else data.label = label;
  }
  if (b.permissions !== undefined) {
    if (!Array.isArray(b.permissions) || !b.permissions.every((p) => typeof p === "string")) {
      details.permissions = "Permissions harus array string.";
    } else {
      data.permissions = b.permissions as string[];
    }
  }
  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data };
}

export async function createRole(input: { name: string; label: string; permissions: string[] }): Promise<RoleDTO> {
  const result = await execute(
    "INSERT INTO roles (name, label, permissions, is_system) VALUES (?, ?, ?, 0)",
    [input.name, input.label, input.permissions.join(",")],
  );
  const created = await query<RoleRow[]>("SELECT id, name, label, permissions, is_system FROM roles WHERE id = ?", [result.insertId]);
  return roleToDTO(created.rows[0]);
}

export async function updateRole(name: string, input: { label?: string; permissions?: string[] }): Promise<RoleDTO | null> {
  const current = await getRoleByName(name);
  if (!current) return null;
  const sets: string[] = [];
  const args: unknown[] = [];
  if (input.label !== undefined) { sets.push("label = ?"); args.push(input.label); }
  if (input.permissions !== undefined) { sets.push("permissions = ?"); args.push(input.permissions.join(",")); }
  if (sets.length === 0) return current;
  await execute(`UPDATE roles SET ${sets.join(", ")} WHERE name = ?`, [...args, name]);
  return getRoleByName(name);
}

export async function deleteRole(name: string): Promise<boolean> {
  const role = await getRoleByName(name);
  if (!role) return false;
  if (role.isSystem) throw new Error("SYSTEM_ROLE");
  const inUse = await query<RowDataPacket[]>("SELECT COUNT(*) total FROM users WHERE role = ?", [name]);
  if (Number(inUse.rows[0]?.total ?? 0) > 0) throw new Error("ROLE_IN_USE");
  await withTransaction(async (conn) => {
    await conn.query("DELETE FROM komisi_settings WHERE role = ?", [name]);
    await conn.query("DELETE FROM roles WHERE name = ?", [name]);
  });
  return true;
}

// ---------------------------------------------------------------------------
// Validasi user
// ---------------------------------------------------------------------------

export interface UserValidation {
  ok: boolean;
  data?: CreateUserInput;
  details?: Record<string, string>;
}

export function validateCreate(body: unknown): UserValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const role = typeof b.role === "string" ? b.role.trim() : "";
  const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase() : null;

  if (!USERNAME_RE.test(username)) details.username = "Username 3-50 karakter, hanya huruf, angka, titik, underscore.";
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    details.password = "Password minimal 8 karakter dan mengandung huruf serta angka.";
  }
  if (fullName.length < 2 || fullName.length > 100) details.fullName = "Nama lengkap wajib diisi (2-100 karakter).";
  if (!ROLE_RE.test(role) && role !== "superadmin") details.role = "Role tidak valid.";
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) details.phone = "Nomor HP tidak valid.";
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";

  if (Object.keys(details).length) return { ok: false, details };
  return {
    ok: true,
    data: { username, password, fullName, role, phone, email, isActive: b.isActive !== false },
  };
}

export function validateUpdate(body: unknown): { ok: boolean; data?: UpdateUserInput; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdateUserInput = {};

  if (b.username !== undefined) {
    const username = typeof b.username === "string" ? b.username.trim() : "";
    if (!USERNAME_RE.test(username)) details.username = "Username 3-50 karakter, hanya huruf, angka, titik, underscore.";
    else data.username = username;
  }
  if (b.password !== undefined) {
    const password = typeof b.password === "string" ? b.password : "";
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      details.password = "Password minimal 8 karakter dan mengandung huruf serta angka.";
    } else data.password = password;
  }
  if (b.fullName !== undefined) {
    const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
    if (fullName.length < 2 || fullName.length > 100) details.fullName = "Nama lengkap wajib diisi (2-100 karakter).";
    else data.fullName = fullName;
  }
  if (b.role !== undefined) {
    const role = typeof b.role === "string" ? b.role.trim() : "";
    if (!ROLE_RE.test(role) && role !== "superadmin") details.role = "Role tidak valid.";
    else data.role = role;
  }
  if (b.phone !== undefined) {
    const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) details.phone = "Nomor HP tidak valid.";
    else data.phone = phone;
  }
  if (b.email !== undefined) {
    const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase() : null;
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";
    else data.email = email;
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") details.isActive = "Status harus boolean.";
    else data.isActive = b.isActive;
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// List & query
// ---------------------------------------------------------------------------

export function parseUserListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    role: q.get("role") ?? "",
    sortBy: q.get("sortBy") ?? "created_at",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

const USER_SELECT = `
  SELECT u.id, u.admin_id, u.username, u.full_name, u.role,
         COALESCE(r.label, u.role) AS role_label,
         u.phone, u.email, u.is_active, u.created_at
  FROM users u
  LEFT JOIN roles r ON r.name = u.role`;

export async function listUsers(params: ReturnType<typeof parseUserListParams>): Promise<UserListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(u.username LIKE ? OR u.full_name LIKE ? OR u.id = ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, Number(params.search) || 0);
  }
  if (params.role) {
    where.push("u.role = ?");
    args.push(params.role);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM users u${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sortKey = `u.${params.sortBy}`;
  const sort = ["u.id", "u.username", "u.full_name", "u.role", "u.created_at"].includes(sortKey) ? sortKey : "u.created_at";
  const rows = await query<UserRow[]>(
    `${USER_SELECT}${whereSql} ORDER BY ${sort} ${params.sortOrder}, u.id ${params.sortOrder} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );
  return {
    items: rows.rows.map(toDTO),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export function toDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    adminId: row.admin_id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    roleLabel: row.role_label ?? row.role,
    phone: row.phone,
    email: row.email,
    isActive: row.is_active === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function getUser(id: number): Promise<UserDTO | null> {
  const result = await query<UserRow[]>(`${USER_SELECT} WHERE u.id = ? LIMIT 1`, [id]);
  return result.rows[0] ? toDTO(result.rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<{ id: number; admin_id: number | null; username: string; full_name: string; role: string; is_active: number } | null> {
  const result = await query<RowDataPacket[]>(
    `SELECT u.id, u.admin_id, u.username, u.full_name, u.role, u.is_active FROM users u WHERE u.username = ? LIMIT 1`,
    [username],
  );
  const row = result.rows[0] as { id: number; admin_id: number | null; username: string; full_name: string; role: string; is_active: number } | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Mutations — user = data pribadi; admins = akun login (username+password)
// ---------------------------------------------------------------------------

async function ensureRoleExists(conn: PoolConnection, role: string): Promise<void> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM roles WHERE name = ? LIMIT 1", [role]);
  if (!rows[0]) throw new Error("ROLE_NOT_FOUND");
}

/** Cek username/email bentrok di admins (akun login) ATAU users. */
async function credentialsTaken(
  conn: PoolConnection,
  username: string,
  email: string | null,
  excludeAdminId?: number,
): Promise<{ username?: boolean; email?: boolean }> {
  const args: unknown[] = [];
  let sql = "SELECT username, email FROM admins WHERE username = ?";
  args.push(username);
  if (email) { sql += " OR email = ?"; args.push(email); }
  if (excludeAdminId) { sql += ` AND id <> ${excludeAdminId}`; }
  const [adminRows] = await conn.query<RowDataPacket[]>(sql, args);
  const taken: { username?: boolean; email?: boolean } = {};
  for (const r of adminRows as Array<{ username: string; email: string }>) {
    if (r.username === username) taken.username = true;
    if (email && r.email === email) taken.email = true;
  }
  const [userRows] = await conn.query<RowDataPacket[]>(
    `SELECT username FROM users WHERE username = ?${excludeAdminId ? " AND admin_id <> ?" : ""}`,
    excludeAdminId ? [username, excludeAdminId] : [username],
  );
  if (userRows[0]) taken.username = true;
  return taken;
}

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  const userId = await withTransaction<number>(async (conn) => {
    await ensureRoleExists(conn, input.role);
    const taken = await credentialsTaken(conn, input.username, input.email ?? null);
    if (taken.username) throw new Error("USERNAME_TAKEN");
    if (taken.email) throw new Error("EMAIL_TAKEN");

    // 1) Buat akun login di admins (username + password ada di sini).
    const passwordHash = bcrypt.hashSync(input.password, BCRYPT_COST);
    const [adminResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, 'superadmin', ?)`,
      [input.username, input.email ?? `${input.username}@sudirja.local`, passwordHash, input.fullName, input.isActive === false ? 0 : 1],
    );

    // 2) Buat profil user terkait (data pribadi + role).
    const [userResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO users (admin_id, username, full_name, role, phone, email, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [adminResult.insertId, input.username, input.fullName, input.role, input.phone ?? null, input.email ?? null, input.isActive === false ? 0 : 1],
    );
    return userResult.insertId;
  });
  // Baca ulang SETELAH commit (koneksi pool lain baru bisa melihat data).
  const created = await getUser(userId);
  if (!created) throw new Error("Gagal membuat user.");
  return created;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserDTO | null> {
  const updated = await withTransaction<boolean>(async (conn) => {
    const [currentRows] = await conn.query<RowDataPacket[]>(`SELECT id, admin_id, username, role FROM users WHERE id = ? LIMIT 1`, [id]);
    const cur = currentRows[0] as { id: number; admin_id: number | null; username: string; role: string } | undefined;
    if (!cur) return false;

    if (input.role !== undefined) {
      await ensureRoleExists(conn, input.role);
    }

    // Update akun login (admins) bila username/password/email berubah.
    if (cur.admin_id != null) {
      const taken = await credentialsTaken(conn, input.username ?? cur.username, input.email ?? null, cur.admin_id);
      if (input.username !== undefined && taken.username) throw new Error("USERNAME_TAKEN");
      if (taken.email && input.email !== undefined) throw new Error("EMAIL_TAKEN");
      const adminSets: string[] = [];
      const adminArgs: unknown[] = [];
      if (input.username !== undefined) { adminSets.push("username = ?"); adminArgs.push(input.username); }
      if (input.password !== undefined) { adminSets.push("password_hash = ?"); adminArgs.push(bcrypt.hashSync(input.password, BCRYPT_COST)); }
      if (input.email !== undefined) { adminSets.push("email = ?"); adminArgs.push(input.email); }
      if (input.isActive !== undefined) { adminSets.push("is_active = ?"); adminArgs.push(input.isActive ? 1 : 0); }
      if (adminSets.length) {
        await conn.query(`UPDATE admins SET ${adminSets.join(", ")} WHERE id = ?`, [...adminArgs, cur.admin_id]);
      }
    }

    // Update profil (users).
    const userSets: string[] = [];
    const userArgs: unknown[] = [];
    if (input.username !== undefined) { userSets.push("username = ?"); userArgs.push(input.username); }
    if (input.fullName !== undefined) { userSets.push("full_name = ?"); userArgs.push(input.fullName); }
    if (input.role !== undefined) { userSets.push("role = ?"); userArgs.push(input.role); }
    if (input.phone !== undefined) { userSets.push("phone = ?"); userArgs.push(input.phone); }
    if (input.email !== undefined) { userSets.push("email = ?"); userArgs.push(input.email); }
    if (input.isActive !== undefined) { userSets.push("is_active = ?"); userArgs.push(input.isActive ? 1 : 0); }
    if (userSets.length) {
      await conn.query(`UPDATE users SET ${userSets.join(", ")} WHERE id = ?`, [...userArgs, id]);
    }
    return true;
  });
  if (!updated) return null;
  return getUser(id);
}

export async function deleteUser(id: number): Promise<boolean> {
  return withTransaction(async (conn) => {
    const [currentRows] = await conn.query<RowDataPacket[]>("SELECT admin_id FROM users WHERE id = ? LIMIT 1", [id]);
    const cur = currentRows[0] as { admin_id: number | null } | undefined;
    if (!cur) return false;
    // Hapus user profil dulu (affectedRows benar), lalu akun login (admins).
    // FK users.admin_id → admins CASCADE, jadi hapus user lebih dulu aman.
    const [result] = await conn.query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [id]);
    if (cur.admin_id != null) {
      await conn.query("DELETE FROM admins WHERE id = ?", [cur.admin_id]);
    }
    return result.affectedRows > 0;
  });
}

export async function bulkCreateUsers(rows: CreateUserInput[]): Promise<BulkUserResult> {
  return withTransaction(async (conn) => {
    let success = 0;
    const failures: BulkUserResult["failures"] = [];
    for (let index = 0; index < rows.length; index++) {
      const parsed = validateCreate(rows[index]);
      const raw = rows[index] as unknown as Record<string, unknown>;
      if (!parsed.ok || !parsed.data) {
        failures.push({ row: index + 1, username: String(raw.username ?? ""), message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      const data = parsed.data as CreateUserInput;
      try {
        await ensureRoleExists(conn, data.role);
        const passwordHash = bcrypt.hashSync(data.password, BCRYPT_COST);
        const [adminResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO admins (username, email, password_hash, full_name, role, is_active)
           VALUES (?, ?, ?, ?, 'superadmin', ?)`,
          [data.username, data.email ?? `${data.username}@sudirja.local`, passwordHash, data.fullName, data.isActive === false ? 0 : 1],
        );
        await conn.query(
          `INSERT INTO users (admin_id, username, full_name, role, phone, email, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminResult.insertId, data.username, data.fullName, data.role, data.phone ?? null, data.email ?? null, data.isActive === false ? 0 : 1],
        );
        success++;
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        const msg = error instanceof Error ? error.message : "";
        let message = "Gagal menyimpan user.";
        if (code === "ER_DUP_ENTRY") message = "Username sudah digunakan.";
        else if (msg === "ROLE_NOT_FOUND") message = "Role tidak ditemukan.";
        failures.push({ row: index + 1, username: data.username, message });
      }
    }
    return { success, failures };
  });
}
