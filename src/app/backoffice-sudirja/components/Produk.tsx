"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkUpsertProduk,
  createProduk,
  deleteProduk,
  formatRupiah,
  listProduk,
  renderBarcode,
  updateProduk,
  updateProdukStatus,
} from "@/lib/product-api";
import { useReferenceLists } from "./useReferenceLists";
import type {
  CreateProdukInput,
  KategoriDTO,
  MerkDTO,
  ProdukDTO,
  ProdukSatuanDTO,
  SatuanDTO,
} from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, Package, Plus,
  Upload, Edit, CheckSquare, Square,
  ChevronDown, Trash2, AlertTriangle, Image as ImageIcon, Barcode, Printer, Download
} from "lucide-react";

type SortField = "sku" | "nama" | "status";
type SortDirection = "asc" | "desc" | null;

// ---------------------------------------------------------------------------
// Satuan row editor shared by the Add & Edit modals.
// ---------------------------------------------------------------------------

interface SatuanRow {
  satuanKode: string;
  kodeItem: string;
  harga: number;
}

function SatuanRowEditor({
  rows,
  onChange,
  satuanList,
  kodePrefix,
}: {
  rows: SatuanRow[];
  onChange: (rows: SatuanRow[]) => void;
  satuanList: SatuanDTO[];
  kodePrefix: string;
}) {
  const [newSatuanKode, setNewSatuanKode] = useState("");
  const [newKodeItem, setNewKodeItem] = useState("");
  const [newHarga, setNewHarga] = useState("");
  const [error, setError] = useState("");

  const satuanNama = (kode: string) => satuanList.find((s) => s.kode === kode)?.nama ?? kode;

  const handleSatuanSelect = (kode: string) => {
    setNewSatuanKode(kode);
    // Auto-suggest a barcode identity based on the product SKU + satuan suffix.
    if (!newKodeItem.trim() && kodePrefix.trim()) {
      const suffix = kode.includes("-") ? kode.split("-")[1] : kode;
      setNewKodeItem(`${kodePrefix.trim()}-${suffix}`);
    }
  };

  const handleAdd = () => {
    setError("");
    if (!newSatuanKode) {
      setError("Pilih satuan terlebih dahulu");
      return;
    }
    if (!newKodeItem.trim()) {
      setError("Kode item wajib diisi (identitas barcode)");
      return;
    }
    const harga = Number(newHarga);
    if (!newHarga || !Number.isFinite(harga) || harga <= 0) {
      setError("Harga harus lebih dari 0");
      return;
    }
    if (rows.some((r) => r.satuanKode === newSatuanKode)) {
      setError("Satuan ini sudah ditambahkan");
      return;
    }
    onChange([...rows, { satuanKode: newSatuanKode, kodeItem: newKodeItem.trim(), harga }]);
    setNewSatuanKode("");
    setNewKodeItem("");
    setNewHarga("");
  };

  const updateRow = (index: number, patch: Partial<SatuanRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={row.satuanKode} className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: '#000000' }}>{satuanNama(row.satuanKode)}</span>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                  style={{ color: '#e40b18' }}
                  title="Hapus satuan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Kode Item (Barcode)
                  </label>
                  <input
                    type="text"
                    value={row.kodeItem}
                    onChange={(e) => updateRow(index, { kodeItem: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                    style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Harga (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={row.harga || ""}
                    onChange={(e) => updateRow(index, { harga: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                    style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="p-4 rounded-lg border border-dashed" style={{ borderColor: 'rgba(39, 180, 70, 0.5)' }}>
        <p className="text-xs mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>
          Tambah satuan dengan harga dan kode item (dipakai sebagai barcode)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <select
            value={newSatuanKode}
            onChange={(e) => handleSatuanSelect(e.target.value)}
            className="w-full pl-3 pr-8 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
            style={{
              color: '#1a0408',
              '--tw-ring-color': '#27b446',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1rem'
            } as any}
          >
            <option value="">Pilih Satuan</option>
            {satuanList.map((s) => (
              <option key={s.kode} value={s.kode}>{s.nama}</option>
            ))}
          </select>
          <input
            type="text"
            value={newKodeItem}
            onChange={(e) => setNewKodeItem(e.target.value)}
            placeholder="Kode item"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
            style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
          />
          <input
            type="number"
            min={0}
            value={newHarga}
            onChange={(e) => setNewHarga(e.target.value)}
            placeholder="Harga"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
            style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
          />
        </div>
        {error && (
          <p className="text-sm mt-2" style={{ color: '#e40b18' }}>{error}</p>
        )}
        <button
          type="button"
          onClick={handleAdd}
          className="mt-3 px-4 py-2 rounded-lg text-sm text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#27b446' }}
        >
          + Tambah Satuan
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Produk (Daftar Produk) — data dari API, bukan dummy.
// ---------------------------------------------------------------------------

export default function Produk() {
  const [products, setProducts] = useState<ProdukDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Debounced copy — server-side search fires at most every 300ms while typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { satuanList, merkList, kategoriList } = useReferenceLists();

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<ProdukDTO | null>(null);
  const [showAddProductMenu, setShowAddProductMenu] = useState(false);
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProdukDTO | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProdukDTO | null>(null);
  const [printingProduct, setPrintingProduct] = useState<ProdukDTO | null>(null);

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
      const result = await listProduk({
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
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data produk.");
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
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = searchQuery !== "";

  // Checkbox helpers — selection keyed by SKU (unique).
  const handleSelectAll = () => {
    if (selectedIds.length === products.length && products.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.sku));
    }
  };

  const handleSelectOne = (sku: string) => {
    if (selectedIds.includes(sku)) {
      setSelectedIds(selectedIds.filter((id) => id !== sku));
    } else {
      setSelectedIds([...selectedIds, sku]);
    }
  };

  const handleBulkStatusChange = async (status: "active" | "inactive") => {
    try {
      // Independent updates — run in parallel.
      await Promise.all(selectedIds.map((sku) => updateProdukStatus(sku, status)));
      setSelectedIds([]);
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengubah status produk.");
    }
  };

  const handleStatusChange = async (sku: string, status: "active" | "inactive") => {
    try {
      await updateProdukStatus(sku, status);
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengubah status produk.");
    }
  };

  const handleDeleteProduct = async (sku: string) => {
    try {
      await deleteProduk(sku);
      setDeletingProduct(null);
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal menghapus produk.");
    }
  };

  // Export seluruh data produk (semua halaman) ke CSV — detail per satuan.
  const handleExportProducts = async () => {
    try {
      const all: ProdukDTO[] = [];
      let page = 1;
      for (;;) {
        const res = await listProduk({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...res.items);
        if (page >= res.pagination.totalPages) break;
        page++;
      }

      const headers = [
        "SKU", "Nama Produk", "Merk", "Kategori", "Status",
        "Deskripsi", "URL Gambar",
        "Satuan", "Kode Item", "Harga", "Jumlah Unit",
      ];
      const rows: string[][] = [];
      for (const p of all) {
        const base = [
          p.sku,
          p.nama,
          p.merkNama || "",
          p.kategoriNama || "",
          p.status === "active" ? "Aktif" : "Tidak Aktif",
          p.deskripsi || "",
          p.gambarUrl || "",
        ];
        // Satu baris per satuan agar detail sampai level satuan produk.
        const satuanRows = p.satuan && p.satuan.length > 0 ? p.satuan : [null];
        for (const s of satuanRows) {
          rows.push([
            ...base,
            s ? s.satuanNama : "",
            s ? s.kodeItem : "",
            s ? String(s.harga) : "",
            s ? String(s.jumlahUnit) : "",
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
      link.setAttribute("download", `data-produk-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data produk.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="daftar-produk" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Produk</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data produk yang tersedia di toko
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Export Data Produk */}
              <button
                onClick={() => void handleExportProducts()}
                className="px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90 flex items-center gap-2"
                style={{
                  borderColor: '#27b446',
                  color: '#27b446',
                  backgroundColor: 'rgba(39, 180, 70, 0.05)'
                }}
                title="Export seluruh data produk (CSV)"
              >
                <Download className="w-5 h-5" />
                Export Data Produk
              </button>

              {/* Tambah Produk Button with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddProductMenu(!showAddProductMenu)}
                  className="px-6 py-3 rounded-lg text-white flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  <Plus className="w-5 h-5" />
                  Tambah Produk
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showAddProductMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAddProductMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                      <button
                        onClick={() => {
                          setShowAddProductMenu(false);
                          setShowAddManualModal(true);
                        }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}
                      >
                        <Edit className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div>
                          <p style={{ color: '#000000' }}>Manual</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddProductMenu(false);
                          setShowBulkUploadModal(true);
                        }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200"
                        style={{ color: '#1a0408' }}
                      >
                        <Upload className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div>
                          <p style={{ color: '#000000' }}>Bulk Upload</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>CSV atau XLSX</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section & Bulk Actions */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Search by SKU or Name */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari SKU atau Nama Produk..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>
            </div>

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

          {/* Bulk Actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 mb-4" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <span style={{ color: '#1a0408' }}>
                {selectedIds.length} produk dipilih
              </span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => handleBulkStatusChange("active")}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  Aktifkan
                </button>
                <button
                  onClick={() => handleBulkStatusChange("inactive")}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#e40b18' }}
                >
                  Non-aktifkan
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: '#1a0408',
                    color: '#1a0408'
                  }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Results count */}
          <div>
            <p style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {products.length} dari {pagination.total} produk
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
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data produk...</p>
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <tr>
                        <th className="px-6 py-4">
                          <button
                            onClick={handleSelectAll}
                            className="flex items-center justify-center"
                            style={{ color: '#27b446' }}
                          >
                            {selectedIds.length === products.length && products.length > 0 ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>
                          Gambar
                        </th>
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
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>
                          Merk
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>
                          Kategori
                        </th>
                        <th className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleSort("status")}
                            className="flex items-center gap-2 mx-auto hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Status
                            {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr
                          key={product.sku}
                          className="border-b border-gray-200 transition-colors hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOne(product.sku);
                              }}
                              className="flex items-center justify-center"
                              style={{ color: '#27b446' }}
                            >
                              {selectedIds.includes(product.sku) ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                              {product.gambarUrl ? (
                                <img
                                  src={product.gambarUrl}
                                  alt={product.nama}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-6 h-6" style="color: #1a0408; opacity: 0.3" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"></path></svg></div>';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-6 h-6" style={{ color: '#1a0408', opacity: 0.3 }} />
                              )}
                            </div>
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            style={{ color: '#27b446' }}
                            onClick={() => setSelectedProduct(product)}
                          >
                            {product.sku}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            style={{ color: '#1a0408' }}
                            onClick={() => setSelectedProduct(product)}
                          >
                            {product.nama}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            style={{ color: '#1a0408' }}
                            onClick={() => setSelectedProduct(product)}
                          >
                            {product.merkNama || '-'}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            style={{ color: '#1a0408' }}
                            onClick={() => setSelectedProduct(product)}
                          >
                            {product.kategoriNama || '-'}
                          </td>
                          <td
                            className="px-6 py-4 text-center cursor-pointer"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <span className="px-3 py-1 rounded-full text-sm" style={{
                              backgroundColor: product.status === 'active' ? '#dcfce7' : '#fee2e2',
                              color: product.status === 'active' ? '#166534' : '#991b1b'
                            }}>
                              {product.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrintingProduct(product);
                                }}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#1a0408' }}
                                title="Cetak Barcode"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProduct(product);
                                }}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#27b446' }}
                                title="Edit Produk"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingProduct(product);
                                }}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#e40b18' }}
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-4 h-4" />
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
                      Menampilkan {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} produk
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
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
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
                      onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                      disabled={pagination.page === pagination.totalPages}
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
                      {hasActiveFilters ? "Coba gunakan kata kunci pencarian yang berbeda" : "Belum ada data produk"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {showAddManualModal && (
        <AddProductManualModal
          onClose={() => setShowAddManualModal(false)}
          onAdd={() => void load()}
          satuanList={satuanList}
          merkList={merkList}
          kategoriList={kategoriList}
        />
      )}

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={() => void load()}
          satuanList={satuanList}
          merkList={merkList}
          kategoriList={kategoriList}
        />
      )}

      {deletingProduct && (
        <DeleteConfirmModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => handleDeleteProduct(deletingProduct.sku)}
        />
      )}

      {printingProduct && (
        <BarcodePrintModal
          product={printingProduct}
          onClose={() => setPrintingProduct(null)}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadModal
          onClose={() => setShowBulkUploadModal(false)}
          onDone={() => void load()}
          satuanList={satuanList}
          merkList={merkList}
          kategoriList={kategoriList}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Detail Modal
// ---------------------------------------------------------------------------

interface ProductDetailModalProps {
  product: ProdukDTO;
  onClose: () => void;
  onStatusChange: (sku: string, newStatus: "active" | "inactive") => void;
}

function ProductDetailModal({ product, onClose, onStatusChange }: ProductDetailModalProps) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [tempStatus, setTempStatus] = useState(product.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");

  const handleSaveStatus = async () => {
    setSavingStatus(true);
    setStatusError("");
    try {
      await onStatusChange(product.sku, tempStatus);
      setIsEditingStatus(false);
    } catch (err) {
      setStatusError(err instanceof ApiClientError ? err.message : "Gagal mengubah status.");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Produk</h2>
            <p style={{ color: '#27b446' }}>{product.sku}</p>
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
          {/* Gambar Produk */}
          <div className="mb-6 flex justify-center">
            <div className="w-64 h-64 rounded-2xl overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
              {product.gambarUrl ? (
                <img
                  src={product.gambarUrl}
                  alt={product.nama}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="flex flex-col items-center justify-center gap-3"><svg class="w-24 h-24" style="color: #1a0408; opacity: 0.3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg><p style="color: #1a0408; opacity: 0.5">Gambar tidak tersedia</p></div>';
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <ImageIcon className="w-24 h-24" style={{ color: '#1a0408', opacity: 0.2 }} />
                  <p style={{ color: '#1a0408', opacity: 0.5 }}>Gambar tidak tersedia</p>
                </div>
              )}
            </div>
          </div>

          {/* Info Detail */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>SKU</p>
                  <p style={{ color: '#27b446' }}>{product.sku}</p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Merk</p>
                  <p style={{ color: '#000000' }}>{product.merkNama || '-'}</p>
                </div>
                <div>
                  <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Kategori</p>
                  <p style={{ color: '#000000' }}>{product.kategoriNama || '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Produk</p>
              <p className="text-xl" style={{ color: '#000000' }}>{product.nama}</p>
            </div>

            <div>
              <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>Deskripsi</p>
              <p style={{ color: '#1a0408' }}>{product.deskripsi || '-'}</p>
            </div>

            <div>
              <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>Informasi per Satuan</p>
              <div className="space-y-2">
                {product.satuan && product.satuan.length > 0 ? (
                  product.satuan.map((s: ProdukSatuanDTO) => (
                    <div key={s.satuanKode} className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-lg" style={{ color: '#000000' }}>{s.satuanNama}</span>
                        <span className="text-lg font-medium" style={{ color: '#27b446' }}>
                          {formatRupiah(s.harga)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span style={{ color: '#1a0408', opacity: 0.6 }}>Kode Item: </span>
                          <span style={{ color: '#1a0408', fontWeight: 500, fontFamily: 'monospace' }}>{s.kodeItem}</span>
                        </div>
                        <div>
                          <span style={{ color: '#1a0408', opacity: 0.6 }}>Jumlah Unit: </span>
                          <span style={{ color: '#1a0408' }}>{s.jumlahUnit}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                    <p className="text-sm text-center" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Belum ada satuan yang dikonfigurasi.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>Status</p>
              {isEditingStatus ? (
                <div className="flex items-center gap-3">
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value as "active" | "inactive")}
                    className="pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                    style={{
                      color: '#1a0408',
                      '--tw-ring-color': '#27b446',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      backgroundSize: '1rem'
                    } as any}
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Tidak Aktif</option>
                  </select>
                  <button
                    onClick={handleSaveStatus}
                    disabled={savingStatus}
                    className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: '#27b446' }}
                  >
                    {savingStatus ? "Menyimpan..." : "Simpan"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingStatus(false);
                      setTempStatus(product.status);
                      setStatusError("");
                    }}
                    className="px-4 py-2 rounded-lg border transition-colors"
                    style={{
                      borderColor: '#e40b18',
                      color: '#e40b18'
                    }}
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="px-4 py-2 rounded-full inline-block" style={{
                    backgroundColor: product.status === 'active' ? '#dcfce7' : '#fee2e2',
                    color: product.status === 'active' ? '#166534' : '#991b1b'
                  }}>
                    {product.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                  <button
                    onClick={() => setIsEditingStatus(true)}
                    className="px-4 py-2 rounded-lg border-2 transition-colors"
                    style={{
                      borderColor: '#27b446',
                      color: '#27b446'
                    }}
                  >
                    Ubah Status
                  </button>
                </div>
              )}
              {statusError && (
                <p className="text-sm mt-2" style={{ color: '#e40b18' }}>{statusError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg border transition-colors"
            style={{
              borderColor: '#e40b18',
              color: '#e40b18'
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Product Manual Modal
// ---------------------------------------------------------------------------

interface AddProductManualModalProps {
  onClose: () => void;
  onAdd: () => void;
  satuanList: SatuanDTO[];
  merkList: MerkDTO[];
  kategoriList: KategoriDTO[];
}

function AddProductManualModal({ onClose, onAdd, satuanList, merkList, kategoriList }: AddProductManualModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    merkKode: "",
    kategoriKode: "",
    status: "active" as "active" | "inactive",
    image: "",
    description: ""
  });

  const [satuanRows, setSatuanRows] = useState<SatuanRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrors((prev) => ({ ...prev, image: "" }));

    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: "Format gambar harus JPG, JPEG, PNG, atau WebP" }));
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: "Ukuran gambar maksimal 2MB" }));
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku.trim()) newErrors.sku = "SKU harus diisi";
    if (!formData.name.trim()) newErrors.name = "Nama produk harus diisi";
    if (!formData.merkKode) newErrors.merk = "Merk harus dipilih";
    if (!formData.kategoriKode) newErrors.kategori = "Kategori harus dipilih";
    if (satuanRows.length === 0) newErrors.satuan = "Tambahkan minimal 1 satuan dengan harga dan kode item";
    if (!formData.description.trim()) newErrors.description = "Deskripsi harus diisi";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      // Gambar dikirim sebagai data URL (JPEG/PNG/WebP). Server mengonversinya
      // otomatis ke WebP sebelum disimpan (lihat src/lib/image.ts).
      await createProduk({
        sku: formData.sku.trim(),
        nama: formData.name.trim(),
        deskripsi: formData.description.trim(),
        gambarUrl: imagePreview || "",
        kategoriKode: formData.kategoriKode,
        merkKode: formData.merkKode,
        status: formData.status,
        satuan: satuanRows.map((r) => ({ satuanKode: r.satuanKode, kodeItem: r.kodeItem, harga: r.harga })),
      });
      onAdd();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const details = err.details ?? {};
        setErrors({
          ...details,
          satuan: details.satuan ?? (satuanRows.length === 0 ? "Tambahkan minimal 1 satuan" : undefined),
          _server: err.message,
        });
      } else {
        setErrors({ _server: "Gagal menyimpan produk." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Tambah Produk Manual</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Lengkapi semua informasi produk
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
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* SKU */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                SKU <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Masukkan SKU produk"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.sku && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.sku}</p>
              )}
            </div>

            {/* Kategori */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Kategori <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.kategoriKode}
                onChange={(e) => setFormData({ ...formData, kategoriKode: e.target.value })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="">Pilih Kategori</option>
                {kategoriList.map((kategori) => (
                  <option key={kategori.kode} value={kategori.kode}>{kategori.nama}</option>
                ))}
              </select>
              {errors.kategori && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.kategori}</p>
              )}
            </div>

            {/* Nama Produk (full width) */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Nama Produk <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama produk"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.name && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.name}</p>
              )}
            </div>

            {/* Merk */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Merk <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.merkKode}
                onChange={(e) => setFormData({ ...formData, merkKode: e.target.value })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="">Pilih Merk</option>
                {merkList.map((merk) => (
                  <option key={merk.kode} value={merk.kode}>{merk.nama}</option>
                ))}
              </select>
              {errors.merk && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.merk}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Status <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>

            {/* Upload Gambar */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Gambar Produk
              </label>
              <div className="flex items-start gap-4">
                {imagePreview && (
                  <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2"
                    style={{
                      borderColor: '#27b446',
                      color: '#27b446'
                    }}
                  >
                    <ImageIcon className="w-5 h-5" />
                    {imageFile ? 'Ganti Gambar' : 'Upload Gambar'}
                  </button>
                  <p className="text-xs mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Format: JPG, JPEG, PNG, WebP (Max 2MB) — akan dikonversi otomatis ke WebP saat disimpan
                  </p>
                  {imageFile && (
                    <p className="text-sm mt-1" style={{ color: '#27b446' }}>
                      ✓ {imageFile.name}
                    </p>
                  )}
                  {errors.image && (
                    <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.image}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Informasi per Satuan */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Informasi per Satuan <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <SatuanRowEditor
                rows={satuanRows}
                onChange={setSatuanRows}
                satuanList={satuanList}
                kodePrefix={formData.sku}
              />
              {errors.satuan && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.satuan}</p>
              )}
            </div>

            {/* Deskripsi */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Deskripsi <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Masukkan deskripsi produk"
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.description && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.description}</p>
              )}
            </div>
          </div>

          {errors._server && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {errors._server}</p>
            </div>
          )}
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
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#27b446' }}
          >
            {saving ? "Menyimpan..." : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Product Modal
// ---------------------------------------------------------------------------

interface EditProductModalProps {
  product: ProdukDTO;
  onClose: () => void;
  onSave: () => void;
  satuanList: SatuanDTO[];
  merkList: MerkDTO[];
  kategoriList: KategoriDTO[];
}

function EditProductModal({ product, onClose, onSave, satuanList, merkList, kategoriList }: EditProductModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    sku: product.sku,
    name: product.nama,
    merkKode: product.merkKode,
    kategoriKode: product.kategoriKode,
    status: product.status,
    image: product.gambarUrl,
    description: product.deskripsi
  });

  const [satuanRows, setSatuanRows] = useState<SatuanRow[]>(
    (product.satuan ?? []).map((s) => ({ satuanKode: s.satuanKode, kodeItem: s.kodeItem, harga: Number(s.harga) })),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(product.gambarUrl);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setErrors((prev) => ({ ...prev, image: "" }));

    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: "Format gambar harus JPG, JPEG, PNG, atau WebP" }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: "Ukuran gambar maksimal 2MB" }));
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku.trim()) newErrors.sku = "SKU harus diisi";
    if (!formData.name.trim()) newErrors.name = "Nama produk harus diisi";
    if (!formData.merkKode) newErrors.merk = "Merk harus dipilih";
    if (!formData.kategoriKode) newErrors.kategori = "Kategori harus dipilih";
    if (satuanRows.length === 0) newErrors.satuan = "Tambahkan minimal 1 satuan dengan harga dan kode item";
    if (!formData.description.trim()) newErrors.description = "Deskripsi harus diisi";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await updateProduk(product.sku, {
        sku: formData.sku.trim(),
        nama: formData.name.trim(),
        deskripsi: formData.description.trim(),
        gambarUrl: imagePreview || "",
        kategoriKode: formData.kategoriKode,
        merkKode: formData.merkKode,
        status: formData.status,
        satuan: satuanRows.map((r) => ({ satuanKode: r.satuanKode, kodeItem: r.kodeItem, harga: r.harga })),
      });
      onSave();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        const details = err.details ?? {};
        setErrors({
          ...details,
          satuan: details.satuan ?? undefined,
          _server: err.message,
        });
      } else {
        setErrors({ _server: "Gagal menyimpan perubahan." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Edit Produk</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Perbarui informasi produk
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
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] px-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            {/* SKU */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                SKU <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Masukkan SKU produk"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.sku && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.sku}</p>
              )}
            </div>

            {/* Merk */}
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Merk <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.merkKode}
                onChange={(e) => setFormData({ ...formData, merkKode: e.target.value })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="">Pilih Merk</option>
                {merkList.map((merk) => (
                  <option key={merk.kode} value={merk.kode}>{merk.nama}</option>
                ))}
              </select>
              {errors.merk && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.merk}</p>
              )}
            </div>

            {/* Kategori */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Kategori <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.kategoriKode}
                onChange={(e) => setFormData({ ...formData, kategoriKode: e.target.value })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="">Pilih Kategori</option>
                {kategoriList.map((kategori) => (
                  <option key={kategori.kode} value={kategori.kode}>{kategori.nama}</option>
                ))}
              </select>
              {errors.kategori && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.kategori}</p>
              )}
            </div>

            {/* Nama Produk (full width) */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Nama Produk <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Masukkan nama produk"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.name && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.name}</p>
              )}
            </div>

            {/* Informasi per Satuan */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Informasi per Satuan <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <SatuanRowEditor
                rows={satuanRows}
                onChange={setSatuanRows}
                satuanList={satuanList}
                kodePrefix={formData.sku}
              />
              {errors.satuan && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.satuan}</p>
              )}
            </div>

            {/* Status */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Status <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 appearance-none bg-white"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a0408' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1rem'
                } as any}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Tidak Aktif</option>
              </select>
            </div>

            {/* Upload Gambar */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Gambar Produk
              </label>
              <div className="flex items-start gap-4">
                {imagePreview && (
                  <div className="w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2"
                    style={{
                      borderColor: '#27b446',
                      color: '#27b446'
                    }}
                  >
                    <ImageIcon className="w-5 h-5" />
                    Ganti Gambar
                  </button>
                  <p className="text-xs mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Format: JPG, JPEG, PNG, WebP (Max 2MB) — akan dikonversi otomatis ke WebP saat disimpan
                  </p>
                  {imageFile && (
                    <p className="text-sm mt-1" style={{ color: '#27b446' }}>
                      ✓ {imageFile.name}
                    </p>
                  )}
                  {errors.image && (
                    <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.image}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Deskripsi */}
            <div className="col-span-2">
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                Deskripsi <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Masukkan deskripsi produk"
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              {errors.description && (
                <p className="text-sm mt-1" style={{ color: '#e40b18' }}>{errors.description}</p>
              )}
            </div>
          </div>

          {errors._server && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {errors._server}</p>
            </div>
          )}
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
// Delete Confirm Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  product: ProdukDTO;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ product, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menghapus produk.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: '#e40b18' }} />
            </div>
            <div>
              <h2 style={{ color: '#000000' }}>Konfirmasi Hapus</h2>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Tindakan ini tidak dapat dibatalkan
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p style={{ color: '#1a0408' }}>
            Apakah Anda yakin ingin menghapus produk <span style={{ color: '#000000' }}>{product.nama}</span> ({product.sku})?
          </p>
          <p className="mt-2 text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
            Produk yang sudah dihapus tidak dapat dikembalikan lagi.
          </p>
          {error && (
            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
            style={{
              borderColor: '#1a0408',
              color: '#1a0408'
            }}
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#e40b18' }}
          >
            {deleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barcode Print Modal — label mengikuti contoh (nama produk di atas, barcode
// di tengah, kode item + satuan, harga besar di bawah).
// ---------------------------------------------------------------------------

function BarcodeLabelCard({
  nama,
  satuanNama,
  kodeItem,
  harga,
  barcodeUrl,
}: {
  nama: string;
  satuanNama: string;
  kodeItem: string;
  harga: number;
  barcodeUrl: string;
}) {
  return (
    <div
      className="barcode-label"
      style={{
        width: 220,
        border: '1px solid #000',
        borderRadius: 6,
        padding: '10px 10px 8px',
        textAlign: 'center',
        backgroundColor: '#fff',
        pageBreakInside: 'avoid'
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: '#000', lineHeight: 1.25, margin: '0 0 6px' }}>{nama}</p>
      <img src={barcodeUrl} alt={`Barcode ${kodeItem}`} style={{ width: '100%', height: 42, objectFit: 'contain', display: 'block' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#000', fontFamily: 'monospace' }}>{kodeItem}</span>
        <span style={{ fontSize: 9, fontWeight: 500, color: '#000' }}>{satuanNama}</span>
      </div>
      <p style={{ fontSize: 17, fontWeight: 800, color: '#000', margin: '2px 0 0' }}>{formatRupiah(harga)}</p>
    </div>
  );
}

function BarcodePrintModal({ product, onClose }: { product: ProdukDTO; onClose: () => void }) {
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // Independent barcode renders — run in parallel.
        const entries = await Promise.all(
          (product.satuan ?? []).map(async (s) => {
            const res = await renderBarcode(s.kodeItem, "CODE128", false);
            return [s.kodeItem, res.dataUrl] as const;
          }),
        );
        if (!cancelled) setBarcodes(Object.fromEntries(entries));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Gagal membuat barcode.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  const satuanNama = (kode: string) => product.satuan.find((s) => s.satuanKode === kode)?.satuanNama ?? kode;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Cetak Barcode</h2>
            <p style={{ color: '#27b446' }}>{product.sku} — {product.nama}</p>
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
          {loading ? (
            <div className="py-12 text-center">
              <p style={{ color: '#1a0408', opacity: 0.6 }}>Membuat barcode...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          ) : (product.satuan ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <p style={{ color: '#1a0408', opacity: 0.6 }}>Produk ini belum memiliki satuan/kode item.</p>
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: '#1a0408', opacity: 0.6 }}>
                Preview label — hanya area label yang akan tercetak.
              </p>
              <div className="barcode-print-area grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {(product.satuan ?? []).map((s) => (
                  <BarcodeLabelCard
                    key={s.satuanKode}
                    nama={product.nama}
                    satuanNama={satuanNama(s.satuanKode)}
                    kodeItem={s.kodeItem}
                    harga={Number(s.harga)}
                    barcodeUrl={barcodes[s.kodeItem] ?? ""}
                  />
                ))}
              </div>
            </>
          )}
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
            Tutup
          </button>
          <button
            onClick={() => window.print()}
            disabled={loading || !!error || (product.satuan ?? []).length === 0}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ backgroundColor: '#27b446' }}
          >
            <Printer className="w-4 h-4" />
            Cetak
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Upload Modal — parsing CSV nyata lalu membuat produk via API.
// ---------------------------------------------------------------------------

interface BulkUploadModalProps {
  onClose: () => void;
  onDone: () => void;
  satuanList: SatuanDTO[];
  merkList: MerkDTO[];
  kategoriList: KategoriDTO[];
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

function BulkUploadModal({ onClose, onDone, satuanList, merkList, kategoriList }: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failures: { row: number; sku: string; message: string }[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");
    setResult(null);

    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
      setError("Format file tidak valid. Gunakan CSV (XLSX belum didukung).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10MB");
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Pilih file terlebih dahulu");
      return;
    }
    if (!fileInputRef.current) return;

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const text = await selectedFile.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setError("File kosong atau tidak memiliki baris data.");
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        sku: header.indexOf("sku"),
        nama: header.indexOf("nama produk"),
        merk: header.indexOf("merk"),
        kategori: header.indexOf("kategori"),
        satuan: header.indexOf("satuan"),
        kodeItem: header.indexOf("kode item"),
        harga: header.indexOf("harga"),
        status: header.indexOf("status"),
        deskripsi: header.indexOf("deskripsi"),
        gambar: header.indexOf("url gambar"),
      };
      if (idx.sku < 0 || idx.nama < 0) {
        setError("Kolom wajib 'SKU' dan 'Nama Produk' tidak ditemukan di baris header.");
        return;
      }

      const failures: { row: number; sku: string; message: string }[] = [];
      let success = 0;
      // Kelompokkan baris per SKU agar produk multi-satuan (beberapa baris CSV
      // dengan SKU sama) dikirim sebagai SATU payload — konsisten dengan create
      // manual yang menerima array satuan.
      const grouped = new Map<
        string,
        CreateProdukInput & { _nama: string }
      >();

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const get = (col: number) => (col >= 0 ? (r[col] ?? "").trim() : "");

        const sku = get(idx.sku);
        const nama = get(idx.nama);
        if (!sku || !nama) {
          failures.push({ row: i + 1, sku, message: "SKU dan Nama Produk wajib diisi." });
          continue;
        }

        const merkNama = get(idx.merk);
        const kategoriNama = get(idx.kategori);
        const satuanNama = get(idx.satuan);
        const kodeItem = get(idx.kodeItem);
        const harga = Number(get(idx.harga));

        const merk = merkList.find((m) => m.nama.toLowerCase() === merkNama.toLowerCase());
        const kategori = kategoriList.find((k) => k.nama.toLowerCase() === kategoriNama.toLowerCase());
        const satuan = satuanList.find((s) => s.nama.toLowerCase() === satuanNama.toLowerCase());

        if (!merk || !kategori || !satuan) {
          failures.push({ row: i + 1, sku, message: "Merk, Kategori, atau Satuan tidak ditemukan di master data." });
          continue;
        }
        if (!kodeItem || !Number.isFinite(harga) || harga <= 0) {
          failures.push({ row: i + 1, sku, message: "Kode item dan harga (angka > 0) wajib diisi." });
          continue;
        }

        const statusRaw = get(idx.status).toLowerCase();
        const status = statusRaw === "inactive" || statusRaw === "tidak aktif" ? "inactive" : "active";

        const existing = grouped.get(sku);
        const satuanRow = { satuanKode: satuan.kode, kodeItem, harga };
        if (existing) {
          // Baris berikutnya utk SKU yang sama → tambahkan satuan ke produk tsb.
          if (existing.satuan.some((s) => s.satuanKode === satuan.kode)) {
            failures.push({ row: i + 1, sku, message: `Satuan "${satuanNama}" untuk SKU ini sudah diisi di baris sebelumnya.` });
            continue;
          }
          existing.satuan.push(satuanRow);
          existing._nama = nama;
        } else {
          grouped.set(sku, {
            sku,
            nama,
            deskripsi: get(idx.deskripsi) || "",
            gambarUrl: get(idx.gambar) || "",
            kategoriKode: kategori.kode,
            merkKode: merk.kode,
            status,
            satuan: [satuanRow],
            _nama: nama,
          });
        }
      }

      const payload = [...grouped.values()].map(({ _nama, ...rest }) => rest);
      if (payload.length === 0) {
        setResult({ success: 0, failures });
        return;
      }

      try {
        // Upsert: SKU sudah ada → update, belum ada → create (server-side).
        const res = await bulkUpsertProduk(payload);
        success = res.success;
        failures.push(...res.failures);
      } catch (err) {
        failures.push({
          row: 1,
          sku: "",
          message: err instanceof ApiClientError ? err.message : "Gagal memproses bulk upload.",
        });
      }

      setResult({ success, failures });
      if (failures.length === 0) {
        onDone();
      }
    } catch {
      setError("Gagal membaca file. Pastikan file CSV valid.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    // Contoh memakai master data yang umum: Merk "Indomie Update", Kategori
    // "Makanan & Minuman", Satuan "Lusin Besar"/"Dus" (sesuaikan bila berubah).
    // Baris dengan SKU sama digabung menjadi satu produk multi-satuan.
    const csvContent = [
      "SKU,Nama Produk,Merk,Kategori,Satuan,Kode Item,Harga,Status,Deskripsi,URL Gambar",
      "BRG-001,Contoh Produk,Indomie Update,Makanan & Minuman,Lusin Besar,BRG-001-003,100000,active,Contoh deskripsi,",
      "BRG-001,Contoh Produk,Indomie Update,Makanan & Minuman,Dus,BRG-001-004,55000,active,Contoh deskripsi,",
      "ind001,Indomie Goreng Spesial,Indomie Update,Makanan & Minuman,Dus,ind001-004,55500,active,Update via bulk,",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-produk.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Upload Produk Bulk</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Upload file CSV (maksimal 10MB)
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
          {/* Upload Area */}
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-opacity-100"
            style={{ borderColor: 'rgba(39,180,70,0.5)' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: '#27b446', opacity: 0.6 }} />
            {selectedFile ? (
              <div>
                <p style={{ color: '#27b446' }}>
                  ✓ {selectedFile.name}
                </p>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div>
                <p style={{ color: '#000000' }}>
                  Klik untuk memilih file atau drag & drop
                </p>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  CSV, maksimal 10MB
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p style={{ color: '#e40b18' }}>⚠ {error}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(39,180,70,0.08)', border: '1px solid rgba(39,180,70,0.25)' }}>
              <p style={{ color: '#166534', fontWeight: 600 }}>
                Berhasil: {result.success} produk
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

          {/* Info Template */}
          <div className="mt-6 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
            <div className="flex items-center justify-between mb-2">
              <p style={{ color: '#000000' }}>Format File:</p>
              <button
                onClick={handleDownloadSample}
                className="text-sm px-3 py-1 rounded transition-colors"
                style={{
                  color: '#27b446',
                  textDecoration: 'underline'
                }}
              >
                Unduh Sample File
              </button>
            </div>
            <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.7 }}>
              File harus memiliki kolom berikut (sesuai urutan):
            </p>
            <div className="text-sm font-mono p-3 rounded border border-gray-300 bg-white" style={{ color: '#1a0408' }}>
              SKU, Nama Produk, Merk, Kategori, Satuan, Kode Item, Harga, Status, Deskripsi, URL Gambar
            </div>
            <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
              Format sama dengan tambah produk manual. Merk, Kategori, dan Satuan harus sudah ada di master data (Kelola Merk / Kategori / Satuan).
            </p>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Upsert: bila SKU sudah ada, data produk diperbarui; bila belum ada, produk baru dibuat. Stok per satuan otomatis dibuat.
            </p>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Produk multi-satuan: tulis beberapa baris dengan SKU yang sama (satu baris per satuan).
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
            disabled={!selectedFile || processing}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#27b446' }}
          >
            {processing ? "Memproses..." : "Upload File"}
          </button>
        </div>
      </div>
    </div>
  );
}
