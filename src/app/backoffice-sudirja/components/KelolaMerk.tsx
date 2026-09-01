"use client";
import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { createMerk, deleteMerk, listMerk, updateMerk } from "@/lib/product-api";
import type { MerkDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Edit, Trash2, Award, Upload, Download
} from "lucide-react";
import BulkUploadReferenceModal, { downloadReferenceCsv } from "./BulkUploadReference";

type SortField = "kode" | "nama";
type SortDirection = "asc" | "desc" | null;

export default function KelolaMerk() {
  const [merkData, setMerkData] = useState<MerkDTO[]>([]);
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
  const [editingMerk, setEditingMerk] = useState<MerkDTO | null>(null);
  const [deletingMerk, setDeletingMerk] = useState<MerkDTO | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await listMerk({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection === "desc" ? "desc" : "asc",
      });
      setMerkData(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal memuat data merk.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortField, sortDirection, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (field: SortField) => {
    setPagination(prev => ({ ...prev, page: 1 }));
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

  // Export seluruh data merk (semua halaman) ke CSV.
  const handleExport = async () => {
    try {
      const all: MerkDTO[] = [];
      let page = 1;
      for (;;) {
        const result = await listMerk({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...result.items);
        if (page >= result.pagination.totalPages) break;
        page++;
      }
      downloadReferenceCsv("merk", all.map((m) => ({ kode: m.kode, nama: m.nama, isActive: m.isActive })));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data merk.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="kelola-merk" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Kelola Merk</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola merk produk
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
                title="Export seluruh data merk (CSV)"
              >
                <Download className="w-5 h-5" />
                Export Data
              </button>

              {/* Tambah Merk with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  <Plus className="w-5 h-5" />
                  Tambah Merk
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showAddMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAddMenu(false)}
                    />
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
                  </>
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
              placeholder="Cari merk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data merk...</p>
              </div>
            ) : merkData.length > 0 ? (
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
                            Nama Merk
                            {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {merkData.map((merk, index) => (
                        <tr
                          key={merk.kode}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff'
                          }}
                        >
                          <td className="px-6 py-4" style={{ color: '#27b446', fontFamily: 'monospace' }}>
                            {merk.kode}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {merk.nama}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingMerk(merk)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#27b446' }}
                                title="Edit Merk"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingMerk(merk)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#e40b18' }}
                                title="Hapus Merk"
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
                      Menampilkan {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} merk
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
                    <Award className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Merk tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      {searchQuery ? "Coba gunakan kata kunci pencarian yang berbeda" : "Belum ada data merk"}
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
        <AddMerkModal
          onClose={() => setShowAddModal(false)}
          onAdd={() => void load()}
        />
      )}

      {editingMerk && (
        <EditMerkModal
          merk={editingMerk}
          onClose={() => setEditingMerk(null)}
          onUpdate={() => void load()}
        />
      )}

      {deletingMerk && (
        <DeleteConfirmModal
          title="Hapus Merk"
          message={`Apakah Anda yakin ingin menghapus merk "${deletingMerk.nama}"?`}
          onClose={() => setDeletingMerk(null)}
          onConfirm={() => void load()}
          target={deletingMerk}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadReferenceModal
          kind="merk"
          onClose={() => setShowBulkUploadModal(false)}
          onDone={() => void load()}
        />
      )}
    </div>
  );
}

// Add Modal
interface AddMerkModalProps {
  onClose: () => void;
  onAdd: () => void;
}

function AddMerkModal({ onClose, onAdd }: AddMerkModalProps) {
  const [nama, setNama] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!nama.trim()) {
      setError("Nama merk harus diisi");
      return;
    }

    setSaving(true);
    try {
      await createMerk({ nama: nama.trim() });
      onAdd();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan merk.");
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
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Tambah Merk</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Nama Merk <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Ultra, Indomie, ABC"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
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
      </div>
    </div>
  );
}

// Edit Modal
interface EditMerkModalProps {
  merk: MerkDTO;
  onClose: () => void;
  onUpdate: () => void;
}

function EditMerkModal({ merk, onClose, onUpdate }: EditMerkModalProps) {
  const [nama, setNama] = useState(merk.nama);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");

    if (!nama.trim()) {
      setError("Nama merk harus diisi");
      return;
    }

    setSaving(true);
    try {
      await updateMerk(merk.kode, { nama: nama.trim() });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menyimpan perubahan.");
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
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Edit Merk</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              ID
            </label>
            <input
              type="text"
              value={merk.kode}
              disabled
              className="w-full px-4 py-3 rounded-lg border border-gray-300 cursor-not-allowed"
              style={{ color: '#1a0408', backgroundColor: '#f9fafb', opacity: 0.8 }}
            />
          </div>

          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>
              Nama Merk <span style={{ color: '#e40b18' }}>*</span>
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

          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
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
      </div>
    </div>
  );
}

// Delete Confirm Modal
interface DeleteConfirmModalProps {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  target: MerkDTO;
}

function DeleteConfirmModal({ title, message, onClose, onConfirm, target }: DeleteConfirmModalProps) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteMerk(target.kode);
      onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal menghapus merk.");
    } finally {
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
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 style={{ color: '#000000' }}>{title}</h2>
        </div>

        <div className="px-6 py-6">
          <p style={{ color: '#1a0408' }}>{message}</p>
          {error && (
            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <p className="text-sm">⚠ {error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors"
            style={{ borderColor: '#1a0408', color: '#1a0408' }}
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
      </div>
    </div>
  );
}
