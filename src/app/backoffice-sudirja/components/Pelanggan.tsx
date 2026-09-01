"use client";
import { useState, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Users, Phone, Mail, MapPin, Calendar, ShoppingBag, CheckCircle,
  CheckSquare, Square
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Interface untuk customer
interface Customer {
  id: string;
  nama: string;
  email: string;
  telepon: string;
  alamat: string;
  kecamatan: string;
  tanggalDaftar: Date;
  isMember: boolean;
  riwayatPembelian: Array<{
    id: string;
    tanggal: Date;
    total: number;
    items: Array<{
      nama: string;
      qty: number;
      harga: number;
    }>;
  }>;
}

// Mock data pelanggan
const initialCustomers: Customer[] = [
  {
    id: "CUST-001",
    nama: "Ahmad Hidayat",
    email: "ahmad.hidayat@email.com",
    telepon: "081234567890",
    alamat: "Jl. Merdeka No. 123, RT 01/RW 05",
    kecamatan: "Ciputat",
    tanggalDaftar: new Date(2025, 0, 15),
    isMember: true,
    riwayatPembelian: [
      {
        id: "ONL-20260408-001",
        tanggal: new Date(2026, 3, 8, 14, 20),
        total: 185000,
        items: [
          { nama: "Susu Ultra Milk 1L", qty: 5, harga: 18000 },
          { nama: "Roti Tawar Sari Roti", qty: 3, harga: 12000 },
          { nama: "Telur Ayam 1kg", qty: 2, harga: 28000 }
        ]
      },
      {
        id: "ONL-20260315-002",
        tanggal: new Date(2026, 2, 15, 10, 30),
        total: 320000,
        items: [
          { nama: "Beras Premium 5kg", qty: 2, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 3, harga: 35000 },
          { nama: "Gula Pasir 1kg", qty: 5, harga: 14000 }
        ]
      }
    ]
  },
  {
    id: "CUST-002",
    nama: "Dewi Lestari",
    email: "dewi.lestari@email.com",
    telepon: "082345678901",
    alamat: "Jl. Gatot Subroto No. 45, RT 02/RW 03",
    kecamatan: "Ciputat Timur",
    tanggalDaftar: new Date(2025, 1, 20),
    isMember: false,
    riwayatPembelian: [
      {
        id: "ONL-20260409-001",
        tanggal: new Date(2026, 3, 9, 10, 15),
        total: 320000,
        items: [
          { nama: "Beras Premium 5kg", qty: 3, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 2, harga: 35000 }
        ]
      }
    ]
  },
  {
    id: "CUST-003",
    nama: "Budi Santoso",
    email: "budi.santoso@email.com",
    telepon: "083456789012",
    alamat: "Jl. Sudirman No. 78, RT 03/RW 02",
    kecamatan: "Pamulang",
    tanggalDaftar: new Date(2025, 2, 10),
    isMember: true,
    riwayatPembelian: [
      {
        id: "ONL-20260401-003",
        tanggal: new Date(2026, 3, 1, 15, 45),
        total: 450000,
        items: [
          { nama: "Beras Premium 5kg", qty: 4, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 5, harga: 35000 },
          { nama: "Telur Ayam 1kg", qty: 2, harga: 28000 }
        ]
      }
    ]
  },
  {
    id: "CUST-004",
    nama: "Siti Rahmawati",
    email: "siti.rahmawati@email.com",
    telepon: "084567890123",
    alamat: "Jl. Raya Ciputat No. 234, RT 05/RW 08",
    kecamatan: "Ciputat",
    tanggalDaftar: new Date(2025, 3, 5),
    isMember: false,
    riwayatPembelian: [
      {
        id: "ONL-20260320-004",
        tanggal: new Date(2026, 2, 20, 11, 30),
        total: 275000,
        items: [
          { nama: "Susu Ultra Milk 1L", qty: 10, harga: 18000 },
          { nama: "Indomie Goreng", qty: 20, harga: 3500 }
        ]
      }
    ]
  },
  {
    id: "CUST-005",
    nama: "Eko Prasetyo",
    email: "eko.prasetyo@email.com",
    telepon: "085678901234",
    alamat: "Jl. Ahmad Yani No. 567, RT 04/RW 06",
    kecamatan: "Ciputat Timur",
    tanggalDaftar: new Date(2025, 4, 12),
    isMember: true,
    riwayatPembelian: [
      {
        id: "ONL-20260405-005",
        tanggal: new Date(2026, 3, 5, 9, 20),
        total: 560000,
        items: [
          { nama: "Beras Premium 5kg", qty: 5, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 4, harga: 35000 },
          { nama: "Gula Pasir 1kg", qty: 10, harga: 14000 }
        ]
      }
    ]
  },
  {
    id: "CUST-006",
    nama: "Rina Kusuma",
    email: "rina.kusuma@email.com",
    telepon: "086789012345",
    alamat: "Jl. Veteran No. 89, RT 01/RW 04",
    kecamatan: "Pamulang",
    tanggalDaftar: new Date(2025, 5, 18),
    isMember: false,
    riwayatPembelian: []
  },
  {
    id: "CUST-007",
    nama: "Agus Setiawan",
    email: "agus.setiawan@email.com",
    telepon: "087890123456",
    alamat: "Jl. Diponegoro No. 112, RT 02/RW 01",
    kecamatan: "Ciputat",
    tanggalDaftar: new Date(2025, 6, 22),
    isMember: true,
    riwayatPembelian: [
      {
        id: "ONL-20260410-007",
        tanggal: new Date(2026, 3, 10, 13, 10),
        total: 380000,
        items: [
          { nama: "Beras Premium 5kg", qty: 3, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 3, harga: 35000 },
          { nama: "Telur Ayam 1kg", qty: 4, harga: 28000 }
        ]
      }
    ]
  },
  {
    id: "CUST-008",
    nama: "Lina Marlina",
    email: "lina.marlina@email.com",
    telepon: "088901234567",
    alamat: "Jl. Kartini No. 45, RT 03/RW 07",
    kecamatan: "Ciputat Timur",
    tanggalDaftar: new Date(2025, 7, 8),
    isMember: false,
    riwayatPembelian: []
  },
  {
    id: "CUST-009",
    nama: "Rudi Hermawan",
    email: "rudi.hermawan@email.com",
    telepon: "089012345678",
    alamat: "Jl. Pahlawan No. 678, RT 05/RW 09",
    kecamatan: "Pamulang",
    tanggalDaftar: new Date(2025, 8, 14),
    isMember: true,
    riwayatPembelian: [
      {
        id: "ONL-20260412-009",
        tanggal: new Date(2026, 3, 12, 16, 45),
        total: 420000,
        items: [
          { nama: "Beras Premium 5kg", qty: 4, harga: 65000 },
          { nama: "Minyak Goreng 2L", qty: 2, harga: 35000 },
          { nama: "Gula Pasir 1kg", qty: 8, harga: 14000 }
        ]
      }
    ]
  },
  {
    id: "CUST-010",
    nama: "Fitri Handayani",
    email: "fitri.handayani@email.com",
    telepon: "081122334455",
    alamat: "Jl. Proklamasi No. 321, RT 06/RW 10",
    kecamatan: "Ciputat",
    tanggalDaftar: new Date(2025, 9, 3),
    isMember: false,
    riwayatPembelian: []
  }
];

type SortField = "id" | "nama" | "kecamatan" | "tanggalDaftar";
type SortDirection = "asc" | "desc" | null;

export default function Pelanggan() {

    

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKecamatan, setFilterKecamatan] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Get unique kecamatan for filter
  const kecamatanList = useMemo(() => {
    const uniqueKecamatan = Array.from(new Set(customers.map(c => c.kecamatan)));
    return uniqueKecamatan.sort();
  }, [customers]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = customer.id.toLowerCase().includes(query) || customer.nama.toLowerCase().includes(query);
      const matchesKecamatan = filterKecamatan === "all" || customer.kecamatan === filterKecamatan;
      return matchesSearch && matchesKecamatan;
    });
  }, [customers, searchQuery, filterKecamatan]);

  // Sort customers
  const sortedCustomers = useMemo(() => {
    if (!sortField || !sortDirection) return filteredCustomers;

    return [...filteredCustomers].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "tanggalDaftar") {
        aValue = a.tanggalDaftar.getTime();
        bValue = b.tanggalDaftar.getTime();
      } else if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCustomers, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (field: SortField) => {
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(new Set(paginatedCustomers.map(c => c.id)));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleBulkSetMember = () => {
    if (selectedCustomers.size === 0) {
      alert("Pilih pelanggan terlebih dahulu");
      return;
    }

    setCustomers(customers.map(c =>
      selectedCustomers.has(c.id) ? { ...c, isMember: true } : c
    ));
    setSelectedCustomers(new Set());
    alert(`${selectedCustomers.size} pelanggan telah diset sebagai member`);
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pelanggan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pelanggan</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data pelanggan dan riwayat pembelian
              </p>
            </div>

            {selectedCustomers.size > 0 && (
              <button
                onClick={handleBulkSetMember}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#27b446' }}
              >
                <CheckCircle className="w-5 h-5" />
                Set {selectedCustomers.size} Pelanggan sebagai Member
              </button>
            )}
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari berdasarkan ID atau nama pelanggan..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
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
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={filterKecamatan}
                onChange={(e) => {
                  setFilterKecamatan(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                style={{
                  color: '#1a0408',
                  '--tw-ring-color': '#27b446'
                } as any}
              >
                <option value="all">Semua Kecamatan</option>
                {kecamatanList.map((kec) => (
                  <option key={kec} value={kec}>{kec}</option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: '#1a0408', opacity: 0.6 }}
              />
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto p-8">
          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {paginatedCustomers.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button
                            onClick={() => handleSelectAll(paginatedCustomers.length > 0 && !paginatedCustomers.every(c => selectedCustomers.has(c.id)))}
                            className="flex items-center justify-center"
                            style={{ color: '#27b446' }}
                          >
                            {selectedCustomers.size > 0 && paginatedCustomers.every(c => selectedCustomers.has(c.id)) ? (
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
                            ID Pelanggan
                            {getSortIcon("id")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("nama")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Nama
                            {getSortIcon("nama")}
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
                        <th className="px-6 py-4 text-left">
                          <button
                            onClick={() => handleSort("tanggalDaftar")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            style={{ color: '#000000' }}
                          >
                            Tanggal Daftar
                            {getSortIcon("tanggalDaftar")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCustomers.map((customer, index) => (
                        <tr
                          key={customer.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{
                            backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff'
                          }}
                        >
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCustomer(customer.id, !selectedCustomers.has(customer.id));
                              }}
                              className="flex items-center justify-center"
                              style={{ color: '#27b446' }}
                            >
                              {selectedCustomers.has(customer.id) ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => setViewingCustomer(customer)}
                            style={{ color: '#27b446', fontFamily: 'monospace' }}
                          >
                            {customer.id}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => setViewingCustomer(customer)}
                            style={{ color: '#1a0408' }}
                          >
                            {customer.nama}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => setViewingCustomer(customer)}
                            style={{ color: '#1a0408' }}
                          >
                            {customer.kecamatan}
                          </td>
                          <td
                            className="px-6 py-4 cursor-pointer"
                            onClick={() => setViewingCustomer(customer)}
                            style={{ color: '#1a0408' }}
                          >
                            {format(customer.tanggalDaftar, "dd MMM yyyy", { locale: id })}
                          </td>
                          <td
                            className="px-6 py-4 text-center cursor-pointer"
                            onClick={() => setViewingCustomer(customer)}
                          >
                            {customer.isMember ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                                <CheckCircle className="w-4 h-4" />
                                Member
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                                Reguler
                              </span>
                            )}
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
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, sortedCustomers.length)} dari {sortedCustomers.length} pelanggan
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
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Users className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Pelanggan tidak ditemukan</p>
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

      {/* Customer Detail Modal */}
      {viewingCustomer && (
        <CustomerDetailModal
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onUpdateMember={(customerId, isMember) => {
            setCustomers(customers.map(c => c.id === customerId ? { ...c, isMember } : c));
            setViewingCustomer(customers.find(c => c.id === customerId && c.id === viewingCustomer.id) ? { ...viewingCustomer, isMember } : viewingCustomer);
          }}
        />
      )}
    </div>
  );
}

// Customer Detail Modal
interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  onUpdateMember: (customerId: string, isMember: boolean) => void;
}

function CustomerDetailModal({ customer, onClose, onUpdateMember }: CustomerDetailModalProps) {
  const totalBelanja = customer.riwayatPembelian.reduce((sum, order) => sum + order.total, 0);
  const totalTransaksi = customer.riwayatPembelian.length;

  const handleToggleMember = () => {
    onUpdateMember(customer.id, !customer.isMember);
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
            <h2 style={{ color: '#000000' }}>Detail Pelanggan</h2>
            <p style={{ color: '#27b446' }}>{customer.id}</p>
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
          {/* Info Pelanggan */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#000000' }}>Informasi Pelanggan</h3>
              {customer.isMember ? (
                <button
                  onClick={handleToggleMember}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: '#e40b18',
                    color: '#e40b18'
                  }}
                >
                  <X className="w-4 h-4" />
                  Lepas Membership
                </button>
              ) : (
                <button
                  onClick={handleToggleMember}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}
                >
                  <CheckCircle className="w-4 h-4" />
                  Set Sebagai Member
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4" style={{ color: '#27b446' }} />
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Lengkap</p>
                  </div>
                  <p style={{ color: '#000000' }}>{customer.nama}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4" style={{ color: '#27b446' }} />
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Email</p>
                  </div>
                  <p style={{ color: '#000000' }}>{customer.email}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-4 h-4" style={{ color: '#27b446' }} />
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Nomor Telepon</p>
                  </div>
                  <p style={{ color: '#000000' }}>{customer.telepon}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4" style={{ color: '#27b446' }} />
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Alamat Lengkap</p>
                  </div>
                  <p style={{ color: '#000000' }}>{customer.alamat}</p>
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                    Kec. {customer.kecamatan}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4" style={{ color: '#27b446' }} />
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Tanggal Daftar</p>
                  </div>
                  <p style={{ color: '#000000' }}>
                    {format(customer.tanggalDaftar, "dd MMMM yyyy", { locale: id })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistik */}
          <div className="mb-6">
            <h3 className="mb-4" style={{ color: '#000000' }}>Statistik Pembelian</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Transaksi</p>
                <p className="text-2xl" style={{ color: '#27b446' }}>{totalTransaksi}</p>
              </div>
              <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Belanja</p>
                <p className="text-2xl" style={{ color: '#27b446' }}>Rp {totalBelanja.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>

          {/* Riwayat Pembelian */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5" style={{ color: '#27b446' }} />
              <h3 style={{ color: '#000000' }}>Riwayat Pembelian</h3>
            </div>

            {customer.riwayatPembelian.length === 0 ? (
              <div className="p-8 text-center rounded-lg border-2 border-dashed" style={{ borderColor: '#e5e7eb' }}>
                <ShoppingBag className="w-12 h-12 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.3 }} />
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Belum ada riwayat pembelian</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customer.riwayatPembelian.map((order) => (
                  <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p style={{ color: '#27b446' }}>{order.id}</p>
                        <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                          {format(order.tanggal, "dd MMMM yyyy, HH:mm", { locale: id })}
                        </p>
                      </div>
                      <p className="text-xl" style={{ color: '#000000' }}>
                        Rp {order.total.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.6 }}>Item Pembelian:</p>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span style={{ color: '#1a0408' }}>
                              {item.nama} <span style={{ opacity: 0.6 }}>x {item.qty}</span>
                            </span>
                            <span style={{ color: '#1a0408' }}>
                              Rp {(item.harga * item.qty).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
