"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { ApiClientError } from "@/lib/api-client";
import { listKurir, listPesanan, updatePengiriman } from "@/lib/pesanan-api";
import type { KurirDTO, PesananDTO } from "@/lib/pesanan-types";
import {
  Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Truck, CheckCircle,
  CheckSquare, Square, Download, MapPin, Phone, Eye
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";

type StatusPengiriman = "Menunggu Kurir" | "Diantar" | "Selesai";
const STATUS_PENGIRIMAN: StatusPengiriman[] = ["Menunggu Kurir", "Diantar", "Selesai"];

type SortField = "no_pesanan" | "created_at" | "total";
type SortDirection = "asc" | "desc" | null;

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function getStatusStyle(status: string) {
  switch (status) {
    case "Menunggu Kurir": return { bg: '#fee2e2', color: '#991b1b' };
    case "Diantar": return { bg: 'rgba(39, 180, 70, 0.1)', color: '#27b446' };
    case "Selesai": return { bg: '#dcfce7', color: '#166534' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
}

function getPaymentBadge(method: string) {
  if (method === "Tunai") return { backgroundColor: "#fef3c7", color: "#92400e" };
  if (method === "QRIS") return { backgroundColor: "#dbeafe", color: "#1e40af" };
  if (method === "Bank Transfer") return { backgroundColor: "#f3e8ff", color: "#6b21a8" };
  if (method.startsWith("Kredit")) return { backgroundColor: "#fce7f3", color: "#9d174d" };
  return { backgroundColor: "#f3f4f6", color: "#374151" };
}

// ---------------------------------------------------------------------------
// Pilih Kurir Modal
// ---------------------------------------------------------------------------

function PilihKurirModal({ onClose, onAssign, kurirs, busy, order }: {
  onClose: () => void;
  onAssign: (kurirId: number) => void;
  kurirs: KurirDTO[];
  busy: boolean;
  /** Pesanan tunggal (dari detail) — null berarti mode bulk dari checkbox grid. */
  order: PesananDTO | null;
}) {
  const [selected, setSelected] = useState("");
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>{order ? "Pilih Kurir" : "Pilih Kurir (Bulk)"}</h2>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{order ? "Pilih kurir untuk memproses pengiriman" : "Tugaskan kurir untuk pesanan terpilih"}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">
          {order && (
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>ID Pesanan</p>
              <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{order.noPesanan}</p>
            </div>
          )}
          <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Pilih Kurir</label>
          {kurirs.length === 0 ? (
            <p className="text-center py-6" style={{ color: '#1a0408', opacity: 0.6 }}>
              Belum ada user dengan role kurir. Buat di menu User → Role & Akses.
            </p>
          ) : (
            <div className="relative">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              >
                <option value="">-- Pilih Kurir --</option>
                {kurirs.map((k) => (
                  <option key={k.id} value={String(k.id)}>{k.fullName} ({k.id})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Batal
          </button>
          <button
            onClick={() => selected && onAssign(Number(selected))}
            disabled={!selected || busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#27b446' }}
          >
            {busy ? "Memproses..." : "Kirim"}
          </button>
        </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Order Modal
// ---------------------------------------------------------------------------

function OrderDetailModal({ order, onClose, onPilihKurir, onSelesaikan, busy }: {
  order: PesananDTO;
  onClose: () => void;
  onPilihKurir: (o: PesananDTO) => void;
  onSelesaikan: (o: PesananDTO) => void;
  busy: boolean;
}) {
  const discountAmount = order.diskonAmount;
  const kurir = order.kurir;
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Pesanan Commerce</h2>
            <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{order.noPesanan}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          {/* Status & pelanggan */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={getStatusStyle(order.statusPengiriman ?? "Menunggu Kurir")}>
              <Truck className="w-4 h-4" />
              {order.statusPengiriman ?? "Menunggu Kurir"}
            </span>
            <span className="px-3 py-1 rounded-full text-sm" style={getPaymentBadge(order.metodeBayar)}>
              {order.metodeBayar}
            </span>
            {order.voucher && <span className="px-3 py-1 rounded-full text-sm font-mono" style={{ backgroundColor: '#f3f4f6', color: '#1a0408' }}>Voucher: {order.voucher}</span>}
          </div>

          {/* Pelanggan */}
          <div className="mb-5 p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
            <p className="font-medium mb-1" style={{ color: '#000000' }}>
              {order.pelanggan?.nama || "-"}
              {order.pelanggan && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-normal" style={{ backgroundColor: '#f3f4f6', color: '#1a0408' }}>
                  {order.pelanggan.kode}
                </span>
              )}
            </p>
            {order.pelanggan?.telepon && (
              <p className="flex items-center gap-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                <Phone className="w-4 h-4" /> {order.pelanggan.telepon}
              </p>
            )}
            {order.pelanggan?.alamat && (
              <p className="flex items-start gap-2 text-sm mt-1" style={{ color: '#1a0408', opacity: 0.7 }}>
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" /> {order.pelanggan.alamat}
              </p>
            )}
            {order.catatanPengiriman && (
              <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                Catatan: {order.catatanPengiriman}
              </p>
            )}
          </div>

          {/* Kurir */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium" style={{ color: '#000000' }}>Kurir</p>
              {order.statusPengiriman === "Menunggu Kurir" && (
                <button onClick={() => onPilihKurir(order)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#27b446' }} disabled={busy}>
                  <Truck className="w-4 h-4" />
                  Pilih Kurir
                </button>
              )}
            </div>
            {kurir ? (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ backgroundColor: '#27b446' }}>
                  {kurir.fullName.charAt(0)}
                </span>
                <div>
                  <p style={{ color: '#000000' }}>{kurir.fullName}</p>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>@{kurir.username}</p>
                </div>
              </div>
            ) : (
              <p style={{ color: '#1a0408', opacity: 0.5 }}>Belum ada kurir ditugaskan</p>
            )}
          </div>

          {/* Items */}
          <div className="mb-5">
            <p className="font-medium mb-2" style={{ color: '#000000' }}>Item Pesanan</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs" style={{ color: '#1a0408' }}>Produk</th>
                    <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Qty</th>
                    <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Harga</th>
                    <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-sm" style={{ color: '#1a0408' }}>{it.namaProduk}</td>
                      <td className="px-4 py-2 text-center text-sm" style={{ color: '#1a0408' }}>{it.qty}</td>
                      <td className="px-4 py-2 text-right text-sm" style={{ color: '#1a0408' }}>{formatRp(it.harga)}</td>
                      <td className="px-4 py-2 text-right text-sm" style={{ color: '#1a0408' }}>{formatRp(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total */}
          <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: '#1a0408' }}>Subtotal</span>
              <span style={{ color: '#1a0408' }}>{formatRp(order.subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#1a0408' }}>Diskon</span>
                <span style={{ color: '#e40b18' }}>- {formatRp(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span style={{ color: '#000000' }}>Total</span>
              <span className="text-xl" style={{ color: '#27b446' }}>{formatRp(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          {order.statusPengiriman === "Diantar" ? (
            <button onClick={() => onSelesaikan(order)}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#27b446' }}>
              <CheckCircle className="w-5 h-5" />
              {busy ? "Memproses..." : "Selesaikan Pengiriman"}
            </button>
          ) : <div />}
          <button onClick={onClose}
            className="px-5 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Tutup
          </button>
        </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Commerce main page
// ---------------------------------------------------------------------------

export default function Commerce() {
  const [orders, setOrders] = useState<PesananDTO[]>([]);
  const [kurirs, setKurirs] = useState<KurirDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [searchId, setSearchId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PesananDTO | null>(null);
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [orderForCourier, setOrderForCourier] = useState<PesananDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchId); setPagination((p) => ({ ...p, page: 1 })); }, 300);
    return () => clearTimeout(t);
  }, [searchId]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const sortBy = sortField ?? undefined;
      const result = await listPesanan({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch,
        asal: "commerce",
        statusPengiriman: statusFilter === "all" ? undefined : statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder: sortDirection ?? undefined,
      });
      setOrders(result.items);
      setPagination(result.pagination);
    } catch (e) {
      setListError(e instanceof ApiClientError ? e.message : "Gagal memuat data commerce.");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, debouncedSearch, statusFilter, dateFrom, dateTo, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);

  // Load kurir list
  useEffect(() => {
    listKurir().then(setKurirs).catch(() => undefined);
  }, []);

  useEffect(() => { setSelectedOrderIds([]); }, [orders]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortField(null); setSortDirection(null); }
    } else { setSortField(field); setSortDirection("asc"); }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const hasActiveFilters = searchId || dateFrom || dateTo || statusFilter !== "all";
  const clearFilters = () => {
    setSearchId(""); setDateFrom(""); setDateTo(""); setStatusFilter("all");
  };

  const handleAssignKurir = async (kurirId: number) => {
    const targets = orderForCourier ? [orderForCourier] : selectedMenunggu;
    if (targets.length === 0) return;
    setBusy(true);
    setListError("");
    setBulkError("");
    const gagal: string[] = [];
    for (const t of targets) {
      try {
        const updated = await updatePengiriman(t.noPesanan, { kurirId, statusPengiriman: "Diantar" });
        setOrders((prev) => prev.map((o) => o.noPesanan === updated.noPesanan ? updated : o));
        setSelectedOrder((cur) => cur && cur.noPesanan === updated.noPesanan ? updated : cur);
      } catch {
        gagal.push(t.noPesanan);
      }
    }
    setShowCourierModal(false);
    setOrderForCourier(null);
    if (targets.length > 1) {
      setSelectedOrderIds([]);
      await load();
      if (gagal.length > 0) setBulkError(`Pilih Kurir: ${targets.length - gagal.length} pesanan ditugaskan, ${gagal.length} gagal (${gagal.join(", ")}).`);
    } else if (gagal.length > 0) {
      setListError("Gagal menugaskan kurir.");
    }
    setBusy(false);
  };

  const handleComplete = async (order: PesananDTO) => {
    setBusy(true);
    setListError("");
    try {
      const updated = await updatePengiriman(order.noPesanan, { statusPengiriman: "Selesai" });
      setOrders((prev) => prev.map((o) => o.noPesanan === updated.noPesanan ? updated : o));
      setSelectedOrder((cur) => cur && cur.noPesanan === updated.noPesanan ? updated : cur);
    } catch (e) {
      setListError(e instanceof ApiClientError ? e.message : "Gagal menyelesaikan pengiriman.");
    } finally { setBusy(false); }
  };

  // Bulk action: baris 'Menunggu Kurir' → Pilih Kurir; 'Diantar' → Selesaikan.
  // Baris berstatus lain (Selesai/dll) tidak bisa dipilih (checkbox disabled).
  const selectedMenunggu = orders.filter((o) => selectedOrderIds.includes(o.noPesanan) && o.statusPengiriman === "Menunggu Kurir");
  const selectedDiantar = orders.filter((o) => selectedOrderIds.includes(o.noPesanan) && o.statusPengiriman === "Diantar");
  const layakBulk = orders.filter((o) => o.statusPengiriman === "Diantar" || o.statusPengiriman === "Menunggu Kurir");
  const allSelected = layakBulk.length > 0 && layakBulk.every((o) => selectedOrderIds.includes(o.noPesanan));

  const handleToggleSelect = (no: string) => {
    if (bulkBusy) return;
    setSelectedOrderIds((prev) => prev.includes(no) ? prev.filter((x) => x !== no) : [...prev, no]);
  };

  const handleSelectAll = () => {
    if (bulkBusy) return;
    if (allSelected) setSelectedOrderIds([]);
    else setSelectedOrderIds(layakBulk.map((o) => o.noPesanan));
  };

  /** Bulk "Selesaikan" — eksekusi sekuensial memakai API yang sama dgn tombol "Selesaikan Pengiriman". */
  const handleBulkSelesaikan = async () => {
    const targets = selectedDiantar;
    if (targets.length === 0 || busy || bulkBusy) return;
    setBulkBusy(true);
    setListError("");
    setBulkError("");
    const gagal: string[] = [];
    for (const o of targets) {
      try {
        await updatePengiriman(o.noPesanan, { statusPengiriman: "Selesai" });
      } catch {
        gagal.push(o.noPesanan);
      }
    }
    setSelectedOrderIds([]);
    await load();
    if (gagal.length > 0) {
      setBulkError(`Bulk Selesaikan: ${targets.length - gagal.length} pesanan selesai, ${gagal.length} gagal (${gagal.join(", ")}).`);
    }
    setBulkBusy(false);
  };

  const exportData = async () => {
    try {
      const result = await listPesanan({ page: 1, pageSize: 1000, asal: "commerce", search: debouncedSearch, statusPengiriman: statusFilter === "all" ? undefined : statusFilter, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
      const headers = ["No. Pesanan", "Tanggal", "Pelanggan", "Telepon", "Alamat", "Metode Bayar", "Status Pengiriman", "Kurir", "Subtotal", "Diskon", "Total"];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const body = result.items.map((o) => [o.noPesanan, fmtWib(o.createdAt, "dd MMM yyyy, HH:mm"), o.pelanggan?.nama ?? "", o.pelanggan?.telepon ?? "", o.pelanggan?.alamat ?? "", o.metodeBayar, o.statusPengiriman ?? "", o.kurir?.fullName ?? "", o.subtotal, o.diskonAmount, o.total].map(esc).join(","));
      const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `data-commerce-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setListError(e instanceof ApiClientError ? e.message : "Gagal export data commerce.");
    }
  };

  const pageNumbers = useMemo(() => {
    const tp = pagination.totalPages;
    if (tp <= 5) return Array.from({ length: tp }, (_, i) => i + 1);
    const pg = pagination.page;
    if (pg <= 3) return [1, 2, 3, 4, 5];
    if (pg >= tp - 2) return [tp - 4, tp - 3, tp - 2, tp - 1, tp];
    return [pg - 2, pg - 1, pg, pg + 1, pg + 2];
  }, [pagination.page, pagination.totalPages]);

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);



  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="commerce" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Commerce</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola pesanan dari toko online & proses pengiriman
              </p>
            </div>
            <button onClick={() => void exportData()}
              className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
              style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
              title="Export seluruh data commerce (CSV)">
              <Download className="w-5 h-5" />
              Export Data
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari no. pesanan atau nama pelanggan..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
              {searchId && (
                <button onClick={() => setSearchId("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="relative">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                <option value="all">Semua Status</option>
                {STATUS_PENGIRIMAN.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>

            <button onClick={() => setShowDateFilter(!showDateFilter)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors`}
              style={{ backgroundColor: showDateFilter ? '#27b446' : 'white', borderColor: '#27b446', color: showDateFilter ? 'white' : '#27b446' }}>
              <Calendar className="w-5 h-5" />
              Filter Tanggal
            </button>

            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                <X className="w-4 h-4" />
                Hapus Filter
              </button>
            )}
          </div>

          {showDateFilter && (
            <div className="mt-4 flex items-center gap-4 p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Dari Tanggal</label>
                <DatePicker value={dateFrom} max={dateTo || undefined}
                  onChange={(v) => { setDateFrom(v); if (dateTo && v && v > dateTo) setDateTo(""); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <DatePicker value={dateTo} min={dateFrom || undefined}
                  onChange={(v) => { setDateTo(v); if (dateFrom && v && v < dateFrom) setDateFrom(""); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {listError && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {listError}</p>
            </div>
          )}
          {bulkError && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {bulkError}</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data commerce...</p></div>
            ) : orders.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button onClick={handleSelectAll} disabled={layakBulk.length === 0 || bulkBusy}
                            className="flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{ color: '#27b446' }} title={allSelected ? "Batalkan semua" : "Pilih semua"}>
                            {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("no_pesanan")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            No. Pesanan {getSortIcon("no_pesanan")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("created_at")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Tanggal {getSortIcon("created_at")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Pelanggan</th>
                        <th className="px-6 py-4 text-right">
                          <button onClick={() => handleSort("total")} className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Total {getSortIcon("total")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Pembayaran</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status Kirim</th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kurir</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order, index) => {
                        const st = getStatusStyle(order.statusPengiriman ?? "Menunggu Kurir");
                        const pay = getPaymentBadge(order.metodeBayar);
                        const layak = order.statusPengiriman === "Diantar" || order.statusPengiriman === "Menunggu Kurir";
                        return (
                          <tr key={order.noPesanan} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                            style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                            <td className="px-6 py-4 text-center">
                              <button onClick={() => handleToggleSelect(order.noPesanan)} disabled={!layak || bulkBusy}
                                className="flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{ color: layak ? '#27b446' : '#9ca3af' }}
                                title={layak ? "Pilih untuk aksi bulk (Pilih Kurir / Selesaikan)" : "Hanya pesanan berstatus Menunggu Kurir atau Diantar yang dapat dipilih"}>
                                {selectedOrderIds.includes(order.noPesanan) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedOrder(order)} style={{ color: '#27b446', fontFamily: 'monospace' }}>{order.noPesanan}</td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedOrder(order)} style={{ color: '#1a0408' }}>
                              {fmtWib(order.createdAt, "dd MMM yyyy, HH:mm")}
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedOrder(order)} style={{ color: '#1a0408' }}>
                              <div>{order.pelanggan?.nama || "-"}</div>
                              {order.pelanggan?.telepon && <div style={{ opacity: 0.6, fontSize: '0.875rem' }}>{order.pelanggan.telepon}</div>}
                            </td>
                            <td className="px-6 py-4 text-right cursor-pointer" onClick={() => setSelectedOrder(order)} style={{ color: '#000000' }}>{formatRp(order.total)}</td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                              <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: pay.backgroundColor, color: pay.color }}>{order.metodeBayar}</span>
                            </td>
                            <td className="px-6 py-4 text-center cursor-pointer" onClick={() => setSelectedOrder(order)}>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: st.bg, color: st.color }}>
                                {order.statusPengiriman === "Diantar" && <Truck className="w-3.5 h-3.5" />}
                                {order.statusPengiriman === "Selesai" && <CheckCircle className="w-3.5 h-3.5" />}
                                {order.statusPengiriman ?? "Menunggu Kurir"}
                              </span>
                            </td>
                            <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                              {order.kurir ? order.kurir.fullName : <span style={{ opacity: 0.4 }}>—</span>}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {order.statusPengiriman === "Diantar" && (
                                  <button onClick={() => void handleComplete(order)} disabled={busy}
                                    className="p-2 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                                    style={{ borderColor: '#27b446', color: '#27b446' }}
                                    title="Selesaikan pengiriman">
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => setSelectedOrder(order)}
                                  className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                                  style={{ borderColor: '#27b446', color: '#27b446' }}
                                  title="Detail">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                    <div className="relative">
                      <select value={pagination.pageSize} onChange={(e) => { setPagination((p) => ({ ...p, pageSize: Number(e.target.value), page: 1 })); }}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                        style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                    </div>
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>
                      Menampilkan {rangeStart} - {rangeEnd} dari {pagination.total} pesanan
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page === 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-1">
                      {pageNumbers.map((pn) => (
                        <button key={pn} onClick={() => setPagination((p) => ({ ...p, page: pn }))} className="w-10 h-10 rounded-lg transition-colors"
                          style={{ backgroundColor: pagination.page === pn ? '#27b446' : 'transparent', color: pagination.page === pn ? 'white' : '#1a0408', border: pagination.page === pn ? 'none' : '1px solid #e5e7eb' }}>
                          {pn}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))} disabled={pagination.page === pagination.totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Truck className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Belum ada pesanan commerce</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      Pesanan dari toko online akan muncul di sini setelah diterima
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-white rounded-xl shadow-2xl border-2 px-6 py-4 flex items-center gap-4" style={{ borderColor: '#27b446' }}>
            <span style={{ color: '#000000' }}>{selectedOrderIds.length} pesanan dipilih</span>
            <div className="h-6 w-px bg-gray-300" />
            {selectedMenunggu.length > 0 && (
              <button onClick={() => { setOrderForCourier(null); setShowCourierModal(true); }} disabled={busy || bulkBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#27b446' }}>
                <Truck className="w-4 h-4" />
                {bulkBusy ? "Memproses..." : `Pilih Kurir (${selectedMenunggu.length})`}
              </button>
            )}
            {selectedDiantar.length > 0 && (
              <button onClick={() => void handleBulkSelesaikan()} disabled={busy || bulkBusy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#27b446' }}>
                <CheckCircle className="w-4 h-4" />
                {bulkBusy ? "Memproses..." : `Selesaikan (${selectedDiantar.length})`}
              </button>
            )}
            <button onClick={() => setSelectedOrderIds([])} disabled={bulkBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-red-50 disabled:opacity-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              <X className="w-4 h-4" />
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onPilihKurir={(o) => { setOrderForCourier(o); setShowCourierModal(true); }}
          onSelesaikan={(o) => void handleComplete(o)}
          busy={busy}
        />
      )}

      {/* Pilih kurir modal */}
      {showCourierModal && (
        <PilihKurirModal
          kurirs={kurirs}
          busy={busy}
          order={orderForCourier}
          onClose={() => { setShowCourierModal(false); setOrderForCourier(null); }}
          onAssign={(kurirId) => void handleAssignKurir(kurirId)}
        />
      )}
    </div>
  );
}
