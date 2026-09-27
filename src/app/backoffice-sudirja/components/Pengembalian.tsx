"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, RotateCcw, Download
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { ApiClientError } from "@/lib/api-client";
import { listRetur } from "@/lib/pesanan-api";
import type { ReturDTO } from "@/lib/pesanan-types";

type SortField = "no_retur" | "created_at" | "no_pesanan" | "total_refund";
type SortDir = "asc" | "desc" | null;

// Tutup panel/popover saat klik di luar (di luar panel & pemicunya).
// Kalender DatePicker di-portal ke <body> dan menghentikan propagasi
// mousedown-nya sendiri, jadi interaksi dengannya tidak ikut menutup panel.
function useOutsideClickClose(
  ref: { current: HTMLElement | null },
  onOutside: () => void,
  extraRef?: { current: HTMLElement | null },
) {
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t && typeof t.closest === "function" && t.closest('body > [style*="z-index: 99999"]')) return;
      if (t && (ref.current?.contains(t) || extraRef?.current?.contains(t))) return;
      onOutside();
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [ref, extraRef, onOutside]);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Selesai": return { bg: "#dcfce7", text: "#166534" };
    case "Diproses": return { bg: "#dbeafe", text: "#1e40af" };
    case "Ditolak":  return { bg: "#fee2e2", text: "#991b1b" };
    default:         return { bg: "#f3f4f6", text: "#374151" };
  }
}

function getTypeBadge(type: string) {
  return type === "semua" || type === "Semua Produk"
    ? { bg: "#f3e8ff", text: "#6b21a8" }
    : { bg: "#fce7f3", text: "#9d174d" };
}

function typeLabel(type: string): string {
  return type === "semua" ? "Semua Produk" : type === "sebagian" ? "Sebagian Produk" : type;
}

export default function Pengembalian() {
  const [returns, setReturns] = useState<ReturDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<ReturDTO | null>(null);

  // Filters
  const [searchId, setSearchId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchId);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchId]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await listRetur({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortDir === "desc" ? "desc" : "asc",
      });
      setReturns(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data pengembalian.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo, sortField, sortDir, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilters = searchId || dateFrom || dateTo;
  const clearFilters = () => { setSearchId(""); setDateFrom(""); setDateTo(""); setPagination(prev => ({ ...prev, page: 1 })); };

  // Panel filter tanggal: tertutup saat klik di luar.
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateFilterToggleRef = useRef<HTMLButtonElement>(null);
  useOutsideClickClose(dateFilterRef, () => setShowDateFilter(false), dateFilterToggleRef);

  const handleSort = (field: SortField) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : d === "desc" ? null : "asc");
      if (sortDir === "desc") setSortField(null);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-4 h-4" style={{ color: '#27b446' }} />
      : <ArrowDown className="w-4 h-4" style={{ color: '#27b446' }} />;
  };

  const currentPage = pagination.page;
  const itemsPerPage = pagination.pageSize;
  const totalPages = pagination.totalPages;
  const sorted = returns;
  const paginated = returns;

  const setCurrentPage = (updater: number | ((p: number) => number)) => {
    setPagination(prev => {
      const next = typeof updater === "function" ? updater(prev.page) : updater;
      return { ...prev, page: Math.max(1, next) };
    });
  };

  // Export seluruh data retur (semua halaman) ke CSV.
  const handleExport = async () => {
    try {
      const all: ReturDTO[] = [];
      let page = 1;
      for (;;) {
        const res = await listRetur({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...res.items);
        if (page >= res.pagination.totalPages) break;
        page++;
      }
      const headers = ["No. Retur", "Tanggal", "No. Pesanan Asal", "Kasir", "Jenis Retur", "Alasan", "Catatan", "Total Refund", "Status"];
      const rows = all.map((r) => [
        r.noRetur,
        fmtWib(r.createdAt, "dd MMM yyyy, HH:mm"),
        r.noPesanan,
        r.kasirNama,
        typeLabel(r.tipe),
        r.alasan,
        r.catatan || "",
        String(r.totalRefund),
        r.status,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `data-pengembalian-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data pengembalian.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pengembalian" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-6 h-6" style={{ color: '#27b446' }} />
              <div>
                <h1 style={{ color: '#000000' }}>Pengembalian</h1>
                <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Daftar retur pesanan yang telah diproses
                </p>
              </div>
            </div>
            <button
              onClick={() => void handleExport()}
              className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
              style={{
                borderColor: '#27b446',
                color: '#27b446',
                backgroundColor: 'rgba(39, 180, 70, 0.05)'
              }}
              title="Export seluruh data pengembalian (CSV)"
            >
              <Download className="w-5 h-5" />
              Export Data
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[260px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari No. Retur atau No. Pesanan..."
                  value={searchId}
                  onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
            </div>

            {/* Date filter toggle */}
            <button
              ref={dateFilterToggleRef}
              onClick={() => setShowDateFilter(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors"
              style={{
                backgroundColor: showDateFilter ? '#27b446' : 'white',
                borderColor: '#27b446',
                color: showDateFilter ? 'white' : '#27b446',
              }}
            >
              <Calendar className="w-5 h-5" />
              Filter Tanggal
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}
              >
                <X className="w-4 h-4" />
                Hapus Filter
              </button>
            )}
          </div>

          {showDateFilter && (
            <div ref={dateFilterRef} className="mt-4 flex items-center gap-4 p-4 rounded-lg border-2"
              style={{ borderColor: '#27b446', backgroundColor: 'rgba(39,180,70,0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Dari Tanggal</label>
                <DatePicker
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={v => { setDateFrom(v); if (dateTo && v && v > dateTo) setDateTo(""); setCurrentPage(1); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <DatePicker
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={v => { setDateTo(v); if (dateFrom && v && v < dateFrom) setDateFrom(""); setCurrentPage(1); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
            </div>
          )}

          <div className="mt-3">
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {paginated.length} dari {pagination.total} data retur
              {hasActiveFilters && ` (difilter dari ${pagination.total} total)`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {listError && (
              <div className="px-6 py-3" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {listError}</p>
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pengembalian...</p>
              </div>
            ) : (
            <>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <tr>
                  {([
                    { field: "no_retur" as SortField, label: "No. Retur", align: "left" },
                    { field: "created_at" as SortField, label: "Tanggal Retur", align: "left" },
                    { field: "no_pesanan" as SortField, label: "No. Pesanan Asal", align: "left" },
                  ]).map(({ field, label, align }) => (
                    <th key={field} className={`px-6 py-4 text-${align}`}>
                      <button
                        onClick={() => handleSort(field)}
                        className={`flex items-center gap-2 hover:opacity-70 transition-opacity ${align === 'right' ? 'ml-auto' : ''}`}
                        style={{ color: '#000000' }}
                      >
                        {label}
                        {getSortIcon(field)}
                      </button>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kasir</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Jenis Retur</th>
                  <th className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSort("total_refund")}
                      className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Total Refund
                      {getSortIcon("total_refund")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <RotateCcw className="w-10 h-10 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.2 }} />
                      <p style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada retur yang sesuai dengan filter" : "Belum ada data pengembalian"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map(r => (
                    <tr
                      key={r.noRetur}
                      onClick={() => setSelectedReturn(r)}
                      className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4" style={{ color: '#27b446' }}>{r.noRetur}</td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        {fmtWib(r.createdAt, "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#27b446' }}>{r.noPesanan}</td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        <div>{r.kasirNama || "-"}</div>
                        <div className="text-xs" style={{ opacity: 0.5 }}>{r.kasirUsername || ""}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-sm whitespace-nowrap"
                          style={{ backgroundColor: getTypeBadge(r.tipe).bg, color: getTypeBadge(r.tipe).text }}>
                          {typeLabel(r.tipe)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium" style={{ color: '#27b446' }}>
                        Rp {r.totalRefund.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-sm whitespace-nowrap"
                          style={{ backgroundColor: getStatusBadge(r.status).bg, color: getStatusBadge(r.status).text }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {sorted.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 })); }}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none text-sm"
                    style={{ color: '#1a0408' }}
                  >
                    {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>per halaman</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = totalPages <= 5 ? i + 1
                        : currentPage <= 3 ? i + 1
                        : currentPage >= totalPages - 2 ? totalPages - 4 + i
                        : currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10 h-10 rounded-lg transition-colors"
                          style={{
                            backgroundColor: currentPage === pageNum ? '#27b446' : 'transparent',
                            color: currentPage === pageNum ? 'white' : '#1a0408',
                            border: currentPage === pageNum ? 'none' : '1px solid #e5e7eb',
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReturn && (
        <ReturnDetailModal
          data={selectedReturn}
          onClose={() => setSelectedReturn(null)}
        />
      )}
    </div>
  );
}

// Return Detail Modal

function ReturnDetailModal({ data, onClose }: { data: ReturDTO; onClose: () => void }) {
  const { bg: statusBg, text: statusText } = getStatusBadge(data.status);
  const { bg: typeBg, text: typeText } = getTypeBadge(data.tipe);

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col max-w-[640px] max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" style={{ color: '#27b446' }} />
              <h2 style={{ color: '#000000' }}>Detail Pengembalian</h2>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#27b446' }}>{data.noRetur}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" style={{ color: '#1a0408' }} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "No. Pesanan Asal", value: data.noPesanan },
              { label: "Tanggal Retur", value: fmtWib(data.createdAt, "dd MMMM yyyy, HH:mm") },
              { label: "Kasir", value: data.kasirNama || "-" },
              { label: "Jenis Retur", value: typeLabel(data.tipe) },
              { label: "Alasan", value: data.alasan },
              { label: "Status", value: data.status },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                <p className="text-xs mb-1" style={{ color: '#1a0408', opacity: 0.5 }}>{label}</p>
                <p style={{ color: '#000000', fontWeight: 500 }}>{value}</p>
              </div>
            ))}
          </div>

          {data.catatan && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
              <p className="text-xs mb-1" style={{ color: '#1a0408', opacity: 0.5 }}>Catatan</p>
              <p className="text-sm" style={{ color: '#1a0408' }}>{data.catatan}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="mb-2 text-sm font-medium" style={{ color: '#000000' }}>Produk Diretur</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th className="px-3 py-2 text-left text-sm" style={{ color: '#000000' }}>Produk</th>
                    <th className="px-3 py-2 text-center text-sm" style={{ color: '#000000' }}>Qty</th>
                    <th className="px-3 py-2 text-right text-sm" style={{ color: '#000000' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-sm" style={{ color: '#1a0408' }}>{item.namaProduk}</td>
                      <td className="px-3 py-2 text-center text-sm" style={{ color: '#1a0408' }}>{item.qty}</td>
                      <td className="px-3 py-2 text-right text-sm" style={{ color: '#1a0408' }}>
                        Rp {item.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-right" style={{ color: '#000000' }}>
                      Total Refund
                    </td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: '#27b446' }}>
                      Rp {data.totalRefund.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: typeBg, color: typeText }}>
              {typeLabel(data.tipe)}
            </span>
            <span className="px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: statusBg, color: statusText }}>
              {data.status}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Tutup
          </button>
        </div>
    </Modal>
  );
}
