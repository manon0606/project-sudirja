import "server-only";

import { execute, query, withTransaction } from "@/lib/db";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import type {
  BulkPelangganResult,
  CreatePelangganInput,
  PelangganDTO,
  PelangganListResponse,
  UpdatePelangganInput,
} from "@/lib/pelanggan-types";

interface PelangganRow extends RowDataPacket {
  id: number;
  kode: string;
  nama: string;
  email: string | null;
  telepon: string | null;
  alamat: string | null;
  kecamatan: string | null;
  is_member: number;
  is_active: number;
  created_at: Date | string;
}

interface PelangganStatsRow extends RowDataPacket {
  pelanggan_id: number;
  total_transaksi: number;
  total_belanja: string | number;
}

const COLUMNS = "id, kode, nama, email, telepon, alamat, kecamatan, is_member, is_active, created_at";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;

export function pelangganToDTO(row: PelangganRow, stats?: { totalTransaksi: number; totalBelanja: number }): PelangganDTO {
  return {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    email: row.email,
    telepon: row.telepon,
    alamat: row.alamat,
    kecamatan: row.kecamatan,
    isMember: row.is_member === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    ...(stats ? { totalTransaksi: stats.totalTransaksi, totalBelanja: stats.totalBelanja } : {}),
  };
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface PelangganValidation {
  ok: boolean;
  data?: CreatePelangganInput;
  details?: Record<string, string>;
}

export function validatePelangganCreate(body: unknown): PelangganValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const nama = typeof b.nama === "string" ? b.nama.trim() : "";
  const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase() : null;
  const telepon = typeof b.telepon === "string" && b.telepon.trim() ? b.telepon.trim() : null;
  const alamat = typeof b.alamat === "string" && b.alamat.trim() ? b.alamat.trim() : null;
  const kecamatan = typeof b.kecamatan === "string" && b.kecamatan.trim() ? b.kecamatan.trim() : null;
  const kode = typeof b.kode === "string" && b.kode.trim() ? b.kode.trim() : undefined;

  if (!nama || nama.length > 100) details.nama = "Nama pelanggan wajib diisi (maksimal 100 karakter).";
  if (kode && !/^[A-Za-z0-9_-]{2,20}$/.test(kode)) details.kode = "Kode 2-20 karakter (huruf, angka, _ atau -).";
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";
  if (telepon && !PHONE_RE.test(telepon)) details.telepon = "Nomor telepon tidak valid.";
  if (alamat && alamat.length > 255) details.alamat = "Alamat maksimal 255 karakter.";
  if (kecamatan && kecamatan.length > 100) details.kecamatan = "Kecamatan maksimal 100 karakter.";

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data: { kode, nama, email, telepon, alamat, kecamatan, isMember: b.isMember === true, isActive: b.isActive !== false } };
}

export function validatePelangganUpdate(body: unknown): { ok: boolean; data?: UpdatePelangganInput; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdatePelangganInput = {};

  if (b.nama !== undefined) {
    const nama = typeof b.nama === "string" ? b.nama.trim() : "";
    if (!nama || nama.length > 100) details.nama = "Nama pelanggan wajib diisi (maksimal 100 karakter).";
    else data.nama = nama;
  }
  if (b.email !== undefined) {
    const email = typeof b.email === "string" && b.email.trim() ? b.email.trim().toLowerCase() : null;
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";
    else data.email = email;
  }
  if (b.telepon !== undefined) {
    const telepon = typeof b.telepon === "string" && b.telepon.trim() ? b.telepon.trim() : null;
    if (telepon && !PHONE_RE.test(telepon)) details.telepon = "Nomor telepon tidak valid.";
    else data.telepon = telepon;
  }
  if (b.alamat !== undefined) {
    const alamat = typeof b.alamat === "string" && b.alamat.trim() ? b.alamat.trim() : null;
    if (alamat && alamat.length > 255) details.alamat = "Alamat maksimal 255 karakter.";
    else data.alamat = alamat;
  }
  if (b.kecamatan !== undefined) {
    const kecamatan = typeof b.kecamatan === "string" && b.kecamatan.trim() ? b.kecamatan.trim() : null;
    if (kecamatan && kecamatan.length > 100) details.kecamatan = "Kecamatan maksimal 100 karakter.";
    else data.kecamatan = kecamatan;
  }
  if (b.isMember !== undefined) {
    if (typeof b.isMember !== "boolean") details.isMember = "isMember harus boolean.";
    else data.isMember = b.isMember;
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") details.isActive = "isActive harus boolean.";
    else data.isActive = b.isActive;
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// List & query
// ---------------------------------------------------------------------------

export function parseListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    sortBy: q.get("sortBy") ?? "created_at",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

export async function listPelanggan(params: ReturnType<typeof parseListParams>): Promise<PelangganListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(kode LIKE ? OR nama LIKE ? OR telepon LIKE ? OR email LIKE ? OR id = ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`, Number(params.search) || 0);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM pelanggan${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sort = ["id", "kode", "nama", "created_at", "kecamatan"].includes(params.sortBy) ? params.sortBy : "created_at";
  const rows = await query<PelangganRow[]>(
    `SELECT ${COLUMNS} FROM pelanggan${whereSql} ORDER BY ${sort} ${params.sortOrder}, id ${params.sortOrder} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );

  // Statistik pesanan commerce per pelanggan (sekali query).
  const ids = rows.rows.map((r) => r.id);
  let statsMap = new Map<number, { totalTransaksi: number; totalBelanja: number }>();
  if (ids.length) {
    const stats = await query<PelangganStatsRow[]>(
      `SELECT pesanan.pelanggan_id, COUNT(*) AS total_transaksi, COALESCE(SUM(pesanan.total), 0) AS total_belanja
       FROM pesanan WHERE pelanggan_id IN (${ids.map(() => "?").join(",")}) AND asal_pesanan = 'commerce'
       GROUP BY pelanggan_id`,
      ids,
    );
    statsMap = new Map(stats.rows.map((s) => [s.pelanggan_id, { totalTransaksi: Number(s.total_transaksi), totalBelanja: Number(s.total_belanja) }]));
  }

  return {
    items: rows.rows.map((r) => pelangganToDTO(r, statsMap.get(r.id))),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getPelanggan(id: number): Promise<PelangganDTO | null> {
  const result = await query<PelangganRow[]>(`SELECT ${COLUMNS} FROM pelanggan WHERE id = ? LIMIT 1`, [id]);
  const row = result.rows[0];
  if (!row) return null;
  const stats = await query<PelangganStatsRow[]>(
    `SELECT COUNT(*) AS total_transaksi, COALESCE(SUM(total), 0) AS total_belanja
     FROM pesanan WHERE pelanggan_id = ? AND asal_pesanan = 'commerce'`,
    [id],
  );
  const s = stats.rows[0];
  return pelangganToDTO(row, { totalTransaksi: Number(s?.total_transaksi ?? 0), totalBelanja: Number(s?.total_belanja ?? 0) });
}

export async function getPelangganByKode(kode: string): Promise<PelangganRow | null> {
  const result = await query<PelangganRow[]>(`SELECT ${COLUMNS} FROM pelanggan WHERE kode = ? LIMIT 1`, [kode]);
  return result.rows[0] ?? null;
}

/** Cari pelanggan utk pesanan commerce (telepon/nama/email cocok). */
export async function findPelangganMatch(input: { telepon?: string | null; nama?: string; email?: string | null }): Promise<PelangganDTO | null> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (input.telepon) { where.push("telepon = ?"); args.push(input.telepon); }
  if (input.email) { where.push("email = ?"); args.push(input.email); }
  if (where.length === 0) return null;
  const result = await query<PelangganRow[]>(
    `SELECT ${COLUMNS} FROM pelanggan WHERE (${where.join(" OR ")}) AND is_active = 1 ORDER BY id DESC LIMIT 1`,
    args,
  );
  return result.rows[0] ? pelangganToDTO(result.rows[0]) : null;
}

async function generateKode(conn?: PoolConnection): Promise<string> {
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM pelanggan`);
    const next = Number(rows[0]?.total ?? 0) + 1;
    return `CUST-${String(next).padStart(3, "0")}`;
  }
  const { rows } = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM pelanggan`);
  const next = Number(rows[0]?.total ?? 0) + 1;
  return `CUST-${String(next).padStart(3, "0")}`;
}

async function insertPelangganRow(conn: PoolConnection, kode: string, input: CreatePelangganInput): Promise<void> {
  await conn.query(
    `INSERT INTO pelanggan (kode, nama, email, telepon, alamat, kecamatan, is_member, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kode, input.nama, input.email ?? null, input.telepon ?? null, input.alamat ?? null, input.kecamatan ?? null, input.isMember ? 1 : 0, input.isActive === false ? 0 : 1],
  );
}

/** Buat pelanggan (dipakai admin & nanti API register toko online). */
export async function createPelanggan(input: CreatePelangganInput, conn?: PoolConnection): Promise<PelangganDTO> {
  if (conn) {
    const kode = input.kode ?? await generateKode(conn);
    await insertPelangganRow(conn, kode, input);
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM pelanggan WHERE kode = ? LIMIT 1`, [kode]);
    return pelangganToDTO(rows[0] as PelangganRow);
  }
  const kode = input.kode ?? await generateKode();
  const result = await execute(
    `INSERT INTO pelanggan (kode, nama, email, telepon, alamat, kecamatan, is_member, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [kode, input.nama, input.email ?? null, input.telepon ?? null, input.alamat ?? null, input.kecamatan ?? null, input.isMember ? 1 : 0, input.isActive === false ? 0 : 1],
  );
  const created = await getPelanggan(result.insertId);
  if (!created) throw new Error("Gagal membuat pelanggan.");
  return created;
}

export async function updatePelanggan(id: number, input: UpdatePelangganInput): Promise<PelangganDTO | null> {
  const current = await getPelanggan(id);
  if (!current) return null;
  const sets: string[] = [];
  const args: unknown[] = [];
  if (input.nama !== undefined) { sets.push("nama = ?"); args.push(input.nama); }
  if (input.email !== undefined) { sets.push("email = ?"); args.push(input.email); }
  if (input.telepon !== undefined) { sets.push("telepon = ?"); args.push(input.telepon); }
  if (input.alamat !== undefined) { sets.push("alamat = ?"); args.push(input.alamat); }
  if (input.kecamatan !== undefined) { sets.push("kecamatan = ?"); args.push(input.kecamatan); }
  if (input.isMember !== undefined) { sets.push("is_member = ?"); args.push(input.isMember ? 1 : 0); }
  if (input.isActive !== undefined) { sets.push("is_active = ?"); args.push(input.isActive ? 1 : 0); }
  if (sets.length === 0) return current;
  await execute(`UPDATE pelanggan SET ${sets.join(", ")} WHERE id = ?`, [...args, id]);
  return getPelanggan(id);
}

export async function deletePelanggan(id: number): Promise<boolean> {
  return (await execute("DELETE FROM pelanggan WHERE id = ?", [id])).affectedRows > 0;
}

export async function bulkCreatePelanggan(rows: CreatePelangganInput[]): Promise<BulkPelangganResult> {
  return withTransaction(async (conn) => {
    let success = 0;
    const failures: BulkPelangganResult["failures"] = [];
    for (let index = 0; index < rows.length; index++) {
      const parsed = validatePelangganCreate(rows[index]);
      const raw = rows[index] as unknown as Record<string, unknown>;
      if (!parsed.ok || !parsed.data) {
        failures.push({ row: index + 1, nama: String(raw.nama ?? ""), message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      try {
        await createPelanggan(parsed.data, conn);
        success++;
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        failures.push({ row: index + 1, nama: parsed.data.nama, message: code === "ER_DUP_ENTRY" ? "Kode pelanggan sudah digunakan." : "Gagal menyimpan pelanggan." });
      }
    }
    return { success, failures };
  });
}
