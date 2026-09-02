import "server-only";

import { execute, query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  KomisiRekapDTO,
  KomisiRekapResponse,
  KomisiSettingDTO,
  KomisiSettingsList,
  KomisiTransaksiDTO,
} from "@/lib/komisi-types";

interface SettingRow extends RowDataPacket {
  role: string;
  role_label: string;
  persen_komisi: string | number;
  aktif: number;
}

interface RekapRow extends RowDataPacket {
  user_id: number;
  user_name: string;
  role: string;
  role_label: string;
  total_transaksi: number;
  total_nominal: string | number;
  total_dibayar: string | number;
  total_belum: string | number;
}

// ---------------------------------------------------------------------------
// Settings — dinamis: semua role dari komisi_settings (JOIN roles utk label)
// ---------------------------------------------------------------------------

export async function getKomisiSettings(): Promise<KomisiSettingsList> {
  const result = await query<SettingRow[]>(
    `SELECT ks.role, COALESCE(r.label, ks.role) AS role_label, ks.persen_komisi, ks.aktif
     FROM komisi_settings ks
     LEFT JOIN roles r ON r.name = ks.role
     ORDER BY ks.id ASC`,
  );
  return result.rows.map((row) => ({
    role: row.role,
    roleLabel: row.role_label ?? row.role,
    persenKomisi: Number(row.persen_komisi),
    aktif: row.aktif === 1,
  }));
}

export async function updateKomisiSetting(role: string, persenKomisi: number, aktif: boolean): Promise<KomisiSettingDTO> {
  await execute(
    `INSERT INTO komisi_settings (role, persen_komisi, aktif) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE persen_komisi = VALUES(persen_komisi), aktif = VALUES(aktif)`,
    [role, persenKomisi, aktif ? 1 : 0],
  );
  const labelRows = await query<RowDataPacket[]>("SELECT label FROM roles WHERE name = ? LIMIT 1", [role]);
  const roleLabel = labelRows.rows[0] ? String((labelRows.rows[0] as { label: string }).label) : role;
  return { role, roleLabel, persenKomisi, aktif };
}

// ---------------------------------------------------------------------------
// Pencatatan komisi saat pesanan dibuat
// ---------------------------------------------------------------------------

/**
 * Hitung & catat komisi untuk user yang terlibat dalam sebuah pesanan.
 * Dipanggil di dalam transaksi createPesananTx.
 * Role user menentukan persen dari komisi_settings; role tanpa aturan
 * aktif atau 0% dilewati.
 */
export async function catatKomisiPesanan(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  input: { userId: number; pesananId: number; role: string; dasarKomisi: number },
): Promise<void> {
  const [settingRows] = await conn.query(
    "SELECT persen_komisi, aktif FROM komisi_settings WHERE role = ? LIMIT 1",
    [input.role],
  ) as unknown as [SettingRow[]];
  const setting = settingRows[0];
  if (!setting || setting.aktif !== 1) return;

  const persen = Number(setting.persen_komisi);
  if (persen <= 0) return;

  const nominal = Math.round((input.dasarKomisi * persen) / 100 * 100) / 100;
  if (nominal <= 0) return;

  await conn.query(
    `INSERT INTO komisi_transaksi (user_id, pesanan_id, role, dasar_komisi, persen_komisi, nominal_komisi, status)
     VALUES (?, ?, ?, ?, ?, ?, 'terhitung')`,
    [input.userId, input.pesananId, input.role, input.dasarKomisi, persen, nominal],
  );
}

// ---------------------------------------------------------------------------
// Rekap
// ---------------------------------------------------------------------------

export function parseKomisiListParams(q: URLSearchParams) {
  return {
    page: Math.max(1, Number(q.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(q.get("pageSize")) || 10)),
    search: (q.get("search") ?? "").trim().slice(0, 100),
    role: q.get("role") ?? "",
  };
}

export async function listKomisiRekap(params: ReturnType<typeof parseKomisiListParams>): Promise<KomisiRekapResponse> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (params.search) {
    where.push("(u.username LIKE ? OR u.full_name LIKE ?)");
    args.push(`%${params.search}%`, `%${params.search}%`);
  }
  if (params.role) {
    where.push("u.role = ?");
    args.push(params.role);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await query<RowDataPacket[]>(
    `SELECT COUNT(*) total FROM (SELECT u.id FROM users u${whereSql}) t`,
    args,
  );
  const total = Number(count.rows[0]?.total ?? 0);

  const rows = await query<RekapRow[]>(
    `SELECT u.id AS user_id, u.full_name AS user_name, u.role,
            COALESCE(r.label, u.role) AS role_label,
            COUNT(kt.id) AS total_transaksi,
            COALESCE(SUM(kt.nominal_komisi), 0) AS total_nominal,
            COALESCE(SUM(CASE WHEN kt.status = 'dibayar' THEN kt.nominal_komisi ELSE 0 END), 0) AS total_dibayar,
            COALESCE(SUM(CASE WHEN kt.status = 'terhitung' THEN kt.nominal_komisi ELSE 0 END), 0) AS total_belum
     FROM users u
     LEFT JOIN roles r ON r.name = u.role
     LEFT JOIN komisi_transaksi kt ON kt.user_id = u.id
     ${whereSql}
     GROUP BY u.id, u.full_name, u.role, r.label
     ORDER BY total_nominal DESC
     LIMIT ? OFFSET ?`,
    [...args, params.pageSize, (params.page - 1) * params.pageSize],
  );

  const items: KomisiRekapDTO[] = rows.rows.map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    role: r.role,
    roleLabel: r.role_label ?? r.role,
    totalTransaksi: Number(r.total_transaksi),
    totalNominal: Number(r.total_nominal),
    totalDibayar: Number(r.total_dibayar),
    totalBelumDibayar: Number(r.total_belum),
  }));

  return {
    items,
    pagination: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

// ---------------------------------------------------------------------------
// Detail transaksi komisi per user
// ---------------------------------------------------------------------------

interface TransaksiRow extends RowDataPacket {
  id: number;
  user_id: number;
  user_name: string;
  role: string;
  no_pesanan: string;
  dasar_komisi: string | number;
  persen_komisi: string | number;
  nominal_komisi: string | number;
  status: "terhitung" | "dibayar";
  created_at: Date | string;
}

export async function listKomisiTransaksi(
  userId: number,
  page = 1,
  pageSize = 20,
): Promise<{ items: KomisiTransaksiDTO[]; total: number }> {
  const count = await query<RowDataPacket[]>(
    `SELECT COUNT(*) total FROM komisi_transaksi kt JOIN pesanan p ON p.id = kt.pesanan_id WHERE kt.user_id = ?`,
    [userId],
  );
  const total = Number(count.rows[0]?.total ?? 0);
  const rows = await query<TransaksiRow[]>(
    `SELECT kt.id, kt.user_id, u.full_name AS user_name, kt.role, p.no_pesanan,
            kt.dasar_komisi, kt.persen_komisi, kt.nominal_komisi, kt.status, kt.created_at
     FROM komisi_transaksi kt
     JOIN users u ON u.id = kt.user_id
     JOIN pesanan p ON p.id = kt.pesanan_id
     WHERE kt.user_id = ?
     ORDER BY kt.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, pageSize, (page - 1) * pageSize],
  );
  const items: KomisiTransaksiDTO[] = rows.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.role,
    noPesanan: r.no_pesanan,
    dasarKomisi: Number(r.dasar_komisi),
    persenKomisi: Number(r.persen_komisi),
    nominalKomisi: Number(r.nominal_komisi),
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
  }));
  return { items, total };
}
