"use client";
import { useCallback, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { generateLaporan } from "@/lib/laporan-api";
import type { LaporanDTO, LaporanTipe } from "@/lib/laporan-types";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Download, FileText, Calendar, ChevronDown, TrendingUp, TrendingDown, Wallet, RefreshCw
} from "lucide-react";

type Tab = "summary" | "penjualan" | "pembelian" | "konsinyasi" | "cash";

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function Card({ label, value, color = '#1a0408', icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border" style={{ borderColor: '#e5e7eb', backgroundColor: 'white' }}>
      <p className="text-sm flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.6 }}>{icon}{label}</p>
      <p className="text-xl font-semibold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function exportReportCsv(report: LaporanDTO) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(["LAPORAN KEUANGAN", report.id, report.tipe, format(new Date(report.periodeMulai), "dd MMM yyyy", { locale: localeId }), format(new Date(report.periodeAkhir), "dd MMM yyyy", { locale: localeId })].map(esc).join(","));
  lines.push([] as unknown as string);
  lines.push(["RINGKASAN"].join(""));
  lines.push(["Total Penjualan Offline", report.summary.totalPenjualanOffline].map(esc).join(","));
  lines.push(["Total Penjualan Online", report.summary.totalPenjualanOnline].map(esc).join(","));
  lines.push(["Total Penjualan", report.summary.totalPenjualan].map(esc).join(","));
  lines.push(["Total Cash In", report.summary.totalCashIn].map(esc).join(","));
  lines.push(["Total PEMASUKAN", report.summary.totalPemasukan].map(esc).join(","));
  lines.push(["Total Pembelian", report.summary.totalPembelian].map(esc).join(","));
  lines.push(["Total Konsinyasi Dibayar", report.summary.totalKonsinyasiDibayar].map(esc).join(","));
  lines.push(["Total Cash Out", report.summary.totalCashOut].map(esc).join(","));
  lines.push(["Total PENGELUARAN", report.summary.totalPengeluaran].map(esc).join(","));
  lines.push(["LABA BERSIH", report.summary.labaBersih].map(esc).join(","));
  lines.push("", "PENJUALAN");
  lines.push(["No", "Tanggal", "Asal", "Kasir/Pelanggan", "Metode", "Total"].map(esc).join(","));
  report.rincian.penjualan.forEach((r, i) => lines.push([i + 1, r.tanggal, r.asal, r.asal === "commerce" ? r.namaPelanggan ?? "" : r.kasir, r.metodeBayar, r.total].map(esc).join(",")));
  lines.push("", "PEMBELIAN");
  lines.push(["No", "Tanggal", "Supplier", "Grand Total"].map(esc).join(","));
  report.rincian.pembelian.forEach((r, i) => lines.push([i + 1, r.tanggal, r.supplier, r.grandTotal].map(esc).join(",")));
  lines.push("", "KONSINYASI");
  lines.push(["No", "Tanggal", "Supplier", "Nilai", "Dibayar", "Dikembalikan"].map(esc).join(","));
  report.rincian.konsinyasi.forEach((r, i) => lines.push([i + 1, r.tanggal, r.supplier, r.totalNilaiKonsinyasi, r.totalDibayar, r.totalDikembalikan].map(esc).join(",")));
  lines.push("", "CASH FLOW");
  lines.push(["Tanggal", "Pesanan", "Tipe", "Jumlah", "Keterangan"].map(esc).join(","));
  report.rincian.cashFlow.forEach((r) => lines.push([r.tanggal, r.noPesanan, r.tipe, r.jumlah, r.keterangan].map(esc).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `laporan-${report.id}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Laporan() {
  const [reportType, setReportType] = useState<LaporanTipe>("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [yearlyYear, setYearlyYear] = useState(String(new Date().getFullYear()));
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [report, setReport] = useState<LaporanDTO | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let dateFrom = selectedDate;
      let dateTo: string | undefined;
      if (reportType === "monthly") {
        dateFrom = selectedMonth;
      } else if (reportType === "yearly") {
        dateFrom = yearlyYear;
      } else if (reportType === "custom") {
        if (!customDateFrom || !customDateTo) {
          setError("Pilih rentang tanggal untuk laporan custom.");
          setLoading(false);
          return;
        }
        if (customDateFrom > customDateTo) {
          setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
          setLoading(false);
          return;
        }
        dateFrom = customDateFrom;
        dateTo = customDateTo;
      }
      const result = await generateLaporan({ tipe: reportType, dateFrom, dateTo });
      setReport(result);
      setTab("summary");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedDate, selectedMonth, yearlyYear, customDateFrom, customDateTo]);

  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="laporan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Laporan Keuangan</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Pantau semua pemasukan & pengeluaran secara real-time dari data transaksi
              </p>
            </div>
            {report && (
              <button onClick={() => exportReportCsv(report)}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <Download className="w-5 h-5" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Form periode */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Tipe Laporan</span>
              <div className="relative">
                <select value={reportType} onChange={(e) => setReportType(e.target.value as LaporanTipe)}
                  className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                  <option value="daily">Harian</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                  <option value="custom">Custom</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
              </div>
            </div>

            {reportType === "daily" && (
              <div>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Tanggal</span>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </div>
            )}
            {reportType === "monthly" && (
              <div>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Bulan</span>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </div>
            )}
            {reportType === "yearly" && (
              <div>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Tahun</span>
                <input type="number" value={yearlyYear} onChange={(e) => setYearlyYear(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 w-28" style={inputStyle} />
              </div>
            )}
            {reportType === "custom" && (
              <>
                <div>
                  <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Dari</span>
                  <input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
                </div>
                <div>
                  <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Sampai</span>
                  <input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
                </div>
              </>
            )}

            <button onClick={() => void handleGenerate()} disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#27b446' }}>
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              {loading ? "Memproses..." : "Buat Laporan"}
            </button>
          </div>
          {error && (
            <div className="mt-3 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {!report ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                  <FileText className="w-10 h-10" style={{ color: '#27b446' }} />
                </div>
                <div>
                  <p className="text-lg" style={{ color: '#000000' }}>Belum ada laporan</p>
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Pilih periode lalu klik &quot;Buat Laporan&quot; untuk melihat laporan real-time.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary cards */}
              <div>
                <p className="text-sm mb-2 flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.7 }}>
                  <Calendar className="w-4 h-4" />
                  Periode: {format(new Date(report.periodeMulai), "dd MMM yyyy", { locale: localeId })} — {format(new Date(report.periodeAkhir), "dd MMM yyyy", { locale: localeId })}
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono" style={{ backgroundColor: '#f3f4f6', color: '#27b446' }}>{report.id}</span>
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card label="Pemasukan (Penjualan)" value={formatRp(report.summary.totalPenjualan)} color="#27b446" icon={<TrendingUp className="w-4 h-4" style={{ color: '#27b446' }} />} />
                  <Card label="Cash In" value={formatRp(report.summary.totalCashIn)} color="#27b446" icon={<Wallet className="w-4 h-4" style={{ color: '#27b446' }} />} />
                  <Card label="Pengeluaran (Beli)" value={formatRp(report.summary.totalPengeluaran)} color="#e40b18" icon={<TrendingDown className="w-4 h-4" style={{ color: '#e40b18' }} />} />
                  <Card label="Laba Bersih" value={formatRp(report.summary.labaBersih)} color={report.summary.labaBersih >= 0 ? '#27b446' : '#e40b18'} icon={<Wallet className="w-4 h-4" style={{ color: '#27b446' }} />} />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
                  <Card label="Penjualan Offline" value={formatRp(report.summary.totalPenjualanOffline)} />
                  <Card label="Penjualan Online" value={formatRp(report.summary.totalPenjualanOnline)} />
                  <Card label="Total Pembelian (PO)" value={formatRp(report.summary.totalPembelian)} />
                  <Card label="Konsinyasi Dibayar" value={formatRp(report.summary.totalKonsinyasiDibayar)} />
                  <Card label="Cash Out" value={formatRp(report.summary.totalCashOut)} />
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
                  {([
                    ["summary", "Ringkasan"],
                    ["penjualan", `Penjualan (${report.rincian.penjualan.length})`],
                    ["pembelian", `Pembelian (${report.rincian.pembelian.length})`],
                    ["konsinyasi", `Konsinyasi (${report.rincian.konsinyasi.length})`],
                    ["cash", `Cash Flow (${report.rincian.cashFlow.length})`],
                  ] as Array<[Tab, string]>).map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                      className="px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
                      style={{ borderColor: tab === key ? '#27b446' : 'transparent', color: tab === key ? '#27b446' : '#1a0408', opacity: tab === key ? 1 : 0.7 }}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  {tab === "summary" && (
                    <div className="p-6">
                      <table className="w-full max-w-lg">
                        <tbody>
                          {([
                            ["Total Penjualan Offline", report.summary.totalPenjualanOffline],
                            ["Total Penjualan Online", report.summary.totalPenjualanOnline],
                            ["+ Cash In", report.summary.totalCashIn],
                          ] as Array<[string, number]>).map(([l, v]) => (
                            <tr key={l} className="border-b border-gray-100">
                              <td className="py-2" style={{ color: '#1a0408' }}>{l}</td>
                              <td className="py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(v)}</td>
                            </tr>
                          ))}
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-medium" style={{ color: '#27b446' }}>TOTAL PEMASUKAN</td>
                            <td className="py-2 text-right font-medium" style={{ color: '#27b446' }}>{formatRp(report.summary.totalPemasukan)}</td>
                          </tr>
                          {([
                            ["Total Pembelian (PO)", report.summary.totalPembelian],
                            ["Konsinyasi dibayar ke supplier", report.summary.totalKonsinyasiDibayar],
                            ["+ Cash Out", report.summary.totalCashOut],
                          ] as Array<[string, number]>).map(([l, v]) => (
                            <tr key={l} className="border-b border-gray-100">
                              <td className="py-2" style={{ color: '#1a0408' }}>{l}</td>
                              <td className="py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(v)}</td>
                            </tr>
                          ))}
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-medium" style={{ color: '#e40b18' }}>TOTAL PENGELUARAN</td>
                            <td className="py-2 text-right font-medium" style={{ color: '#e40b18' }}>{formatRp(report.summary.totalPengeluaran)}</td>
                          </tr>
                          <tr>
                            <td className="py-3 text-lg font-semibold" style={{ color: '#000000' }}>LABA BERSIH ({report.summary.jumlahTransaksi} transaksi)</td>
                            <td className="py-3 text-lg font-semibold text-right" style={{ color: report.summary.labaBersih >= 0 ? '#27b446' : '#e40b18' }}>{formatRp(report.summary.labaBersih)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {tab === "penjualan" && (
                    <table className="w-full">
                      <thead style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <tr>
                          {["No. Pesanan", "Tanggal", "Asal", "Kasir / Pelanggan", "Metode", "Subtotal", "Diskon", "Total"].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#000' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rincian.penjualan.length === 0 ? (
                          <tr><td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Tidak ada penjualan pada periode ini.</td></tr>
                        ) : report.rincian.penjualan.map((r) => (
                          <tr key={r.noPesanan} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-2 font-mono text-sm" style={{ color: '#27b446' }}>{r.noPesanan}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{format(new Date(r.tanggal), "dd MMM HH:mm", { locale: localeId })}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.asal === "offline" ? "Offline" : "Online"}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.asal === "commerce" ? r.namaPelanggan ?? "-" : r.kasir}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.metodeBayar}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#1a0408' }}>{formatRp(r.subtotal)}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#e40b18' }}>{r.diskon > 0 ? `-${formatRp(r.diskon)}` : "-"}</td>
                            <td className="px-5 py-2 text-sm text-right font-medium" style={{ color: '#27b446' }}>{formatRp(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === "pembelian" && (
                    <table className="w-full">
                      <thead style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <tr>
                          {["No. Pembelian", "Tanggal", "Supplier", "Subtotal", "PPN", "Grand Total"].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#000' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rincian.pembelian.length === 0 ? (
                          <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Tidak ada pembelian pada periode ini.</td></tr>
                        ) : report.rincian.pembelian.map((r) => (
                          <tr key={r.noPembelian} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-2 font-mono text-sm" style={{ color: '#27b446' }}>{r.noPembelian}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{format(new Date(r.tanggal), "dd MMM yyyy", { locale: localeId })}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.supplier}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#1a0408' }}>{formatRp(r.totalPembelian)}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#1a0408' }}>{r.ppn > 0 ? `${r.ppn}%` : "-"}</td>
                            <td className="px-5 py-2 text-sm text-right font-medium" style={{ color: '#e40b18' }}>{formatRp(r.grandTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === "konsinyasi" && (
                    <table className="w-full">
                      <thead style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <tr>
                          {["No. Konsinyasi", "Tanggal", "Supplier", "Nilai", "Dibayar", "Dikembalikan"].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#000' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rincian.konsinyasi.length === 0 ? (
                          <tr><td colSpan={6} className="px-5 py-10 text-center text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Tidak ada konsinyasi pada periode ini.</td></tr>
                        ) : report.rincian.konsinyasi.map((r) => (
                          <tr key={r.noKonsinyasi} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-2 font-mono text-sm" style={{ color: '#27b446' }}>{r.noKonsinyasi}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{format(new Date(r.tanggal), "dd MMM yyyy", { locale: localeId })}</td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.supplier}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#1a0408' }}>{formatRp(r.totalNilaiKonsinyasi)}</td>
                            <td className="px-5 py-2 text-sm text-right font-medium" style={{ color: '#e40b18' }}>{formatRp(r.totalDibayar)}</td>
                            <td className="px-5 py-2 text-sm text-right" style={{ color: '#27b446' }}>{formatRp(r.totalDikembalikan)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === "cash" && (
                    <table className="w-full">
                      <thead style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <tr>
                          {["Tanggal", "Pesanan", "Tipe", "Jumlah", "Keterangan"].map((h) => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#000' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.rincian.cashFlow.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Tidak ada cash in/out pada periode ini.</td></tr>
                        ) : report.rincian.cashFlow.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{format(new Date(r.tanggal), "dd MMM yyyy HH:mm", { locale: localeId })}</td>
                            <td className="px-5 py-2 font-mono text-sm" style={{ color: '#27b446' }}>{r.noPesanan}</td>
                            <td className="px-5 py-2 text-sm">
                              <span className="px-2 py-0.5 rounded-full text-xs"
                                style={{ backgroundColor: r.tipe === "in" ? 'rgba(39,180,70,0.1)' : '#fee2e2', color: r.tipe === "in" ? '#27b446' : '#991b1b' }}>
                                {r.tipe === "in" ? "Cash In" : "Cash Out"}
                              </span>
                            </td>
                            <td className="px-5 py-2 text-sm text-right font-medium" style={{ color: r.tipe === "in" ? '#27b446' : '#e40b18' }}>
                              {r.tipe === "in" ? "+" : "-"}{formatRp(r.jumlah)}
                            </td>
                            <td className="px-5 py-2 text-sm" style={{ color: '#1a0408' }}>{r.keterangan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
