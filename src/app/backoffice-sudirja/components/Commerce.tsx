"use client";
import { useState, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, Calendar, ArrowUpDown, ArrowUp, ArrowDown,
  FileText, X, ChevronLeft, ChevronRight, ChevronDown, Truck, CheckCircle,
  CheckSquare, Square
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface CommerceOrder {
  id: string;
  date: Date;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  total: number;
  paymentMethod: string;
  status: "Diproses" | "Diantar" | "Selesai";
  items: Array<{
    name: string;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  voucher: string;
  courier?: {
    name: string;
    id: string;
  };
}

// Mock data pesanan commerce
const initialCommerceOrders: CommerceOrder[] = [
  {
    id: "COM-20260413-001",
    date: new Date(2026, 3, 13, 9, 15),
    customerName: "Andi Wijaya",
    customerAddress: "Jl. Sudirman No. 123, Jakarta Pusat",
    customerPhone: "081234567890",
    total: 429000, // 90000+70000+84000+80000+105000 = 429000, no voucher
    paymentMethod: "Bank Transfer",
    status: "Diproses",
    items: [
      { name: "Susu Ultra Milk 1L", qty: 5, price: 18000, subtotal: 90000 },
      { name: "Indomie Goreng", qty: 20, price: 3500, subtotal: 70000 },
      { name: "Telur Ayam 1kg", qty: 3, price: 28000, subtotal: 84000 },
      { name: "Beras Premium 5kg", qty: 2, price: 40000, subtotal: 80000 },
      { name: "Minyak Goreng 2L", qty: 3, price: 35000, subtotal: 105000 }
    ],
    voucher: ""
  },
  {
    id: "COM-20260413-002",
    date: new Date(2026, 3, 13, 10, 30),
    customerName: "Siti Rahmawati",
    customerAddress: "Jl. Gatot Subroto No. 45, Jakarta Selatan",
    customerPhone: "081234567891",
    total: 270900, // 80000+125000+96000 = 301000, DISC10 = -30100, total = 270900
    paymentMethod: "QRIS",
    status: "Diantar",
    items: [
      { name: "Sabun Mandi Lifebuoy", qty: 10, price: 8000, subtotal: 80000 },
      { name: "Shampo Pantene", qty: 5, price: 25000, subtotal: 125000 },
      { name: "Pasta Gigi Pepsodent", qty: 8, price: 12000, subtotal: 96000 },
    ],
    voucher: "DISC10",
    courier: {
      name: "Dewi Lestari",
      id: "USR-004"
    }
  },
  {
    id: "COM-20260413-003",
    date: new Date(2026, 3, 13, 11, 45),
    customerName: "Budi Santoso",
    customerAddress: "Jl. Thamrin No. 78, Jakarta Pusat",
    customerPhone: "081234567892",
    total: 2280000, // 2500000+350000 = 2850000, DISC20 = -570000, total = 2280000
    paymentMethod: "Bank Transfer",
    status: "Selesai",
    items: [
      { name: "TV LED 32 inch", qty: 1, price: 2500000, subtotal: 2500000 },
      { name: "Rice Cooker Miyako", qty: 1, price: 350000, subtotal: 350000 }
    ],
    voucher: "DISC20",
    courier: {
      name: "Fitri Handayani",
      id: "USR-006"
    }
  },
  {
    id: "COM-20260412-001",
    date: new Date(2026, 3, 12, 14, 20),
    customerName: "Dewi Lestari",
    customerAddress: "Jl. Asia Afrika No. 90, Bandung",
    customerPhone: "081234567893",
    total: 164000, // 60000+54000+50000 = 164000, no voucher
    paymentMethod: "QRIS",
    status: "Diproses",
    items: [
      { name: "Roti Tawar Sari Roti", qty: 5, price: 12000, subtotal: 60000 },
      { name: "Selai Strawberry", qty: 3, price: 18000, subtotal: 54000 },
      { name: "Keju Craft", qty: 2, price: 25000, subtotal: 50000 }
    ],
    voucher: ""
  },
  {
    id: "COM-20260412-002",
    date: new Date(2026, 3, 12, 16, 10),
    customerName: "Eko Prasetyo",
    customerAddress: "Jl. Braga No. 34, Bandung",
    customerPhone: "081234567894",
    total: 1215000, // 900000+450000 = 1350000, DISC10 = -135000, total = 1215000
    paymentMethod: "Bank Transfer",
    status: "Selesai",
    items: [
      { name: "Blender Philips", qty: 2, price: 450000, subtotal: 900000 },
      { name: "Setrika", qty: 3, price: 150000, subtotal: 450000 }
    ],
    voucher: "DISC10",
    courier: {
      name: "Indra Kusuma",
      id: "USR-009"
    }
  }
];

// Mock data kurir
const couriers = [
  { id: "USR-004", name: "Dewi Lestari" },
  { id: "USR-006", name: "Fitri Handayani" },
  { id: "USR-009", name: "Indra Kusuma" },
  { id: "USR-012", name: "Linda Maharani" },
  { id: "USR-014", name: "Nina Puspita" }
];

type SortField = "id" | "date" | "customerName" | "total" | "paymentMethod" | "status";
type SortDirection = "asc" | "desc" | null;

export default function Commerce() {

  const [orders, setOrders] = useState<CommerceOrder[]>(initialCommerceOrders);

  // State untuk filter
  const [searchId, setSearchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "Diproses" | "Diantar" | "Selesai">("all");

  // State untuk sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // State untuk pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk detail pesanan
  const [selectedOrder, setSelectedOrder] = useState<CommerceOrder | null>(null);

  // State untuk pilih kurir
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState("");
  const [orderForCourier, setOrderForCourier] = useState<CommerceOrder | null>(null);

  // State untuk bulk selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showBulkCourierModal, setShowBulkCourierModal] = useState(false);

  // Filter data
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Filter by ID
      if (searchId && !order.id.toLowerCase().includes(searchId.toLowerCase())) {
        return false;
      }

      // Filter by date range
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (order.date < fromDate) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (order.date > toDate) return false;
      }

      // Filter by status
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchId, dateFrom, dateTo, statusFilter]);

  // Sort data
  const sortedOrders = useMemo(() => {
    if (!sortField || !sortDirection) return filteredOrders;

    return [...filteredOrders].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "date") {
        aValue = a.date.getTime();
        bValue = b.date.getTime();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

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
    setSearchId("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchId || dateFrom || dateTo || statusFilter !== "all";

  const handleSelectCourier = (order: CommerceOrder) => {
    setOrderForCourier(order);
    setSelectedCourier("");
    setShowCourierModal(true);
  };

  const handleAssignCourier = () => {
    if (!selectedCourier || !orderForCourier) return;

    const courier = couriers.find(c => c.id === selectedCourier);
    if (!courier) return;

    setOrders(prev => prev.map(order =>
      order.id === orderForCourier.id
        ? { ...order, status: "Diantar" as const, courier: { name: courier.name, id: courier.id } }
        : order
    ));

    setShowCourierModal(false);
    setSelectedCourier("");
    setOrderForCourier(null);
  };

  const handleCompleteOrder = (order: CommerceOrder) => {
    setOrders(prev => prev.map(o =>
      o.id === order.id
        ? { ...o, status: "Selesai" as const }
        : o
    ));
  };

  // Bulk selection handlers
  const handleToggleSelect = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.length === paginatedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(paginatedOrders.map(o => o.id));
    }
  };

  const handleBulkAssignCourier = () => {
    if (!selectedCourier) return;

    const courier = couriers.find(c => c.id === selectedCourier);
    if (!courier) return;

    setOrders(prev => prev.map(order =>
      selectedOrderIds.includes(order.id) && order.status === "Diproses"
        ? { ...order, status: "Diantar" as const, courier: { name: courier.name, id: courier.id } }
        : order
    ));

    setShowBulkCourierModal(false);
    setSelectedCourier("");
    setSelectedOrderIds([]);
  };

  const handleBulkComplete = () => {
    setOrders(prev => prev.map(order =>
      selectedOrderIds.includes(order.id) && order.status === "Diantar"
        ? { ...order, status: "Selesai" as const }
        : order
    ));
    setSelectedOrderIds([]);
  };

  const selectedDiprosesCount = selectedOrderIds.filter(id => {
    const order = orders.find(o => o.id === id);
    return order?.status === "Diproses";
  }).length;

  const selectedDiantarCount = selectedOrderIds.filter(id => {
    const order = orders.find(o => o.id === id);
    return order?.status === "Diantar";
  }).length;

    

  
  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="commerce" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl mb-1" style={{ color: '#000000' }}>Commerce</h1>
              <p style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola pesanan dari website online
              </p>
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

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2 rounded-lg border-2 focus:outline-none focus:ring-2 cursor-pointer"
                style={{
                  color: '#1a0408',
                  borderColor: '#27b446',
                  '--tw-ring-color': '#27b446'
                } as any}
              >
                <option value="all">Semua Status</option>
                <option value="Diproses">Diproses</option>
                <option value="Diantar">Diantar</option>
                <option value="Selesai">Selesai</option>
              </select>
              <ChevronDown
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#1a0408', opacity: 0.6 }}
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
              Menampilkan {paginatedOrders.length} dari {sortedOrders.length} pesanan
              {hasActiveFilters && ` (difilter dari ${orders.length} total)`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <tr>
                  <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center"
                      style={{ color: '#27b446' }}
                    >
                      {selectedOrderIds.length === paginatedOrders.length && paginatedOrders.length > 0 ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      ID Pesanan
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Tanggal & Waktu
                      {getSortIcon("date")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left">
                    <button
                      onClick={() => handleSort("customerName")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Pelanggan
                      {getSortIcon("customerName")}
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
                      onClick={() => handleSort("paymentMethod")}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                      style={{ color: '#000000' }}
                    >
                      Pembayaran
                      {getSortIcon("paymentMethod")}
                    </button>
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
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div style={{ color: '#1a0408', opacity: 0.4 }}>
                        {hasActiveFilters ? "Tidak ada pesanan yang sesuai dengan filter" : "Belum ada data pesanan"}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-200 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(order.id);
                          }}
                          className="flex items-center justify-center"
                          style={{ color: '#27b446' }}
                        >
                          {selectedOrderIds.includes(order.id) ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        style={{ color: '#27b446' }}
                      >
                        {order.id}
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        style={{ color: '#1a0408' }}
                      >
                        {format(order.date, "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        style={{ color: '#1a0408' }}
                      >
                        <div>
                          <div>{order.customerName}</div>
                          <div style={{ opacity: 0.6, fontSize: '0.875rem' }}>{order.customerPhone}</div>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 text-right cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        style={{ color: '#000000' }}
                      >
                        Rp {order.total.toLocaleString('id-ID')}
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                        style={{ color: '#1a0408' }}
                      >
                        <span className="px-3 py-1 rounded-full text-sm" style={{
                          backgroundColor: order.paymentMethod === 'Tunai' ? '#fef3c7' :
                                         order.paymentMethod === 'QRIS' ? '#dbeafe' : '#f3e8ff',
                          color: order.paymentMethod === 'Tunai' ? '#92400e' :
                                 order.paymentMethod === 'QRIS' ? '#1e40af' : '#6b21a8'
                        }}>
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-center cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <span className="px-3 py-1 rounded-full text-sm" style={{
                          backgroundColor: order.status === "Diproses" ? 'rgba(228, 11, 24, 0.1)' :
                                         order.status === "Diantar" ? 'rgba(39, 180, 70, 0.1)' :
                                         '#dcfce7',
                          color: order.status === "Diproses" ? '#e40b18' :
                                order.status === "Diantar" ? '#27b446' :
                                '#166534'
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
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedOrders.length)} dari {sortedOrders.length} pesanan
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

          {/* Bulk Action Bar */}
          {selectedOrderIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
              <div className="bg-white rounded-xl shadow-2xl border-2 px-6 py-4 flex items-center gap-4" style={{ borderColor: '#27b446' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: '#000000' }}>{selectedOrderIds.length} pesanan dipilih</span>
                </div>

                <div className="h-6 w-px bg-gray-300" />

                {selectedDiprosesCount > 0 && (
                  <button
                    onClick={() => setShowBulkCourierModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#27b446' }}
                  >
                    <Truck className="w-4 h-4" />
                    Pilih Kurir ({selectedDiprosesCount})
                  </button>
                )}

                {selectedDiantarCount > 0 && (
                  <button
                    onClick={handleBulkComplete}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#27b446' }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Selesaikan ({selectedDiantarCount})
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrderIds([])}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#e40b18', color: '#e40b18' }}
                >
                  <X className="w-4 h-4" />
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Pesanan Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSelectCourier={handleSelectCourier}
          onCompleteOrder={handleCompleteOrder}
        />
      )}

      {/* Pilih Kurir Modal */}
      {showCourierModal && orderForCourier && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ color: '#000000' }}>Pilih Kurir</h2>
              <button
                onClick={() => {
                  setShowCourierModal(false);
                  setSelectedCourier("");
                  setOrderForCourier(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: '#1a0408' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>ID Pesanan</p>
                <p style={{ color: '#27b446' }}>{orderForCourier.id}</p>
              </div>

              <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                Pilih Kurir
              </label>
              <div className="relative">
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                >
                  <option value="">-- Pilih Kurir --</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name} ({courier.id})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCourierModal(false);
                  setSelectedCourier("");
                  setOrderForCourier(null);
                }}
                className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-gray-50"
                style={{
                  borderColor: '#e5e7eb',
                  color: '#1a0408'
                }}
              >
                Batal
              </button>
              <button
                onClick={handleAssignCourier}
                disabled={!selectedCourier}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#27b446' }}
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Pilih Kurir Modal */}
      {showBulkCourierModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ color: '#000000' }}>Pilih Kurir (Bulk)</h2>
              <button
                onClick={() => {
                  setShowBulkCourierModal(false);
                  setSelectedCourier("");
                }}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: '#1a0408' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Jumlah Pesanan</p>
                <p style={{ color: '#27b446' }}>{selectedDiprosesCount} pesanan (status: Diproses)</p>
              </div>

              <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                Pilih Kurir
              </label>
              <div className="relative">
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                  style={{
                    color: '#1a0408',
                    '--tw-ring-color': '#27b446'
                  } as any}
                >
                  <option value="">-- Pilih Kurir --</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name} ({courier.id})
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkCourierModal(false);
                  setSelectedCourier("");
                }}
                className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-gray-50"
                style={{
                  borderColor: '#e5e7eb',
                  color: '#1a0408'
                }}
              >
                Batal
              </button>
              <button
                onClick={handleBulkAssignCourier}
                disabled={!selectedCourier}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#27b446' }}
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface OrderDetailModalProps {
  order: CommerceOrder;
  onClose: () => void;
  onSelectCourier: (order: CommerceOrder) => void;
  onCompleteOrder: (order: CommerceOrder) => void;
}

function OrderDetailModal({ order, onClose, onSelectCourier, onCompleteOrder }: OrderDetailModalProps) {
  // Calculate totals
  const subtotalAmount = order.items.reduce((sum, item) => sum + item.subtotal, 0);

  // Calculate discount based on voucher
  let discountPercent = 0;
  if (order.voucher) {
    if (order.voucher === "DISC20") discountPercent = 0.2;
    else if (order.voucher === "DISC10") discountPercent = 0.1;
    else if (order.voucher === "DISC5") discountPercent = 0.05;
  }
  const discountAmount = Math.floor(subtotalAmount * discountPercent);
  const grandTotal = subtotalAmount - discountAmount;

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
            <h2 style={{ color: '#000000' }}>Detail Pesanan Commerce</h2>
            <p style={{ color: '#27b446' }}>{order.id}</p>
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
                  {format(order.date, "dd MMMM yyyy, HH:mm", { locale: id })}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Pelanggan</p>
                <p style={{ color: '#000000' }}>{order.customerName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Alamat Pengiriman</p>
                <p style={{ color: '#000000' }}>{order.customerAddress}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Nomor Telepon</p>
                <p style={{ color: '#000000' }}>{order.customerPhone}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Metode Pembayaran</p>
                <p style={{ color: '#000000' }}>{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Status</p>
                <span className="px-3 py-1 rounded-full text-sm inline-block" style={{
                  backgroundColor: order.status === "Diproses" ? 'rgba(228, 11, 24, 0.1)' :
                                 order.status === "Diantar" ? 'rgba(39, 180, 70, 0.1)' :
                                 '#dcfce7',
                  color: order.status === "Diproses" ? '#e40b18' :
                        order.status === "Diantar" ? '#27b446' :
                        '#166534'
                }}>
                  {order.status}
                </span>
              </div>
              {order.courier && (
                <div>
                  <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Kurir</p>
                  <p style={{ color: '#000000' }}>{order.courier.name}</p>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{order.courier.id}</p>
                </div>
              )}
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
                      <td className="px-4 py-3" style={{ color: '#1a0408' }}>{item.name}</td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>{item.qty}</td>
                      <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                        Rp {item.price.toLocaleString('id-ID')}
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
                {order.voucher && (
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-gray-50"
            style={{
              borderColor: '#e5e7eb',
              color: '#1a0408'
            }}
          >
            Tutup
          </button>

          {order.status === "Diproses" && (
            <button
              onClick={() => {
                onSelectCourier(order);
                onClose();
              }}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#27b446' }}
            >
              <Truck className="w-5 h-5" />
              Pilih Kurir
            </button>
          )}

          {order.status === "Diantar" && (
            <button
              onClick={() => {
                onCompleteOrder(order);
                onClose();
              }}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#27b446' }}
            >
              <CheckCircle className="w-5 h-5" />
              Selesaikan Pesanan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
