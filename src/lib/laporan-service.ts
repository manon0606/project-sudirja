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
}

interface PembelianRow2 extends RowDataPacket {
  no_pembelian: string;
  tanggal: Date | string;
  supplier_nama: string;
  ppn: string | number;
  subtotal_total: string | number;
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

/** Format Date → string "YYYY-MM-DD HH:mm:ss" agar kompatibel dgn kolom datetime & timezone DB. */
function fmtDt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function resolveRange(params: ReturnType<typeof parseLaporanParams>, today = new Date()) {
  let from: Date;
  let to: Date;
  switch (params.tipe) {
    case "monthly": {
      const y = Number(params.dateFrom?.slice(0, 4)) || today.getFullYear();
      const m = (Number(params.dateFrom?.slice(5, 7)) || today.getMonth() + 1) - 1;
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 0, 23, 59, 59, 999);
      break;
    }
    case "yearly": {
      const y = Number(params.dateFrom?.slice(0, 4)) || today.getFullYear();
      from = new Date(y, 0, 1);
      to = new Date(y, 11, 31, 23, 59, 59, 999);
      break;
    }
    default: {
      if (params.tipe === "daily") {
        const d = params.dateFrom || today.toISOString().slice(0, 10);
        from = new Date(`${d}T00:00:00`);
        to = new Date(`${d}T23:59:59.999`);
      } else {
        from = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1);
        to = params.dateTo ? new Date(`${params.dateTo}T23:59:59.999`) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      }
    }
  }
  return { from, to, fromStr: fmtDt(from), toStr: fmtDt(to) };
}

/** Ambil pesanan (penjualan + cash) pada rentang — kecuali dibatalkan/dikembalikan. */
async function queryPesanan(from: string, to: string): Promise<PesananRow2[]> {
  const { rows } = await query<PesananRow2[]>(
    `SELECT p.no_pesanan, p.created_at, p.asal_pesanan, p.kasir_nama,
            pg.nama AS nama_pelanggan,
            p.metode_bayar, p.subtotal, p.diskon_amount, p.total,
            p.cash_in, p.cash_out, p.status
     FROM pesanan p
     LEFT JOIN pelanggan pg ON pg.id = p.pelanggan_id
     WHERE p.created_at >= ? AND p.created_at <= ?
       AND p.status NOT IN ('Dibatalkan', 'Dikembalikan')
     ORDER BY p.created_at ASC`,
    [from, to],
  );
  return rows;
}

async function queryPembelian(from: string, to: string): Promise<PembelianRow2[]> {
  const { rows } = await query<PembelianRow2[]>(
    `SELECT pb.no_pembelian, pb.tanggal, s.nama AS supplier_nama, pb.ppn,
            (SELECT COALESCE(SUM(pi.subtotal),0) FROM pembelian_item pi WHERE pi.pembelian_id = pb.id) AS subtotal_total
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
    total: Number(p.total),
  }));

  // Rincian pembelian.
  const pembelian: LaporanPembelianRow[] = pembelianRows.map((pb) => {
    const totalPembelian = Number(pb.subtotal_total);
    const ppn = Number(pb.ppn);
    const grandTotal = totalPembelian + Math.round(totalPembelian * ppn) / 100;
    return {
      noPembelian: pb.no_pembelian,
      tanggal: iso(pb.tanggal),
      supplier: pb.supplier_nama ?? "",
      totalPembelian,
      ppn,
      grandTotal,
      estimasiLaba: 0, // dihitung di laporan utk kelak — placeholder diset 0 utk sekarang
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
  const totalOffline = pesananRows.filter((p) => p.asal_pesanan === "offline").reduce((s, p) => s + Number(p.total), 0);
  const totalOnline = pesananRows.filter((p) => p.asal_pesanan === "commerce").reduce((s, p) => s + Number(p.total), 0);
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
