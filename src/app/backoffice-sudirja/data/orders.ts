export const mockOrders = [
  // === 15 Juni 2026 ===
  {
    id: "ORD-20260615-001",
    date: new Date(2026, 5, 15, 8, 10),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 235000,
    paymentMethod: "Tunai",
    status: "Selesai",
    items: [
      { name: "Susu Ultra Milk 1L", qty: 2, price: 18000, subtotal: 36000 },
      { name: "Indomie Goreng", qty: 10, price: 3500, subtotal: 35000 },
      { name: "Telur Ayam 1kg", qty: 3, price: 28000, subtotal: 84000 },
      { name: "Beras Premium 5kg", qty: 2, price: 40000, subtotal: 80000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 250000,
    change: 15000
  },
  {
    id: "ORD-20260615-002",
    date: new Date(2026, 5, 15, 9, 5),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 1250000,
    paymentMethod: "Kredit — Cicil 12 Bulan",
    status: "Menunggu Pembayaran",
    items: [
      { name: "Rice Cooker Miyako 1.8L", qty: 1, price: 550000, subtotal: 550000 },
      { name: "Blender Philips 600W", qty: 1, price: 450000, subtotal: 450000 },
      { name: "Teko Listrik Cosmos", qty: 1, price: 250000, subtotal: 250000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260615-003",
    date: new Date(2026, 5, 15, 10, 30),
    cashier: "Ahmad Hidayat",
    cashierId: "CSR003",
    total: 450000,
    paymentMethod: "QRIS",
    status: "Selesai",
    items: [
      { name: "Minyak Goreng 2L", qty: 3, price: 35000, subtotal: 105000 },
      { name: "Gula Pasir 1kg", qty: 5, price: 14000, subtotal: 70000 },
      { name: "Kopi Kapal Api", qty: 10, price: 12000, subtotal: 120000 },
      { name: "Teh Sariwangi", qty: 15, price: 10000, subtotal: 150000 }
    ],
    cashIn: { amount: 50000, reason: "Tambahan modal awal" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260615-004",
    date: new Date(2026, 5, 15, 11, 20),
    cashier: "Dewi Kusuma",
    cashierId: "CSR004",
    total: 3200000,
    paymentMethod: "Kredit — Cicil 6 Bulan",
    status: "Diproses",
    items: [
      { name: "TV LED 32 inch Samsung", qty: 1, price: 2800000, subtotal: 2800000 },
      { name: "Bracket TV", qty: 1, price: 250000, subtotal: 250000 },
      { name: "Kabel HDMI 2m", qty: 1, price: 150000, subtotal: 150000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC5",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260615-005",
    date: new Date(2026, 5, 15, 13, 0),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 180000,
    paymentMethod: "Bank Transfer",
    status: "Selesai",
    items: [
      { name: "Sabun Mandi Lifebuoy", qty: 5, price: 8000, subtotal: 40000 },
      { name: "Shampo Pantene 170ml", qty: 3, price: 25000, subtotal: 75000 },
      { name: "Pasta Gigi Pepsodent", qty: 4, price: 12000, subtotal: 48000 },
      { name: "Sikat Gigi", qty: 5, price: 6000, subtotal: 30000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 25000, reason: "Bayar kurir ekspedisi" },
    voucher: "DISC10",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260615-006",
    date: new Date(2026, 5, 15, 14, 45),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 875000,
    paymentMethod: "Kredit — Bayar Bulan Depan",
    status: "Menunggu Konfirmasi",
    items: [
      { name: "Dispenser Cosmos", qty: 1, price: 550000, subtotal: 550000 },
      { name: "Galon Aqua 19L", qty: 5, price: 20000, subtotal: 100000 },
      { name: "Gelas Plastik Set", qty: 3, price: 75000, subtotal: 225000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260615-007",
    date: new Date(2026, 5, 15, 15, 30),
    cashier: "Ahmad Hidayat",
    cashierId: "CSR003",
    total: 92000,
    paymentMethod: "Tunai",
    status: "Dibatalkan",
    items: [
      { name: "Roti Tawar Sari Roti", qty: 3, price: 12000, subtotal: 36000 },
      { name: "Selai Strawberry", qty: 2, price: 18000, subtotal: 36000 },
      { name: "Mentega Blue Band 200gr", qty: 1, price: 16000, subtotal: 16000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 100000,
    change: 8000
  },
  // === 14 Juni 2026 ===
  {
    id: "ORD-20260614-001",
    date: new Date(2026, 5, 14, 9, 15),
    cashier: "Dewi Kusuma",
    cashierId: "CSR004",
    total: 5400000,
    paymentMethod: "Kredit — Cicil 12 Bulan",
    status: "Aktif",
    items: [
      { name: "AC Daikin 1PK", qty: 1, price: 4200000, subtotal: 4200000 },
      { name: "Bracket AC", qty: 1, price: 350000, subtotal: 350000 },
      { name: "Pipa AC Set", qty: 2, price: 425000, subtotal: 850000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC5",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260614-002",
    date: new Date(2026, 5, 14, 10, 40),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 650000,
    paymentMethod: "Tunai",
    status: "Selesai",
    items: [
      { name: "Daging Sapi 1kg", qty: 2, price: 150000, subtotal: 300000 },
      { name: "Ayam Potong 1kg", qty: 3, price: 35000, subtotal: 105000 },
      { name: "Ikan Bandeng", qty: 5, price: 25000, subtotal: 125000 },
      { name: "Udang Windu", qty: 2, price: 60000, subtotal: 120000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 700000,
    change: 50000
  },
  {
    id: "ORD-20260614-003",
    date: new Date(2026, 5, 14, 13, 20),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 2100000,
    paymentMethod: "Kredit — Cicil 3 Bulan",
    status: "Selesai",
    items: [
      { name: "Mesin Cuci Aqua 7kg", qty: 1, price: 1900000, subtotal: 1900000 },
      { name: "Deterjen Rinso 900gr", qty: 5, price: 28000, subtotal: 140000 },
      { name: "Pewangi Molto 600ml", qty: 3, price: 20000, subtotal: 60000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC10",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260614-004",
    date: new Date(2026, 5, 14, 15, 0),
    cashier: "Ahmad Hidayat",
    cashierId: "CSR003",
    total: 125000,
    paymentMethod: "QRIS",
    status: "Selesai",
    items: [
      { name: "Roti Tawar Sari Roti", qty: 3, price: 12000, subtotal: 36000 },
      { name: "Selai Strawberry", qty: 2, price: 18000, subtotal: 36000 },
      { name: "Mentega Blue Band 200gr", qty: 2, price: 16000, subtotal: 32000 },
      { name: "Keju Craft", qty: 1, price: 25000, subtotal: 25000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC5",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260614-005",
    date: new Date(2026, 5, 14, 16, 30),
    cashier: "Dewi Kusuma",
    cashierId: "CSR004",
    total: 1750000,
    paymentMethod: "Kredit — Cicil 6 Bulan",
    status: "Menunggu Pembayaran",
    items: [
      { name: "Kulkas Sharp 2 Pintu", qty: 1, price: 1600000, subtotal: 1600000 },
      { name: "Karet Pintu Kulkas", qty: 1, price: 150000, subtotal: 150000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  // === 13 Juni 2026 ===
  {
    id: "ORD-20260613-001",
    date: new Date(2026, 5, 13, 9, 0),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 340000,
    paymentMethod: "Bank Transfer",
    status: "Selesai",
    items: [
      { name: "Minyak Goreng 2L", qty: 4, price: 35000, subtotal: 140000 },
      { name: "Beras Premium 5kg", qty: 3, price: 65000, subtotal: 195000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260613-002",
    date: new Date(2026, 5, 13, 11, 10),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 980000,
    paymentMethod: "Kredit — Bayar Bulan Depan",
    status: "Selesai",
    items: [
      { name: "Setrika Philips 2400W", qty: 1, price: 350000, subtotal: 350000 },
      { name: "Vacuum Cleaner Electrolux", qty: 1, price: 580000, subtotal: 580000 },
      { name: "Kain Lap Microfiber", qty: 5, price: 10000, subtotal: 50000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260613-003",
    date: new Date(2026, 5, 13, 14, 0),
    cashier: "Ahmad Hidayat",
    cashierId: "CSR003",
    total: 78500,
    paymentMethod: "QRIS",
    status: "Dikembalikan",
    items: [
      { name: "Susu Ultra Milk 1L", qty: 3, price: 18000, subtotal: 54000 },
      { name: "Teh Sariwangi", qty: 2, price: 10000, subtotal: 20000 },
      { name: "Kopi Kapal Api", qty: 1, price: 12000, subtotal: 12000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260613-004",
    date: new Date(2026, 5, 13, 16, 45),
    cashier: "Dewi Kusuma",
    cashierId: "CSR004",
    total: 7200000,
    paymentMethod: "Kredit — Cicil 12 Bulan",
    status: "Aktif",
    items: [
      { name: "Laptop Lenovo IdeaPad", qty: 1, price: 6500000, subtotal: 6500000 },
      { name: "Tas Laptop", qty: 1, price: 350000, subtotal: 350000 },
      { name: "Mouse Wireless Logitech", qty: 1, price: 200000, subtotal: 200000 },
      { name: "Screen Protector 14 inch", qty: 2, price: 75000, subtotal: 150000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC5",
    cashReceived: 0,
    change: 0
  },
  // === 12 Juni 2026 ===
  {
    id: "ORD-20260612-001",
    date: new Date(2026, 5, 12, 10, 20),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 420000,
    paymentMethod: "Tunai",
    status: "Selesai",
    items: [
      { name: "Gula Pasir 1kg", qty: 10, price: 14000, subtotal: 140000 },
      { name: "Kopi Kapal Api", qty: 10, price: 12000, subtotal: 120000 },
      { name: "Teh Sariwangi", qty: 16, price: 10000, subtotal: 160000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 500000,
    change: 80000
  },
  {
    id: "ORD-20260612-002",
    date: new Date(2026, 5, 12, 13, 30),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 1480000,
    paymentMethod: "Kredit — Cicil 3 Bulan",
    status: "Diproses",
    items: [
      { name: "Speaker Bluetooth JBL", qty: 1, price: 850000, subtotal: 850000 },
      { name: "Headphone Sony WH-1000", qty: 1, price: 580000, subtotal: 580000 },
      { name: "Kabel Aux 1m", qty: 2, price: 25000, subtotal: 50000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260612-003",
    date: new Date(2026, 5, 12, 15, 50),
    cashier: "Ahmad Hidayat",
    cashierId: "CSR003",
    total: 213000,
    paymentMethod: "Bank Transfer",
    status: "Selesai",
    items: [
      { name: "Shampo Pantene 170ml", qty: 4, price: 25000, subtotal: 100000 },
      { name: "Sabun Mandi Lifebuoy", qty: 6, price: 8000, subtotal: 48000 },
      { name: "Pasta Gigi Pepsodent", qty: 5, price: 12000, subtotal: 60000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC5",
    cashReceived: 0,
    change: 0
  },
  // === 10 Juni 2026 ===
  {
    id: "ORD-20260610-001",
    date: new Date(2026, 5, 10, 9, 0),
    cashier: "Dewi Kusuma",
    cashierId: "CSR004",
    total: 4950000,
    paymentMethod: "Kredit — Cicil 6 Bulan",
    status: "Aktif",
    items: [
      { name: "Kulkas Samsung 2 Pintu 220L", qty: 1, price: 4500000, subtotal: 4500000 },
      { name: "Nampan Buah Set", qty: 2, price: 75000, subtotal: 150000 },
      { name: "Rak Kulkas Tambahan", qty: 3, price: 100000, subtotal: 300000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "DISC10",
    cashReceived: 0,
    change: 0
  },
  {
    id: "ORD-20260610-002",
    date: new Date(2026, 5, 10, 14, 15),
    cashier: "Budi Santoso",
    cashierId: "CSR001",
    total: 157000,
    paymentMethod: "Tunai",
    status: "Selesai",
    items: [
      { name: "Aqua Galon 19L", qty: 3, price: 20000, subtotal: 60000 },
      { name: "Gula Pasir 1kg", qty: 3, price: 14000, subtotal: 42000 },
      { name: "Susu Ultra Milk 1L", qty: 3, price: 18000, subtotal: 54000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 200000,
    change: 43000
  },
  {
    id: "ORD-20260610-003",
    date: new Date(2026, 5, 10, 16, 0),
    cashier: "Siti Rahmawati",
    cashierId: "CSR002",
    total: 2850000,
    paymentMethod: "Kredit — Cicil 12 Bulan",
    status: "Menunggu Konfirmasi",
    items: [
      { name: "Sofa 2 Seater", qty: 1, price: 2500000, subtotal: 2500000 },
      { name: "Bantal Sofa Set", qty: 2, price: 175000, subtotal: 350000 }
    ],
    cashIn: { amount: 0, reason: "" },
    cashOut: { amount: 0, reason: "" },
    voucher: "",
    cashReceived: 0,
    change: 0
  },
];

export type Order = typeof mockOrders[0];
export const creditOrders = mockOrders.filter(o => o.paymentMethod.startsWith("Kredit"));
export const nonCreditOrders = mockOrders.filter(o => !o.paymentMethod.startsWith("Kredit"));
