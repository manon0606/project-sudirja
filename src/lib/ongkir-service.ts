import "server-only";

import { execute, query, withTransaction } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  BulkOngkirResult,
  CreateOngkirInput,
  OngkirDTO,
  OngkirListResponse,
  UpdateOngkirInput,
} from "@/lib/ongkir-types";

interface OngkirRow extends RowDataPacket {
  id: number;
  kode: string;
  kecamatan: string;
  ongkir: string | number;
  is_active: number;
  created_at: Date | string;
}

const COLUMNS = "id, kode, kecamatan, ongkir, is_active, created_at";
const KODE_RE = /^[A-Za-z0-9_-]{2,20}$/;

function toDTO(row: OngkirRow): OngkirDTO {
  return {
    id: row.id,
    kode: row.kode,
    kecamatan: row.kecamatan,
    ongkir: Number(row.ongkir),
    isActive: row.is_active === 1,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

export interface OngkirValidation {
  ok: boolean;
  data?: CreateOngkirInput;
  details?: Record<string, string>;
}

export function validateCreate(body: unknown): OngkirValidation {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const kode = typeof b.kode === "string" ? b.kode.trim() : "";
  const kecamatan = typeof b.kecamatan === "string" ? b.kecamatan.trim() : "";
  const ongkir = typeof b.ongkir === "number" ? b.ongkir : Number(b.ongkir);

  if (!KODE_RE.test(kode)) details.kode = "Kode 2-20 karakter (huruf, angka, _ atau -).";
  if (!kecamatan || kecamatan.length > 100) details.kecamatan = "Nama kecamatan wajib diisi (maksimal 100 karakter).";
  if (!Number.isFinite(ongkir) || ongkir < 0) details.ongkir = "Ongkir wajib angka >= 0.";

  if (Object.keys(details).length) return { ok: false, details };
  return {
    ok: true,
    data: {
      kode,
      kecamatan,
      ongkir: Math.round(ongkir),
      isActive: b.isActive !== false,
    },
  };
}

export function validateUpdate(body: unknown): { ok: boolean; data?: UpdateOngkirInput; details?: Record<string, string> } {
  const details: Record<string, string> = {};
  const b = (body ?? {}) as Record<string, unknown>;
  const data: UpdateOngkirInput = {};

  if (b.kecamatan !== undefined) {
    const kecamatan = typeof b.kecamatan === "string" ? b.kecamatan.trim() : "";
    if (!kecamatan || kecamatan.length > 100) details.kecamatan = "Nama kecamatan wajib diisi (maksimal 100 karakter).";
    else data.kecamatan = kecamatan;
  }
  if (b.ongkir !== undefined) {
    const ongkir = typeof b.ongkir === "number" ? b.ongkir : Number(b.ongkir);
    if (!Number.isFinite(ongkir) || ongkir < 0) details.ongkir = "Ongkir wajib angka >= 0.";
    else data.ongkir = Math.round(ongkir);
  }
  if (b.isActive !== undefined) {
    if (typeof b.isActive !== "boolean") details.isActive = "Status harus boolean.";
    else data.isActive = b.isActive;
  }

  if (Object.keys(details).length) return { ok: false, details };
  return { ok: true, data };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function parseListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    sortBy: q.get("sortBy") ?? "kecamatan",
    sortOrder: q.get("sortOrder") === "asc" ? "ASC" as const : "DESC" as const,
  };
}

export async function listOngkir(params: ReturnType<typeof parseListParams>): Promise<OngkirListResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(kode LIKE ? OR kecamatan LIKE ? OR id = ?)");
    args.push(`%${params.search}%`, `%${params.search}%`, Number(params.search) || 0);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(`SELECT COUNT(*) total FROM ongkir_kecamatan${whereSql}`, args);
  const total = Number(count.rows[0]?.total ?? 0);
  const sort = ["id", "kode", "kecamatan", "ongkir", "created_at"].includes(params.sortBy) ? params.sortBy : "kecamatan";
  const rows = await query<OngkirRow[]>(
    `SELECT ${COLUMNS} FROM ongkir_kecamatan${whereSql} ORDER BY ${sort} ${params.sortOrder}, id ${params.sortOrder} LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );
  return {
    items: rows.rows.map(toDTO),
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

export async function getOngkirByKode(kode: string): Promise<OngkirDTO | null> {
  const result = await query<OngkirRow[]>(`SELECT ${COLUMNS} FROM ongkir_kecamatan WHERE kode = ? LIMIT 1`, [kode]);
  return result.rows[0] ? toDTO(result.rows[0]) : null;
}

export async function kecamatanExists(kecamatan: string, excludeKode?: string): Promise<boolean> {
  const args: unknown[] = [kecamatan];
  let sql = "SELECT COUNT(*) total FROM ongkir_kecamatan WHERE kecamatan = ?";
  if (excludeKode) {
    sql += " AND kode <> ?";
    args.push(excludeKode);
  }
  const result = await query<RowDataPacket[]>(sql, args);
  return Number(result.rows[0]?.total ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createOngkir(input: CreateOngkirInput): Promise<OngkirDTO> {
  const result = await execute(
    `INSERT INTO ongkir_kecamatan (kode, kecamatan, ongkir, is_active) VALUES (?, ?, ?, ?)`,
    [input.kode, input.kecamatan, input.ongkir, input.isActive === false ? 0 : 1],
  );
  const created = await query<OngkirRow[]>(`SELECT ${COLUMNS} FROM ongkir_kecamatan WHERE id = ?`, [result.insertId]);
  return toDTO(created.rows[0]);
}

export async function updateOngkir(kode: string, input: UpdateOngkirInput): Promise<OngkirDTO | null> {
  const current = await getOngkirByKode(kode);
  if (!current) return null;

  const sets: string[] = [];
  const args: unknown[] = [];
  if (input.kecamatan !== undefined) { sets.push("kecamatan = ?"); args.push(input.kecamatan); }
  if (input.ongkir !== undefined) { sets.push("ongkir = ?"); args.push(input.ongkir); }
  if (input.isActive !== undefined) { sets.push("is_active = ?"); args.push(input.isActive ? 1 : 0); }
  if (sets.length === 0) return current;
  await execute(`UPDATE ongkir_kecamatan SET ${sets.join(", ")} WHERE kode = ?`, [...args, kode]);
  return getOngkirByKode(kode);
}

export async function deleteOngkir(kode: string): Promise<boolean> {
  return (await execute("DELETE FROM ongkir_kecamatan WHERE kode = ?", [kode])).affectedRows > 0;
}

export async function bulkCreateOngkir(rows: CreateOngkirInput[]): Promise<BulkOngkirResult> {
  return withTransaction(async (connection) => {
    let success = 0;
    const failures: BulkOngkirResult["failures"] = [];
    for (let index = 0; index < rows.length; index++) {
      const parsed = validateCreate(rows[index]);
      const raw = rows[index] as unknown as Record<string, unknown>;
      if (!parsed.ok || !parsed.data) {
        failures.push({ row: index + 1, kode: String(raw.kode ?? ""), message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      try {
        await connection.execute(
          `INSERT INTO ongkir_kecamatan (kode, kecamatan, ongkir, is_active) VALUES (?, ?, ?, 1)`,
          [parsed.data.kode, parsed.data.kecamatan, parsed.data.ongkir],
        );
        success++;
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
        failures.push({
          row: index + 1,
          kode: parsed.data.kode,
          message: code === "ER_DUP_ENTRY" ? "Kode atau kecamatan sudah digunakan." : "Gagal menyimpan data.",
        });
      }
    }
    return { success, failures };
  });
}
