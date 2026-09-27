"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { ApiClientError } from "@/lib/api-client";
import {
  listPesanan,
  createPesanan,
  createRetur,
  searchPesananProduk,
} from "@/lib/pesanan-api";
import { validatePromoVoucher } from "@/lib/promo-api";
import { listPelanggan } from "@/lib/pelanggan-api";
import type { PelangganDTO } from "@/lib/pelanggan-types";
import type { PesananDTO, PesananProdukOption } from "@/lib/pesanan-types";
import {
  Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2,
  RotateCcw, AlertTriangle, CheckCircle2, Printer, Download
} from "lucide-react";
import { fmtWib } from "@/lib/date-utils";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import ReceiptModal from "./ReceiptModal";

function getPaymentBadge(method: string) {
  if (method === "Tunai") return { bg: "#fef3c7", text: "#92400e" };
  if (method === "QRIS") return { bg: "#dbeafe", text: "#1e40af" };
  if (method === "Bank Transfer") return { bg: "#f3e8ff", text: "#6b21a8" };
  if (method.startsWith("Kredit")) return { bg: "#fce7f3", text: "#9d174d" };
  return { bg: "#f3f4f6", text: "#374151" };
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Selesai":           return { bg: "#dcfce7", text: "#166534" };
    case "Diproses":          return { bg: "#dbeafe", text: "#1e40af" };
    case "Aktif":             return { bg: "#e0f2fe", text: "#0369a1" };
    case "Menunggu Pembayaran": return { bg: "#fef9c3", text: "#854d0e" };
    case "Menunggu Konfirmasi": return { bg: "#ffedd5", text: "#9a3412" };
    case "Dibatalkan":        return { bg: "#fee2e2", text: "#991b1b" };
    case "Dikembalikan":      return { bg: "#fde8d8", text: "#7c2d12" };
    default:                  return { bg: "#f3f4f6", text: "#374151" };
  }
}

type SortField = "no_pesanan" | "created_at" | "kasir_nama" | "total" | "metode_bayar";
type SortDirection = "asc" | "desc" | null;

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

export default function Pesanan() {

  // State untuk data (dari API)
  const [orders, setOrders] = useState<PesananDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  // State untuk filter
  const [searchId, setSearchId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // State untuk sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // State untuk detail pesanan
  const [selectedOrder, setSelectedOrder] = useState<PesananDTO | null>(null);
  const [returOrder, setReturOrder] = useState<PesananDTO | null>(null);

  // State untuk buat pesanan manual
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchId);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchId]);

  // Load data dari API (server-side search/filter/sort/pagination).
  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await listPesanan({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection === "desc" ? "desc" : "asc",
      });
      setOrders(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data pesanan.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, dateFrom, dateTo, sortField, sortDirection, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    if (sortDirection === "asc") return <ArrowUp className="w-4 h-4" />;
    return <ArrowDown className="w-4 h-4" />;
  };

  const clearFilters = () => {
    setSearchId("");
    setDateFrom("");
    setDateTo("");
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchId || dateFrom || dateTo;

  // Panel filter tanggal: tertutup saat klik di luar.
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const dateFilterToggleRef = useRef<HTMLButtonElement>(null);
  useOutsideClickClose(dateFilterRef, () => setShowDateFilter(false), dateFilterToggleRef);

  const totalPages = pagination.totalPages;
  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const sortedOrders = orders;
  const paginatedOrders = orders;
  const currentPage = pagination.page;
  const itemsPerPage = pagination.pageSize;
  const setCurrentPage = (updater: number | ((p: number) => number)) => {
    setPagination(prev => {
      const next = typeof updater === "function" ? updater(prev.page) : updater;
      return { ...prev, page: Math.max(1, next) };
    });
  };

  // Export seluruh data pesanan (semua halaman) ke CSV.
  const handleExportPesanan = async () => {
    try {
      const all: PesananDTO[] = [];
      let page = 1;
      for (;;) {
        const res = await listPesanan({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...res.items);
        if (page >= res.pagination.totalPages) break;
        page++;
      }
      const headers = ["No. Pesanan", "Tanggal", "Kasir", "Metode Bayar", "Status", "Subtotal", "Diskon", "Total", "Uang Diterima", "Kembalian"];
      const rows = all.map((o) => [
        o.noPesanan,
        fmtWib(o.createdAt, "dd MMM yyyy, HH:mm"),
        o.kasirNama,
        o.metodeBayar,
        o.status,
        String(o.subtotal),
        String(o.diskonAmount),
        String(o.total),
        String(o.uangDiterima),
        String(o.kembalian),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `data-pesanan-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data pesanan.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="daftar-pesanan" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pesanan</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola dan lihat seluruh riwayat pesanan
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void handleExportPesanan()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{
                  borderColor: '#27b446',
                  color: '#27b446',
                  backgroundColor: 'rgba(39, 180, 70, 0.05)'
                }}
                title="Export seluruh data pesanan (CSV)"
              >
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <button
                onClick={() => setShowCreateOrderModal(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#27b446' }}
              >
                <Plus className="w-5 h-5" />
                Buat Pesanan Manual
              </button>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search by ID */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari ID Pesanan..."
                  value={searchId}
                  onChange={(e) => {
                    setSearchId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ 
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>
            </div>

            {/* Date Filter Toggle */}
            <button
              ref={dateFilterToggleRef}
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors ${
                showDateFilter ? 'text-white' : ''
              }`}
              style={{ 
                backgroundColor: showDateFilter ? '#27b446' : 'white',
                borderColor: '#27b446',
                color: showDateFilter ? 'white' : '#27b446'
              }}
            >
              <Calendar className="w-5 h-5" />
              Filter Tanggal
            </button>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ 
                  borderColor: '#e40b18',
                  color: '#e40b18'
                }}
              >
                <X className="w-4 h-4" />
                Hapus Filter
              </button>
            )}
          </div>

          {/* Date Range Filter */}
          {showDateFilter && (
            <div ref={dateFilterRef} className="mt-4 flex items-center gap-4 p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                  Dari Tanggal
                </label>
                <DatePicker
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(v) => {
                    setDateFrom(v);
                    if (dateTo && v && v > dateTo) setDateTo("");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                  Sampai Tanggal
                </label>
                <DatePicker
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(v) => {
                    setDateTo(v);
                    if (dateFrom && v && v < dateFrom) setDateFrom("");
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>
            </div>
          )}

          {/* Results count */}
          <div className="mt-4">
            <p style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {paginatedOrders.length} dari {pagination.total} pesanan
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
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pesanan...</p>
              </div>
            ) : (
            <>
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("no_pesanan")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      ID Pesanan
                      {getSortIcon("no_pesanan")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("created_at")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Tanggal & Waktu
                      {getSortIcon("created_at")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("kasir_nama")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Kasir
                      {getSortIcon("kasir_nama")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSort("total")}
                      className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Total
                      {getSortIcon("total")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("metode_bayar")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Metode Pembayaran
                      {getSortIcon("metode_bayar")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada pesanan yang sesuai dengan filter" : "Belum ada data pesanan"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr
                      key={order.noPesanan}
                      onClick={() => setSelectedOrder(order)}
                      className="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4" style={{ color: '#27b446' }}>
                        {order.noPesanan}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        {fmtWib(order.createdAt, "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        <div>
                          <div>{order.kasirNama}</div>
                          <div style={{ opacity: 0.6, fontSize: '0.875rem' }}>{order.kasirUsername}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right" style={{ color: '#000000' }}>
                        Rp {order.total.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        <span className="px-3 py-1 rounded-full text-sm whitespace-nowrap" style={{
                          backgroundColor: getPaymentBadge(order.metodeBayar).bg,
                          color: getPaymentBadge(order.metodeBayar).text
                        }}>
                          {order.metodeBayar}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 rounded-full text-sm whitespace-nowrap" style={{
                          backgroundColor: getStatusBadge(order.status).bg,
                          color: getStatusBadge(order.status).text
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {sortedOrders.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                  <div className="relative">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), page: 1 }));
                      }}
                      className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                      style={{
                        color: '#1a0408',
                        '--tw-ring-color': '#27b446'
                      } as any}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <ChevronDown
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: '#1a0408', opacity: 0.6 }}
                    />
                  </div>
                  <span style={{ color: '#1a0408', opacity: 0.7 }}>
                    Menampilkan {startIndex + 1} - {Math.min(currentPage * itemsPerPage, pagination.total)} dari {pagination.total} pesanan
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-10 h-10 rounded-lg transition-colors"
                          style={{
                            backgroundColor: currentPage === pageNum ? '#27b446' : 'transparent',
                            color: currentPage === pageNum ? 'white' : '#1a0408',
                            border: currentPage === pageNum ? 'none' : '1px solid #e5e7eb'
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
                    className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
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

      {/* Detail Pesanan Modal */}
      {selectedOrder && !returOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRetur={() => setReturOrder(selectedOrder)}
        />
      )}

      {/* Retur Modal */}
      {returOrder && (
        <ReturnModal
          order={returOrder}
          onClose={() => { setReturOrder(null); setSelectedOrder(null); }}
          onSubmit={() => {
            setReturOrder(null);
            setSelectedOrder(null);
            void load();
          }}
        />
      )}

      {/* Buat Pesanan Manual Modal */}
      {showCreateOrderModal && (
        <CreateOrderModal
          onClose={() => setShowCreateOrderModal(false)}
          onCreated={() => void load()}
        />
      )}
    </div>
  );
}

interface OrderDetailModalProps {
  order: PesananDTO;
  onClose: () => void;
  onRetur: () => void;
}

function OrderDetailModal({ order, onClose, onRetur }: OrderDetailModalProps) {
  // Total & diskon dihitung server & tersimpan di DTO.
  const subtotalAmount = order.subtotal;
  const discountAmount = order.diskonAmount;
  const grandTotal = order.total;

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Pesanan</h2>
            <p style={{ color: '#27b446' }}>{order.noPesanan}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#1a0408' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)] px-6 py-4">
          {/* Info Umum */}
          <div className="mb-6 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Tanggal & Waktu</p>
                <p style={{ color: '#000000' }}>
                  {fmtWib(order.createdAt, "dd MMMM yyyy, HH:mm")}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Kasir</p>
                <p style={{ color: '#000000' }}>{order.kasirNama}</p>
                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{order.kasirUsername}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Metode Pembayaran</p>
                <p style={{ color: '#000000' }}>{order.metodeBayar}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Status</p>
                <span className="px-3 py-1 rounded-full text-sm inline-block" style={{
                  backgroundColor: getStatusBadge(order.status).bg,
                  color: getStatusBadge(order.status).text
                }}>
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="mb-3" style={{ color: '#000000' }}>Produk</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Nama Produk</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3" style={{ color: '#1a0408' }}>{item.namaProduk}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qty}</td>
                      <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                        Rp {item.harga.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#000000' }}>
                        Rp {item.subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ringkasan Pembayaran */}
          <div className="mb-6">
            <h3 className="mb-3" style={{ color: '#000000' }}>Ringkasan Pembayaran</h3>
            <div className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
              <div className="space-y-3">
                {/* Total */}
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <div>
                    <p style={{ color: '#1a0408' }}>Total</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Jumlah dari semua subtotal
                    </p>
                  </div>
                  <p style={{ color: '#000000' }}>
                    Rp {subtotalAmount.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Voucher/Diskon */}
                {order.voucher && discountAmount > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <div>
                      <p style={{ color: '#1a0408' }}>Diskon</p>
                      <p className="text-sm" style={{ color: '#27b446' }}>
                        Voucher: {order.voucher}
                      </p>
                    </div>
                    <p style={{ color: '#e40b18' }}>
                      - Rp {discountAmount.toLocaleString('id-ID')}
                    </p>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <p style={{ color: '#000000' }}>Grand Total</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Total yang dibayarkan
                    </p>
                  </div>
                  <p className="text-2xl" style={{ color: '#27b446' }}>
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Pembayaran untuk Tunai */}
          {order.metodeBayar === 'Tunai' && (
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <h3 className="mb-3" style={{ color: '#000000' }}>Detail Pembayaran Tunai</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span style={{ color: '#1a0408' }}>Uang Diterima</span>
                  <span style={{ color: '#1a0408' }}>
                    Rp {order.uangDiterima.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span style={{ color: '#1a0408' }}>Kembalian</span>
                  <span style={{ color: '#27b446' }}>
                    Rp {order.kembalian.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
          {/* Retur — left-anchored secondary action */}
          {order.status !== "Dibatalkan" && order.status !== "Dikembalikan" && (
            <button
              onClick={onRetur}
              className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-colors hover:bg-green-50"
              style={{ borderColor: '#27b446', color: '#27b446' }}
            >
              <RotateCcw className="w-4 h-4" />
              Retur Pesanan
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Tutup
          </button>
          <button
            onClick={() => alert(`Mencetak invoice untuk ${order.noPesanan}`)}
            className="px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center gap-2"
            style={{ backgroundColor: '#27b446' }}
          >
            <Printer className="w-4 h-4" />
            Cetak Invoice
          </button>
        </div>
    </Modal>
  );
}

// ─── Return Modal ────────────────────────────────────────────────────────────

const RETURN_REASONS = [
  "Produk rusak / cacat",
  "Produk tidak sesuai pesanan",
  "Produk kadaluarsa",
  "Produk salah kirim",
  "Kelebihan pesanan",
  "Lainnya",
];

interface ReturnModalProps {
  order: PesananDTO;
  onClose: () => void;
  onSubmit: (data: unknown) => void;
}

function ReturnModal({ order, onClose, onSubmit }: ReturnModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [returnType, setReturnType] = useState<"sebagian" | "semua" | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [quantities, setQuantities] = useState<Record<number, number | "">>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const selectedItems = returnType === "semua"
    ? order.items.map((item, i) => ({ ...item, returnQty: item.qty, index: i }))
    : order.items
        .map((item, i) => ({ ...item, returnQty: (quantities[i] as number) || 0, index: i }))
        .filter((_, i) => checkedItems.has(i));

  const totalRefund = selectedItems.reduce((sum, item) => sum + item.harga * item.returnQty, 0);

  const canGoStep2 = returnType !== null;
  const canGoStep3 = reason !== "" &&
    (returnType === "semua" || (checkedItems.size > 0 && [...checkedItems].every(i => Number(quantities[i]) > 0)));

  const handleSubmit = async () => {
    if (!returnType) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const retur = await createRetur(order.noPesanan, {
        tipe: returnType,
        alasan: reason,
        catatan: notes || null,
        items: selectedItems.map(item => ({
          pesananItemId: item.id,
          namaProduk: item.namaProduk,
          qty: item.returnQty,
          harga: item.harga,
        })),
      });
      onSubmit(retur);
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : "Gagal memproses retur.");
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] mx-4 max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" style={{ color: '#27b446' }} />
              <h2 style={{ color: '#000000' }}>Retur Pesanan</h2>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#27b446' }}>{order.noPesanan}</p>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{
                    backgroundColor: step >= s ? (step > s ? '#27b446' : '#27b446') : '#e5e7eb',
                    color: step >= s ? 'white' : '#9ca3af',
                  }}
                >
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className="w-6 h-0.5" style={{ backgroundColor: step > s ? '#27b446' : '#e5e7eb' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {submitError && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {submitError}</p>
            </div>
          )}

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <p className="mb-5" style={{ color: '#1a0408', opacity: 0.7 }}>
                Tentukan apakah Anda ingin meretur sebagian atau seluruh produk dari pesanan ini.
              </p>
              <div className="flex flex-col gap-3">
                {([
                  {
                    value: "sebagian" as const,
                    title: "Sebagian Produk",
                    desc: "Pilih produk tertentu dan tentukan jumlah yang akan diretur.",
                  },
                  {
                    value: "semua" as const,
                    title: "Semua Produk",
                    desc: "Semua produk dalam pesanan ini akan diretur dengan jumlah penuh.",
                  },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setReturnType(opt.value)}
                    className="flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: returnType === opt.value ? '#27b446' : '#e5e7eb',
                      backgroundColor: returnType === opt.value ? 'rgba(39,180,70,0.07)' : 'white',
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center"
                      style={{ borderColor: returnType === opt.value ? '#27b446' : '#d1d5db' }}
                    >
                      {returnType === opt.value && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#27b446' }} />
                      )}
                    </div>
                    <div>
                      <p style={{ color: '#000000', fontWeight: 600 }}>{opt.title}</p>
                      <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <p className="mb-5" style={{ color: '#1a0408', opacity: 0.7 }}>
                {returnType === "sebagian"
                  ? "Centang produk yang ingin diretur, lalu masukkan jumlahnya. Gunakan tombol Max untuk mengisi jumlah maksimal."
                  : "Semua produk akan diretur dengan jumlah maksimal sesuai data pembelian."}
              </p>

              {/* Product table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-5">
                <table className="w-full">
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      {returnType === "sebagian" && <th className="px-4 py-3 text-center w-10" style={{ color: '#000000' }}></th>}
                      <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Jml Beli</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>
                        {returnType === "sebagian" ? "Jml Retur" : "Jml Diretur"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, i) => {
                      const isChecked = checkedItems.has(i);
                      const qty = quantities[i];
                      return (
                        <tr key={i} className="border-t border-gray-100"
                          style={{ opacity: returnType === "sebagian" && !isChecked ? 0.45 : 1 }}>
                          {returnType === "sebagian" && (
                            <td className="px-4 py-3 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    setCheckedItems(prev => {
                                      const s = new Set(prev);
                                      e.target.checked ? s.add(i) : s.delete(i);
                                      return s;
                                    });
                                  }}
                                  className="sr-only"
                                />
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                  style={{
                                    backgroundColor: isChecked ? '#27b446' : 'white',
                                    border: `2px solid ${isChecked ? '#27b446' : '#d1d5db'}`,
                                  }}
                                >
                                  {isChecked && (
                                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                      <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  )}
                                </div>
                              </label>
                            </td>
                          )}
                          <td className="px-4 py-3" style={{ color: '#1a0408' }}>
                            <p>{item.namaProduk}</p>
                            <p className="text-xs mt-0.5" style={{ opacity: 0.5 }}>
                              Rp {item.harga.toLocaleString('id-ID')} / pcs
                            </p>
                          </td>
                          <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qty}</td>
                          <td className="px-4 py-3">
                            {returnType === "semua" ? (
                              <div className="flex justify-center">
                                <span className="px-3 py-1 rounded-lg text-sm font-medium"
                                  style={{ backgroundColor: 'rgba(39,180,70,0.07)', color: '#27b446' }}>
                                  {item.qty}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  max={item.qty}
                                  value={qty === undefined ? "" : qty}
                                  disabled={!isChecked}
                                  placeholder="0"
                                  onChange={e => {
                                    const raw = e.target.value;
                                    if (raw === "") { setQuantities(prev => ({ ...prev, [i]: "" })); return; }
                                    const val = Math.min(item.qty, Math.max(1, parseInt(raw) || 1));
                                    setQuantities(prev => ({ ...prev, [i]: val }));
                                  }}
                                  className="w-16 text-center px-2 py-1.5 rounded-lg border focus:outline-none"
                                  style={{ borderColor: isChecked ? '#27b446' : '#e5e7eb', color: '#1a0408' }}
                                />
                                <button
                                  disabled={!isChecked}
                                  onClick={() => setQuantities(prev => ({ ...prev, [i]: item.qty }))}
                                  className="px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{
                                    backgroundColor: isChecked ? 'rgba(39,180,70,0.07)' : '#f9fafb',
                                    color: isChecked ? '#27b446' : '#9ca3af',
                                    border: `1px solid ${isChecked ? '#27b446' : '#e5e7eb'}`,
                                  }}
                                >
                                  Max
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Refund preview */}
              {selectedItems.length > 0 && (
                <div className="flex justify-between items-center px-4 py-3 rounded-lg mb-5"
                  style={{ backgroundColor: 'rgba(39,180,70,0.07)', border: '1px solid #fed7aa' }}>
                  <span style={{ color: '#1a0408' }}>Estimasi Pengembalian Dana</span>
                  <span style={{ color: '#27b446', fontWeight: 700, fontSize: '16px' }}>
                    Rp {totalRefund.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-3">
                <div>
                  <label className="block mb-1.5 text-sm font-medium" style={{ color: '#000000' }}>
                    Alasan Retur <span style={{ color: '#e40b18' }}>*</span>
                  </label>
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none"
                    style={{ color: reason ? '#1a0408' : '#9ca3af', '--tw-ring-color': '#27b446' } as any}
                  >
                    <option value="">-- Pilih alasan retur --</option>
                    {RETURN_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5 text-sm font-medium" style={{ color: '#000000' }}>
                    Catatan Tambahan <span style={{ color: '#1a0408', opacity: 0.4, fontWeight: 400 }}>(opsional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Jelaskan kondisi produk atau keterangan lainnya..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 resize-none"
                    style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── Confirmation */}
          {step === 3 && (
            <div>
              <div className="flex items-start gap-3 p-4 rounded-xl mb-5"
                style={{ backgroundColor: 'rgba(39,180,70,0.07)', border: '1px solid #fed7aa' }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#27b446' }} />
                <p className="text-sm" style={{ color: '#1a0408' }}>
                  Periksa kembali detail retur di bawah sebelum diproses. Tindakan ini <strong>tidak dapat dibatalkan</strong> setelah dikonfirmasi.
                </p>
              </div>

              {/* Summary info */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                {[
                  { label: "No. Pesanan", value: order.noPesanan },
                  { label: "Jenis Retur", value: returnType === "semua" ? "Semua Produk" : "Sebagian Produk" },
                  { label: "Alasan", value: reason },
                  { label: "Jumlah Produk", value: `${selectedItems.length} produk` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                    <p className="text-xs mb-1" style={{ color: '#1a0408', opacity: 0.5 }}>{label}</p>
                    <p style={{ color: '#000000', fontWeight: 500 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Items to return */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#f9fafb' }}>
                  <p style={{ color: '#000000', fontWeight: 600 }}>Produk yang Diretur</p>
                </div>
                {selectedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p style={{ color: '#1a0408' }}>{item.namaProduk}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#1a0408', opacity: 0.5 }}>
                        {item.returnQty} pcs × Rp {item.harga.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <p style={{ color: '#27b446', fontWeight: 600 }}>
                      Rp {(item.harga * item.returnQty).toLocaleString('id-ID')}
                    </p>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-3"
                  style={{ backgroundColor: 'rgba(39,180,70,0.07)', borderTop: '2px solid #fed7aa' }}>
                  <span style={{ color: '#000000', fontWeight: 600 }}>Total Pengembalian</span>
                  <span style={{ color: '#27b446', fontWeight: 700, fontSize: '18px' }}>
                    Rp {totalRefund.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {notes && (
                <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                  <p className="text-xs mb-1" style={{ color: '#1a0408', opacity: 0.5 }}>Catatan</p>
                  <p className="text-sm" style={{ color: '#1a0408' }}>{notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          {step === 1 ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                Batalkan
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!canGoStep2}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                style={{ backgroundColor: '#27b446' }}>
                Lanjut
              </button>
            </>
          ) : step === 2 ? (
            <>
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                Kembali
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canGoStep3}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-30"
                style={{ backgroundColor: '#27b446' }}>
                Lanjut
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                Kembali
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: '#27b446' }}>
                <RotateCcw className="w-4 h-4" />
                {submitting ? "Memproses..." : "Proses Retur"}
              </button>
            </>
          )}
        </div>
    </Modal>
  );
}

// ─── Create Order Modal ───────────────────────────────────────────────────────

interface CreateOrderModalProps {
  onClose: () => void;
  /** Dipanggil setelah pesanan berhasil dibuat (utk me-refresh grid). */
  onCreated?: () => void;
}

function CreateOrderModal({ onClose, onCreated }: CreateOrderModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<Array<{
    produkId: number | null;
    produkSatuanId: number | null;
    satuanNama: string | null;
    satuanOptions: Array<{ produkSatuanId: number; satuanNama: string; harga: number }>;
    name: string;
    price: number;
    quantity: number;
  }>>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherInfo, setVoucherInfo] = useState<{ valid: boolean; message: string; diskonAmount?: number; tipe?: string; nilaiDiskon?: number; maksimalDiskon?: number | null } | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Tunai");
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [kreditPeriod, setKreditPeriod] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<PesananProdukOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Tipe pesanan: offline (POS, default) / commerce (toko online).
  const [orderType, setOrderType] = useState<"offline" | "commerce">("offline");
  // Pelanggan terpilih (dari master pelanggan) — wajib utk commerce.
  const [selectedPelanggan, setSelectedPelanggan] = useState<PelangganDTO | null>(null);
  const [pelangganQuery, setPelangganQuery] = useState("");
  const [pelangganResults, setPelangganResults] = useState<PelangganDTO[]>([]);
  const [showPelangganResults, setShowPelangganResults] = useState(false);
  const [pelangganSearching, setPelangganSearching] = useState(false);

  // Dropdown/popover di form ini: tertutup saat klik di luar.
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  useOutsideClickClose(paymentDropdownRef, () => setShowPaymentDropdown(false));
  const searchResultsRef = useRef<HTMLDivElement>(null);
  useOutsideClickClose(searchResultsRef, () => setShowSearchResults(false));
  const pelangganResultsRef = useRef<HTMLDivElement>(null);
  useOutsideClickClose(pelangganResultsRef, () => setShowPelangganResults(false));

  // Cari pelanggan dari master (utk tipe commerce) — debounce.
  useEffect(() => {
    if (orderType !== "commerce") {
      setPelangganResults([]);
      return;
    }
    if (!pelangganQuery.trim()) {
      setPelangganResults([]);
      return;
    }
    let cancelled = false;
    setPelangganSearching(true);
    const timer = setTimeout(async () => {
      try {
        const result = await listPelanggan({ search: pelangganQuery.trim(), pageSize: 8 });
        if (!cancelled) setPelangganResults(result.items);
      } catch {
        if (!cancelled) setPelangganResults([]);
      } finally {
        if (!cancelled) setPelangganSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pelangganQuery, orderType]);

  // Cari produk dari API (debounce sederhana per ketikan).
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchPesananProduk(searchQuery.trim(), 5);
        if (!cancelled) setSearchResults(result);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Calculate totals
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Validasi voucher via API setiap kode / subtotal berubah (debounce).
  useEffect(() => {
    if (!voucherCode.trim()) {
      setVoucherInfo(null);
      setValidatingVoucher(false);
      return;
    }
    let cancelled = false;
    setValidatingVoucher(true);
    const timer = setTimeout(async () => {
      try {
        const result = await validatePromoVoucher(voucherCode.trim(), subtotal);
        if (!cancelled) {
          setVoucherInfo(result.valid
            ? { valid: true, message: result.message, diskonAmount: result.promo?.diskonAmount, tipe: result.promo?.tipe, nilaiDiskon: result.promo?.nilaiDiskon, maksimalDiskon: result.promo?.maksimalDiskon }
            : { valid: false, message: result.message });
        }
      } catch {
        if (!cancelled) setVoucherInfo({ valid: false, message: "Gagal memvalidasi voucher." });
      } finally {
        if (!cancelled) setValidatingVoucher(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [voucherCode, subtotal]);

  const discountAmount = voucherInfo?.valid ? (voucherInfo.diskonAmount ?? 0) : 0;
  const discountLabel = voucherInfo?.valid && voucherCode
    ? `Voucher (${voucherCode.trim().toUpperCase()})`
    : "Diskon";
  const total = subtotal - discountAmount;

  // Identitas baris = produk + satuan. Produk sama dgn satuan berbeda
  // (mis. Indomie rebus — Dus lalu Pcs) tetap jadi 2 baris terpisah.
  const itemKey = (produkId: number | null, produkSatuanId: number | null) =>
    `${produkId ?? "x"}||${produkSatuanId ?? "x"}`;

  const handleAddProduct = (product: PesananProdukOption) => {
    setSelectedItems(items => {
      const barisProdukIni = items.filter(item => item.produkId === product.produkId);
      const satuanTerpakai = barisProdukIni.map(item => item.produkSatuanId);
      // Satuan default = opsi pertama yang belum dipakai baris lain utk produk ini.
      // Contoh: Indomie sudah ada dgn satuan Dus → klik lagi membuat baris baru dgn Pcs.
      const defSat = product.satuan.find(o => !satuanTerpakai.includes(o.produkSatuanId))
        ?? product.satuan[0]
        ?? null;
      const defSatuanId = defSat ? defSat.produkSatuanId : null;
      const existing = items.find(
        item => item.produkId === product.produkId && item.produkSatuanId === defSatuanId
      );
      if (existing) {
        // Produk + satuan identik → merge (qty naik), bukan baris ganda.
        const key = itemKey(existing.produkId, existing.produkSatuanId);
        return items.map(item =>
          itemKey(item.produkId, item.produkSatuanId) === key
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      // Produk sama + satuan berbeda → baris baru (qty & harga sendiri).
      return [...items, {
        produkId: product.produkId,
        produkSatuanId: defSatuanId,
        satuanNama: defSat ? defSat.satuanNama : null,
        satuanOptions: product.satuan,
        name: product.nama,
        price: defSat ? defSat.harga : product.harga,
        quantity: 1
      }];
    });
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleChangeSatuan = (index: number, psId: number) => {
    setSelectedItems(items => {
      const target = items[index];
      if (!target) return items;
      // Satuan itu sudah dipakai baris lain utk produk yang sama → duplikat murni, tolak.
      const dipakaiBarisLain = items.some((item, i) =>
        i !== index && item.produkId === target.produkId && item.produkSatuanId === psId
      );
      if (dipakaiBarisLain) return items;
      const opt = target.satuanOptions.find(o => o.produkSatuanId === psId);
      return items.map((item, i) =>
        i === index
          ? {
              ...item,
              produkSatuanId: psId,
              satuanNama: opt ? opt.satuanNama : item.satuanNama,
              price: opt ? opt.harga : item.price,
            }
          : item
      );
    });
  };

  const handleIncreaseQuantity = (index: number) => {
    setSelectedItems(items =>
      items.map((item, i) => (i === index ? { ...item, quantity: item.quantity + 1 } : item))
    );
  };

  const handleDecreaseQuantity = (index: number) => {
    setSelectedItems(items =>
      items.map((item, i) =>
        i === index && item.quantity > 1 ? { ...item, quantity: item.quantity - 1 } : item
      )
    );
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(items => items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      alert("Harap tambahkan minimal 1 produk");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      if (orderType === "commerce" && !selectedPelanggan) {
        setSubmitError("Pilih pelanggan terlebih dahulu untuk pesanan commerce.");
        setSubmitting(false);
        return;
      }
      await createPesanan({
        items: selectedItems.map(i => ({
          produkId: i.produkId,
          produkSatuanId: i.produkSatuanId,
          namaProduk: i.name,
          qty: i.quantity,
          harga: i.price,
        })),
        metodeBayar: paymentMethod === "Kredit" && kreditPeriod
          ? `Kredit — ${kreditPeriod}`
          : paymentMethod,
        periodeKredit: paymentMethod === "Kredit" ? kreditPeriod || null : null,
        voucher: voucherCode || null,
        asal: orderType,
        pelangganId: orderType === "commerce" ? selectedPelanggan!.id : undefined,
      });
      setShowReceipt(true);
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : "Gagal membuat pesanan.");
      setSubmitting(false);
    }
  };

  const paymentMethods = ["Tunai", "QRIS", "Bank Transfer", "Kredit"];
  const kreditPeriods = ["Bayar Bulan Depan", "Cicil 3 Bulan", "Cicil 6 Bulan", "Cicil 12 Bulan"];

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Buat Pesanan Manual</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#1a0408' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)] px-6 py-4">
          <div className="space-y-6">
            {submitError && (
              <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {submitError}</p>
              </div>
            )}
            {/* Tipe Pesanan */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Tipe Pesanan
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setOrderType("offline"); setSelectedPelanggan(null); setPelangganQuery(""); }}
                  className="p-4 rounded-lg border-2 transition-colors text-left"
                  style={{
                    borderColor: orderType === "offline" ? '#27b446' : '#e5e7eb',
                    backgroundColor: orderType === "offline" ? 'rgba(39, 180, 70, 0.04)' : 'white'
                  }}
                >
                  <p className="font-medium flex items-center gap-2" style={{ color: '#000000' }}>
                    🏪 Offline / POS
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Pesanan langsung di kasir/toko
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("commerce")}
                  className="p-4 rounded-lg border-2 transition-colors text-left"
                  style={{
                    borderColor: orderType === "commerce" ? '#27b446' : '#e5e7eb',
                    backgroundColor: orderType === "commerce" ? 'rgba(39, 180, 70, 0.04)' : 'white'
                  }}
                >
                  <p className="font-medium flex items-center gap-2" style={{ color: '#000000' }}>
                    🛒 Commerce / Online
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Pesanan dari toko online (wajib pelanggan)
                  </p>
                </button>
              </div>
            </div>

            {/* Pilih Pelanggan (commerce) */}
            {orderType === "commerce" && (
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Pelanggan <span style={{ color: '#e40b18' }}>*</span>
                </label>
                {selectedPelanggan ? (
                  <div className="p-3 rounded-lg border-2 flex items-center gap-3"
                    style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.04)' }}>
                    <div className="flex-1">
                      <p style={{ color: '#000000' }}>
                        {selectedPelanggan.nama}
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-mono" style={{ backgroundColor: '#f3f4f6', color: '#27b446' }}>
                          {selectedPelanggan.kode}
                        </span>
                      </p>
                      <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                        {[selectedPelanggan.telepon, selectedPelanggan.email].filter(Boolean).join(" · ") || "—"}
                        {selectedPelanggan.kecamatan ? ` · ${selectedPelanggan.kecamatan}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedPelanggan(null); setPelangganQuery(""); }}
                      className="p-2 rounded-lg border transition-colors"
                      style={{ borderColor: '#e40b18', color: '#e40b18' }}
                      title="Ganti pelanggan"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div ref={pelangganResultsRef} className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                    <input
                      type="text"
                      placeholder="Cari nama, telepon, atau kode pelanggan..."
                      value={pelangganQuery}
                      onChange={(e) => { setPelangganQuery(e.target.value); setShowPelangganResults(true); }}
                      onFocus={() => setShowPelangganResults(true)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                      style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                    />
                    {pelangganSearching && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>
                        Mencari...
                      </span>
                    )}
                    {showPelangganResults && pelangganResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                        {pelangganResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedPelanggan(p); setPelangganResults([]); setShowPelangganResults(false); }}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <p style={{ color: '#1a0408' }}>{p.nama}</p>
                                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                                  {[p.telepon, p.email].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-xs font-mono" style={{ backgroundColor: p.isMember ? 'rgba(39,180,70,0.1)' : '#f3f4f6', color: p.isMember ? '#27b446' : '#1a0408' }}>
                                {p.isMember ? "Member" : p.kode}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showPelangganResults && pelangganQuery && !pelangganSearching && pelangganResults.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-4 text-center">
                        <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                          Pelanggan tidak ditemukan. Buat pelanggan di menu <strong>Pelanggan</strong>.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Product Search */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Cari Produk
              </label>
              <div ref={searchResultsRef} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Ketik nama produk..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />

                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {searchResults.map(product => (
                      <button
                        key={product.produkId}
                        onClick={() => handleAddProduct(product)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p style={{ color: '#1a0408' }}>{product.nama}</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                              Stok: {product.stok}
                            </p>
                          </div>
                          <p style={{ color: '#27b446' }}>
                            Rp {product.harga.toLocaleString('id-ID')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Items */}
            {selectedItems.length > 0 && (
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Produk Dipilih ({selectedItems.length})
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {selectedItems.map((item, index) => (
                      <div key={itemKey(item.produkId, item.produkSatuanId)} className="py-4 px-4 flex items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <p style={{ color: '#1a0408' }}>{item.name}</p>
                          {item.satuanOptions.length > 1 ? (
                            <div className="relative inline-block">
                              <select
                                value={String(item.produkSatuanId ?? "")}
                                onChange={(e) => handleChangeSatuan(index, Number(e.target.value))}
                                className="appearance-none pl-2 pr-7 py-0.5 rounded border border-gray-300 text-xs focus:outline-none focus:ring-2 cursor-pointer"
                                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                              >
                                {item.satuanOptions.map(o => {
                                  // Satuan yang sudah dipakai baris lain utk produk ini
                                  // = duplikat murni → tandai terpakai (tidak bisa dipilih).
                                  const terpakai = selectedItems.some((other, i) =>
                                    i !== index && other.produkId === item.produkId && other.produkSatuanId === o.produkSatuanId
                                  );
                                  return (
                                    <option key={o.produkSatuanId} value={o.produkSatuanId} disabled={terpakai}
                                      style={{ color: terpakai ? '#9ca3af' : '#1a0408' }}>
                                      {o.satuanNama}{terpakai ? " (terpakai)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.5 }} />
                            </div>
                          ) : item.satuanNama ? (
                            <div>
                              <span className="inline-flex px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#f3f4f6', color: '#1a0408' }}>
                                {item.satuanNama}
                              </span>
                            </div>
                          ) : null}
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                            Rp {item.price.toLocaleString('id-ID')} × {item.quantity}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDecreaseQuantity(index)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#e5e7eb', color: '#1a0408' }}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-12 text-center" style={{ color: '#1a0408' }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleIncreaseQuantity(index)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#27b446', color: '#27b446' }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Subtotal */}
                        <div className="w-32 text-right">
                          <p style={{ color: '#000000' }}>
                            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                          </p>
                        </div>

                        {/* Remove Button */}
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-red-50"
                          style={{ borderColor: '#e40b18', color: '#e40b18' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Voucher Code */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Kode Voucher (Opsional)
              </label>
              <input
                type="text"
                placeholder="Masukkan kode voucher promo"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {voucherCode && validatingVoucher && (
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Memvalidasi kode voucher...
                </p>
              )}
              {voucherCode && !validatingVoucher && voucherInfo?.valid && (
                <p className="text-sm mt-1" style={{ color: '#27b446' }}>
                  ✓ {voucherInfo.message}
                  {voucherInfo.tipe === "Diskon %" && ` (${voucherInfo.nilaiDiskon}%${voucherInfo.maksimalDiskon != null ? `, maks Rp ${voucherInfo.maksimalDiskon.toLocaleString('id-ID')}` : ''})`}
                </p>
              )}
              {voucherCode && !validatingVoucher && voucherInfo && !voucherInfo.valid && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>
                  ✗ {voucherInfo.message}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Metode Pembayaran
              </label>
              <div ref={paymentDropdownRef} className="relative">
                <button
                  onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 flex items-center justify-between focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                >
                  {paymentMethod}
                  <ChevronDown className="w-5 h-5" style={{ color: '#1a0408', opacity: 0.6 }} />
                </button>

                {showPaymentDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {paymentMethods.map(method => (
                      <button
                        key={method}
                        onClick={() => {
                          setPaymentMethod(method);
                          setShowPaymentDropdown(false);
                          if (method !== "Kredit") setKreditPeriod("");
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                          method === paymentMethod ? 'bg-gray-50' : ''
                        }`}
                        style={{ color: '#1a0408' }}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Kredit Period Selector */}
            {paymentMethod === "Kredit" && (
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Periode Kredit
                </label>
                <div className="flex flex-col gap-2">
                  {kreditPeriods.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setKreditPeriod(period)}
                      className="w-full px-4 py-3 rounded-lg border-2 text-left transition-all"
                      style={{
                        borderColor: kreditPeriod === period ? '#27b446' : '#e2e8f0',
                        backgroundColor: kreditPeriod === period ? 'rgba(39,180,70,0.07)' : 'white',
                        color: '#000000',
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Total Summary */}
            {selectedItems.length > 0 && (
              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span style={{ color: '#1a0408' }}>Subtotal</span>
                    <span style={{ color: '#1a0408' }}>
                      Rp {subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span style={{ color: '#1a0408' }}>
                        {voucherInfo?.tipe === "Diskon %" ? `Diskon (${voucherInfo.nilaiDiskon}%)` : `Diskon (${voucherCode})`}
                      </span>
                      <span style={{ color: '#e40b18' }}>
                        - Rp {discountAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                    <span style={{ color: '#000000' }}>Total</span>
                    <span className="text-xl" style={{ color: '#27b446' }}>
                      Rp {total.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{
              borderColor: '#e40b18',
              color: '#e40b18'
            }}
          >
            Batal
          </button>
          <button
            onClick={() => void handleSubmit()}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#27b446' }}
            disabled={selectedItems.length === 0 || submitting}
          >
            {submitting ? "Menyimpan..." : "Buat Pesanan"}
          </button>
        </div>

      {/* Receipt popup — rendered above CreateOrderModal */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => { setShowReceipt(false); onClose(); onCreated?.(); }}
        items={selectedItems.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }))}
        subtotal={subtotal}
        discountAmount={discountAmount}
        discountLabel={discountLabel}
        total={total}
        paymentMethod={paymentMethod === "Kredit" && kreditPeriod ? `Kredit — ${kreditPeriod}` : paymentMethod}
        kreditPeriod={kreditPeriod || undefined}
      />
    </Modal>
  );
}