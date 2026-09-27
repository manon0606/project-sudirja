/**
 * Generator PDF laporan keuangan (client-side, jsPDF + jspdf-autotable).
 *
 * Format mengikuti contoh laporan desain V3.1 (modal detail Laporan.tsx):
 * header "Laporan Keuangan" + ID + periode + tanggal cetak, lalu seksi
 * Ringkasan Total, Ringkasan Penjualan, Metode Pembayaran, Laporan Per Jam,
 * dan tabel rincian per seksi (Transaksi POS, Transaksi Online, Pembelian
 * Stok, Konsinyasi, Cash In, Cash Out) dengan total berwarna di baris judul.
 *
 * Seksi desain yang datanya tidak ada di LaporanDTO dilewati (lihat notes
 * di task): "Produk Terlaris" (butuh data per item produk) dan kolom
 * "Status"/"Repack" (tidak ada di DTO).
 */
import type { CellInput, RowInput, UserOptions } from "jspdf-autotable";
import { fmtWib } from "@/lib/date-utils";
import type { LaporanDTO, LaporanPenjualanRow, LaporanTipe } from "@/lib/laporan-types";

/** RGB triple untuk API jsPDF & style autoTable. */
type RGB = [number, number, number];

// Warna brand V3.1
const GREEN: RGB = [39, 180, 70];
const RED: RGB = [228, 11, 24];
const BLACK: RGB = [0, 0, 0];
const DARK: RGB = [26, 4, 8];
const GRAY: RGB = [107, 114, 128];
const HEAD_BG: RGB = [249, 250, 251]; // #f9fafb — header tabel desain
const ZEBRA_BG: RGB = [252, 250, 255]; // #fcfaff — stripe halus
const LINE: RGB = [229, 231, 235];

const MARGIN = 14;
const TOP = 47; // ruang header tetap di setiap halaman
const BOTTOM = 16;

function rp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function tipeLabel(tipe: LaporanTipe): string {
  switch (tipe) {
    case "daily": return "Harian";
    case "monthly": return "Bulanan";
    case "yearly": return "Tahunan";
    default: return "Custom";
  }
}

function periodeText(report: LaporanDTO): string {
  switch (report.tipe) {
    case "daily":
      return fmtWib(report.periodeMulai, "dd MMMM yyyy");
    case "monthly":
      return fmtWib(report.periodeMulai, "MMMM yyyy");
    case "yearly":
      return fmtWib(report.periodeMulai, "yyyy");
    default:
      return `${fmtWib(report.periodeMulai, "dd MMM yyyy")} - ${fmtWib(report.periodeAkhir, "dd MMM yyyy")}`;
  }
}

/** Agregasi Metode Pembayaran dari rincian penjualan. */
function aggregateMetode(rows: LaporanPenjualanRow[]): Array<[string, number, number]> {
  const map = new Map<string, { n: number; total: number }>();
  for (const r of rows) {
    const key = r.metodeBayar || "-";
    const cur = map.get(key) ?? { n: 0, total: 0 };
    cur.n += 1;
    cur.total += r.total;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([metode, v]) => [metode, v.n, v.total] as [string, number, number])
    .sort((a, b) => b[2] - a[2]);
}

/** Agregasi Laporan Per Jam (per jam WIB) dari rincian penjualan. */
function aggregatePerJam(rows: LaporanPenjualanRow[]): Array<[string, number, number]> {
  const map = new Map<number, { n: number; total: number }>();
  for (const r of rows) {
    const hour = Number(fmtWib(r.tanggal, "HH"));
    const key = Number.isNaN(hour) ? 0 : hour;
    const cur = map.get(key) ?? { n: 0, total: 0 };
    cur.n += 1;
    cur.total += r.total;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, v]) => [`${String(hour).padStart(2, "0")}:00 - ${String(hour).padStart(2, "0")}:59`, v.n, v.total] as [string, number, number]);
}

interface Emphasis {
  color: RGB;
  bold?: boolean;
  size?: number;
}

interface SectionOpts {
  title: string;
  titleColor?: RGB;
  /** Total yang tampil di sisi kanan baris judul (gaya DataSection desain). */
  total?: { value: number; color: RGB };
  head: string[];
  rows: CellInput[][];
  widths: number[];
  /** Indeks kolom rata kanan (angka rupiah). */
  rightCols?: number[];
  /** Penekanan baris (mis. baris TOTAL berwarna). */
  emphasize?: (rowIndex: number) => Emphasis | null;
}

export async function exportLaporanPdf(report: LaporanDTO): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableMod.autoTable;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const headedPages = new Set<number>();
  let y = TOP;

  const drawHeader = () => {
    const page = doc.getNumberOfPages();
    if (headedPages.has(page)) return;
    headedPages.add(page);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text("LAPORAN KEUANGAN", MARGIN, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text(`${report.id}  ·  ${tipeLabel(report.tipe)}`, MARGIN, 24);

    doc.setFontSize(9);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(`Periode: ${periodeText(report)}`, MARGIN, 30);

    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(`Dicetak: ${fmtWib(new Date(), "dd MMMM yyyy, HH:mm")} WIB`, MARGIN, 35.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text("Sudirja", pageW - MARGIN, 17, { align: "right" });

    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, 39, pageW - MARGIN, 39);
  };
  drawHeader();

  const lastY = (): number => {
    const t = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    return t?.finalY ?? y;
  };

  const newPage = () => {
    doc.addPage();
    y = TOP;
    drawHeader();
  };

  const addSection = (opts: SectionOpts) => {
    // Ruang minimal untuk judul + 1 baris tabel
    if (y + 24 > pageH - BOTTOM) newPage();

    const titleY = y + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const tc = opts.titleColor ?? GREEN;
    doc.setTextColor(tc[0], tc[1], tc[2]);
    doc.text(opts.title, MARGIN, titleY);
    if (opts.total && opts.rows.length > 0) {
      doc.text(rp(opts.total.value), pageW - MARGIN, titleY, { align: "right" });
    }

    if (opts.rows.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
      doc.text("Tidak ada data", MARGIN, titleY + 6);
      y = titleY + 12;
      return;
    }

    const columnStyles: UserOptions["columnStyles"] = {};
    opts.widths.forEach((w, i) => {
      columnStyles[i] = {
        cellWidth: w,
        halign: opts.rightCols?.includes(i) ? "right" : "left",
      };
    });

    autoTable(doc, {
      head: [opts.head],
      body: opts.rows as RowInput[],
      startY: titleY + 3,
      theme: "grid",
      margin: { top: TOP, right: MARGIN, bottom: BOTTOM, left: MARGIN },
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 1.8,
        textColor: [DARK[0], DARK[1], DARK[2]],
        lineColor: [LINE[0], LINE[1], LINE[2]],
        lineWidth: 0.1,
        valign: "middle",
      },
      headStyles: {
        fillColor: [HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]],
        textColor: [BLACK[0], BLACK[1], BLACK[2]],
        fontStyle: "bold",
        lineColor: [LINE[0], LINE[1], LINE[2]],
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [ZEBRA_BG[0], ZEBRA_BG[1], ZEBRA_BG[2]],
      },
      columnStyles,
      didParseCell: (data) => {
        if (data.section !== "body" || !opts.emphasize) return;
        const em = opts.emphasize(data.row.index);
        if (!em) return;
        data.cell.styles.textColor = em.color;
        if (em.bold) data.cell.styles.fontStyle = "bold";
        if (em.size) data.cell.styles.fontSize = em.size;
      },
      didDrawPage: () => drawHeader(),
    });

    y = lastY() + 8;
  };

  const s = report.summary;
  const penjualan = report.rincian.penjualan;
  const posRows = penjualan.filter((r) => r.asal === "offline");
  const onlineRows = penjualan.filter((r) => r.asal === "commerce");
  const cashIn = report.rincian.cashFlow.filter((r) => r.tipe === "in");
  const cashOut = report.rincian.cashFlow.filter((r) => r.tipe === "out");

  // ------------------------------------------------------------------
  // 1. Ringkasan Total (mengikuti box "Ringkasan Total" desain + tabel
  //    rekap di tab Ringkasan)
  // ------------------------------------------------------------------
  addSection({
    title: "Ringkasan Total",
    titleColor: BLACK,
    head: ["Keterangan", "Jumlah"],
    widths: [150, 119],
    rightCols: [1],
    rows: [
      ["Total Penjualan Offline", rp(s.totalPenjualanOffline)],
      ["Total Penjualan Online", rp(s.totalPenjualanOnline)],
      ["+ Cash In", rp(s.totalCashIn)],
      ["TOTAL PEMASUKAN", rp(s.totalPemasukan)],
      ["Total Pembelian (PO)", rp(s.totalPembelian)],
      ["Konsinyasi dibayar ke supplier", rp(s.totalKonsinyasiDibayar)],
      ["+ Cash Out", rp(s.totalCashOut)],
      ["TOTAL PENGELUARAN", rp(s.totalPengeluaran)],
      [`LABA BERSIH (${s.jumlahTransaksi} transaksi)`, rp(s.labaBersih)],
    ],
    emphasize: (i) => {
      if (i === 3) return { color: GREEN, bold: true };
      if (i === 7) return { color: RED, bold: true };
      if (i === 8) return { color: s.labaBersih >= 0 ? GREEN : RED, bold: true, size: 10 };
      return null;
    },
  });

  // ------------------------------------------------------------------
  // 2. Ringkasan Penjualan
  // ------------------------------------------------------------------
  addSection({
    title: "Ringkasan Penjualan",
    head: ["Keterangan", "Jumlah"],
    widths: [150, 119],
    rightCols: [1],
    rows: [
      ["Penjualan Offline (POS)", rp(s.totalPenjualanOffline)],
      ["Penjualan Online", rp(s.totalPenjualanOnline)],
      ["Total Penjualan", rp(s.totalPenjualan)],
      ["Jumlah Transaksi", `${s.jumlahTransaksi} transaksi`],
    ],
    emphasize: (i) => (i === 2 ? { color: GREEN, bold: true } : null),
  });

  // ------------------------------------------------------------------
  // 3. Metode Pembayaran (agregat dari rincian penjualan)
  // ------------------------------------------------------------------
  const metodeRows: CellInput[][] = aggregateMetode(penjualan).map(([m, n, total]) => [m, `${n} transaksi`, rp(total)]);
  addSection({
    title: "Metode Pembayaran",
    head: ["Metode Pembayaran", "Jumlah Transaksi", "Total"],
    widths: [109, 80, 80],
    rightCols: [1, 2],
    rows: metodeRows,
  });

  // ------------------------------------------------------------------
  // 4. Laporan Per Jam (agregat penjualan per jam WIB)
  // ------------------------------------------------------------------
  const jamRows: CellInput[][] = aggregatePerJam(penjualan).map(([jam, n, total]) => [jam, `${n} transaksi`, rp(total)]);
  addSection({
    title: "Laporan Per Jam",
    head: ["Jam", "Jumlah Transaksi", "Total Penjualan"],
    widths: [109, 80, 80],
    rightCols: [1, 2],
    rows: jamRows,
  });

  // ------------------------------------------------------------------
  // 5. Transaksi POS (desain: ID / Tanggal / Kasir / Metode / Total)
  // ------------------------------------------------------------------
  addSection({
    title: "Transaksi POS",
    total: { value: posRows.reduce((a, r) => a + r.total, 0), color: GREEN },
    head: ["No. Pesanan", "Tanggal", "Kasir", "Metode", "Subtotal", "Diskon", "Total"],
    widths: [40, 42, 50, 34, 34, 30, 39],
    rightCols: [4, 5, 6],
    rows: posRows.map((r) => [
      r.noPesanan,
      fmtWib(r.tanggal, "dd MMM yyyy HH:mm"),
      r.kasir,
      r.metodeBayar,
      rp(r.subtotal),
      r.diskon > 0 ? `-${rp(r.diskon)}` : "-",
      rp(r.total),
    ]),
  });

  // ------------------------------------------------------------------
  // 6. Transaksi Online (kolom Status desain dilewati — tidak ada di DTO)
  // ------------------------------------------------------------------
  addSection({
    title: "Transaksi Online",
    total: { value: onlineRows.reduce((a, r) => a + r.total, 0), color: GREEN },
    head: ["No. Pesanan", "Tanggal", "Pelanggan", "Metode", "Subtotal", "Diskon", "Total"],
    widths: [40, 42, 50, 34, 34, 30, 39],
    rightCols: [4, 5, 6],
    rows: onlineRows.map((r) => [
      r.noPesanan,
      fmtWib(r.tanggal, "dd MMM yyyy HH:mm"),
      r.namaPelanggan ?? "-",
      r.metodeBayar,
      rp(r.subtotal),
      r.diskon > 0 ? `-${rp(r.diskon)}` : "-",
      rp(r.total),
    ]),
  });

  // ------------------------------------------------------------------
  // 7. Pembelian Stok (kolom Repack desain diganti PPN + Estimasi Laba
  //    sesuai field DTO)
  // ------------------------------------------------------------------
  addSection({
    title: "Pembelian Stok",
    titleColor: RED,
    total: { value: report.rincian.pembelian.reduce((a, r) => a + r.grandTotal, 0), color: RED },
    head: ["No. Pembelian", "Tanggal", "Supplier", "Total Pembelian", "PPN", "Grand Total", "Estimasi Laba"],
    widths: [38, 34, 55, 36, 18, 42, 46],
    rightCols: [3, 4, 5, 6],
    rows: report.rincian.pembelian.map((r) => [
      r.noPembelian,
      fmtWib(r.tanggal, "dd MMM yyyy"),
      r.supplier,
      rp(r.totalPembelian),
      r.ppn > 0 ? `${r.ppn}%` : "-",
      rp(r.grandTotal),
      rp(r.estimasiLaba),
    ]),
  });

  // ------------------------------------------------------------------
  // 8. Konsinyasi (desain: Nilai Konsinyasi / Yang Dibayar / Dikembalikan)
  // ------------------------------------------------------------------
  addSection({
    title: "Konsinyasi",
    titleColor: RED,
    total: { value: report.rincian.konsinyasi.reduce((a, r) => a + r.totalDibayar, 0), color: RED },
    head: ["No. Konsinyasi", "Tanggal", "Vendor", "Nilai Konsinyasi", "Yang Dibayar", "Dikembalikan"],
    widths: [42, 34, 55, 46, 46, 46],
    rightCols: [3, 4, 5],
    rows: report.rincian.konsinyasi.map((r) => [
      r.noKonsinyasi,
      fmtWib(r.tanggal, "dd MMM yyyy"),
      r.supplier,
      rp(r.totalNilaiKonsinyasi),
      rp(r.totalDibayar),
      rp(r.totalDikembalikan),
    ]),
  });

  // ------------------------------------------------------------------
  // 9-10. Cash In / Cash Out (desain: Tanggal / Keterangan / Jumlah)
  // ------------------------------------------------------------------
  addSection({
    title: "Cash In",
    total: { value: cashIn.reduce((a, r) => a + r.jumlah, 0), color: GREEN },
    head: ["Tanggal", "Pesanan", "Keterangan", "Jumlah"],
    widths: [38, 42, 129, 60],
    rightCols: [3],
    rows: cashIn.map((r) => [
      fmtWib(r.tanggal, "dd MMM yyyy HH:mm"),
      r.noPesanan || "-",
      r.keterangan,
      rp(r.jumlah),
    ]),
  });

  addSection({
    title: "Cash Out",
    titleColor: RED,
    total: { value: cashOut.reduce((a, r) => a + r.jumlah, 0), color: RED },
    head: ["Tanggal", "Pesanan", "Keterangan", "Jumlah"],
    widths: [38, 42, 129, 60],
    rightCols: [3],
    rows: cashOut.map((r) => [
      fmtWib(r.tanggal, "dd MMM yyyy HH:mm"),
      r.noPesanan || "-",
      r.keterangan,
      rp(r.jumlah),
    ]),
  });

  // Nomor halaman di kaki setiap halaman
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageW / 2, pageH - 6, { align: "center" });
  }

  doc.save(`laporan-${report.id}.pdf`);
}
