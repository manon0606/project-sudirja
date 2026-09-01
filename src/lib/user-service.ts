import "server-only";

import bcrypt from "bcryptjs";
import { execute, query, withTransaction } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  BulkUserResult,
  CreateUserInput,
  UpdateUserInput,
  UserDTO,
  UserListResponse,
  UserRole,
} from "@/lib/user-types";
import { USER_ROLES } from "@/lib/user-types";

const BCRYPT_COST = 12;

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  is_active: number;
  created_at: Date | string;
}

const COLUMNS = "id, username, full_name, role, phone, email, is_active, created_at";
const USERNAME_RE = /^[a-zA-Z0-9._]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    isActive: row.is_active === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface UserValidation {
  ok: boolean;
  data?: CreateUserInput | UpdateUserInput;
  details?: Record<string, string>;
}

export function validateCreate(body: unknown): UserValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
  const role = typeof b.role === "string" ? b.role : "";
  const phone = typeof b.phone === "string" && b.phone.trim() ? b.phone.trim() : null;
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase() : null;

  if (!USERNAME_RE.test(username)) details.username = "Username 3-50 karakter, hanya huruf, angka, titik, underscore.";
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    details.password = "Password minimal 8 karakter dan mengandung huruf serta angka.";
  }
  if (fullName.length < 2 || fullName.length > 100) details.fullName = "Nama lengkap wajib diisi (2-100 karakter).";
  if (!USER_ROLES.includes(role as UserRole)) details.role = "Role tidak valid.";
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) details.phone = "Nomor HP tidak valid.";
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";

  if (Object.keys(details).length) return { ok: false, details };
  return {
    ok: true,
    data: { username, password, fullName, role: role as UserRole, phone, email, isActive: b.isActive !== false },
  };
}

export function validateUpdate(body: unknown): UserValidation {
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
    const role = typeof b.role === "string" ? b.role : "";
    if (!USER_ROLES.includes(role as UserRole)) details.role = "Role tidak valid.";
    else data.role = role as UserRole;
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
// Query helpers
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

export async function listUsers(params: ReturnType<typeof parseUserListParams>): Promise<UserListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(username LIKE ? OR full_name LIKE ? OR phone LIKE ? OR id = ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, Number(params.search) || 0);
  }
  if (USER_ROLES.includes(params.role as UserRole)) {
    where.push("role = ?");
    args.push(params.role);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM users${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sort = ["id", "username", "full_name", "role", "created_at"].includes(params.sortBy) ? params.sortBy : "created_at";
  const rows = await query<UserRow[]>(
    `SELECT ${COLUMNS} FROM users${whereSql} ORDER BY ${sort} ${params.sortOrder}, id ${params.sortOrder} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );
  return {
    items: rows.rows.map(toDTO),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getUser(id: number): Promise<UserDTO | null> {
  const result = await query<UserRow[]>(`SELECT ${COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
  return result.rows[0] ? toDTO(result.rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const result = await query<UserRow[]>(`SELECT ${COLUMNS}, password_hash FROM users WHERE username = ? LIMIT 1`, [username]);
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  const passwordHash = bcrypt.hashSync(input.password, BCRYPT_COST);
  const result = await execute(
    `INSERT INTO users (username, password_hash, full_name, role, phone, email, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.username, passwordHash, input.fullName, input.role, input.phone ?? null, input.email ?? null, input.isActive === false ? 0 : 1],
  );
  const created = await getUser(result.insertId);
  if (!created) throw new Error("Gagal membuat user.");
  return created;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserDTO | null> {
  const current = await getUser(id);
  if (!current) return null;

  const sets: string[] = [];
  const args: unknown[] = [];
  if (input.username !== undefined) { sets.push("username = ?"); args.push(input.username); }
  if (input.password !== undefined) { sets.push("password_hash = ?"); args.push(bcrypt.hashSync(input.password, BCRYPT_COST)); }
  if (input.fullName !== undefined) { sets.push("full_name = ?"); args.push(input.fullName); }
  if (input.role !== undefined) { sets.push("role = ?"); args.push(input.role); }
  if (input.phone !== undefined) { sets.push("phone = ?"); args.push(input.phone); }
  if (input.email !== undefined) { sets.push("email = ?"); args.push(input.email); }
  if (input.isActive !== undefined) { sets.push("is_active = ?"); args.push(input.isActive ? 1 : 0); }

  if (sets.length === 0) return current;
  await execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, [...args, id]);
  return getUser(id);
}

export async function deleteUser(id: number): Promise<boolean> {
  return (await execute("DELETE FROM users WHERE id = ?", [id])).affectedRows > 0;
}

export async function bulkCreateUsers(rows: CreateUserInput[]): Promise<BulkUserResult> {
  return withTransaction(async (connection) => {
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
        await connection.execute(
          `INSERT INTO users (username, password_hash, full_name, role, phone, email, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [data.username, bcrypt.hashSync(data.password, BCRYPT_COST), data.fullName, data.role, data.phone ?? null, data.email ?? null, data.isActive === false ? 0 : 1],
        );
        success++;
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        failures.push({
          row: index + 1,
          username: data.username,
          message: code === "ER_DUP_ENTRY" ? "Username sudah digunakan." : "Gagal menyimpan user.",
        });
      }
    }
    return { success, failures };
  });
}
