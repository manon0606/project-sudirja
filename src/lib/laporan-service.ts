import "server-only";

import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import type {
  LaporanCashRow,
  LaporanDTO,
  LaporanKonsinyasiRow,
  LaporanPembelianRow,
  LaporanPenjualanRow,
  LaporanSummary,
  LaporanTipe,
} from "@/lib/laporan-types";

interface PesananRow2 extends RowDataPacket {
  no_pesanan: string;
  created_at: Date | string;
  asal_pesanan: "offline" | "commerce";
  kasir_nama: string;
  nama_pelanggan: string | null;
  metode_bayar: string;
  subtotal: string | number;
  diskon_amount: string | number;
  total: string | number;
  cash_in: string | number | null;
  cash_out: string | number | null;
  status: string;
  nilai_retur: string | number;
}

interface PembelianRow2 extends RowDataPacket {
  no_pembelian: string;
  tanggal: Date | string;
  supplier_nama: string;
  ppn: string | number;
  subtotal_total: string | number;
  biaya_repack: string | number;
  estimasi_laba: string | number;
}

interface KonsinyasiRow2 extends RowDataPacket {
  no_konsinyasi: string;
  tanggal: Date | string;
  supplier_nama: string;
  total_nilai: string | number;
  total_dibayar: string | number;
  total_dikembalikan: string | number;
}

const iso = (v: Date | string) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());

export function parseLaporanParams(q: URLSearchParams) {
  const tipe = (q.get("tipe") ?? "daily") as LaporanTipe;
  const dateFrom = q.get("dateFrom") ?? "";
  const dateTo = q.get("dateTo") ?? "";
  return { tipe, dateFrom, dateTo };
}

/** Offset WIB tetap (UTC+7). */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Instan UTC dari wall-clock WIB (mis. 28 Sep 00:00 WIB → 27 Sep 17:00 UTC). */
function wibInstant(y: number, m: number, d: number, h = 0, mi = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(y, m, d, h, mi, s, ms) - WIB_OFFSET_MS);
}

/** Format Date → "YYYY-MM-DD HH:mm:ss" dalam UTC, sesuai penyimpanan kolom datetime DB. */
function fmtDt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function resolveRange(params: ReturnType<typeof parseLaporanParams>, now = new Date()) {
  // Wall-clock "hari ini" menurut WIB (bukan UTC server).
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const todayY = wibNow.getUTCFullYear();
  const todayM = wibNow.getUTCMonth();
  const todayD = wibNow.getUTCDate();
  const parseYmd = (s: string): [number, number, number] => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return [todayY, todayM, todayD];
    return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  };

  let from: Date;
  let to: Date;
  switch (params.tipe) {
    case "monthly": {
      const [y, m] = params.dateFrom ? parseYmd(params.dateFrom) : [todayY, todayM, 1];
      from = wibInstant(y, m, 1);
      to = wibInstant(y, m + 1, 0, 23, 59, 59, 999);
      break;
    }
    case "yearly": {
      const [y] = params.dateFrom ? parseYmd(params.dateFrom) : [todayY, 0, 1];
      from = wibInstant(y, 0, 1);
      to = wibInstant(y, 11, 31, 23, 59, 59, 999);
      break;
    }
    default: {
      if (params.tipe === "daily") {
        const [y, m, d] = parseYmd(params.dateFrom);
        from = wibInstant(y, m, d);
        to = wibInstant(y, m, d, 23, 59, 59, 999);
      } else {
        const [fy, fm, fd] = params.dateFrom ? parseYmd(params.dateFrom) : [todayY, todayM, 1];
        const [ty, tm, td] = params.dateTo ? parseYmd(params.dateTo) : [todayY, todayM + 1, 0];
        from = wibInstant(fy, fm, fd);
        to = wibInstant(ty, tm, td, 23, 59, 59, 999);
      }
    }
  }
  return { from, to, fromStr: fmtDt(from), toStr: fmtDt(to) };
}

/** Ambil pesanan (penjualan + cash) pada rentang — kecuali dibatalkan.
 *  Pesanan berstatus 'Dikembalikan' TETAP dihitung: nilai retur dipotong dari
 *  totalnya (retur semua → sisa 0), sesuai keputusan laporan = nilai bersih. */
async function queryPesanan(from: string, to: string): Promise<PesananRow2[]> {
  const { rows } = await query<PesananRow2[]>(
    `SELECT p.no_pesanan, p.created_at, p.asal_pesanan, p.kasir_nama,
            pg.nama AS nama_pelanggan,
            p.metode_bayar, p.subtotal, p.diskon_amount, p.total,
            p.cash_in, p.cash_out, p.status,
            (SELECT COALESCE(SUM(ri.subtotal),0) FROM retur_pesanan rp
               JOIN retur_item ri ON ri.retur_id = rp.id
              WHERE rp.pesanan_id = p.id) AS nilai_retur
     FROM pesanan p
     LEFT JOIN pelanggan pg ON pg.id = p.pelanggan_id
     WHERE p.created_at >= ? AND p.created_at <= ?
       AND p.status <> 'Dibatalkan'
     ORDER BY p.created_at ASC`,
    [from, to],
  );
  return rows;
}

async function queryPembelian(from: string, to: string): Promise<PembelianRow2[]> {
  const { rows } = await query<PembelianRow2[]>(
    `SELECT pb.no_pembelian, pb.tanggal, s.nama AS supplier_nama, pb.ppn,
            (SELECT COALESCE(SUM(pi.subtotal),0) FROM pembelian_item pi WHERE pi.pembelian_id = pb.id) AS subtotal_total,
            (SELECT COALESCE(SUM(b.biaya),0) FROM pembelian_item_bahan b
               JOIN pembelian_item pi ON pi.id = b.pembelian_item_id
              WHERE pi.pembelian_id = pb.id) AS biaya_repack,
            (SELECT COALESCE(SUM(
                CASE WHEN EXISTS (SELECT 1 FROM pembelian_item_pecahan pc WHERE pc.pembelian_item_id = pi.id)
                     THEN (SELECT COALESCE(SUM((pc2.harga_jual_satuan - pc2.harga_beli_alokasi) * pc2.qty),0)
                             FROM pembelian_item_pecahan pc2 WHERE pc2.pembelian_item_id = pi.id)
                     /* Alokasi HPP pecahan sudah memuat biaya bahan → jangan dikurangi lagi. */
                     ELSE (pi.harga_jual - pi.harga_beli * (1 - pi.diskon / 100)) * pi.qty
                          - (SELECT COALESCE(SUM(b2.biaya),0) FROM pembelian_item_bahan b2 WHERE b2.pembelian_item_id = pi.id)
                END
              ),0) FROM pembelian_item pi WHERE pi.pembelian_id = pb.id) AS estimasi_laba
     FROM pembelian pb
     LEFT JOIN supplier s ON s.id = pb.supplier_id
     WHERE pb.tanggal >= ? AND pb.tanggal <= ?
     ORDER BY pb.tanggal ASC`,
    [from, to],
  );
  return rows;
}

async function queryKonsinyasi(from: string, to: string): Promise<KonsinyasiRow2[]> {
  const { rows } = await query<KonsinyasiRow2[]>(
    `SELECT k.no_konsinyasi, k.tanggal, s.nama AS supplier_nama,
            (SELECT COALESCE(SUM(ki.qty_konsinyasi * ki.harga_beli),0) FROM konsinyasi_item ki WHERE ki.konsinyasi_id = k.id) AS total_nilai,
            (SELECT COALESCE(SUM(ki.qty_terjual * ki.harga_beli),0) FROM konsinyasi_item ki WHERE ki.konsinyasi_id = k.id) AS total_dibayar,
            (SELECT COALESCE(SUM(ki.qty_dikembalikan * ki.harga_beli),0) FROM konsinyasi_item ki WHERE ki.konsinyasi_id = k.id) AS total_dikembalikan
     FROM konsinyasi k
     LEFT JOIN supplier s ON s.id = k.supplier_id
     WHERE k.tanggal >= ? AND k.tanggal <= ?
     ORDER BY k.tanggal ASC`,
    [from, to],
  );
  return rows;
}

/** Generate laporan real-time untuk periode tertentu. */
export async function generateLaporan(params: ReturnType<typeof parseLaporanParams>): Promise<LaporanDTO> {
  const { from, to, fromStr, toStr } = resolveRange(params);
  const [pesananRows, pembelianRows, konsinyasiRows] = await Promise.all([
    queryPesanan(fromStr, toStr),
    queryPembelian(fromStr, toStr),
    queryKonsinyasi(fromStr, toStr),
  ]);

  // Rincian penjualan (per pesanan).
  const penjualan: LaporanPenjualanRow[] = pesananRows.map((p) => ({
    noPesanan: p.no_pesanan,
    tanggal: iso(p.created_at),
    asal: p.asal_pesanan,
    kasir: p.kasir_nama,
    namaPelanggan: p.nama_pelanggan,
    metodeBayar: p.metode_bayar,
    subtotal: Number(p.subtotal),
    diskon: Number(p.diskon_amount),
    // Retur memotong nilai penjualan (retur semua = 0). Pesanan Dibatalkan/Dikembalikan sudah dikecualikan query.
    total: Number(p.total) - Number(p.nilai_retur ?? 0),
  }));

  // Rincian pembelian.
  const pembelian: LaporanPembelianRow[] = pembelianRows.map((pb) => {
    const subtotalItems = Number(pb.subtotal_total);
    const biayaRepack = Number(pb.biaya_repack ?? 0);
    const totalPembelian = Math.round((subtotalItems + biayaRepack) * 100) / 100;
    const ppn = Number(pb.ppn);
    const grandTotal = totalPembelian + Math.round(totalPembelian * ppn) / 100;
    return {
      noPembelian: pb.no_pembelian,
      tanggal: iso(pb.tanggal),
      supplier: pb.supplier_nama ?? "",
      totalPembelian,
      biayaRepack,
      ppn,
      grandTotal,
      estimasiLaba: Number(pb.estimasi_laba ?? 0),
    };
  });

  // Rincian konsinyasi.
  const konsinyasi: LaporanKonsinyasiRow[] = konsinyasiRows.map((k) => ({
    noKonsinyasi: k.no_konsinyasi,
    tanggal: iso(k.tanggal),
    supplier: k.supplier_nama ?? "",
    totalNilaiKonsinyasi: Number(k.total_nilai),
    totalDibayar: Number(k.total_dibayar),
    totalDikembalikan: Number(k.total_dikembalikan),
  }));

  // Cash flow dari pesanan (cash_in & cash_out opsional).
  const cashFlow: LaporanCashRow[] = [];
  for (const p of pesananRows) {
    const cashIn = p.cash_in == null ? 0 : Number(p.cash_in);
    const cashOut = p.cash_out == null ? 0 : Number(p.cash_out);
    if (cashIn > 0) cashFlow.push({ tanggal: iso(p.created_at), noPesanan: p.no_pesanan, tipe: "in", jumlah: cashIn, keterangan: `Cash in (pesanan ${p.no_pesanan})` });
    if (cashOut > 0) cashFlow.push({ tanggal: iso(p.created_at), noPesanan: p.no_pesanan, tipe: "out", jumlah: cashOut, keterangan: `Cash out (pesanan ${p.no_pesanan})` });
  }
  cashFlow.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  // Summary.
  const totalOffline = penjualan.filter((p) => p.asal === "offline").reduce((s, p) => s + p.total, 0);
  const totalOnline = penjualan.filter((p) => p.asal === "commerce").reduce((s, p) => s + p.total, 0);
  const totalCashIn = pesananRows.reduce((s, p) => s + (p.cash_in == null ? 0 : Number(p.cash_in)), 0);
  const totalPembelian = pembelian.reduce((s, pb) => s + pb.grandTotal, 0);
  const totalKonsinyasiDibayar = konsinyasi.reduce((s, k) => s + k.totalDibayar, 0);
  const totalCashOut = pesananRows.reduce((s, p) => s + (p.cash_out == null ? 0 : Number(p.cash_out)), 0);

  const summary: LaporanSummary = {
    totalPenjualanOffline: Math.round(totalOffline * 100) / 100,
    totalPenjualanOnline: Math.round(totalOnline * 100) / 100,
    totalPenjualan: Math.round((totalOffline + totalOnline) * 100) / 100,
    totalCashIn: Math.round(totalCashIn * 100) / 100,
    totalPemasukan: Math.round((totalOffline + totalOnline + totalCashIn) * 100) / 100,
    totalPembelian: Math.round(totalPembelian * 100) / 100,
    totalKonsinyasiDibayar: Math.round(totalKonsinyasiDibayar * 100) / 100,
    totalCashOut: Math.round(totalCashOut * 100) / 100,
    totalPengeluaran: Math.round((totalPembelian + totalKonsinyasiDibayar + totalCashOut) * 100) / 100,
    labaBersih: 0,
    jumlahTransaksi: pesananRows.length,
  };
  summary.labaBersih = Math.round((summary.totalPemasukan - summary.totalPengeluaran) * 100) / 100;

  const now = new Date();
  const id = `LAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  return {
    id,
    tipe: params.tipe,
    tanggalPembuatan: now.toISOString(),
    periodeMulai: from.toISOString(),
    periodeAkhir: to.toISOString(),
    summary,
    rincian: { penjualan, pembelian, konsinyasi, cashFlow },
  };
}
