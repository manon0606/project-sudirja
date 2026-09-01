"use client";
import { useState, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus
} from "lucide-react";

// Mock data pemetaan & ongkir
const mockPemetaanData = [
  { id: "PM001", kecamatan: "Bandung Wetan", ongkir: 15000 },
  { id: "PM002", kecamatan: "Bandung Kulon", ongkir: 15000 },
  { id: "PM003", kecamatan: "Cibiru", ongkir: 20000 },
  { id: "PM004", kecamatan: "Cibeunying Kaler", ongkir: 18000 },
  { id: "PM005", kecamatan: "Cibeunying Kidul", ongkir: 18000 },
  { id: "PM006", kecamatan: "Cicendo", ongkir: 17000 },
  { id: "PM007", kecamatan: "Cidadap", ongkir: 20000 },
  { id: "PM008", kecamatan: "Coblong", ongkir: 19000 },
  { id: "PM009", kecamatan: "Gedebage", ongkir: 22000 },
  { id: "PM010", kecamatan: "Kiaracondong", ongkir: 20000 },
  { id: "PM011", kecamatan: "Lengkong", ongkir: 16000 },
  { id: "PM012", kecamatan: "Mandalajati", ongkir: 21000 },
  { id: "PM013", kecamatan: "Panyileukan", ongkir: 23000 },
  { id: "PM014", kecamatan: "Rancasari", ongkir: 24000 },
  { id: "PM015", kecamatan: "Regol", ongkir: 16000 },
  { id: "PM016", kecamatan: "Sukajadi", ongkir: 18000 },
  { id: "PM017", kecamatan: "Sukasari", ongkir: 19000 },
  { id: "PM018", kecamatan: "Sumur Bandung", ongkir: 15000 },
];

type SortField = "id" | "kecamatan" | "ongkir";
type SortDirection = "asc" | "desc" | null;

export default function Pemetaan() {

    

  // State untuk filter
  const [searchQuery, setSearchQuery] = useState("");

  // State untuk sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingData, setEditingData] = useState<{ id: string; kecamatan: string; ongkir: number } | null>(null);

  // State untuk data
  const [pemetaanData, setPemetaanData] = useState(mockPemetaanData);

  // Filter data
  const filteredData = useMemo(() => {
    return pemetaanData.filter(item => {
      const query = searchQuery.toLowerCase();
      return (
        item.id.toLowerCase().includes(query) ||
        item.kecamatan.toLowerCase().includes(query)
      );
    });
  }, [pemetaanData, searchQuery]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

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
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery;

  const handleAddData = (newData: { id: string; kecamatan: string; ongkir: number }) => {
    setPemetaanData([...pemetaanData, newData]);
  };

  const handleEditData = (updatedData: { id: string; kecamatan: string; ongkir: number }) => {
    setPemetaanData(pemetaanData.map(item =>
      item.id === updatedData.id ? updatedData : item
    ));
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pemetaan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pemetaan & Ongkir</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola pemetaan kecamatan dan biaya ongkos kirim
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}
            >
              <Plus className="w-5 h-5" />
              Tambah Data
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari ID atau Kecamatan..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
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

          {/* Results count */}
          <div className="mt-4">
            <p style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {paginatedData.length} dari {sortedData.length} data
              {hasActiveFilters && ` (difilter dari ${pemetaanData.length} total)`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <tr>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      ID
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("kecamatan")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Kecamatan
                      {getSortIcon("kecamatan")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleSort("ongkir")}
                      className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Ongkir
                      {getSortIcon("ongkir")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada data yang sesuai dengan filter" : "Belum ada data"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setEditingData(item)}
                      className="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4" style={{ color: '#27b446' }}>
                        {item.id}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        {item.kecamatan}
                      </td>
                      <td className="px-6 py-4 text-right" style={{ color: '#000000' }}>
                        Rp {item.ongkir.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {sortedData.length > 0 && (
              <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                  <div className="relative">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
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
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedData.length)} dari {sortedData.length} data
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
          </div>
        </div>
      </div>

      {/* Add Data Modal */}
      {showAddModal && (
        <AddDataModal
          existingIds={pemetaanData.map(item => item.id)}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddData}
        />
      )}

      {/* Edit Data Modal */}
      {editingData && (
        <EditDataModal
          data={editingData}
          onClose={() => setEditingData(null)}
          onSave={handleEditData}
        />
      )}
    </div>
  );
}

interface AddDataModalProps {
  existingIds: string[];
  onClose: () => void;
  onAdd: (data: { id: string; kecamatan: string; ongkir: number }) => void;
}

function AddDataModal({ existingIds, onClose, onAdd }: AddDataModalProps) {
  const [id, setId] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [ongkir, setOngkir] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");

    // Validation
    if (!id.trim()) {
      setError("ID harus diisi");
      return;
    }

    if (existingIds.includes(id.trim())) {
      setError("ID sudah digunakan. Harap gunakan ID yang berbeda");
      return;
    }

    if (!kecamatan.trim()) {
      setError("Kecamatan harus diisi");
      return;
    }

    if (!ongkir.trim()) {
      setError("Ongkir harus diisi");
      return;
    }

    const ongkirValue = parseInt(ongkir);
    if (isNaN(ongkirValue) || ongkirValue < 0) {
      setError("Ongkir harus berupa angka positif");
      return;
    }

    // Add data
    onAdd({
      id: id.trim(),
      kecamatan: kecamatan.trim(),
      ongkir: ongkirValue
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Tambah Data Pemetaan & Ongkir</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#1a0408' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            {/* ID */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                ID <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: PM019"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                ID harus unik dan belum pernah digunakan
              </p>
            </div>

            {/* Kecamatan */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Kecamatan <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Arcamanik"
                value={kecamatan}
                onChange={(e) => setKecamatan(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
            </div>

            {/* Ongkir */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Ongkir (Rp) <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="number"
                placeholder="Contoh: 20000"
                value={ongkir}
                onChange={(e) => setOngkir(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <p className="text-sm">⚠ {error}</p>
              </div>
            )}
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
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditDataModalProps {
  data: { id: string; kecamatan: string; ongkir: number };
  onClose: () => void;
  onSave: (data: { id: string; kecamatan: string; ongkir: number }) => void;
}

function EditDataModal({ data, onClose, onSave }: EditDataModalProps) {
  const [kecamatan, setKecamatan] = useState(data.kecamatan);
  const [ongkir, setOngkir] = useState(data.ongkir.toString());
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");

    // Validation
    if (!kecamatan.trim()) {
      setError("Kecamatan harus diisi");
      return;
    }

    if (!ongkir.trim()) {
      setError("Ongkir harus diisi");
      return;
    }

    const ongkirValue = parseInt(ongkir);
    if (isNaN(ongkirValue) || ongkirValue < 0) {
      setError("Ongkir harus berupa angka positif");
      return;
    }

    // Save data
    onSave({
      id: data.id,
      kecamatan: kecamatan.trim(),
      ongkir: ongkirValue
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Edit Data Pemetaan & Ongkir</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#1a0408' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="space-y-4">
            {/* ID (Read-only) */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                ID
              </label>
              <div
                className="w-full px-4 py-3 rounded-lg border border-gray-300"
                style={{ backgroundColor: '#f9fafb', color: '#1a0408', opacity: 0.7 }}
              >
                {data.id}
              </div>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                ID tidak dapat diubah
              </p>
            </div>

            {/* Kecamatan */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Kecamatan <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Arcamanik"
                value={kecamatan}
                onChange={(e) => setKecamatan(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
            </div>

            {/* Ongkir */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Ongkir (Rp) <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="number"
                placeholder="Contoh: 20000"
                value={ongkir}
                onChange={(e) => setOngkir(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <p className="text-sm">⚠ {error}</p>
              </div>
            )}
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
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
