import "server-only";

import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  DashboardDTO,
  DashboardStatusRingkasan,
  DashboardSummary,
  GrafikPenjualanPoint,
  PesananTerbaruRow,
} from "@/lib/dashboard-types";

export function parseDashboardParams(q: URLSearchParams): { range: "7" | "30" | "year" } {
  const raw = q.get("range") ?? "7";
  return { range: raw === "30" || raw === "year" ? (raw as "30" | "year") : "7" };
}

/** Hitung rentang [from, to] & [prevFrom, prevTo] (periode sebelumnya utk pertumbuhan). */
function resolveRange(range: "7" | "30" | "year", now = new Date()) {
  const days = range === "30" ? 30 : range === "year" ? 365 : 7;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(-1); // tepat sebelum start
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  prevStart.setHours(0, 0, 0, 0);
  return { start, end, prevStart, prevEnd };
}

const fmt = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

interface AgregatRow extends RowDataPacket {
  total: string | number;
  jumlah: number;
}

/** Agregat penjualan & qty utk rentang (status bukan dibatalkan/dikembalikan). */
async function agregatPenjualan(from: string, to: string): Promise<{ total: number; jumlah: number; produkTerjual: number }> {
  const { rows } = await query<AgregatRow[]>(
    `SELECT COALESCE(SUM(p.total),0) AS total,
            COUNT(p.id) AS jumlah,
            COALESCE((SELECT SUM(pi.qty) FROM pesanan_item pi WHERE pi.pesanan_id IN
              (SELECT id FROM pesanan p2 WHERE p2.created_at >= ? AND p2.created_at <= ?
               AND p2.status NOT IN ('Dibatalkan','Dikembalikan'))),0) AS produk_terjual
     FROM pesanan p
     WHERE p.created_at >= ? AND p.created_at <= ?
       AND p.status NOT IN ('Dibatalkan','Dikembalikan')`,
    [from, to, from, to],
  );
  const r = rows[0] as AgregatRow & { produk_terjual: number };
  return { total: Number(r?.total ?? 0), jumlah: Number(r?.jumlah ?? 0), produkTerjual: Number(r?.produk_terjual ?? 0) };
}

async function pelangganBaru(from: string, to: string): Promise<number> {
  const { rows } = await query<RowDataPacket[]>(
    `SELECT COUNT(*) total FROM pelanggan WHERE created_at >= ? AND created_at <= ?`,
    [from, to],
  );
  return Number(rows[0]?.total ?? 0);
}

/** Grafik penjualan per hari utk rentang (maks ~31 titik; year digabung per bulan). */
async function grafikPenjualan(range: "7" | "30" | "year", from: string, to: string): Promise<GrafikPenjualanPoint[]> {
  if (range === "year") {
    const { rows } = await query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(p.created_at, '%Y-%m') AS bln, COALESCE(SUM(p.total),0) AS total, COUNT(p.id) AS jumlah
       FROM pesanan p
       WHERE p.created_at >= ? AND p.created_at <= ?
         AND p.status NOT IN ('Dibatalkan','Dikembalikan')
       GROUP BY bln ORDER BY bln ASC`,
      [from, to],
    );
    return (rows as Array<{ bln: string; total: number; jumlah: number }>).map((r) => {
      const [, m] = r.bln.split("-");
      const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m) - 1] ?? m;
      return { label: bulan, tanggal: r.bln, total: Number(r.total), jumlah: Number(r.jumlah) };
    });
  }
  const { rows } = await query<RowDataPacket[]>(
    `SELECT DATE(p.created_at) AS tgl, COALESCE(SUM(p.total),0) AS total, COUNT(p.id) AS jumlah
     FROM pesanan p
     WHERE p.created_at >= ? AND p.created_at <= ?
       AND p.status NOT IN ('Dibatalkan','Dikembalikan')
     GROUP BY tgl ORDER BY tgl ASC`,
    [from, to],
  );
  const map = new Map<string, { total: number; jumlah: number }>();
  for (const r of rows as Array<{ tgl: string | Date; total: number; jumlah: number }>) {
    const t = r.tgl;
    const key = t instanceof Date ? fmt(t).slice(0, 10) : String(t).slice(0, 10);
    map.set(key, { total: Number(r.total), jumlah: Number(r.jumlah) });
  }
  // Isi hari tanpa penjualan dgn 0.
  const out: GrafikPenjualanPoint[] = [];
  const cursor = new Date(`${from.slice(0, 10)}T00:00:00`);
  const endDate = new Date(`${to.slice(0, 10)}T00:00:00`);
  const bln = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  while (cursor <= endDate) {
    const key = fmt(cursor).slice(0, 10);
    const v = map.get(key) ?? { total: 0, jumlah: 0 };
    out.push({ label: `${cursor.getDate()} ${bln[cursor.getMonth()]}`, tanggal: key, total: v.total, jumlah: v.jumlah });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Status pesanan HARI INI (untuk donut ringkasan). */
async function statusHariIni(): Promise<DashboardStatusRingkasan> {
  const now = new Date();
  const from = `${fmt(now).slice(0, 10)} 00:00:00`;
  const to = `${fmt(now).slice(0, 10)} 23:59:59`;
  const { rows } = await query<RowDataPacket[]>(
    `SELECT p.status, COUNT(*) AS jumlah FROM pesanan p
     WHERE p.created_at >= ? AND p.created_at <= ?
     GROUP BY p.status`,
    [from, to],
  );
  const map = new Map<string, number>();
  for (const r of rows as Array<{ status: string; jumlah: number }>) map.set(r.status, Number(r.jumlah));
  const selesai = map.get("Selesai") ?? 0;
  const diproses = (map.get("Diproses") ?? 0) + (map.get("Menunggu Pembayaran") ?? 0);
  const lain = (map.get("Dibatalkan") ?? 0) + (map.get("Dikembalikan") ?? 0) + (map.get("Menunggu Konfirmasi") ?? 0);
  return { selesai, diproses, lainnya: lain, total: selesai + diproses + lain };
}

/** Pesanan terbaru (maks 8) utk tabel aktivitas. */
async function pesananTerbaru(limit = 8): Promise<PesananTerbaruRow[]> {
  const { rows } = await query<RowDataPacket[]>(
    `SELECT p.no_pesanan, p.asal_pesanan, p.created_at, p.total, p.status,
            COALESCE(pg.nama, p.kasir_nama) AS nama
     FROM pesanan p
     LEFT JOIN pelanggan pg ON pg.id = p.pelanggan_id
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return (rows as Array<{ no_pesanan: string; asal_pesanan: "offline" | "commerce"; created_at: Date; total: number; status: string; nama: string }>)
    .map((r) => ({
      noPesanan: r.no_pesanan,
      asal: r.asal_pesanan,
      nama: r.nama ?? "-",
      total: Number(r.total),
      status: r.status,
      waktu: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
    }));
}

function pct(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? null : null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function getDashboard(params: ReturnType<typeof parseDashboardParams>): Promise<DashboardDTO> {
  const { start, end, prevStart, prevEnd } = resolveRange(params.range);
  const fromS = fmt(start);
  const toS = fmt(end);
  const prevFromS = fmt(prevStart);
  const prevToS = fmt(prevEnd);

  const [cur, prev, pelangganCur, pelangganPrev, grafik, statusHariIniData, terbaru] = await Promise.all([
    agregatPenjualan(fromS, toS),
    agregatPenjualan(prevFromS, prevToS),
    pelangganBaru(fromS, toS),
    pelangganBaru(prevFromS, prevToS),
    grafikPenjualan(params.range, fromS, toS),
    statusHariIni(),
    pesananTerbaru(8),
  ]);

  const summary: DashboardSummary = {
    totalPenjualan: cur.total,
    totalPesanan: cur.jumlah,
    produkTerjual: cur.produkTerjual,
    pelangganBaru: pelangganCur,
    pertumbuhan: {
      totalPenjualan: pct(cur.total, prev.total),
      totalPesanan: pct(cur.jumlah, prev.jumlah),
      produkTerjual: pct(cur.produkTerjual, prev.produkTerjual),
      pelangganBaru: pct(pelangganCur, pelangganPrev),
    },
  };

  return {
    range: params.range,
    summary,
    grafik,
    statusHariIni: statusHariIniData,
    pesananTerbaru: terbaru,
  };
}
