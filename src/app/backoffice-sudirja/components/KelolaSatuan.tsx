"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { createSatuan, deleteSatuan, listSatuan, updateSatuan } from "@/lib/product-api";
import type { SatuanDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Edit, Trash2, Package, Upload, Download
} from "lucide-react";
import BulkUploadReferenceModal, { downloadReferenceCsv } from "./BulkUploadReference";
import Modal from "./Modal";

type SortField = "kode" | "nama" | "jumlah_unit";
type SortDirection = "asc" | "desc" | null;

export default function KelolaSatuan() {
  const [satuanData, setSatuanData] = useState<SatuanDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Debounced copy — server-side search fires at most every 300ms while typing.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingSatuan, setEditingSatuan] = useState<SatuanDTO | null>(null);
  const [deletingSatuan, setDeletingSatuan] = useState<SatuanDTO | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tutup dropdown "Tambah" saat klik di luar (document mousedown + ref).
  const addMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showAddMenu) return;
    const onDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showAddMenu]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const sortBy =
        sortField === "kode" || sortField === "nama" || sortField === "jumlah_unit"
          ? sortField
          : undefined;
      const result = await listSatuan({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder: sortDirection === "desc" ? "desc" : "asc",
      });
      setSatuanData(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data satuan.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortField, sortDirection, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearSort = () => {
    setSortField(null);
    setSortDirection(null);
  };

  const handleSort = (field: SortField) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        clearSort();
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

  // Export seluruh data satuan (semua halaman) ke CSV.
  const handleExport = async () => {
    try {
      const all: SatuanDTO[] = [];
      let page = 1;
      for (;;) {
        const result = await listSatuan({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...result.items);
        if (page >= result.pagination.totalPages) break;
        page++;
      }
      downloadReferenceCsv("satuan", all.map((s) => ({ kode: s.kode, nama: s.nama, jumlahUnit: s.jumlahUnit, isActive: s.isActive })));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data satuan.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="kelola-satuan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Kelola Satuan</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola satuan untuk produk
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Export Data */}
              <button
                onClick={() => void handleExport()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{
                  borderColor: '#27b446',
                  color: '#27b446',
                  backgroundColor: 'rgba(39, 180, 70, 0.05)'
                }}
                title="Export seluruh data satuan (CSV)"
              >
                <Download className="w-5 h-5" />
                Export Data
              </button>

              {/* Tambah Satuan with Dropdown */}
              <div className="relative" ref={addMenuRef}>
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  <Plus className="w-5 h-5" />
                  Tambah Satuan
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showAddMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                      <button
                        onClick={() => {
                          setShowAddMenu(false);
                          setShowAddModal(true);
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
                          setShowAddMenu(false);
                          setShowBulkUploadModal(true);
                        }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200"
                        style={{ color: '#1a0408' }}
                      >
                        <Upload className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div>
                          <p style={{ color: '#000000' }}>Bulk Upload</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>CSV</p>
                        </div>
                      </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
            <input
              type="text"
              placeholder="Cari satuan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: '#1a0408', opacity: 0.6 }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {listError && (
              <div className="px-6 py-3" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {listError}</p>
              </div>
            )}
            {loading ? (
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data satuan...</p>
              </div>
            ) : satuanData.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("kode")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            ID
                            {getSortIcon("kode")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("nama")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Nama Satuan
                            {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("jumlah_unit")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Jumlah Unit
                            {getSortIcon("jumlah_unit")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {satuanData.map((satuan, index) => (
                        <tr
                          key={satuan.kode}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff'
                          }}
                        >
                          <td className="px-6 py-4" style={{ color: '#27b446', fontFamily: 'monospace' }}>
                            {satuan.kode}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {satuan.nama}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {satuan.jumlahUnit} unit
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingSatuan(satuan)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#27b446' }}
                                title="Edit Satuan"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingSatuan(satuan)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#e40b18' }}
                                title="Hapus Satuan"
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
                      Menampilkan {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} satuan
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
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
                            onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
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
                      onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
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
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Satuan tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      {searchQuery ? "Coba gunakan kata kunci pencarian yang berbeda" : "Belum ada data satuan"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddSatuanModal
          onClose={() => setShowAddModal(false)}
          onAdd={() => void load()}
        />
      )}

      {editingSatuan && (
        <EditSatuanModal
          satuan={editingSatuan}
          onClose={() => setEditingSatuan(null)}
          onUpdate={() => void load()}
        />
      )}

      {deletingSatuan && (
        <DeleteConfirmModal
          title="Hapus Satuan"
          message={`Apakah Anda yakin ingin menghapus satuan "${deletingSatuan.nama}"?`}
          onClose={() => setDeletingSatuan(null)}
          onConfirm={() => void load()}
          target={deletingSatuan}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadReferenceModal
          kind="satuan"
          onClose={() => setShowBulkUploadModal(false)}
          onDone={() => void load()}
        />
      )}
    </div>
  );
}

// Add Modal
interface AddSatuanModalProps {
  onClose: () => void;
  onAdd: () => void;
}

function AddSatuanModal({ onClose, onAdd }: AddSatuanModalProps) {
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!nama.trim()) {
      setError("Nama satuan harus diisi");
      return;
    }

    const jumlahNum = parseInt(jumlah);
    if (!jumlah || isNaN(jumlahNum) || jumlahNum < 1) {
      setError("Jumlah unit harus lebih dari 0");
      return;
    }

    setSaving(true);
    try {
      await createSatuan({ nama: nama.trim(), jumlahUnit: jumlahNum });
      onAdd();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan satuan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Tambah Satuan</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Nama Satuan <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Pcs, Dus, Lusin"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
          </div>

          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Jumlah Unit <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="number"
              placeholder="Contoh: 1, 12, 24"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Berapa banyak unit dasar dalam satuan ini
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#27b446' }}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
    </Modal>
  );
}

// Edit Modal
interface EditSatuanModalProps {
  satuan: SatuanDTO;
  onClose: () => void;
  onUpdate: () => void;
}

function EditSatuanModal({ satuan, onClose, onUpdate }: EditSatuanModalProps) {
  const [nama, setNama] = useState(satuan.nama);
  const [jumlah, setJumlah] = useState(satuan.jumlahUnit.toString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!nama.trim()) {
      setError("Nama satuan harus diisi");
      return;
    }

    const jumlahNum = parseInt(jumlah);
    if (!jumlah || isNaN(jumlahNum) || jumlahNum < 1) {
      setError("Jumlah unit harus lebih dari 0");
      return;
    }

    setSaving(true);
    try {
      await updateSatuan(satuan.kode, { nama: nama.trim(), jumlahUnit: jumlahNum });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Edit Satuan</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              ID
            </label>
            <input
              type="text"
              value={satuan.kode}
              disabled
              className="w-full px-4 py-3 rounded-lg border border-gray-300 cursor-not-allowed"
              style={{ color: '#1a0408', backgroundColor: '#f9fafb', opacity: 0.8 }}
            />
          </div>

          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Nama Satuan <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
          </div>

          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Jumlah Unit <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="number"
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#27b446' }}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
    </Modal>
  );
}

// Delete Confirm Modal
interface DeleteConfirmModalProps {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  target: SatuanDTO;
}

function DeleteConfirmModal({ title, message, onClose, onConfirm, target }: DeleteConfirmModalProps) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteSatuan(target.kode);
      onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menghapus satuan.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 style={{ color: '#000000' }}>{title}</h2>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
          <p style={{ color: '#1a0408' }}>{message}</p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#e40b18' }}
          >
            {deleting ? "Menghapus..." : "Hapus"}
          </button>
        </div>
    </Modal>
  );
}
