"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2, Undo2, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface KonsinyasiItem {
  sku: string;
  nama: string;
  qtyKonsinyasi: number;
  qtyTerjual: number;
  qtyDikembalikan: number;
  hargaBeli: number;
  hargaJual: number;
}

interface KonsinyasiData {
  nomorKonsinyasi: string;
  tanggal: Date;
  vendor: string;
  items: KonsinyasiItem[];
  status: 'aktif' | 'selesai';
}

// Mock products data
const mockProducts = [
  { id: "1", sku: "BRG-001", name: "Susu Ultra Milk 1L", price: 18000 },
  { id: "2", sku: "BRG-002", name: "Indomie Goreng", price: 3500 },
  { id: "3", sku: "BRG-003", name: "Telur Ayam 1kg", price: 28000 },
  { id: "4", sku: "BRG-004", name: "Beras Premium 5kg", price: 65000 },
  { id: "5", sku: "BRG-005", name: "Minyak Goreng 2L", price: 35000 },
  { id: "6", sku: "BRG-006", name: "Gula Pasir 1kg", price: 14000 },
  { id: "7", sku: "BRG-007", name: "Kopi Kapal Api", price: 12000 },
  { id: "8", sku: "BRG-008", name: "Teh Sariwangi", price: 10000 },
  { id: "9", sku: "BRG-009", name: "Aqua Galon 19L", price: 20000 },
  { id: "10", sku: "BRG-010", name: "Sabun Mandi Lifebuoy", price: 8000 },
];

// Mock konsinyasi data
const mockKonsinyasiData: KonsinyasiData[] = [
  {
    nomorKonsinyasi: "KON-20260515-001",
    tanggal: new Date(2026, 4, 15, 10, 0),
    vendor: "PT Konsinyasi Jaya",
    items: [
      { sku: "BRG-001", nama: "Susu Ultra Milk 1L", qtyKonsinyasi: 100, qtyTerjual: 45, qtyDikembalikan: 0, hargaBeli: 15000, hargaJual: 18000 },
      { sku: "BRG-002", nama: "Indomie Goreng", qtyKonsinyasi: 200, qtyTerjual: 150, qtyDikembalikan: 0, hargaBeli: 2800, hargaJual: 3500 },
    ],
    status: 'aktif'
  },
  {
    nomorKonsinyasi: "KON-20260510-001",
    tanggal: new Date(2026, 4, 10, 14, 30),
    vendor: "CV Mitra Konsinyasi",
    items: [
      { sku: "BRG-007", nama: "Kopi Kapal Api", qtyKonsinyasi: 80, qtyTerjual: 80, qtyDikembalikan: 0, hargaBeli: 10000, hargaJual: 12000 },
    ],
    status: 'selesai'
  },
  {
    nomorKonsinyasi: "KON-20260505-001",
    tanggal: new Date(2026, 4, 5, 9, 15),
    vendor: "PT Konsinyasi Jaya",
    items: [
      { sku: "BRG-003", nama: "Telur Ayam 1kg", qtyKonsinyasi: 60, qtyTerjual: 40, qtyDikembalikan: 20, hargaBeli: 24000, hargaJual: 28000 },
      { sku: "BRG-005", nama: "Minyak Goreng 2L", qtyKonsinyasi: 50, qtyTerjual: 30, qtyDikembalikan: 20, hargaBeli: 30000, hargaJual: 35000 },
    ],
    status: 'selesai'
  },
];

type SortField = "nomorKonsinyasi" | "tanggal" | "vendor" | "status";
type SortDirection = "asc" | "desc" | null;

export default function Konsinyasi() {

    

  // State untuk filter
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'semua' | 'aktif' | 'selesai'>('semua');

  // State untuk sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk modal
  const [selectedKonsinyasi, setSelectedKonsinyasi] = useState<KonsinyasiData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [returnKonsinyasi, setReturnKonsinyasi] = useState<KonsinyasiData | null>(null);

  // State untuk data
  const [konsinyasiData, setKonsinyasiData] = useState(mockKonsinyasiData);

  // Filter data
  const filteredData = useMemo(() => {
    return konsinyasiData.filter(item => {
      // Filter by search query
      const query = searchQuery.toLowerCase();
      if (query && !item.nomorKonsinyasi.toLowerCase().includes(query) && !item.vendor.toLowerCase().includes(query)) {
        return false;
      }

      // Filter by status
      if (filterStatus !== 'semua' && item.status !== filterStatus) {
        return false;
      }

      // Filter by date range
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (item.tanggal < fromDate) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (item.tanggal > toDate) return false;
      }

      return true;
    });
  }, [konsinyasiData, searchQuery, filterStatus, dateFrom, dateTo]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "tanggal") {
        aValue = a.tanggal.getTime();
        bValue = b.tanggal.getTime();
      }

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
    setDateFrom("");
    setDateTo("");
    setFilterStatus('semua');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || filterStatus !== 'semua';

  const handleAddKonsinyasi = (newData: KonsinyasiData) => {
    setKonsinyasiData([newData, ...konsinyasiData]);
  };

  const handleReturn = (nomorKonsinyasi: string, returnedItems: { sku: string; qtyReturn: number }[]) => {
    setKonsinyasiData(prev => prev.map(item => {
      if (item.nomorKonsinyasi === nomorKonsinyasi) {
        const updatedItems = item.items.map(itemDetail => {
          const returnItem = returnedItems.find(r => r.sku === itemDetail.sku);
          if (returnItem) {
            return {
              ...itemDetail,
              qtyDikembalikan: itemDetail.qtyDikembalikan + returnItem.qtyReturn
            };
          }
          return itemDetail;
        });

        // Check if all items are returned or sold
        const allCompleted = updatedItems.every(i =>
          i.qtyKonsinyasi === (i.qtyTerjual + i.qtyDikembalikan)
        );

        return {
          ...item,
          items: updatedItems,
          status: allCompleted ? 'selesai' : 'aktif'
        };
      }
      return item;
    }));
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="konsinyasi" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Konsinyasi</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data konsinyasi dan pengembalian stok
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}
            >
              <Plus className="w-5 h-5" />
              Buat Konsinyasi Baru
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
                  placeholder="Cari Nomor Konsinyasi atau Vendor..."
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

            {/* Status Filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border-2 focus:outline-none focus:ring-2 cursor-pointer"
                style={{
                  color: '#1a0408',
                  borderColor: '#27b446',
                  '--tw-ring-color': '#27b446'
                } as any}
              >
                <option value="semua">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </select>
              <ChevronDown
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#27b446' }}
              />
            </div>

            {/* Date Filter Toggle */}
            <button
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
            <div className="mt-4 flex items-center gap-4 p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
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
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
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
              Menampilkan {paginatedData.length} dari {sortedData.length} data
              {hasActiveFilters && ` (difilter dari ${konsinyasiData.length} total)`}
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
                      onClick={() => handleSort("nomorKonsinyasi")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Nomor Konsinyasi
                      {getSortIcon("nomorKonsinyasi")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("tanggal")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Tanggal
                      {getSortIcon("tanggal")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("vendor")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Vendor
                      {getSortIcon("vendor")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                    Jumlah Item
                  </th>
                  <th className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity mx-auto"
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
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada data yang sesuai dengan filter" : "Belum ada data konsinyasi"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr
                      key={item.nomorKonsinyasi}
                      className="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td
                        className="px-6 py-4"
                        style={{ color: '#27b446' }}
                        onClick={() => setSelectedKonsinyasi(item)}
                      >
                        {item.nomorKonsinyasi}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{ color: '#1a0408' }}
                        onClick={() => setSelectedKonsinyasi(item)}
                      >
                        {format(item.tanggal, "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td
                        className="px-6 py-4"
                        style={{ color: '#1a0408' }}
                        onClick={() => setSelectedKonsinyasi(item)}
                      >
                        {item.vendor}
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        style={{ color: '#1a0408' }}
                        onClick={() => setSelectedKonsinyasi(item)}
                      >
                        {item.items.length} item
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        onClick={() => setSelectedKonsinyasi(item)}
                      >
                        <span
                          className="inline-block px-3 py-1 rounded-full text-sm text-white"
                          style={{
                            backgroundColor: item.status === 'aktif' ? '#27b446' : '#6b7280'
                          }}
                        >
                          {item.status === 'aktif' ? 'Aktif' : 'Selesai'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.status === 'aktif' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReturnKonsinyasi(item);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-blue-50"
                            style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                          >
                            <Undo2 className="w-4 h-4" />
                            Pengembalian
                          </button>
                        )}
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
                    Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, sortedData.length)} dari {sortedData.length} data
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

      {/* Detail Modal */}
      {selectedKonsinyasi && (
        <DetailKonsinyasiModal
          data={selectedKonsinyasi}
          onClose={() => setSelectedKonsinyasi(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateKonsinyasiModal
          existingNumbers={konsinyasiData.map(item => item.nomorKonsinyasi)}
          onClose={() => setShowCreateModal(false)}
          onAdd={handleAddKonsinyasi}
        />
      )}

      {/* Return Modal */}
      {returnKonsinyasi && (
        <ReturnKonsinyasiModal
          data={returnKonsinyasi}
          onClose={() => setReturnKonsinyasi(null)}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
}

interface DetailKonsinyasiModalProps {
  data: KonsinyasiData;
  onClose: () => void;
}

function DetailKonsinyasiModal({ data, onClose }: DetailKonsinyasiModalProps) {
  const itemsWithCalc = data.items.map(item => ({
    ...item,
    qtyTersisa: item.qtyKonsinyasi - item.qtyTerjual - item.qtyDikembalikan,
    totalNilaiKonsinyasi: item.hargaBeli * item.qtyKonsinyasi,
    totalNilaiTerjual: item.hargaBeli * item.qtyTerjual,
    totalNilaiDikembalikan: item.hargaBeli * item.qtyDikembalikan,
  }));

  const totalNilaiKonsinyasi = itemsWithCalc.reduce((sum, item) => sum + item.totalNilaiKonsinyasi, 0);
  const totalNilaiTerjual = itemsWithCalc.reduce((sum, item) => sum + item.totalNilaiTerjual, 0);
  const totalNilaiDikembalikan = itemsWithCalc.reduce((sum, item) => sum + item.totalNilaiDikembalikan, 0);
  const totalYangHarusDibayar = totalNilaiTerjual;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Konsinyasi</h2>
            <p style={{ color: '#27b446' }}>{data.nomorKonsinyasi}</p>
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
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Tanggal Konsinyasi</p>
                <p style={{ color: '#000000' }}>
                  {format(data.tanggal, "dd MMMM yyyy, HH:mm", { locale: id })}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Vendor</p>
                <p style={{ color: '#000000' }}>{data.vendor}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Status</p>
                <span
                  className="inline-block px-3 py-1 rounded-full text-sm text-white"
                  style={{
                    backgroundColor: data.status === 'aktif' ? '#27b446' : '#6b7280'
                  }}
                >
                  {data.status === 'aktif' ? 'Aktif' : 'Selesai'}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="mb-3" style={{ color: '#000000' }}>Daftar Produk</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>SKU</th>
                    <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Nama Produk</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Konsinyasi</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Terjual</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Dikembalikan</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Tersisa</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Total Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithCalc.map((item, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-4 py-3" style={{ color: '#1a0408', opacity: 0.7 }}>{item.sku}</td>
                      <td className="px-4 py-3" style={{ color: '#1a0408' }}>{item.nama}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qtyKonsinyasi}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#27b446' }}>{item.qtyTerjual}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#3b82f6' }}>{item.qtyDikembalikan}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qtyTersisa}</td>
                      <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                        Rp {item.hargaBeli.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#000000' }}>
                        Rp {item.totalNilaiKonsinyasi.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <h3 className="mb-3" style={{ color: '#000000' }}>Ringkasan</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span style={{ color: '#1a0408', opacity: 0.7 }}>Total Nilai Konsinyasi</span>
                <span style={{ color: '#1a0408' }}>
                  Rp {totalNilaiKonsinyasi.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: '#1a0408', opacity: 0.7 }}>Nilai Produk Terjual</span>
                <span style={{ color: '#27b446' }}>
                  Rp {totalNilaiTerjual.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: '#1a0408', opacity: 0.7 }}>Nilai Produk Dikembalikan</span>
                <span style={{ color: '#3b82f6' }}>
                  Rp {totalNilaiDikembalikan.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="pt-2 border-t-2 border-gray-300 flex justify-between items-center">
                <div>
                  <p style={{ color: '#000000' }}>Yang Harus Dibayar ke Vendor</p>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Hanya untuk produk yang terjual
                  </p>
                </div>
                <p className="text-2xl" style={{ color: '#27b446' }}>
                  Rp {totalYangHarusDibayar.toLocaleString('id-ID')}
                </p>
              </div>
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

interface CreateKonsinyasiModalProps {
  existingNumbers: string[];
  onClose: () => void;
  onAdd: (data: KonsinyasiData) => void;
}

function CreateKonsinyasiModal({ existingNumbers, onClose, onAdd }: CreateKonsinyasiModalProps) {
  const [nomorKonsinyasi, setNomorKonsinyasi] = useState("");
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [vendor, setVendor] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<KonsinyasiItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [error, setError] = useState("");
  const productListRef = useRef<HTMLDivElement>(null);

  // Auto-generate konsinyasi number on mount
  useEffect(() => {
    const today = new Date();
    const dateStr = format(today, "yyyyMMdd");

    const todayNumbers = existingNumbers
      .filter(num => num.includes(dateStr))
      .map(num => {
        const parts = num.split("-");
        return parseInt(parts[parts.length - 1]) || 0;
      });

    const nextNumber = todayNumbers.length > 0 ? Math.max(...todayNumbers) + 1 : 1;
    const generatedNumber = `KON-${dateStr}-${String(nextNumber).padStart(3, '0')}`;
    setNomorKonsinyasi(generatedNumber);
  }, [existingNumbers]);

  // Auto-scroll to bottom when items are added
  useEffect(() => {
    if (productListRef.current && selectedItems.length > 0) {
      setTimeout(() => {
        productListRef.current?.scrollTo({
          top: productListRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [selectedItems.length]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return mockProducts
      .filter(product =>
        product.sku.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [searchQuery]);

  const handleAddProduct = (product: typeof mockProducts[0]) => {
    const existingItem = selectedItems.find(item => item.sku === product.sku);
    if (existingItem) {
      alert("Produk sudah ditambahkan");
      return;
    }

    setSelectedItems([...selectedItems, {
      sku: product.sku,
      nama: product.name,
      qtyKonsinyasi: 1,
      qtyTerjual: 0,
      qtyDikembalikan: 0,
      hargaBeli: 0,
      hargaJual: product.price,
    }]);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleUpdateItem = (sku: string, field: keyof KonsinyasiItem, value: any) => {
    setSelectedItems(items =>
      items.map(item =>
        item.sku === sku ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveItem = (sku: string) => {
    setSelectedItems(items => items.filter(item => item.sku !== sku));
  };

  const handleSubmit = () => {
    setError("");

    if (!tanggal) {
      setError("Tanggal harus diisi");
      return;
    }

    if (!vendor.trim()) {
      setError("Vendor harus diisi");
      return;
    }

    if (selectedItems.length === 0) {
      setError("Minimal harus ada 1 produk");
      return;
    }

    for (const item of selectedItems) {
      if (item.qtyKonsinyasi <= 0) {
        setError(`Qty Konsinyasi untuk ${item.nama} harus lebih dari 0`);
        return;
      }
      if (item.hargaBeli <= 0) {
        setError(`Harga Beli untuk ${item.nama} harus lebih dari 0`);
        return;
      }
      if (item.hargaJual <= 0) {
        setError(`Harga Jual untuk ${item.nama} harus lebih dari 0`);
        return;
      }
    }

    const newKonsinyasi: KonsinyasiData = {
      nomorKonsinyasi: nomorKonsinyasi.trim(),
      tanggal: new Date(tanggal),
      vendor: vendor.trim(),
      items: selectedItems,
      status: 'aktif'
    };

    onAdd(newKonsinyasi);
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
      <div className="bg-white rounded-2xl w-full max-w-6xl mx-4 h-[98vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Buat Konsinyasi Baru</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: '#1a0408' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(98vh-160px)] px-6 py-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Nomor Konsinyasi <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  value={nomorKonsinyasi}
                  disabled
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 cursor-not-allowed"
                  style={{
                    color: '#1a0408',
                    backgroundColor: '#f9fafb',
                    opacity: 0.8
                  }}
                />
              </div>

              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Tanggal <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>

              <div>
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Vendor <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama Vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />
              </div>
            </div>

            {/* Product Search */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Tambah Produk
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari produk berdasarkan SKU atau nama..."
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

                {/* Search Results */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {searchResults.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p style={{ color: '#1a0408' }}>{product.name}</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                              SKU: {product.sku}
                            </p>
                          </div>
                          <p style={{ color: '#27b446' }}>
                            Rp {product.price.toLocaleString('id-ID')}
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
                <div
                  ref={productListRef}
                  className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto"
                >
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Konsinyasi</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Jual</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Total Nilai</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => (
                        <tr key={item.sku} className="border-t border-gray-200">
                          <td className="px-4 py-3">
                            <p style={{ color: '#1a0408' }}>{item.nama}</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                              {item.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleUpdateItem(item.sku, 'qtyKonsinyasi', Math.max(1, item.qtyKonsinyasi - 1))}
                                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                                style={{ borderColor: '#e5e7eb', color: '#1a0408' }}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <input
                                type="number"
                                value={item.qtyKonsinyasi}
                                onChange={(e) => handleUpdateItem(item.sku, 'qtyKonsinyasi', Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                                style={{
                                  color: '#1a0408',
                                  '--tw-ring-color': '#27b446'
                                } as any}
                              />
                              <button
                                onClick={() => handleUpdateItem(item.sku, 'qtyKonsinyasi', item.qtyKonsinyasi + 1)}
                                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                                style={{ borderColor: '#27b446', color: '#27b446' }}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              placeholder="0"
                              value={item.hargaBeli || ''}
                              onChange={(e) => handleUpdateItem(item.sku, 'hargaBeli', parseInt(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                              style={{
                                color: '#1a0408',
                                '--tw-ring-color': '#27b446'
                              } as any}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              placeholder="0"
                              value={item.hargaJual || ''}
                              onChange={(e) => handleUpdateItem(item.sku, 'hargaJual', parseInt(e.target.value) || 0)}
                              className="w-full text-right px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                              style={{
                                color: '#1a0408',
                                '--tw-ring-color': '#27b446'
                              } as any}
                            />
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: '#000000' }}>
                            Rp {(item.hargaBeli * item.qtyKonsinyasi).toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.sku)}
                              className="w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-colors hover:bg-red-50"
                              style={{ borderColor: '#e40b18', color: '#e40b18' }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total Summary */}
            {selectedItems.length > 0 && (
              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: '#000000' }}>Total Nilai Konsinyasi</span>
                  <span className="text-xl" style={{ color: '#27b446' }}>
                    Rp {selectedItems.reduce((sum, item) => sum + (item.hargaBeli * item.qtyKonsinyasi), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

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
            Simpan Konsinyasi
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReturnKonsinyasiModalProps {
  data: KonsinyasiData;
  onClose: () => void;
  onReturn: (nomorKonsinyasi: string, returnedItems: { sku: string; qtyReturn: number }[]) => void;
}

function ReturnKonsinyasiModal({ data, onClose, onReturn }: ReturnKonsinyasiModalProps) {
  const [returnItems, setReturnItems] = useState<{ [sku: string]: number }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");

  const itemsWithReturn = data.items.map(item => {
    const qtyReturn = returnItems[item.sku] || 0;
    const qtyTersisa = item.qtyKonsinyasi - item.qtyTerjual - item.qtyDikembalikan;
    return {
      ...item,
      qtyTersisa,
      qtyReturn,
      nilaiReturn: item.hargaBeli * qtyReturn
    };
  }).filter(item => item.qtyTersisa > 0);

  const totalNilaiReturn = itemsWithReturn.reduce((sum, item) => sum + item.nilaiReturn, 0);
  const totalQtyReturn = itemsWithReturn.reduce((sum, item) => sum + item.qtyReturn, 0);

  const handleUpdateReturn = (sku: string, qty: number) => {
    const item = data.items.find(i => i.sku === sku);
    if (!item) return;

    const maxQty = item.qtyKonsinyasi - item.qtyTerjual - item.qtyDikembalikan;
    const validQty = Math.min(Math.max(0, qty), maxQty);

    setReturnItems(prev => ({
      ...prev,
      [sku]: validQty
    }));
  };

  const handleSubmit = () => {
    setError("");

    if (totalQtyReturn === 0) {
      setError("Minimal harus ada 1 item yang dikembalikan");
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirm = () => {
    const returnedItems = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([sku, qtyReturn]) => ({ sku, qtyReturn }));

    onReturn(data.nomorKonsinyasi, returnedItems);
    onClose();
  };

  if (showConfirmation) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(4px)'
        }}
      >
        <div className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <AlertCircle className="w-6 h-6" style={{ color: '#3b82f6' }} />
              </div>
              <h2 style={{ color: '#000000' }}>Konfirmasi Pengembalian</h2>
            </div>
          </div>

          <div className="px-6 py-4">
            <p className="mb-4" style={{ color: '#1a0408' }}>
              Anda akan mengembalikan {totalQtyReturn} item dengan total nilai:
            </p>
            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <p className="text-center text-2xl" style={{ color: '#3b82f6' }}>
                Rp {totalNilaiReturn.toLocaleString('id-ID')}
              </p>
            </div>
            <p className="mt-4 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
              Nilai ini akan dikurangi dari pembayaran ke vendor.
            </p>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={() => setShowConfirmation(false)}
              className="flex-1 py-3 rounded-lg border transition-colors"
              style={{
                borderColor: '#e40b18',
                color: '#e40b18'
              }}
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#3b82f6' }}
            >
              Ya, Kembalikan
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <h2 style={{ color: '#000000' }}>Pengembalian Konsinyasi</h2>
            <p style={{ color: '#3b82f6' }}>{data.nomorKonsinyasi}</p>
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
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] px-6 py-4">
          <div className="mb-4 p-4 rounded-lg border-2" style={{ borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.8 }}>
              Masukkan jumlah quantity yang akan dikembalikan untuk setiap produk. Sistem akan menghitung nilai pengembalian secara otomatis.
            </p>
          </div>

          {itemsWithReturn.length === 0 ? (
            <div className="py-12 text-center">
              <p style={{ color: '#1a0408', opacity: 0.6 }}>
                Tidak ada produk yang dapat dikembalikan
              </p>
            </div>
          ) : (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                <table className="w-full">
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Tersisa</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Dikembalikan</th>
                      <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                      <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Nilai Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsWithReturn.map((item) => (
                      <tr key={item.sku} className="border-t border-gray-200">
                        <td className="px-4 py-3">
                          <p style={{ color: '#1a0408' }}>{item.nama}</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                            {item.sku}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>
                          {item.qtyTersisa}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateReturn(item.sku, item.qtyReturn - 1)}
                              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                              style={{ borderColor: '#e5e7eb', color: '#1a0408' }}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.qtyReturn || ''}
                              onChange={(e) => handleUpdateReturn(item.sku, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-16 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                              style={{
                                color: '#1a0408',
                                '--tw-ring-color': '#3b82f6'
                              } as any}
                            />
                            <button
                              onClick={() => handleUpdateReturn(item.sku, item.qtyReturn + 1)}
                              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                              style={{ borderColor: '#3b82f6', color: '#3b82f6' }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                          Rp {item.hargaBeli.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right" style={{ color: '#3b82f6' }}>
                          Rp {item.nilaiReturn.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                <div className="flex justify-between items-center">
                  <span style={{ color: '#000000' }}>Total Nilai Pengembalian</span>
                  <span className="text-xl" style={{ color: '#3b82f6' }}>
                    Rp {totalNilaiReturn.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
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
              borderColor: '#e40b18',
              color: '#e40b18'
            }}
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={totalQtyReturn === 0}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#3b82f6' }}
          >
            Proses Pengembalian
          </button>
        </div>
      </div>
    </div>
  );
}
