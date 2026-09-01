"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2, Info
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface RepackItem {
  id: string;
  namaBarang: string;
  biaya: number;
}

interface SelectedItem {
  sku: string;
  nama: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  diskon: number; // dalam persen
  isRepack: boolean;
  jumlahRepack: number;
  repackItems: RepackItem[];
}

// Mock products data untuk referensi
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
  { id: "11", sku: "BRG-011", name: "Shampo Pantene 170ml", price: 25000 },
  { id: "12", sku: "BRG-012", name: "Pasta Gigi Pepsodent", price: 12000 },
  { id: "13", sku: "BRG-013", name: "Sikat Gigi", price: 6000 },
  { id: "14", sku: "BRG-014", name: "Roti Tawar Sari Roti", price: 12000 },
  { id: "15", sku: "BRG-015", name: "Selai Strawberry", price: 18000 },
];

// Mock data pembelian
const mockPembelianData = [
  {
    nomorPembelian: "PO-20260410-001",
    tanggal: new Date(2026, 3, 10, 9, 30),
    supplier: "PT Sumber Jaya",
    items: [
      { sku: "BRG-001", nama: "Susu Ultra Milk 1L", qty: 50, hargaBeli: 15000, hargaJual: 18000 },
      { sku: "BRG-002", nama: "Indomie Goreng", qty: 200, hargaBeli: 2800, hargaJual: 3500 },
      { sku: "BRG-005", nama: "Minyak Goreng 2L", qty: 30, hargaBeli: 30000, hargaJual: 35000 },
    ]
  },
  {
    nomorPembelian: "PO-20260408-001",
    tanggal: new Date(2026, 3, 8, 14, 15),
    supplier: "CV Berkah Abadi",
    items: [
      { sku: "BRG-004", nama: "Beras Premium 5kg", qty: 100, hargaBeli: 55000, hargaJual: 65000 },
      { sku: "BRG-006", nama: "Gula Pasir 1kg", qty: 80, hargaBeli: 12000, hargaJual: 14000 },
    ]
  },
  {
    nomorPembelian: "PO-20260405-001",
    tanggal: new Date(2026, 3, 5, 10, 0),
    supplier: "PT Sumber Jaya",
    items: [
      { sku: "BRG-010", nama: "Sabun Mandi Lifebuoy", qty: 100, hargaBeli: 6500, hargaJual: 8000 },
      { sku: "BRG-011", nama: "Shampo Pantene 170ml", qty: 60, hargaBeli: 21000, hargaJual: 25000 },
      { sku: "BRG-012", nama: "Pasta Gigi Pepsodent", qty: 80, hargaBeli: 10000, hargaJual: 12000 },
    ]
  },
  {
    nomorPembelian: "PO-20260403-001",
    tanggal: new Date(2026, 3, 3, 11, 30),
    supplier: "UD Maju Jaya",
    items: [
      { sku: "BRG-007", nama: "Kopi Kapal Api", qty: 120, hargaBeli: 10000, hargaJual: 12000 },
      { sku: "BRG-008", nama: "Teh Sariwangi", qty: 150, hargaBeli: 8500, hargaJual: 10000 },
    ]
  },
  {
    nomorPembelian: "PO-20260401-001",
    tanggal: new Date(2026, 3, 1, 8, 45),
    supplier: "CV Berkah Abadi",
    items: [
      { sku: "BRG-014", nama: "Roti Tawar Sari Roti", qty: 40, hargaBeli: 10000, hargaJual: 12000 },
      { sku: "BRG-015", nama: "Selai Strawberry", qty: 30, hargaBeli: 15000, hargaJual: 18000 },
      { sku: "BRG-003", nama: "Telur Ayam 1kg", qty: 50, hargaBeli: 24000, hargaJual: 28000 },
    ]
  },
];

type SortField = "nomorPembelian" | "tanggal" | "supplier";
type SortDirection = "asc" | "desc" | null;

export default function Pembelian() {

    

  // State untuk filter
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // State untuk sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk modal
  const [selectedPembelian, setSelectedPembelian] = useState<typeof mockPembelianData[0] | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // State untuk data
  const [pembelianData, setPembelianData] = useState(mockPembelianData);

  // Filter data
  const filteredData = useMemo(() => {
    return pembelianData.filter(item => {
      // Filter by search query
      const query = searchQuery.toLowerCase();
      if (query && !item.nomorPembelian.toLowerCase().includes(query) && !item.supplier.toLowerCase().includes(query)) {
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
  }, [pembelianData, searchQuery, dateFrom, dateTo]);

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
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo;

  const handleAddPembelian = (newData: typeof mockPembelianData[0]) => {
    setPembelianData([newData, ...pembelianData]);
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pembelian" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pembelian</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data pembelian dan restock produk
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}
            >
              <Plus className="w-5 h-5" />
              Buat Pembelian Baru
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
                  placeholder="Cari Nomor Pembelian atau Supplier..."
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
              {hasActiveFilters && ` (difilter dari ${pembelianData.length} total)`}
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
                      onClick={() => handleSort("nomorPembelian")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Nomor Pembelian
                      {getSortIcon("nomorPembelian")}
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
                      onClick={() => handleSort("supplier")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Supplier
                      {getSortIcon("supplier")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                    Jumlah Item
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada data yang sesuai dengan filter" : "Belum ada data pembelian"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item) => (
                    <tr
                      key={item.nomorPembelian}
                      onClick={() => setSelectedPembelian(item)}
                      className="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4" style={{ color: '#27b446' }}>
                        {item.nomorPembelian}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        {format(item.tanggal, "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                        {item.supplier}
                      </td>
                      <td className="px-6 py-4 text-center" style={{ color: '#1a0408' }}>
                        {item.items.length} item
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
      {selectedPembelian && (
        <DetailPembelianModal
          data={selectedPembelian}
          onClose={() => setSelectedPembelian(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePembelianModal
          existingNumbers={pembelianData.map(item => item.nomorPembelian)}
          onClose={() => setShowCreateModal(false)}
          onAdd={handleAddPembelian}
        />
      )}
    </div>
  );
}

interface DetailPembelianModalProps {
  data: typeof mockPembelianData[0];
  onClose: () => void;
}

function DetailPembelianModal({ data, onClose }: DetailPembelianModalProps) {
  // Calculate totals
  const totalLabaPerItem = data.items.map((item: any) => {
    const subtotalBeforeDiscount = item.hargaBeli * item.qty;
    const discountAmount = ((subtotalBeforeDiscount * (item.diskon || 0)) / 100);
    const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
    const repackCost = (item.repackItems || []).reduce((sum: number, r: any) => sum + r.biaya, 0);
    const totalCost = subtotalAfterDiscount + repackCost;

    return {
      ...item,
      subtotalBeforeDiscount,
      discountAmount,
      subtotalAfterDiscount,
      repackCost,
      totalCost,
      laba: (item.hargaJual - item.hargaBeli) * item.qty,
      persentaseLaba: ((item.hargaJual - item.hargaBeli) / item.hargaBeli * 100).toFixed(1)
    };
  });

  const subtotalPembelian = totalLabaPerItem.reduce((sum, item) => sum + item.subtotalAfterDiscount, 0);
  const totalRepackCost = totalLabaPerItem.reduce((sum, item) => sum + item.repackCost, 0);
  const subtotalWithRepack = subtotalPembelian + totalRepackCost;
  const ppnAmount = (subtotalWithRepack * ((data as any).ppn || 0)) / 100;
  const grandTotal = subtotalWithRepack + ppnAmount;
  const totalLaba = totalLabaPerItem.reduce((sum, item) => sum + item.laba, 0);

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
            <h2 style={{ color: '#000000' }}>Detail Pembelian</h2>
            <p style={{ color: '#27b446' }}>{data.nomorPembelian}</p>
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
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Tanggal Pembelian</p>
                <p style={{ color: '#000000' }}>
                  {format(data.tanggal, "dd MMMM yyyy, HH:mm", { locale: id })}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Supplier</p>
                <p style={{ color: '#000000' }}>{data.supplier}</p>
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
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Jual</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Diskon</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Total</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {totalLabaPerItem.map((item, index) => (
                    <React.Fragment key={index}>
                      <tr className="border-t border-gray-200">
                        <td className="px-4 py-3" style={{ color: '#1a0408', opacity: 0.7 }}>{item.sku}</td>
                        <td className="px-4 py-3">
                          <p style={{ color: '#1a0408' }}>{item.nama}</p>
                          {item.isRepack && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: '#27b446' }}>
                              Repack ({item.jumlahRepack}x)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qty}</td>
                        <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                          Rp {item.hargaBeli.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                          Rp {item.hargaJual.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>
                          {item.diskon ? `${item.diskon}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p style={{ color: '#000000' }}>
                            Rp {item.totalCost.toLocaleString('id-ID')}
                          </p>
                          {item.discountAmount > 0 && (
                            <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                              Diskon: -Rp {item.discountAmount.toLocaleString('id-ID')}
                            </p>
                          )}
                          {item.repackCost > 0 && (
                            <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                              Repack: +Rp {item.repackCost.toLocaleString('id-ID')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div>
                            <p style={{ color: '#27b446' }}>
                              Rp {item.laba.toLocaleString('id-ID')}
                            </p>
                            <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                              ({item.persentaseLaba}%)
                            </p>
                          </div>
                        </td>
                      </tr>

                      {/* Repack Items Details */}
                      {item.isRepack && item.repackItems && item.repackItems.length > 0 && (
                        <tr className="border-t border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                          <td colSpan={8} className="px-4 py-3">
                            <div className="ml-8">
                              <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.7 }}>
                                Bahan Repack:
                              </p>
                              <div className="space-y-1">
                                {item.repackItems.map((repackItem: any, ridx: number) => (
                                  <div key={ridx} className="flex justify-between text-sm">
                                    <span style={{ color: '#1a0408' }}>• {repackItem.namaBarang}</span>
                                    <span style={{ color: '#1a0408' }}>
                                      Rp {repackItem.biaya.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
                <span style={{ color: '#1a0408', opacity: 0.7 }}>Subtotal Pembelian</span>
                <span style={{ color: '#1a0408' }}>
                  Rp {subtotalPembelian.toLocaleString('id-ID')}
                </span>
              </div>

              {totalRepackCost > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: '#1a0408', opacity: 0.7 }}>Total Biaya Repack</span>
                  <span style={{ color: '#1a0408' }}>
                    Rp {totalRepackCost.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {(data as any).ppn > 0 && (
                <div className="flex justify-between items-center">
                  <span style={{ color: '#1a0408', opacity: 0.7 }}>PPn ({(data as any).ppn}%)</span>
                  <span style={{ color: '#1a0408' }}>
                    Rp {ppnAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-gray-300 flex justify-between items-center">
                <span className="text-lg" style={{ color: '#000000' }}>Grand Total</span>
                <span className="text-xl" style={{ color: '#27b446' }}>
                  Rp {grandTotal.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <div>
                  <p style={{ color: '#000000' }}>Total Laba (Estimasi)</p>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Jika semua produk terjual
                  </p>
                </div>
                <p className="text-2xl" style={{ color: '#27b446' }}>
                  Rp {totalLaba.toLocaleString('id-ID')}
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

interface CreatePembelianModalProps {
  existingNumbers: string[];
  onClose: () => void;
  onAdd: (data: typeof mockPembelianData[0]) => void;
}

function CreatePembelianModal({ existingNumbers, onClose, onAdd }: CreatePembelianModalProps) {
  const [nomorPembelian, setNomorPembelian] = useState("");
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplier, setSupplier] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [ppn, setPpn] = useState<number>(0); // PPn dalam persen
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [error, setError] = useState("");
  const productListRef = useRef<HTMLDivElement>(null);

  // List of previously used suppliers
  const previousSuppliers = useMemo(() => {
    const suppliers = Array.from(new Set(mockPembelianData.map(p => p.supplier)));
    return suppliers.sort();
  }, []);

  // Auto-generate purchase number on mount
  useEffect(() => {
    const today = new Date();
    const dateStr = format(today, "yyyyMMdd");

    // Find existing numbers for today
    const todayNumbers = existingNumbers
      .filter(num => num.includes(dateStr))
      .map(num => {
        const parts = num.split("-");
        return parseInt(parts[parts.length - 1]) || 0;
      });

    const nextNumber = todayNumbers.length > 0 ? Math.max(...todayNumbers) + 1 : 1;
    const generatedNumber = `PO-${dateStr}-${String(nextNumber).padStart(3, '0')}`;
    setNomorPembelian(generatedNumber);
  }, [existingNumbers]);

  // Auto-scroll to bottom when items are added
  useEffect(() => {
    if (productListRef.current && selectedItems.length > 0) {
      // Smooth scroll to bottom with a slight delay to ensure DOM is updated
      setTimeout(() => {
        productListRef.current?.scrollTo({
          top: productListRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [selectedItems.length]);

  // Filter products based on search query
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
      qty: 1,
      hargaBeli: 0,
      hargaJual: product.price,
      diskon: 0,
      isRepack: false,
      jumlahRepack: 0,
      repackItems: []
    }]);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleUpdateItem = (sku: string, field: string, value: any) => {
    setSelectedItems(items =>
      items.map(item =>
        item.sku === sku ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveItem = (sku: string) => {
    setSelectedItems(items => items.filter(item => item.sku !== sku));
  };

  const handleAddRepackItem = (sku: string) => {
    setSelectedItems(items =>
      items.map(item =>
        item.sku === sku
          ? {
              ...item,
              repackItems: [
                ...item.repackItems,
                { id: Date.now().toString(), namaBarang: "", biaya: 0 }
              ]
            }
          : item
      )
    );
  };

  const handleRemoveRepackItem = (sku: string, repackId: string) => {
    setSelectedItems(items =>
      items.map(item =>
        item.sku === sku
          ? {
              ...item,
              repackItems: item.repackItems.filter(r => r.id !== repackId)
            }
          : item
      )
    );
  };

  const handleUpdateRepackItem = (sku: string, repackId: string, field: keyof RepackItem, value: any) => {
    setSelectedItems(items =>
      items.map(item =>
        item.sku === sku
          ? {
              ...item,
              repackItems: item.repackItems.map(r =>
                r.id === repackId ? { ...r, [field]: value } : r
              )
            }
          : item
      )
    );
  };

  const handleSubmit = () => {
    setError("");

    // Validation - nomor pembelian is auto-generated, no need to validate
    if (!tanggal) {
      setError("Tanggal harus diisi");
      return;
    }

    if (!supplier.trim()) {
      setError("Supplier harus diisi");
      return;
    }

    if (selectedItems.length === 0) {
      setError("Minimal harus ada 1 produk");
      return;
    }

    // Validate all items have valid data
    for (const item of selectedItems) {
      if (item.qty <= 0) {
        setError(`Qty untuk ${item.nama} harus lebih dari 0`);
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
      if (item.hargaJual <= item.hargaBeli) {
        setError(`Harga Jual untuk ${item.nama} harus lebih tinggi dari Harga Beli`);
        return;
      }

      // Validate repack fields if repack is enabled
      if (item.isRepack) {
        if (item.jumlahRepack <= 0) {
          setError(`Jumlah Repack untuk ${item.nama} harus lebih dari 0`);
          return;
        }
        for (const repackItem of item.repackItems) {
          if (!repackItem.namaBarang.trim()) {
            setError(`Nama barang repack untuk ${item.nama} harus diisi`);
            return;
          }
          if (repackItem.biaya <= 0) {
            setError(`Biaya untuk bahan repack "${repackItem.namaBarang}" harus lebih dari 0`);
            return;
          }
        }
      }
    }

    // Create new pembelian
    const newPembelian = {
      nomorPembelian: nomorPembelian.trim(),
      tanggal: new Date(tanggal),
      supplier: supplier.trim(),
      items: selectedItems,
      ppn: ppn
    } as any;

    onAdd(newPembelian);
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
          <h2 style={{ color: '#000000' }}>Buat Pembelian Baru</h2>
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
                  Nomor Pembelian <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  value={nomorPembelian}
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

              <div className="relative">
                <label className="block mb-2" style={{ color: '#000000' }}>
                  Supplier <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nama Supplier"
                  value={supplier}
                  onChange={(e) => {
                    setSupplier(e.target.value);
                    setShowSupplierSuggestions(true);
                  }}
                  onFocus={() => setShowSupplierSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow clicking on suggestions
                    setTimeout(() => setShowSupplierSuggestions(false), 200);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                />

                {/* Supplier Suggestions */}
                {showSupplierSuggestions && supplier.length >= 2 && (() => {
                  const filteredSuppliers = previousSuppliers.filter(s => s.toLowerCase().includes(supplier.toLowerCase()));
                  return filteredSuppliers.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredSuppliers.map((supplierName, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSupplier(supplierName);
                            setShowSupplierSuggestions(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <p style={{ color: '#1a0408' }}>{supplierName}</p>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* PPn Field */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                PPn (%)
              </label>
              <input
                type="number"
                placeholder="0"
                value={ppn || ''}
                onChange={(e) => setPpn(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-32 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              />
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
                  className="border border-gray-200 rounded-lg overflow-hidden max-h-[700px] overflow-y-auto"
                >
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Jual</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Diskon (%)</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Subtotal</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>
                          <div className="flex items-center justify-center gap-1">
                            Repack
                            <div className="relative group">
                              <Info className="w-4 h-4 cursor-help" style={{ color: '#1a0408', opacity: 0.4 }} />
                              <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-64 p-3 rounded-lg shadow-xl bg-white border border-gray-200 z-50">
                                <p className="text-xs text-left" style={{ color: '#1a0408' }}>
                                  Aktifkan jika produk ini akan direpack menjadi produk yang lebih kecil.
                                  Bahan repack tidak masuk stok tetapi masuk perhitungan rugi laba.
                                </p>
                              </div>
                            </div>
                          </div>
                        </th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((item) => {
                        const subtotalBeforeDiscount = item.hargaBeli * item.qty;
                        const discountAmount = (subtotalBeforeDiscount * item.diskon) / 100;
                        const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
                        const repackCost = item.repackItems.reduce((sum, r) => sum + r.biaya, 0);
                        const totalWithRepack = subtotalAfterDiscount + repackCost;

                        return (
                          <React.Fragment key={item.sku}>
                            <tr className="border-t border-gray-200">
                              <td className="px-4 py-3">
                                <p style={{ color: '#1a0408' }}>{item.nama}</p>
                                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                                  {item.sku}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleUpdateItem(item.sku, 'qty', Math.max(1, item.qty - 1))}
                                    className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                                    style={{ borderColor: '#e5e7eb', color: '#1a0408' }}
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.qty}
                                    onChange={(e) => handleUpdateItem(item.sku, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                                    style={{
                                      color: '#1a0408',
                                      '--tw-ring-color': '#27b446'
                                    } as any}
                                  />
                                  <button
                                    onClick={() => handleUpdateItem(item.sku, 'qty', item.qty + 1)}
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
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={item.diskon || ''}
                                  onChange={(e) => handleUpdateItem(item.sku, 'diskon', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                  className="w-20 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 mx-auto"
                                  style={{
                                    color: '#1a0408',
                                    '--tw-ring-color': '#27b446'
                                  } as any}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <p style={{ color: '#000000' }}>
                                  Rp {totalWithRepack.toLocaleString('id-ID')}
                                </p>
                                {item.diskon > 0 && (
                                  <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                                    -{item.diskon}%: -Rp {discountAmount.toLocaleString('id-ID')}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center">
                                  <button
                                    onClick={() => handleUpdateItem(item.sku, 'isRepack', !item.isRepack)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                      item.isRepack ? 'bg-[#27b446]' : 'bg-gray-300'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        item.isRepack ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
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

                            {/* Repack Section */}
                            {item.isRepack && (
                              <tr className="border-t border-gray-200" style={{ backgroundColor: 'rgba(39, 180, 70, 0.02)' }}>
                                <td colSpan={8} className="px-4 py-4">
                                  <div className="ml-8 space-y-4">
                                    {/* Jumlah Repack */}
                                    <div>
                                      <label className="block mb-2 text-sm" style={{ color: '#000000' }}>
                                        Jumlah Repack
                                      </label>
                                      <input
                                        type="number"
                                        placeholder="0"
                                        value={item.jumlahRepack || ''}
                                        onChange={(e) => handleUpdateItem(item.sku, 'jumlahRepack', Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-48 px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2"
                                        style={{
                                          color: '#1a0408',
                                          '--tw-ring-color': '#27b446'
                                        } as any}
                                      />
                                    </div>

                                    {/* Bahan Kebutuhan Repack */}
                                    <div>
                                      <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm" style={{ color: '#000000' }}>
                                          Bahan Kebutuhan Repack
                                        </label>
                                        <button
                                          onClick={() => handleAddRepackItem(item.sku)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-sm transition-opacity hover:opacity-90"
                                          style={{ backgroundColor: '#27b446' }}
                                        >
                                          <Plus className="w-4 h-4" />
                                          Tambah Bahan
                                        </button>
                                      </div>

                                      {item.repackItems.length > 0 && (
                                        <div className="space-y-2">
                                          {item.repackItems.map((repackItem) => (
                                            <div key={repackItem.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 bg-white">
                                              <div className="flex-1">
                                                <input
                                                  type="text"
                                                  placeholder="Nama Barang"
                                                  value={repackItem.namaBarang}
                                                  onChange={(e) => handleUpdateRepackItem(item.sku, repackItem.id, 'namaBarang', e.target.value)}
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                                                  style={{
                                                    color: '#1a0408',
                                                    '--tw-ring-color': '#27b446'
                                                  } as any}
                                                />
                                              </div>
                                              <div className="w-48">
                                                <input
                                                  type="number"
                                                  placeholder="Biaya"
                                                  value={repackItem.biaya || ''}
                                                  onChange={(e) => handleUpdateRepackItem(item.sku, repackItem.id, 'biaya', parseInt(e.target.value) || 0)}
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                                                  style={{
                                                    color: '#1a0408',
                                                    '--tw-ring-color': '#27b446'
                                                  } as any}
                                                />
                                              </div>
                                              <button
                                                onClick={() => handleRemoveRepackItem(item.sku, repackItem.id)}
                                                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-red-50"
                                                style={{ borderColor: '#e40b18', color: '#e40b18' }}
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          ))}
                                          <div className="text-right mt-3 pt-2 border-t border-gray-200">
                                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                                              Total Biaya Repack: <span style={{ color: '#000000' }}>Rp {repackCost.toLocaleString('id-ID')}</span>
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Grand Total Summary */}
            {selectedItems.length > 0 && (
              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <h3 className="mb-3" style={{ color: '#000000' }}>Ringkasan Total</h3>
                <div className="space-y-3">
                  {(() => {
                    const subtotal = selectedItems.reduce((sum, item) => {
                      const itemSubtotal = item.hargaBeli * item.qty;
                      const discount = (itemSubtotal * item.diskon) / 100;
                      return sum + (itemSubtotal - discount);
                    }, 0);

                    const totalRepackCost = selectedItems.reduce((sum, item) => {
                      return sum + item.repackItems.reduce((repackSum, r) => repackSum + r.biaya, 0);
                    }, 0);

                    const subtotalWithRepack = subtotal + totalRepackCost;
                    const ppnAmount = (subtotalWithRepack * ppn) / 100;
                    const grandTotal = subtotalWithRepack + ppnAmount;

                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span style={{ color: '#1a0408', opacity: 0.7 }}>Subtotal Pembelian</span>
                          <span style={{ color: '#1a0408' }}>
                            Rp {subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>

                        {totalRepackCost > 0 && (
                          <div className="flex justify-between items-center">
                            <span style={{ color: '#1a0408', opacity: 0.7 }}>Total Biaya Repack</span>
                            <span style={{ color: '#1a0408' }}>
                              Rp {totalRepackCost.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        {ppn > 0 && (
                          <div className="flex justify-between items-center">
                            <span style={{ color: '#1a0408', opacity: 0.7 }}>PPn ({ppn}%)</span>
                            <span style={{ color: '#1a0408' }}>
                              Rp {ppnAmount.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        <div className="pt-3 border-t-2 border-gray-300 flex justify-between items-center">
                          <span className="text-lg" style={{ color: '#000000' }}>Grand Total</span>
                          <span className="text-2xl" style={{ color: '#27b446' }}>
                            Rp {grandTotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </>
                    );
                  })()}
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
            Simpan Pembelian
          </button>
        </div>
      </div>
    </div>
  );
}
