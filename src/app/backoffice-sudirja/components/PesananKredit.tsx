"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, CreditCard, CheckCircle,
  Plus, Printer, Download
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { useUser } from "./useUser";
import { ApiClientError } from "@/lib/api-client";
import {
  listKredit,
  getKredit,
  addKreditPembayaran,
} from "@/lib/pesanan-api";
import type { KreditDTO, KreditPembayaranDTO } from "@/lib/pesanan-types";

// Badge helpers

function getPeriodBadge() {
  return { bg: "#fce7f3", text: "#9d174d" };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Selesai":             return { bg: "#dcfce7", text: "#166534" };
    case "Aktif":               return { bg: "#e0f2fe", text: "#0369a1" };
    case "Diproses":            return { bg: "#dbeafe", text: "#1e40af" };
    case "Menunggu Pembayaran": return { bg: "#fef9c3", text: "#854d0e" };
    case "Menunggu Konfirmasi": return { bg: "#ffedd5", text: "#9a3412" };
    default:                    return { bg: "#f3f4f6", text: "#374151" };
  }
}

type SortField = "no_pesanan" | "created_at" | "kasir_nama" | "total" | "totalDibayar";
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

// Main Page

export default function PesananKredit() {
  const user = useUser();

  // Data dari API
  const [orders, setOrders] = useState<KreditDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  // Tab
  const [activeTab, setActiveTab] = useState<"berjalan" | "lunas">("berjalan");

  // Filters
  const [searchId, setSearchId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<KreditDTO | null>(null);

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
      const result = await listKredit({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortDir === "desc" ? "desc" : "asc",
      });
      setOrders(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data kredit.");
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
      if (sortDir === "asc") { setSortDir("desc"); }
      else if (sortDir === "desc") { setSortField(null); setSortDir(null); }
      else setSortDir("asc");
    } else {
      setSortField(field); setSortDir("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-4 h-4" style={{ color: '#27b446' }} />
      : <ArrowDown className="w-4 h-4" style={{ color: '#27b446' }} />;
  };

  // Partition by paid status
  const berjalan = orders.filter(o => !o.isLunas);
  const lunas = orders.filter(o => o.isLunas);

  const sourceList = activeTab === "berjalan" ? berjalan : lunas;

  const currentPage = pagination.page;
  const itemsPerPage = pagination.pageSize;
  const totalPages = pagination.totalPages;
  const sorted = sourceList;
  const paginated = sorted;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const setCurrentPage = (updater: number | ((p: number) => number)) => {
    setPagination(prev => {
      const next = typeof updater === "function" ? updater(prev.page) : updater;
      return { ...prev, page: Math.max(1, next) };
    });
  };

  // Export seluruh data kredit (semua halaman) ke CSV.
  const handleExport = async () => {
    try {
      const all: KreditDTO[] = [];
      let page = 1;
      for (;;) {
        const res = await listKredit({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...res.items);
        if (page >= res.pagination.totalPages) break;
        page++;
      }
      const headers = ["No. Pesanan", "Tanggal", "Kasir", "Periode Kredit", "Total Kredit", "Sudah Dibayar", "Sisa", "Status"];
      const rows = all.map((o) => [
        o.noPesanan,
        fmtWib(o.createdAt, "dd MMM yyyy, HH:mm"),
        o.kasirNama,
        o.periodeKredit || "-",
        String(o.total),
        String(o.totalDibayar),
        o.isLunas ? "0" : String(o.sisa),
        o.isLunas ? "Lunas" : "Berjalan",
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `data-kredit-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data kredit.");
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pesanan-kredit" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6" style={{ color: '#27b446' }} />
              <div>
                <h1 style={{ color: '#000000' }}>Pesanan Kredit</h1>
                <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Kelola pembayaran angsuran pesanan kredit
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
              title="Export seluruh data kredit (CSV)"
            >
              <Download className="w-5 h-5" />
              Export Data
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 bg-white border-b border-gray-200">
          <div className="flex gap-1">
            {([
              { key: "berjalan" as const, label: "Berjalan", count: berjalan.length },
              { key: "lunas" as const, label: "Lunas", count: lunas.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                className="flex items-center gap-2 px-6 py-3 rounded-t-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
                  color: activeTab === tab.key ? '#27b446' : '#1a0408',
                  borderBottom: activeTab === tab.key ? '2px solid #27b446' : '2px solid transparent',
                  opacity: activeTab === tab.key ? 1 : 0.6,
                }}
              >
                {tab.label}
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: activeTab === tab.key ? 'rgba(39,180,70,0.1)' : '#f3f4f6',
                    color: activeTab === tab.key ? '#27b446' : '#6b7280',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="px-8 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari ID Pesanan..."
                value={searchId}
                onChange={e => { setSearchId(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
            </div>
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
            <div ref={dateFilterRef} className="mt-4 flex gap-4 p-4 rounded-lg border-2"
              style={{ borderColor: '#27b446', backgroundColor: 'rgba(39,180,70,0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Dari Tanggal</label>
                <DatePicker value={dateFrom} max={dateTo || undefined}
                  onChange={v => {
                    setDateFrom(v);
                    if (dateTo && v && v > dateTo) setDateTo("");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <DatePicker value={dateTo} min={dateFrom || undefined}
                  onChange={v => {
                    setDateTo(v);
                    if (dateFrom && v && v < dateFrom) setDateFrom("");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
            </div>
          )}

          <div className="mt-3">
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {paginated.length} dari {pagination.total} pesanan kredit
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
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data kredit...</p>
              </div>
            ) : (
            <>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <tr>
                  {([
                    { field: "no_pesanan" as SortField, label: "ID Pesanan", align: "left" },
                    { field: "created_at" as SortField, label: "Tanggal", align: "left" },
                    { field: "kasir_nama" as SortField, label: "Kasir", align: "left" },
                  ]).map(({ field, label, align }) => (
                    <th key={field} className={`px-6 py-4 text-${align}`}>
                      <button onClick={() => handleSort(field)}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                        style={{ color: '#000000' }}>
                        {label}{getSortIcon(field)}
                      </button>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Periode Kredit</th>
                  <th className="px-6 py-4 text-right">
                    <button onClick={() => handleSort("total")}
                      className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}>
                      Total Kredit{getSortIcon("total")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button onClick={() => handleSort("totalDibayar")}
                      className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}>
                      Sudah Dibayar{getSortIcon("totalDibayar")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <CreditCard className="w-10 h-10 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.2 }} />
                      <p style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada pesanan yang sesuai filter" : `Tidak ada pesanan kredit ${activeTab}`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map(order => {
                    const sisa = order.sisa;
                    const period = order.periodeKredit || order.metodeBayar.replace(/^Kredit\s*.\s*/, "");
                    return (
                      <tr
                        key={order.noPesanan}
                        onClick={() => setSelectedOrder(order)}
                        className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4" style={{ color: '#27b446' }}>{order.noPesanan}</td>
                        <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                          {fmtWib(order.createdAt, "dd MMM yyyy")}
                        </td>
                        <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                          <div>{order.kasirNama}</div>
                          <div className="text-xs" style={{ opacity: 0.5 }}>{order.kasirUsername}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 rounded-full text-sm whitespace-nowrap"
                            style={{ backgroundColor: getPeriodBadge().bg, color: getPeriodBadge().text }}>
                            {period}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium" style={{ color: '#000000' }}>
                          Rp {order.total.toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 text-right" style={{ color: '#27b446' }}>
                          Rp {order.totalDibayar.toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 text-right" style={{ color: sisa > 0 ? '#e40b18' : '#27b446' }}>
                          {sisa === 0 ? "Lunas" : `Rp ${sisa.toLocaleString('id-ID')}`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {sorted.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                  <select value={itemsPerPage}
                    onChange={e => { setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 })); }}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:outline-none"
                    style={{ color: '#1a0408' }}>
                    {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>per halaman</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}>
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = totalPages <= 5 ? i + 1
                        : currentPage <= 3 ? i + 1
                        : currentPage >= totalPages - 2 ? totalPages - 4 + i
                        : currentPage - 2 + i;
                      return (
                        <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                          className="w-10 h-10 rounded-lg transition-colors"
                          style={{
                            backgroundColor: currentPage === pageNum ? '#27b446' : 'transparent',
                            color: currentPage === pageNum ? 'white' : '#1a0408',
                            border: currentPage === pageNum ? 'none' : '1px solid #e5e7eb',
                          }}>
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}>
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

      {/* Credit Detail Modal */}
      {selectedOrder && (
        <CreditDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          currentUser={user?.fullName || user?.username || "Admin"}
          onPaymentRecorded={async () => {
            // Refresh grid + perbarui data modal (riwayat pembayaran) dari server.
            await load();
            try {
              const fresh = await getKredit(selectedOrder.noPesanan);
              if (fresh) setSelectedOrder(fresh);
            } catch { /* list sudah refresh; abaikan bila detail gagal */ }
          }}
        />
      )}
    </div>
  );
}

// Credit Detail Modal

interface CreditDetailModalProps {
  order: KreditDTO;
  onClose: () => void;
  onAddPayment?: (amount: number, catatan?: string) => void;
  currentUser: string;
  onPaymentRecorded: () => void;
}

function CreditDetailModal({ order, onClose, currentUser, onPaymentRecorded }: CreditDetailModalProps) {
  const [inputAmount, setInputAmount] = useState("");
  const [catatan, setCatatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const paid = order.totalDibayar;
  const sisa = order.sisa;
  const isLunas = order.isLunas;
  const pct = Math.min(100, Math.round((paid / order.total) * 100));
  const period = order.periodeKredit || order.metodeBayar.replace(/^Kredit\s*.\s*/, "");

  const numInput = parseFloat(inputAmount.replace(/\D/g, "")) || 0;
  const canSubmit = numInput > 0 && numInput <= sisa && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await addKreditPembayaran(order.noPesanan, { jumlah: numInput, catatan: catatan || null });
      setInputAmount("");
      setCatatan("");
      onPaymentRecorded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal mencatat pembayaran.");
    } finally {
      setSubmitting(false);
    }
  };

  // Running cumulative for history table
  let cumulative = 0;

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex relative max-w-[900px] max-h-[90vh]">

        {/* Close button — fixed to top-right of popup */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
          style={{ color: '#1a0408' }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Order Detail */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 style={{ color: '#000000' }}>Detail Pesanan</h2>
            <p className="text-sm mt-0.5" style={{ color: '#27b446' }}>{order.noPesanan}</p>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Tanggal", value: fmtWib(order.createdAt, "dd MMMM yyyy, HH:mm") },
                { label: "Kasir", value: `${order.kasirNama} (${order.kasirUsername})` },
                { label: "Periode Kredit", value: period },
                { label: "Status", value: order.status },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                  <p className="text-xs mb-1" style={{ color: '#1a0408', opacity: 0.5 }}>{label}</p>
                  <p style={{ color: '#000000', fontWeight: 500 }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Items */}
            <div>
              <p className="mb-2 text-sm font-medium" style={{ color: '#000000' }}>Produk</p>
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
                    {order.items.map((item, i) => (
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
                        Total Kredit
                      </td>
                      <td className="px-3 py-2 text-right font-bold" style={{ color: '#27b446' }}>
                        Rp {order.total.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-lg border-2 transition-colors"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Tutup
            </button>
            <button
              onClick={() => alert(`Mencetak invoice untuk ${order.noPesanan}`)}
              className="flex-1 py-3 rounded-lg text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}>
              <Printer className="w-4 h-4" />
              Cetak Invoice
            </button>
          </div>
        </div>

        {/* Right: Credit Payment Panel */}
        <div className="flex flex-col overflow-hidden" style={{ width: '360px', minWidth: '360px' }}>
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" style={{ color: '#27b446' }} />
              <h3 style={{ color: '#000000' }}>Pembayaran Kredit</h3>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 gap-2">
              <div className="flex justify-between items-center px-4 py-3 rounded-lg"
                style={{ backgroundColor: '#f9fafb' }}>
                <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Total Kredit</span>
                <span className="font-semibold" style={{ color: '#000000' }}>
                  Rp {order.total.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 rounded-lg"
                style={{ backgroundColor: 'rgba(39,180,70,0.07)' }}>
                <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Sudah Dibayar</span>
                <span className="font-semibold" style={{ color: '#27b446' }}>
                  Rp {paid.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: isLunas ? 'rgba(39,180,70,0.07)' : '#fee2e2',
                }}>
                <span className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Sisa Kredit</span>
                <span className="font-bold" style={{ color: isLunas ? '#27b446' : '#991b1b', fontSize: '16px' }}>
                  {isLunas ? "Lunas" : `Rp ${sisa.toLocaleString('id-ID')}`}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                <span>Progress Pembayaran</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: '#e5e7eb' }}>
                <div
                  className="h-2.5 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: isLunas ? '#27b446' : '#27b446' }}
                />
              </div>
            </div>

            {/* Input angsuran */}
            {!isLunas && (
              <div className="p-4 rounded-xl border-2 space-y-3" style={{ borderColor: '#27b446' }}>
                <p className="text-sm font-medium" style={{ color: '#000000' }}>Catat Angsuran</p>
                <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Maks: Rp {sisa.toLocaleString('id-ID')}
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: '#1a0408', opacity: 0.5 }}>Rp</span>
                    <input
                      type="number"
                      min={1}
                      max={sisa}
                      value={inputAmount}
                      onChange={e => {
                        const val = Math.min(sisa, Math.max(0, parseFloat(e.target.value) || 0));
                        setInputAmount(val === 0 && e.target.value === "" ? "" : String(val));
                      }}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border focus:outline-none focus:ring-2 text-sm"
                      style={{ color: '#1a0408', borderColor: '#d1d5db', '--tw-ring-color': '#27b446' } as any}
                    />
                  </div>
                  <button
                    onClick={() => setInputAmount(String(sisa))}
                    className="px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    style={{ backgroundColor: 'rgba(39,180,70,0.1)', color: '#27b446', border: '1px solid #27b446' }}>
                    Max
                  </button>
                </div>
                <input
                  type="text"
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  placeholder="Catatan (opsional)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
                {error && (
                  <p className="text-xs" style={{ color: '#e40b18' }}>⚠ {error}</p>
                )}
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-30"
                  style={{ backgroundColor: '#27b446' }}>
                  <Plus className="w-4 h-4" />
                  {submitting ? "Menyimpan..." : "Catat Pembayaran"}
                </button>
              </div>
            )}

            {isLunas && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(39,180,70,0.07)', border: '2px solid #27b446' }}>
                <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#27b446' }} />
                <p className="text-sm font-medium" style={{ color: '#27b446' }}>
                  Kredit telah dilunasi sepenuhnya.
                </p>
              </div>
            )}

            {/* Payment history */}
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: '#000000' }}>
                Riwayat Pembayaran ({order.pembayaran.length} transaksi)
              </p>
              {order.pembayaran.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: '#1a0408', opacity: 0.4 }}>
                  Belum ada pembayaran
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs" style={{ color: '#000000' }}>Tanggal</th>
                        <th className="px-3 py-2 text-left text-xs" style={{ color: '#000000' }}>Dicatat oleh</th>
                        <th className="px-3 py-2 text-right text-xs" style={{ color: '#000000' }}>Jumlah</th>
                        <th className="px-3 py-2 text-right text-xs" style={{ color: '#000000' }}>Kumulatif</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.pembayaran.map((p: KreditPembayaranDTO, i) => {
                        cumulative += p.jumlah;
                        return (
                          <tr key={p.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-xs" style={{ color: '#1a0408' }}>
                              {fmtWib(p.createdAt, "dd MMM yy, HH:mm")}
                            </td>
                            <td className="px-3 py-2 text-xs" style={{ color: '#1a0408', opacity: 0.7 }}>
                              {p.dicatatOleh || "-"}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium" style={{ color: '#27b446' }}>
                              Rp {p.jumlah.toLocaleString('id-ID')}
                            </td>
                            <td className="px-3 py-2 text-right text-xs" style={{ color: '#1a0408', opacity: 0.7 }}>
                              Rp {cumulative.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
    </Modal>
  );
}
