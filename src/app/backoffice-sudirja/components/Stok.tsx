"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ExportButton, AddButton } from "./ActionButtons";
import { ApiClientError } from "@/lib/api-client";
import {
  listStok,
  getStokHistory,
  updateStok,
  bulkUpdateStok,
} from "@/lib/stok-api";
import type { StokDTO, StokHistoryDTO, StokSatuanDTO } from "@/lib/stok-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, Package,
  Upload, Download, Edit, ChevronDown, AlertTriangle, FileSpreadsheet, HelpCircle, Plus, Trash2
} from "lucide-react";

type SortField = "sku" | "nama" | "kategori" | "totalQty" | "totalBuffer";
type SortDirection = "asc" | "desc" | null;

export default function Stok() {
  // Data dari API — bukan dummy.
  const [products, setProducts] = useState<StokDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  // Debounced copy — server-side search fires at most every 300ms while typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Modals
  const [editingStock, setEditingStock] = useState<StokDTO | null>(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await listStok({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection === "desc" ? "desc" : "asc",
      });
      setProducts(result.items);
      setPagination((prev) => ({
        ...prev,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data stok.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortField, sortDirection, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (field: SortField) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    return sortDirection === "asc" ?
      <ArrowUp className="w-4 h-4" /> :
      <ArrowDown className="w-4 h-4" />;
  };

  const handleUpdateStock = async (
    sku: string,
    satuan: Array<{ satuanKode: string; qty: number; bufferStok: number; batasBawah: number | null }>,
    note: string,
  ) => {
    try {
      await updateStok(sku, {
        catatan: note || undefined,
        satuan: satuan.map((s) => ({
          satuanKode: s.satuanKode,
          qty: s.qty,
          bufferStok: s.bufferStok,
          batasBawah: s.batasBawah,
        })),
      });
      await load();
    } catch (err) {
      throw err instanceof ApiClientError ? err : new ApiClientError(0, "INTERNAL_ERROR", "Gagal memperbarui stok.");
    }
  };

  const handleDownloadReport = async () => {
    try {
      // Ambil semua data (sampai 100 per halaman = batas maks API) untuk laporan.
      const pages = Math.max(1, pagination.totalPages);
      const all: StokDTO[] = [];
      for (let page = 1; page <= pages; page++) {
        const res = await listStok({
          page,
          pageSize: 100,
          search: debouncedSearch || undefined,
        });
        all.push(...res.items);
        if (page >= res.pagination.totalPages) break;
      }

      // Detail sampai satuan: satu baris per satuan stok produk.
      const headers = [
        "SKU", "Produk", "Kategori", "Satuan", "Kode Item",
        "Stok", "Stok Cadangan", "Batas Bawah", "Status",
      ];
      const rows: string[][] = [];
      for (const p of all) {
        const satuanRows = p.satuan && p.satuan.length > 0 ? p.satuan : [null];
        for (const s of satuanRows) {
          rows.push([
            p.sku,
            p.nama,
            p.kategoriNama,
            s ? s.satuanNama : "",
            s ? s.kodeItem : "",
            s ? String(s.qty) : String(p.totalQty),
            s ? String(s.bufferStok) : String(p.totalBuffer),
            s && s.batasBawah !== null ? String(s.batasBawah) : "",
            p.status === "active" ? "Aktif" : "Tidak Aktif",
          ]);
        }
      }

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `laporan-stok-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengunduh laporan.");
    }
  };

  const startIndex = (pagination.page - 1) * pagination.pageSize;
  const totalPages = pagination.totalPages;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="stok" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Manajemen Stok</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola stok produk di toko Anda
              </p>
            </div>

            <div className="flex gap-3">
              <ExportButton
                onClick={handleDownloadReport}
                label="Export Data"
                icon={Download}
                title="Export seluruh data stok (CSV)"
              />
              <AddButton
                onClick={() => setShowBulkUploadModal(true)}
                label="Bulk Upload Stok"
              />
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari berdasarkan SKU atau nama produk..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto p-8">
          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {listError && (
              <div className="px-6 py-3" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {listError}</p>
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data stok...</p>
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("sku")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            SKU
                            {getSortIcon("sku")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("nama")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Nama Produk
                            {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("kategori")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Kategori
                            {getSortIcon("kategori")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleSort("totalQty")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity mx-auto"
                            style={{ color: '#000000' }}
                          >
                            Stok
                            {getSortIcon("totalQty")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleSort("totalBuffer")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity mx-auto"
                            style={{ color: '#000000' }}
                          >
                            Stok Cadangan
                            {getSortIcon("totalBuffer")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center">
                          <span style={{ color: '#000000' }}>Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product, index) => (
                        <tr
                          key={product.sku}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff'
                          }}
                        >
                          <td className="px-6 py-4">
                            <span style={{ color: '#1a0408', fontFamily: 'monospace' }}>
                              {product.sku}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span style={{ color: '#1a0408' }}>{product.nama}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span style={{ color: '#1a0408' }}>{product.kategoriNama}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              style={{
                                color: product.isLow ? '#e40b18' : '#1a0408',
                                fontWeight: product.isLow ? 600 : undefined
                              }}
                            >
                              {product.totalQty}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span style={{ color: '#1a0408' }}>
                              {product.totalBuffer}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingStock(product)}
                                className="px-3 py-2 rounded-lg border transition-all hover:opacity-90 flex items-center gap-2"
                                style={{
                                  borderColor: '#27b446',
                                  color: '#27b446'
                                }}
                              >
                                <Edit className="w-4 h-4" />
                                Edit Stok
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                    <div className="relative">
                      <select
                        value={pagination.pageSize}
                        onChange={(e) => {
                          setPagination((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }));
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
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + pagination.pageSize, pagination.total)} dari {pagination.total} produk
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={pagination.page === 1}
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
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPagination((prev) => ({ ...prev, page: pageNum }))}
                            className="w-10 h-10 rounded-lg transition-colors"
                            style={{
                              backgroundColor: pagination.page === pageNum ? '#27b446' : 'transparent',
                              color: pagination.page === pageNum ? 'white' : '#1a0408',
                              border: pagination.page === pageNum ? 'none' : '1px solid #e5e7eb'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                      disabled={pagination.page === totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      style={{ color: '#1a0408' }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Package className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Produk tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      Coba gunakan kata kunci pencarian yang berbeda
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {editingStock && (
        <EditStockModal
          product={editingStock}
          onClose={() => setEditingStock(null)}
          onSave={handleUpdateStock}
          onHistory={(sku) => getStokHistory(sku)}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadStockModal
          onClose={() => setShowBulkUploadModal(false)}
          onDone={() => void load()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Stock Modal
// ---------------------------------------------------------------------------

interface EditStockModalProps {
  product: StokDTO;
  onClose: () => void;
  onSave: (
    sku: string,
    satuan: Array<{ satuanKode: string; qty: number; bufferStok: number; batasBawah: number | null }>,
    note: string,
  ) => Promise<void>;
  onHistory: (sku: string) => Promise<StokHistoryDTO[]>;
}

function EditStockModal({ product, onClose, onSave, onHistory }: EditStockModalProps) {
  const [satuanStockInputs, setSatuanStockInputs] = useState(
    product.satuan.map((s) => ({
      satuanKode: s.satuanKode,
      qty: s.qty.toString(),
      bufferStok: s.bufferStok.toString(),
      batasBawah: s.batasBawah?.toString() || "",
    })),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<StokHistoryDTO[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const rows = await onHistory(product.sku);
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && history.length === 0) void loadHistory();
  };

  const handleSubmit = async () => {
    // Validate all inputs
    for (let i = 0; i < satuanStockInputs.length; i++) {
      const input = satuanStockInputs[i];
      const qtyNum = Number(input.qty);
      const bufferNum = Number(input.bufferStok);
      const lowerNum = input.batasBawah ? Number(input.batasBawah) : undefined;

      if (!input.qty.trim() || isNaN(qtyNum) || qtyNum < 0) {
        setError(`Stok untuk ${input.satuanKode} harus 0 atau lebih`);
        return;
      }
      if (input.bufferStok && (isNaN(bufferNum) || bufferNum < 0)) {
        setError(`Stok Cadangan untuk ${input.satuanKode} harus 0 atau lebih`);
        return;
      }
      if (input.batasBawah && (isNaN(lowerNum!) || lowerNum! < 0)) {
        setError(`Batas Bawah untuk ${input.satuanKode} harus 0 atau lebih`);
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      await onSave(
        product.sku,
        satuanStockInputs.map((input) => ({
          satuanKode: input.satuanKode,
          qty: Number(input.qty),
          bufferStok: Number(input.bufferStok),
          batasBawah: input.batasBawah ? Number(input.batasBawah) : null,
        })),
        note,
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan perubahan stok.");
      setSaving(false);
    }
  };

  const updateSatuanInput = (index: number, field: 'qty' | 'bufferStok' | 'batasBawah', value: string) => {
    const updated = [...satuanStockInputs];
    updated[index] = { ...updated[index], [field]: value };
    setSatuanStockInputs(updated);
    setError("");
  };

  const getSatuanNama = (satuanKode: string) => {
    const satuan = product.satuan.find((s) => s.satuanKode === satuanKode);
    return satuan ? satuan.satuanNama : satuanKode;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: '#000000' }}>Edit Stok</h2>
            <p className="text-sm mt-1" style={{ color: '#27b446' }}>
              {product.sku}
            </p>
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4">
            <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Produk</p>
            <p style={{ color: '#000000' }}>{product.nama}</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 style={{ color: '#000000' }}>Stok per Satuan</h3>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#1a0408', opacity: 0.4 }} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-10 whitespace-normal">
                  <p>Kelola stok untuk setiap satuan. Batas bawah digunakan untuk menandai stok yang perlu di-restock (akan berwarna merah di tabel).</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {satuanStockInputs.map((input, index) => {
                const originalStock = product.satuan.find((s) => s.satuanKode === input.satuanKode);
                const originalStockValue = originalStock ? originalStock.qty : 0;
                const newStockNum = Number(input.qty);
                const difference = !isNaN(newStockNum) ? newStockNum - originalStockValue : 0;
                const isNewSatuan = !originalStock;

                return (
                  <div key={input.satuanKode} className="p-4 rounded-lg border-2 border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 style={{ color: '#27b446' }}>{getSatuanNama(input.satuanKode)}</h4>
                        <div className="px-3 py-1 rounded-lg border" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                          {isNewSatuan ? 'Satuan Baru' : `Saat ini: ${originalStockValue} unit`}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                          Batas Bawah (Opsional)
                        </label>
                        <input
                          type="number"
                          value={input.batasBawah}
                          onChange={(e) => updateSatuanInput(index, 'batasBawah', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 bg-white"
                          style={{
                            color: '#1a0408',
                            '--tw-ring-color': '#27b446'
                          } as any}
                        />
                      </div>

                      <div>
                        <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                          Stok Saat Ini <span style={{ color: '#e40b18' }}>*</span>
                        </label>
                        <input
                          type="number"
                          value={input.qty}
                          onChange={(e) => updateSatuanInput(index, 'qty', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 bg-white"
                          style={{
                            color: '#1a0408',
                            '--tw-ring-color': '#27b446'
                          } as any}
                        />
                        {!error && input.qty && !isNaN(Number(input.qty)) && difference !== 0 && (
                          <p className="text-xs mt-1" style={{ color: difference >= 0 ? '#27b446' : '#e40b18' }}>
                            {difference > 0 ? `+${difference}` : difference} dari stok saat ini
                          </p>
                        )}
                      </div>

                      <div className="col-span-2">
                        <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                          Stok Cadangan (Buffer)
                        </label>
                        <input
                          type="number"
                          value={input.bufferStok}
                          onChange={(e) => updateSatuanInput(index, 'bufferStok', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 bg-white"
                          style={{
                            color: '#1a0408',
                            '--tw-ring-color': '#27b446'
                          } as any}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(228, 11, 24, 0.1)', borderLeft: '4px solid #e40b18' }}>
              <p className="text-sm" style={{ color: '#e40b18' }}>{error}</p>
            </div>
          )}

          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
              Catatan (Opsional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masukkan catatan perubahan stok..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
          </div>

          {/* Riwayat Stok */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <button
              onClick={handleToggleHistory}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: '#27b446' }}
            >
              {showHistory ? '▾' : '▸'} Riwayat Stok
            </button>
            {showHistory && (
              <div className="mt-3">
                {historyLoading ? (
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Memuat riwayat...</p>
                ) : history.length === 0 ? (
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Belum ada riwayat mutasi stok.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead style={{ backgroundColor: '#fcfaff' }}>
                        <tr>
                          <th className="px-4 py-2 text-left" style={{ color: '#000000' }}>Tanggal</th>
                          <th className="px-4 py-2 text-left" style={{ color: '#000000' }}>Satuan</th>
                          <th className="px-4 py-2 text-center" style={{ color: '#000000' }}>Tipe</th>
                          <th className="px-4 py-2 text-right" style={{ color: '#000000' }}>Perubahan</th>
                          <th className="px-4 py-2 text-right" style={{ color: '#000000' }}>Stok</th>
                          <th className="px-4 py-2 text-left" style={{ color: '#000000' }}>Catatan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id} className="border-t border-gray-100">
                            <td className="px-4 py-2" style={{ color: '#1a0408', whiteSpace: 'nowrap' }}>
                              {new Date(h.createdAt).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-2" style={{ color: '#1a0408' }}>{h.satuanNama}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs" style={{
                                backgroundColor: h.tipe === 'in' ? '#dcfce7' : h.tipe === 'out' ? '#fee2e2' : '#fef9c3',
                                color: h.tipe === 'in' ? '#166534' : h.tipe === 'out' ? '#991b1b' : '#854d0e'
                              }}>
                                {h.tipe === 'in' ? 'Masuk' : h.tipe === 'out' ? 'Keluar' : 'Adjust'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right" style={{
                              color: h.qtyDelta >= 0 ? '#166534' : '#991b1b',
                              fontFamily: 'monospace'
                            }}>
                              {h.qtyDelta > 0 ? `+${h.qtyDelta}` : h.qtyDelta}
                            </td>
                            <td className="px-4 py-2 text-right" style={{ color: '#1a0408', fontFamily: 'monospace' }}>
                              {h.qtySebelum} → {h.qtySesudah}
                            </td>
                            <td className="px-4 py-2" style={{ color: '#1a0408', opacity: 0.7 }}>{h.catatan || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
            style={{
              borderColor: '#e40b18',
              color: '#e40b18'
            }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#27b446' }}
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Upload Stock Modal
// ---------------------------------------------------------------------------

interface BulkUploadStockModalProps {
  onClose: () => void;
  onDone: () => void;
}

function BulkUploadStockModal({ onClose, onDone }: BulkUploadStockModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failures: { row: number; sku: string; message: string }[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");
    setResult(null);

    if (!file) return;

    if (!file.name.match(/\.(csv)$/i)) {
      setError("Format file harus CSV");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }

    setUploadedFile(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ["SKU", "Satuan", "Stok Baru", "Catatan"];
    const example = ["ind001", "Dus", "150", "Restok dari supplier"];

    const csvContent = [headers.join(","), example.join(",")].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template-bulk-upload-stok.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!uploadedFile) {
      setError("Pilih file terlebih dahulu");
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const text = await uploadedFile.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setError("File kosong atau tidak memiliki baris data.");
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idxSku = header.indexOf("sku");
      const idxSatuan = header.indexOf("satuan");
      const idxQty = header.indexOf("stok baru");
      const idxCatatan = header.indexOf("catatan");
      if (idxSku < 0 || idxQty < 0) {
        setError("Kolom wajib 'SKU' dan 'Stok Baru' tidak ditemukan di baris header.");
        return;
      }

      const payloadRows: Array<{ sku: string; qty: number; satuan?: string; catatan?: string }> = [];
      const failures: { row: number; sku: string; message: string }[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const sku = (idxSku >= 0 ? (r[idxSku] ?? "").trim() : "");
        const qty = Number(idxQty >= 0 ? (r[idxQty] ?? "").trim() : "");
        if (!sku) {
          failures.push({ row: i + 1, sku: "", message: "SKU wajib diisi." });
          continue;
        }
        if (!Number.isInteger(qty) || qty < 0) {
          failures.push({ row: i + 1, sku, message: "Stok baru wajib angka bulat >= 0." });
          continue;
        }
        payloadRows.push({
          sku,
          qty,
          satuan: idxSatuan >= 0 ? (r[idxSatuan] ?? "").trim() || undefined : undefined,
          catatan: idxCatatan >= 0 ? (r[idxCatatan] ?? "").trim() || undefined : undefined,
        });
      }

      const res = await bulkUpdateStok({ rows: payloadRows });
      setResult({ success: res.success, failures: [...failures, ...res.failures] });
      if (res.failures.length === 0 && failures.length === 0) {
        onDone();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal memproses file.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Bulk Upload Stok</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Upload file CSV untuk update stok secara massal
            </p>
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
        <div className="px-6 py-6">
          {/* Download Template */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#27b446' }} />
              <div className="flex-1">
                <p className="mb-1" style={{ color: '#000000' }}>Unduh Template</p>
                <p className="text-sm mb-3" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Gunakan template ini sebagai panduan format file upload
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 rounded-lg border transition-all hover:opacity-90 text-sm"
                  style={{
                    borderColor: '#27b446',
                    color: '#27b446'
                  }}
                >
                  Unduh Template CSV
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
              Upload File <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3"
              style={{
                borderColor: uploadedFile ? '#27b446' : '#e5e7eb',
                backgroundColor: uploadedFile ? 'rgba(39, 180, 70, 0.05)' : 'transparent',
                color: uploadedFile ? '#27b446' : '#1a0408'
              }}
            >
              <Upload className="w-8 h-8" />
              <div className="text-center">
                {uploadedFile ? (
                  <>
                    <p className="mb-1" style={{ color: '#27b446' }}>✓ {uploadedFile.name}</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Klik untuk mengganti file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-1">Klik untuk upload file</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Format: CSV (Max 5MB)
                    </p>
                  </>
                )}
              </div>
            </button>
            {error && (
              <p className="text-sm mt-2" style={{ color: '#e40b18' }}>{error}</p>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(39,180,70,0.08)', border: '1px solid rgba(39,180,70,0.25)' }}>
              <p style={{ color: '#166534', fontWeight: 600 }}>
                Berhasil: {result.success} baris
              </p>
              {result.failures.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {result.failures.map((f, i) => (
                    <p key={i} className="text-sm mt-1" style={{ color: '#991b1b' }}>
                      Baris {f.row}{f.sku ? ` (${f.sku})` : ""}: {f.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
            <p className="text-sm mb-2" style={{ color: '#000000' }}>Format File:</p>
            <ul className="text-sm space-y-1" style={{ color: '#1a0408', opacity: 0.8 }}>
              <li>• Kolom 1: SKU (wajib)</li>
              <li>• Kolom 2: Satuan (opsional — nama/kode satuan; kosong = satuan pertama)</li>
              <li>• Kolom 3: Stok Baru (wajib, angka)</li>
              <li>• Kolom 4: Catatan (opsional)</li>
            </ul>
            <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
              Hanya update stok untuk produk yang sudah ada. SKU yang belum ada akan ditolak — buat produknya dulu lewat menu Produk.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
            style={{
              borderColor: '#e40b18',
              color: '#e40b18'
            }}
          >
            Batal
          </button>
          <button
            onClick={handleUpload}
            disabled={!uploadedFile || processing}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#27b446' }}
          >
            {processing ? "Memproses..." : "Upload & Proses"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Minimal CSV parser — handles double-quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}
