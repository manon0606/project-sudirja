"use client";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import DatePicker from "./DatePicker";
import Modal from "./Modal";
import { ApiClientError } from "@/lib/api-client";
import { generateLaporan } from "@/lib/laporan-api";
import type { LaporanDTO, LaporanTipe } from "@/lib/laporan-types";
import { exportLaporanPdf } from "./laporan-pdf";
import {
  eachMonthOfInterval, eachWeekOfInterval, endOfMonth, endOfWeek, format,
  isWithinInterval, startOfMonth,
} from "date-fns";
import { fmtWib, toWibDate } from "@/lib/date-utils";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Download, Eye, FileText, RefreshCw, Search, X
} from "lucide-react";

const GREEN = '#27b446';
const RED = '#e40b18';
const INK = '#1a0408';

const HISTORY_KEY = "sudirja_laporan_history";
const HISTORY_MAX = 50;

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/** Pilihan tahun dropdown: 6 tahun terakhir (termasuk tahun berjalan). */
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

const TYPE_TILES: Array<{ key: LaporanTipe; label: string; desc: string }> = [
  { key: "daily", label: "Harian", desc: "Laporan per hari" },
  { key: "monthly", label: "Bulanan", desc: "Laporan per bulan" },
  { key: "yearly", label: "Tahunan", desc: "Laporan per tahun" },
  { key: "custom", label: "Custom", desc: "Tentukan periode" },
];

interface HistoryEntry {
  id: string;
  tipe: LaporanTipe;
  periodeMulai: string;
  periodeAkhir: string;
  tanggalPembuatan: string;
  report: LaporanDTO;
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** Teks periode laporan (format desain per tipe). */
function periodeText(r: { tipe: LaporanTipe; periodeMulai: string; periodeAkhir: string }) {
  if (r.tipe === "daily") return fmtWib(r.periodeMulai, "dd MMMM yyyy");
  if (r.tipe === "monthly") return fmtWib(r.periodeMulai, "MMMM yyyy");
  if (r.tipe === "yearly") return fmtWib(r.periodeMulai, "yyyy");
  return `${fmtWib(r.periodeMulai, "dd MMM yyyy")} - ${fmtWib(r.periodeAkhir, "dd MMM yyyy")}`;
}

const EMPTY_HISTORY: HistoryEntry[] = [];

function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return EMPTY_HISTORY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_HISTORY;
    const valid = parsed.filter((e): e is HistoryEntry => {
      const entry = e as HistoryEntry | null;
      return !!entry && typeof entry.id === "string" && !!entry.report;
    });
    return valid.length ? valid : EMPTY_HISTORY;
  } catch {
    return EMPTY_HISTORY;
  }
}

// localStorage = sumber kebenaran riwayat. Snapshot di-cache supaya referensinya
// stabil (syarat useSyncExternalStore), dan getServerSnapshot selalu kosong agar
// HTML server sama dengan render pertama klien (tanpa hydration mismatch).
let cachedHistoryRaw: string | null = null;
let cachedHistory: HistoryEntry[] = EMPTY_HISTORY;
const historyListeners = new Set<() => void>();

function getHistorySnapshot(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return EMPTY_HISTORY;
  }
  if (raw === cachedHistoryRaw) return cachedHistory;
  cachedHistoryRaw = raw;
  cachedHistory = parseHistory(raw);
  return cachedHistory;
}

function subscribeHistory(onChange: () => void): () => void {
  historyListeners.add(onChange);
  return () => { historyListeners.delete(onChange); };
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    /* storage penuh/diblokir — riwayat cukup hidup di memori sesi ini */
  }
  historyListeners.forEach((listener) => listener());
}

/** Nomor halaman yang tampil (maks 5, mengikuti desain). */
function pageWindow(current: number, total: number, size = 5): number[] {
  if (total <= size) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(1, current - Math.floor(size / 2));
  if (start + size - 1 > total) start = total - size + 1;
  return Array.from({ length: size }, (_, i) => start + i);
}


export default function Laporan() {
  const now = new Date();
  const [reportType, setReportType] = useState<LaporanTipe>("daily");
  const [selectedDate, setSelectedDate] = useState(format(now, "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [latest, setLatest] = useState<LaporanDTO | null>(null);
  const [viewing, setViewing] = useState<LaporanDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportingId, setExportingId] = useState("");
  const [exportError, setExportError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"tanggalPembuatan" | "periodeMulai">("tanggalPembuatan");
  const [sortAsc, setSortAsc] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Riwayat laporan hidup di localStorage (sumber kebenaran); snapshot server kosong.
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, () => EMPTY_HISTORY);

  const handleGenerate = useCallback(async () => {
    setError("");
    let dateFrom = selectedDate;
    let dateTo: string | undefined;
    if (reportType === "monthly") {
      dateFrom = `${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, "0")}-01`;
    } else if (reportType === "yearly") {
      dateFrom = `${selectedYear}-01-01`;
    } else if (reportType === "custom") {
      if (!customDateFrom || !customDateTo) {
        setError("Pilih rentang tanggal laporan custom terlebih dahulu.");
        return;
      }
      if (customDateFrom > customDateTo) {
        setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.");
        return;
      }
      dateFrom = customDateFrom;
      dateTo = customDateTo;
    }
    setLoading(true);
    try {
      const result = await generateLaporan({ tipe: reportType, dateFrom, dateTo });
      if (result.dataKosong) {
        setError("Data tidak ditemukan untuk periode yang dipilih.");
        return;
      }
      const entry: HistoryEntry = {
        id: result.id,
        tipe: result.tipe,
        periodeMulai: result.periodeMulai,
        periodeAkhir: result.periodeAkhir,
        tanggalPembuatan: result.tanggalPembuatan,
        report: result,
      };
      setLatest(result);
      setCurrentPage(1);
      writeHistory([entry, ...history.filter((e) => e.id !== entry.id)].slice(0, HISTORY_MAX));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedDate, selectedMonth, selectedYear, customDateFrom, customDateTo, history]);

  const handleExport = useCallback(async (r: LaporanDTO, key: string) => {
    setExportingId(key);
    setExportError("");
    try {
      await exportLaporanPdf(r);
    } catch {
      setExportError("Gagal membuat file PDF. Silakan coba lagi.");
    } finally {
      setExportingId("");
    }
  }, []);

  const toggleSort = useCallback((key: "tanggalPembuatan" | "periodeMulai") => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
      return;
    }
    setSortKey(key);
    setSortAsc(false);
  }, [sortKey]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q ? history.filter((e) => e.id.toLowerCase().includes(q)) : [...history];
    list.sort((a, b) => {
      const va = sortKey === "tanggalPembuatan" ? a.tanggalPembuatan : a.periodeMulai;
      const vb = sortKey === "tanggalPembuatan" ? b.tanggalPembuatan : b.periodeMulai;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [history, searchQuery, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * itemsPerPage;
  const pageRows = filtered.slice(startIndex, startIndex + itemsPerPage);

  const sortIcon = (key: "tanggalPembuatan" | "periodeMulai") =>
    sortKey !== key
      ? <ArrowUpDown className="w-4 h-4" style={{ opacity: 0.4 }} />
      : sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;

  const inputStyle = { color: INK, '--tw-ring-color': GREEN } as React.CSSProperties;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="laporan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <h1 style={{ color: '#000000' }}>Laporan</h1>
          <p className="mt-1" style={{ color: INK, opacity: 0.6 }}>
            Buat dan kelola laporan keuangan toko
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="space-y-6">
            {exportError && (
              <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                ⚠ {exportError}
              </div>
            )}

            {/* Buat Laporan Baru */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="mb-4" style={{ color: '#000000' }}>Buat Laporan Baru</h2>

              <div className="mb-6">
                <label className="block mb-3" style={{ color: '#000000' }}>Pilih Tipe Laporan</label>
                <div className="grid grid-cols-4 gap-4">
                  {TYPE_TILES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => { setReportType(t.key); setError(""); }}
                      className="p-4 rounded-lg border-2 transition-colors text-left"
                      style={{
                        borderColor: reportType === t.key ? GREEN : '#e5e7eb',
                        backgroundColor: reportType === t.key ? 'rgba(39, 180, 70, 0.05)' : 'transparent'
                      }}
                    >
                      <p style={{ color: '#000000' }}>{t.label}</p>
                      <p className="text-sm mt-1" style={{ color: INK, opacity: 0.6 }}>{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-2">
                {reportType === "daily" && (
                  <div className="flex-1 max-w-xs">
                    <label className="block mb-2" style={{ color: '#000000' }}>Pilih Tanggal</label>
                    <div className="relative">
                      <DatePicker
                        value={selectedDate}
                        onChange={(v) => setSelectedDate(v)}
                        className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                        style={inputStyle}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.4 }} />
                    </div>
                  </div>
                )}

                {reportType === "monthly" && (
                  <div className="flex-1 grid grid-cols-2 gap-4 max-w-lg">
                    <div>
                      <label className="block mb-2" style={{ color: '#000000' }}>Pilih Bulan</label>
                      <div className="relative">
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                          style={inputStyle}
                        >
                          {MONTHS_ID.map((month, index) => (
                            <option key={month} value={String(index)}>{month}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.6 }} />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2" style={{ color: '#000000' }}>Pilih Tahun</label>
                      <div className="relative">
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                          style={inputStyle}
                        >
                          {YEAR_OPTIONS.map((year) => (
                            <option key={year} value={String(year)}>{year}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.6 }} />
                      </div>
                    </div>
                  </div>
                )}

                {reportType === "yearly" && (
                  <div className="flex-1 max-w-xs">
                    <label className="block mb-2" style={{ color: '#000000' }}>Pilih Tahun</label>
                    <div className="relative">
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                        style={inputStyle}
                      >
                        {YEAR_OPTIONS.map((year) => (
                          <option key={year} value={String(year)}>{year}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.6 }} />
                    </div>
                  </div>
                )}

                {reportType === "custom" && (
                  <div className="flex-1 grid grid-cols-2 gap-4 max-w-lg">
                    <div>
                      <label className="block mb-2" style={{ color: '#000000' }}>Dari Tanggal</label>
                      <div className="relative">
                        <DatePicker
                          value={customDateFrom}
                          max={customDateTo || undefined}
                          onChange={(v) => { setCustomDateFrom(v); setError(""); }}
                          className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                          style={inputStyle}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.4 }} />
                      </div>
                    </div>

                    <div>
                      <label className="block mb-2" style={{ color: '#000000' }}>Sampai Tanggal</label>
                      <div className="relative">
                        <DatePicker
                          value={customDateTo}
                          min={customDateFrom || undefined}
                          onChange={(v) => { setCustomDateTo(v); setError(""); }}
                          className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                          style={inputStyle}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: INK, opacity: 0.4 }} />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => void handleGenerate()}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: GREEN }}
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  {loading ? "Memproses..." : "Buat Laporan"}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-sm" style={{ color: RED }}>⚠ {error}</p>
              )}

              {latest && (
                <div className="mt-6 p-4 rounded-lg border-2" style={{ borderColor: GREEN, backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p style={{ color: '#000000' }}>Laporan berhasil dibuat!</p>
                      <p className="text-sm mt-1" style={{ color: INK, opacity: 0.6 }}>
                        Periode: {periodeText(latest)}
                      </p>
                    </div>
                    <button
                      onClick={() => setLatest(null)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{ color: INK }}
                      title="Tutup preview"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewing(latest)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: GREEN }}
                    >
                      <Eye className="w-4 h-4" />
                      Lihat
                    </button>

                    <button
                      onClick={() => void handleExport(latest, latest.id)}
                      disabled={exportingId === latest.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-white disabled:opacity-60"
                      style={{ borderColor: GREEN, color: GREEN }}
                    >
                      <Download className="w-4 h-4" />
                      {exportingId === latest.id ? "Membuat PDF..." : "Unduh"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Riwayat Laporan */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 style={{ color: '#000000' }}>Riwayat Laporan</h2>
                <p className="text-sm mt-1" style={{ color: INK, opacity: 0.6 }}>
                  Daftar laporan yang pernah dibuat
                </p>
              </div>

              <div className="px-6 py-4 border-b border-gray-200">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: INK, opacity: 0.4 }} />
                  <input
                    type="text"
                    placeholder="Cari ID Laporan..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                    style={inputStyle}
                  />
                </div>
              </div>

              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <button
                        onClick={() => toggleSort("tanggalPembuatan")}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                        style={{ color: '#000000' }}
                      >
                        Tanggal Pembuatan
                        {sortIcon("tanggalPembuatan")}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button
                        onClick={() => toggleSort("periodeMulai")}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                        style={{ color: '#000000' }}
                      >
                        Periode Laporan
                        {sortIcon("periodeMulai")}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center" style={{ color: INK, opacity: 0.4 }}>
                        Belum ada riwayat laporan
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="border-b border-gray-200 transition-colors hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p style={{ color: GREEN }}>{row.id}</p>
                          <p className="text-sm" style={{ color: INK, opacity: 0.6 }}>
                            {fmtWib(row.tanggalPembuatan, "dd MMM yyyy, HH:mm")}
                          </p>
                        </td>
                        <td className="px-6 py-4" style={{ color: INK }}>
                          {periodeText(row)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewing(row.report)}
                              className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                              style={{ borderColor: GREEN, color: GREEN }}
                              title="Lihat Laporan"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => void handleExport(row.report, row.id)}
                              disabled={exportingId === row.id}
                              className="p-2 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-60"
                              style={{ borderColor: GREEN, color: GREEN }}
                              title="Unduh Laporan"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {filtered.length > 0 && (
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: INK, opacity: 0.7 }}>Tampilkan</span>
                    <div className="relative">
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                        style={inputStyle}
                      >
                        {[10, 25, 50, 100].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: INK, opacity: 0.6 }} />
                    </div>
                    <span style={{ color: INK, opacity: 0.7 }}>
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filtered.length)} dari {filtered.length} laporan
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      style={{ color: INK }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex gap-1">
                      {pageWindow(page, totalPages).map((num) => (
                        <button
                          key={num}
                          onClick={() => setCurrentPage(num)}
                          className="w-10 h-10 rounded-lg transition-colors"
                          style={{
                            backgroundColor: page === num ? GREEN : 'transparent',
                            color: page === num ? 'white' : INK,
                            border: page === num ? 'none' : '1px solid #e5e7eb'
                          }}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      style={{ color: INK }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewing && (
        <ViewReportModal report={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal lihat laporan (detail, mengikuti desain V3.1)
// ---------------------------------------------------------------------------

/** Tanggal periode laporan (ISO UTC dari API / YYYY-MM-DD) → Date lokal (WIB) untuk segmentasi. */
function parsePeriode(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // ISO UTC (…Z) dari API: geser ke komponen WIB dulu (2025-12-31T17:00Z = 1 Jan 00:00 WIB),
  // jangan dibaca sebagai tanggal-nya saja (bikin segmen geser 1 bulan).
  const d = toWibDate(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function weeksInRange(start: Date, end: Date) {
  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const s = weekStart < start ? start : weekStart;
    const e = weekEnd > end ? end : weekEnd;
    return {
      title: `Minggu ${index + 1} (${fmtWib(s, "dd MMM")} - ${fmtWib(e, "dd MMM")})`,
      start: s,
      end: e,
    };
  });
}

function monthsInRange(start: Date, end: Date) {
  return eachMonthOfInterval({ start, end }).map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    return {
      title: fmtWib(monthStart, "MMMM yyyy"),
      start: monthStart < start ? start : startOfMonth(monthStart),
      end: monthEnd > end ? end : monthEnd,
    };
  });
}

/** Potong rincian laporan ke rentang tanggal tertentu (per segmen). */
function sliceRincian(rincian: LaporanDTO["rincian"], start: Date, end: Date): LaporanDTO["rincian"] {
  const inRange = (t: string) => {
    const d = toWibDate(t);
    return !Number.isNaN(d.getTime()) && isWithinInterval(d, { start, end });
  };
  return {
    penjualan: rincian.penjualan.filter((r) => inRange(r.tanggal)),
    pembelian: rincian.pembelian.filter((r) => inRange(r.tanggal)),
    konsinyasi: rincian.konsinyasi.filter((r) => inRange(r.tanggal)),
    cashFlow: rincian.cashFlow.filter((r) => inRange(r.tanggal)),
  };
}

function ViewReportModal({ report, onClose }: { report: LaporanDTO; onClose: () => void }) {
  const { summary } = report;
  const start = parsePeriode(report.periodeMulai);
  const end = parsePeriode(report.periodeAkhir);

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-6xl mx-4 h-[90vh] flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 style={{ color: '#000000' }}>Laporan Keuangan</h2>
          <p style={{ color: GREEN }}>{report.id}</p>
          <p className="text-sm mt-1" style={{ color: INK, opacity: 0.6 }}>
            Periode: {periodeText(report)}
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: INK }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mb-6 p-6 rounded-lg border-2" style={{ borderColor: GREEN, backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
          <h3 className="mb-4" style={{ color: '#000000' }}>Ringkasan Total</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm mb-1" style={{ color: INK, opacity: 0.6 }}>Total Pendapatan</p>
              <p className="text-2xl" style={{ color: GREEN }}>{formatRp(summary.totalPemasukan)}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: INK, opacity: 0.6 }}>Total Pengeluaran</p>
              <p className="text-2xl" style={{ color: RED }}>{formatRp(summary.totalPengeluaran)}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: INK, opacity: 0.6 }}>Laba Bersih</p>
              <p className="text-2xl" style={{ color: summary.labaBersih >= 0 ? GREEN : RED }}>
                {formatRp(summary.labaBersih)}
              </p>
            </div>
          </div>
        </div>

        {report.tipe === "daily" ? (
          <RincianSections data={report.rincian} />
        ) : report.tipe === "monthly" ? (
          <div className="space-y-6">
            {weeksInRange(start, end).map((week, i) => (
              <div key={i} className="border-2 border-gray-200 rounded-lg p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.01)' }}>
                <h3 className="mb-4 pb-2 border-b-2" style={{ color: GREEN, borderColor: GREEN }}>{week.title}</h3>
                <RincianSections data={sliceRincian(report.rincian, week.start, week.end)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {monthsInRange(start, end).map((month, i) => (
              <div key={i} className="border-2 border-gray-300 rounded-lg p-5" style={{ backgroundColor: 'rgba(39, 180, 70, 0.03)' }}>
                <h2 className="mb-4 pb-3 border-b-2 text-xl" style={{ color: GREEN, borderColor: GREEN }}>{month.title}</h2>
                <div className="space-y-5">
                  {weeksInRange(month.start, month.end).map((week, j) => (
                    <div key={j} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h4 className="mb-3 pb-2 border-b" style={{ color: INK, borderColor: '#e5e7eb' }}>{week.title}</h4>
                      <RincianSections data={sliceRincian(report.rincian, week.start, week.end)} compact />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg border transition-colors"
          style={{ borderColor: RED, color: RED }}
        >
          Tutup
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Seksi data rincian (gaya DataSection desain V3.1)
// ---------------------------------------------------------------------------

interface SectionHead {
  label: string;
  align?: 'left' | 'right' | 'center';
}

/** Mode ringkas (segmen minggu dalam laporan tahunan/custom) ala `compact` desain V3.1. */
const CompactCtx = createContext(false);

function Section({ title, color, total, head, rows }: {
  title: string;
  color: string;
  total?: string;
  head: SectionHead[];
  rows: React.ReactNode[][];
}) {
  const compact = useContext(CompactCtx);
  return (
    <div className={compact ? "mb-3" : "mb-6"}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={compact ? "text-sm font-semibold" : ""} style={{ color: '#000000' }}>{title}</h4>
        {total != null && <p className={compact ? "text-sm" : ""} style={{ color }}>{total}</p>}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              {head.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2${compact ? ' text-xs' : ''}`}
                  style={{ color: '#000000', textAlign: h.align ?? 'left' }}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={head.length} className={`px-3 py-4 text-center${compact ? ' text-xs' : ''}`} style={{ color: INK, opacity: 0.4 }}>
                  Tidak ada data
                </td>
              </tr>
            ) : rows.map((cells, i) => (
              <tr key={i} className="border-t border-gray-200">{cells}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Td({ children, align = 'left', color = INK, bold = false }: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  color?: string;
  bold?: boolean;
}) {
  const compact = useContext(CompactCtx);
  return (
    <td className={`px-3 py-2${compact ? ' text-xs' : ''}${bold ? ' font-medium' : ''}`} style={{ color, textAlign: align }}>
      {children}
    </td>
  );
}

/** Badge hijau "Ya" untuk pembelian dengan biaya bahan repack. */
function RepackBadge({ value }: { value: number }) {
  if (value <= 0) return <>-</>;
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: GREEN }}>
      Ya
    </span>
  );
}

function RincianSections({ data, compact = false }: { data: LaporanDTO["rincian"]; compact?: boolean }) {
  const pos = data.penjualan.filter((r) => r.asal === "offline");
  const online = data.penjualan.filter((r) => r.asal === "commerce");
  const cashIn = data.cashFlow.filter((r) => r.tipe === "in");
  const cashOut = data.cashFlow.filter((r) => r.tipe === "out");
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  /** Format tanggal ala desain: ringkas "dd/MM HH:mm" (cash "dd/MM"), penuh "dd MMM yyyy, HH:mm". */
  const tgl = (value: string, withTime = true) =>
    withTime
      ? fmtWib(value, compact ? "dd/MM HH:mm" : "dd MMM yyyy, HH:mm")
      : fmtWib(value, compact ? "dd/MM" : "dd MMM yyyy");

  return (
    <CompactCtx.Provider value={compact}>
    <>
      <Section
        title="Transaksi POS"
        color={GREEN}
        total={formatRp(sum(pos.map((r) => r.total)))}
        head={[{ label: 'ID' }, { label: 'Tanggal' }, { label: 'Kasir' }, { label: 'Metode' }, { label: 'Total', align: 'right' }]}
        rows={pos.map((r) => [
          <Td key="id">{r.noPesanan}</Td>,
          <Td key="tgl">{tgl(r.tanggal)}</Td>,
          <Td key="kasir">{r.kasir || '-'}</Td>,
          <Td key="metode">{r.metodeBayar || '-'}</Td>,
          <Td key="total" align="right">{formatRp(r.total)}</Td>,
        ])}
      />

      <Section
        title="Transaksi Online"
        color={GREEN}
        total={formatRp(sum(online.map((r) => r.total)))}
        head={[{ label: 'ID' }, { label: 'Tanggal' }, { label: 'Pelanggan' }, { label: 'Asal' }, { label: 'Total', align: 'right' }]}
        rows={online.map((r) => [
          <Td key="id">{r.noPesanan}</Td>,
          <Td key="tgl">{tgl(r.tanggal)}</Td>,
          <Td key="pelanggan">{r.namaPelanggan || '-'}</Td>,
          <Td key="asal">{r.asal === "commerce" ? 'Commerce' : 'Offline'}</Td>,
          <Td key="total" align="right">{formatRp(r.total)}</Td>,
        ])}
      />

      <Section
        title="Pembelian Stok"
        color={RED}
        total={formatRp(sum(data.pembelian.map((r) => r.grandTotal)))}
        head={[
          { label: 'No. Pembelian' }, { label: 'Tanggal' }, { label: 'Supplier' },
          { label: 'Repack', align: 'center' }, { label: 'Total', align: 'right' }, { label: 'Laba', align: 'right' },
        ]}
        rows={data.pembelian.map((r) => [
          <Td key="no">{r.noPembelian}</Td>,
          <Td key="tgl">{tgl(r.tanggal)}</Td>,
          <Td key="supplier">{r.supplier || '-'}</Td>,
          <Td key="repack" align="center"><RepackBadge value={r.biayaRepack} /></Td>,
          <Td key="total" align="right" color={RED}>
            {formatRp(r.grandTotal)}
            {r.biayaRepack > 0 && (
              <span className="block text-xs" style={{ color: INK, opacity: 0.6 }}>
                (Repack: {formatRp(r.biayaRepack)})
              </span>
            )}
          </Td>,
          <Td key="laba" align="right" color={r.estimasiLaba >= 0 ? GREEN : RED}>{formatRp(r.estimasiLaba)}</Td>,
        ])}
      />

      <Section
        title="Konsinyasi"
        color={RED}
        total={formatRp(sum(data.konsinyasi.map((r) => r.totalDibayar)))}
        head={[
          { label: 'No. Konsinyasi' }, { label: 'Tanggal' }, { label: 'Vendor' },
          { label: 'Nilai Konsinyasi', align: 'right' }, { label: 'Yang Dibayar', align: 'right' },
          { label: 'Dikembalikan', align: 'right' },
        ]}
        rows={data.konsinyasi.map((r) => [
          <Td key="no">{r.noKonsinyasi}</Td>,
          <Td key="tgl">{tgl(r.tanggal)}</Td>,
          <Td key="vendor">{r.supplier || '-'}</Td>,
          <Td key="nilai" align="right">{formatRp(r.totalNilaiKonsinyasi)}</Td>,
          <Td key="bayar" align="right" color={RED}>{formatRp(r.totalDibayar)}</Td>,
          <Td key="kembali" align="right" color="#3b82f6">{formatRp(r.totalDikembalikan)}</Td>,
        ])}
      />

      <div className="grid grid-cols-2 gap-4">
        <Section
          title="Cash In"
          color={GREEN}
          total={formatRp(sum(cashIn.map((r) => r.jumlah)))}
          head={[{ label: 'Tanggal' }, { label: 'Keterangan' }, { label: 'Jumlah', align: 'right' }]}
          rows={cashIn.map((r) => [
            <Td key="tgl">{tgl(r.tanggal, false)}</Td>,
            <Td key="ket">{r.keterangan || '-'}</Td>,
            <Td key="jml" align="right" color={GREEN}>{formatRp(r.jumlah)}</Td>,
          ])}
        />

        <Section
          title="Cash Out"
          color={RED}
          total={formatRp(sum(cashOut.map((r) => r.jumlah)))}
          head={[{ label: 'Tanggal' }, { label: 'Keterangan' }, { label: 'Jumlah', align: 'right' }]}
          rows={cashOut.map((r) => [
            <Td key="tgl">{tgl(r.tanggal, false)}</Td>,
            <Td key="ket">{r.keterangan || '-'}</Td>,
            <Td key="jml" align="right" color={RED}>{formatRp(r.jumlah)}</Td>,
          ])}
        />
      </div>
    </>
    </CompactCtx.Provider>
  );
}
