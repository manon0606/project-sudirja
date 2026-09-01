"use client";
import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { createKategori, deleteKategori, listKategori, updateKategori } from "@/lib/product-api";
import type { KategoriDTO } from "@/lib/product-types";
import { X, Search, Plus, Edit2, Trash2, Tag, Upload, Download, ChevronDown } from 'lucide-react';
import BulkUploadReferenceModal, { downloadReferenceCsv } from "./BulkUploadReference";

const KelolaKategori: React.FC = () => {
  const [kategoriList, setKategoriList] = useState<KategoriDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  // Debounced copy — server-side search fires at most every 300ms while typing.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'kode' | 'nama'; direction: 'asc' | 'desc' }>({
    key: 'kode',
    direction: 'asc',
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedKategori, setSelectedKategori] = useState<KategoriDTO | null>(null);

  // Form states
  const [formNama, setFormNama] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await listKategori({
        page: pagination.page,
        pageSize: pagination.pageSize,
        search: debouncedSearch || undefined,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
      });
      setKategoriList(result.items);
      setPagination(prev => ({ ...prev, total: result.pagination.total, totalPages: result.pagination.totalPages }));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : 'Gagal memuat data kategori.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortConfig, pagination.page, pagination.pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (key: 'kode' | 'nama') => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const getSortIndicator = (key: 'kode' | 'nama') => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleAdd = async () => {
    setFormError('');

    if (!formNama.trim()) {
      setFormError('Nama kategori tidak boleh kosong');
      return;
    }

    setSaving(true);
    try {
      await createKategori({ nama: formNama.trim() });
      setShowAddModal(false);
      setFormNama('');
      setPagination(prev => ({ ...prev, page: 1 }));
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    setFormError('');

    if (!selectedKategori) return;
    if (!formNama.trim()) {
      setFormError('Nama kategori tidak boleh kosong');
      return;
    }

    setSaving(true);
    try {
      await updateKategori(selectedKategori.kode, { nama: formNama.trim() });
      setShowEditModal(false);
      setSelectedKategori(null);
      setFormNama('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Gagal menyimpan perubahan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKategori) return;

    setDeleting(true);
    try {
      await deleteKategori(selectedKategori.kode);
      setShowDeleteModal(false);
      setSelectedKategori(null);
      await load();
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : 'Gagal menghapus kategori.');
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const openAddModal = () => {
    setFormNama('');
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (kategori: KategoriDTO) => {
    setSelectedKategori(kategori);
    setFormNama(kategori.nama);
    setFormError('');
    setShowEditModal(true);
  };

  const openDeleteModal = (kategori: KategoriDTO) => {
    setSelectedKategori(kategori);
    setShowDeleteModal(true);
  };

  // Export seluruh data kategori (semua halaman) ke CSV.
  const handleExport = async () => {
    try {
      const all: KategoriDTO[] = [];
      let page = 1;
      for (;;) {
        const result = await listKategori({ page, pageSize: 100, search: debouncedSearch || undefined });
        all.push(...result.items);
        if (page >= result.pagination.totalPages) break;
        page++;
      }
      downloadReferenceCsv("kategori", all.map((k) => ({ kode: k.kode, nama: k.nama, isActive: k.isActive })));
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : "Gagal mengekspor data kategori.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="kelola-kategori" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Kelola Kategori</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola kategori untuk produk
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
                title="Export seluruh data kategori (CSV)"
              >
                <Download className="w-5 h-5" />
                Export Data
              </button>

              {/* Tambah Kategori with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  <Plus className="w-5 h-5" />
                  Tambah Kategori
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
                          openAddModal();
                        }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}
                      >
                        <Edit2 className="w-5 h-5" style={{ color: '#27b446' }} />
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
              placeholder="Cari kategori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
              style={{
                color: '#1a0408',
                '--tw-ring-color': '#27b446'
              } as any}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
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
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data kategori...</p>
              </div>
            ) : kategoriList.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort('kode')}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            ID Kategori
                            {getSortIndicator('kode')}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort('nama')}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Nama Kategori
                            {getSortIndicator('nama')}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {kategoriList.map((kategori) => (
                        <tr key={kategori.kode} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {kategori.kode}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {kategori.nama}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(kategori)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#27b446' }}
                                title="Edit Kategori"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(kategori)}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#e40b18' }}
                                title="Hapus Kategori"
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
                {pagination.totalPages > 1 && (
                  <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div style={{ color: '#1a0408', opacity: 0.7 }}>
                      Menampilkan {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} kategori
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}
                      >
                        Sebelumnya
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
                        className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Tag className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Kategori tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      {searchTerm ? 'Coba gunakan kata kunci pencarian yang berbeda' : 'Belum ada data kategori'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 style={{ color: '#000000' }}>Tambah Kategori</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Nama Kategori <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Makanan & Minuman"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>

              {formError && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                  <p className="text-sm">⚠ {formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}
              >
                Batal
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#27b446' }}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedKategori && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 style={{ color: '#000000' }}>Edit Kategori</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>ID Kategori</label>
                <input
                  type="text"
                  value={selectedKategori.kode}
                  disabled
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-100"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                />
              </div>

              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Nama Kategori <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Makanan & Minuman"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>

              {formError && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                  <p className="text-sm">⚠ {formError}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}
              >
                Batal
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#27b446' }}
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedKategori && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 style={{ color: '#000000' }}>Hapus Kategori</h2>
              <button onClick={() => setShowDeleteModal(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-6">
              <p style={{ color: '#1a0408' }}>
                Apakah Anda yakin ingin menghapus kategori <span style={{ color: '#000000', fontWeight: 600 }}>{selectedKategori.nama}</span>?
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-lg border transition-colors"
                style={{ borderColor: '#1a0408', color: '#1a0408' }}
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#e40b18' }}
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <BulkUploadReferenceModal
          kind="kategori"
          onClose={() => setShowBulkUploadModal(false)}
          onDone={() => void load()}
        />
      )}
    </div>
  );
};

export default KelolaKategori;
