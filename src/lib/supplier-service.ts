import "server-only";

import { execute, query, withTransaction } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import type {
  BulkSupplierResult,
  CreateSupplierInput,
  SupplierDTO,
  SupplierListResponse,
  UpdateSupplierInput,
} from "@/lib/supplier-types";

interface SupplierRow extends RowDataPacket {
  id: number;
  kode: string;
  nama: string;
  alamat: string | null;
  kota: string | null;
  provinsi: string | null;
  negara: string | null;
  kodepos: string | null;
  telepon: string | null;
  fax: string | null;
  bank: string | null;
  norek: string | null;
  atasnama: string | null;
  kontak: string | null;
  email: string | null;
  keterangan: string | null;
  is_active: number;
  created_at: Date | string;
}

const COLUMNS = "id, kode, nama, alamat, kota, provinsi, negara, kodepos, telepon, fax, bank, norek, atasnama, kontak, email, keterangan, is_active, created_at";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KODEPOS_RE = /^[0-9]{4,6}$/;

export function supplierToDTO(row: SupplierRow): SupplierDTO {
  return {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    alamat: row.alamat,
    kota: row.kota,
    provinsi: row.provinsi,
    negara: row.negara,
    kodepos: row.kodepos,
    telepon: row.telepon,
    fax: row.fax,
    bank: row.bank,
    norek: row.norek,
    atasnama: row.atasnama,
    kontak: row.kontak,
    email: row.email,
    keterangan: row.keterangan,
    isActive: row.is_active === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface SupplierValidation {
  ok: boolean;
  data?: CreateSupplierInput;
  details?: Record<string, string>;
}

function cleanStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function validateSupplierCreate(body: unknown): SupplierValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const nama = typeof b.nama === "string" ? b.nama.trim() : "";
  const kode = typeof b.kode === "string" && b.kode.trim() ? b.kode.trim() : undefined;
  const email = cleanStr(b.email)?.toLowerCase() ?? null;
  const kodepos = cleanStr(b.kodepos);
  const telepon = cleanStr(b.telepon);
  const norek = cleanStr(b.norek);

  if (!nama || nama.length > 150) details.nama = "Nama supplier wajib diisi (maksimal 150 karakter).";
  if (kode && !/^[A-Za-z0-9_-]{2,20}$/.test(kode)) details.kode = "Kode 2-20 karakter (huruf, angka, _ atau -).";
  if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";
  if (kodepos && !KODEPOS_RE.test(kodepos)) details.kodepos = "Kode pos 4-6 digit angka.";
  if (telepon && telepon.length > 30) details.telepon = "Telepon maksimal 30 karakter.";
  if (norek && norek.length > 50) details.norek = "No. rekening maksimal 50 karakter.";

  if (Object.keys(details).length) return { ok: false, details };
  return {
    ok: true,
    data: {
      kode, nama,
      alamat: cleanStr(b.alamat),
      kota: cleanStr(b.kota),
      provinsi: cleanStr(b.provinsi),
      negara: cleanStr(b.negara) ?? "Indonesia",
      kodepos,
      telepon,
      fax: cleanStr(b.fax),
      bank: cleanStr(b.bank),
      norek,
      atasnama: cleanStr(b.atasnama),
      kontak: cleanStr(b.kontak),
      email,
      keterangan: cleanStr(b.keterangan),
      isActive: b.isActive !== false,
    },
  };
}

export function validateSupplierUpdate(body: unknown): { ok: boolean; data?: UpdateSupplierInput; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdateSupplierInput = {};

  if (b.nama !== undefined) {
    const nama = typeof b.nama === "string" ? b.nama.trim() : "";
    if (!nama || nama.length > 150) details.nama = "Nama supplier wajib diisi (maksimal 150 karakter).";
    else data.nama = nama;
  }
  const textKeys = ["alamat", "kota", "provinsi", "negara", "kodepos", "telepon", "fax", "bank", "norek", "atasnama", "kontak", "keterangan"] as const;
  for (const key of textKeys) {
    if (b[key] !== undefined) (data as Record<string, unknown>)[key] = cleanStr(b[key]);
  }
  if (b.email !== undefined) {
    const email = cleanStr(b.email)?.toLowerCase() ?? null;
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) details.email = "Format email tidak valid.";
    else data.email = email;
  }
  if (data.kodepos && !KODEPOS_RE.test(data.kodepos)) details.kodepos = "Kode pos 4-6 digit angka.";
  if (data.telepon && data.telepon.length > 30) details.telepon = "Telepon maksimal 30 karakter.";
  if (data.norek && data.norek.length > 50) details.norek = "No. rekening maksimal 50 karakter.";
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
    sortBy: q.get("sortBy") ?? "nama",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

export async function listSupplier(params: ReturnType<typeof parseListParams>): Promise<SupplierListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(kode LIKE ? OR nama LIKE ? OR kota LIKE ? OR telepon LIKE ? OR id = ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`, Number(params.search) || 0);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM supplier${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sort = ["id", "kode", "nama", "kota", "created_at"].includes(params.sortBy) ? params.sortBy : "nama";
  const rows = await query<SupplierRow[]>(
    `SELECT ${COLUMNS} FROM supplier${whereSql} ORDER BY ${sort} ${params.sortOrder}, id ${params.sortOrder} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );
  return {
    items: rows.rows.map(supplierToDTO),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getSupplier(id: number): Promise<SupplierDTO | null> {
  const result = await query<SupplierRow[]>(`SELECT ${COLUMNS} FROM supplier WHERE id = ? LIMIT 1`, [id]);
  return result.rows[0] ? supplierToDTO(result.rows[0]) : null;
}

export async function getSupplierByKode(kode: string): Promise<SupplierRow | null> {
  const result = await query<SupplierRow[]>(`SELECT ${COLUMNS} FROM supplier WHERE kode = ? LIMIT 1`, [kode]);
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function generateKode(conn?: PoolConnection): Promise<string> {
  const run = async (q: string): Promise<number> => {
    if (conn) {
      const [rows] = await conn.query<RowDataPacket[]>(q);
      return Number(rows[0]?.total ?? 0);
    }
    const { rows } = await query<RowDataPacket[]>(q);
    return Number(rows[0]?.total ?? 0);
  };
  const total = await run(`SELECT COUNT(*) total FROM supplier`);
  return `SUP-${String(total + 1).padStart(3, "0")}`;
}

async function insertRow(conn: PoolConnection | undefined, kode: string, input: CreateSupplierInput): Promise<number> {
  const vals = [kode, input.nama, input.alamat ?? null, input.kota ?? null, input.provinsi ?? null, input.negara ?? "Indonesia", input.kodepos ?? null, input.telepon ?? null, input.fax ?? null, input.bank ?? null, input.norek ?? null, input.atasnama ?? null, input.kontak ?? null, input.email ?? null, input.keterangan ?? null, input.isActive === false ? 0 : 1];
  const sql = `INSERT INTO supplier (kode, nama, alamat, kota, provinsi, negara, kodepos, telepon, fax, bank, norek, atasnama, kontak, email, keterangan, is_active) VALUES (${vals.map(() => "?").join(", ")})`;
  if (conn) {
    const [result] = await conn.query<ResultSetHeader>(sql, vals);
    return result.insertId;
  }
  const result = await execute(sql, vals);
  return result.insertId;
}

export async function createSupplier(input: CreateSupplierInput, conn?: PoolConnection): Promise<SupplierDTO> {
  const kode = input.kode ?? await generateKode(conn);
  const insertId = await insertRow(conn, kode, input);
  const created = await getSupplier(insertId);
  if (!created) throw new Error("Gagal membuat supplier.");
  return created;
}

export async function updateSupplier(id: number, input: UpdateSupplierInput): Promise<SupplierDTO | null> {
  const current = await getSupplier(id);
  if (!current) return null;
  const sets: string[] = [];
  const args: unknown[] = [];
  const map: Record<string, keyof UpdateSupplierInput> = {
    nama: "nama", alamat: "alamat", kota: "kota", provinsi: "provinsi", negara: "negara",
    kodepos: "kodepos", telepon: "telepon", fax: "fax", bank: "bank", norek: "norek",
    atasnama: "atasnama", kontak: "kontak", email: "email", keterangan: "keterangan",
  };
  for (const col of Object.keys(map)) {
    const key = map[col];
    if (input[key] !== undefined) { sets.push(`${col} = ?`); args.push(input[key]); }
  }
  if (input.isActive !== undefined) { sets.push("is_active = ?"); args.push(input.isActive ? 1 : 0); }
  if (sets.length === 0) return current;
  await execute(`UPDATE supplier SET ${sets.join(", ")} WHERE id = ?`, [...args, id]);
  return getSupplier(id);
}

export async function deleteSupplier(id: number): Promise<boolean> {
  return (await execute("DELETE FROM supplier WHERE id = ?", [id])).affectedRows > 0;
}

export async function bulkCreateSupplier(rows: CreateSupplierInput[]): Promise<BulkSupplierResult> {
  return withTransaction(async (conn) => {
    let success = 0;
    const failures: BulkSupplierResult["failures"] = [];
    for (let index = 0; index < rows.length; index++) {
      const parsed = validateSupplierCreate(rows[index]);
      const raw = rows[index] as unknown as Record<string, unknown>;
      if (!parsed.ok || !parsed.data) {
        failures.push({ row: index + 1, nama: String(raw.nama ?? ""), message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      try {
        const kode = parsed.data.kode ?? await generateKode(conn);
        await insertRow(conn, kode, parsed.data);
        success++;
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        failures.push({ row: index + 1, nama: parsed.data.nama, message: code === "ER_DUP_ENTRY" ? "Kode supplier sudah digunakan." : "Gagal menyimpan supplier." });
      }
    }
    return { success, failures };
  });
}
