"use client";
import { useState, useMemo } from "react";
import AdminSidebar from "./AdminSidebar";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, FileText, Download, Eye, Calendar
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { id } from "date-fns/locale";

// Type untuk report
interface ReportData {
  id: string;
  tanggalPembuatan: Date;
  periodeMulai: Date;
  periodeAkhir: Date;
  tipeReport: "daily" | "monthly" | "yearly" | "custom";
  data: {
    posTransactions: Array<{
      id: string;
      tanggal: Date;
      kasir: string;
      total: number;
      metode: string;
    }>;
    onlineTransactions: Array<{
      id: string;
      tanggal: Date;
      pelanggan: string;
      total: number;
      status: string;
    }>;
    pembelian: Array<{
      nomorPembelian: string;
      tanggal: Date;
      supplier: string;
      totalBeli: number;
      totalLaba: number;
      hasRepack: boolean;
      repackCost?: number;
    }>;
    konsinyasi: Array<{
      nomorKonsinyasi: string;
      tanggal: Date;
      vendor: string;
      totalNilaiKonsinyasi: number;
      totalYangDibayar: number;
      totalDikembalikan: number;
    }>;
    cashIn: Array<{
      tanggal: Date;
      jumlah: number;
      keterangan: string;
    }>;
    cashOut: Array<{
      tanggal: Date;
      jumlah: number;
      keterangan: string;
    }>;
  };
}

// Mock data untuk laporan yang pernah dibuat
const mockReportHistory: ReportData[] = [
  // Laporan Harian Terbaru - 18 Mei 2026
  {
    id: "RPT-20260518-001",
    tanggalPembuatan: new Date(2026, 4, 18, 16, 30),
    periodeMulai: new Date(2026, 4, 18, 0, 0, 0),
    periodeAkhir: new Date(2026, 4, 18, 23, 59, 59),
    tipeReport: "daily",
    data: {
      posTransactions: [
        { id: "ORD-20260518-001", tanggal: new Date(2026, 4, 18, 9, 15), kasir: "Budi Santoso", total: 145000, metode: "Tunai" },
        { id: "ORD-20260518-002", tanggal: new Date(2026, 4, 18, 10, 30), kasir: "Siti Rahmawati", total: 320000, metode: "QRIS" },
        { id: "ORD-20260518-003", tanggal: new Date(2026, 4, 18, 11, 45), kasir: "Budi Santoso", total: 89000, metode: "Debit Card" },
        { id: "ORD-20260518-004", tanggal: new Date(2026, 4, 18, 13, 20), kasir: "Siti Rahmawati", total: 256000, metode: "QRIS" },
        { id: "ORD-20260518-005", tanggal: new Date(2026, 4, 18, 14, 10), kasir: "Budi Santoso", total: 178000, metode: "Tunai" },
        { id: "ORD-20260518-006", tanggal: new Date(2026, 4, 18, 15, 25), kasir: "Siti Rahmawati", total: 412000, metode: "QRIS" },
        { id: "ORD-20260518-007", tanggal: new Date(2026, 4, 18, 16, 40), kasir: "Budi Santoso", total: 195000, metode: "Debit Card" },
      ],
      onlineTransactions: [
        { id: "ONL-20260518-001", tanggal: new Date(2026, 4, 18, 10, 15), pelanggan: "Dewi Lestari", total: 425000, status: "Selesai" },
        { id: "ONL-20260518-002", tanggal: new Date(2026, 4, 18, 12, 30), pelanggan: "Rudi Hermawan", total: 215000, status: "Selesai" },
        { id: "ONL-20260518-003", tanggal: new Date(2026, 4, 18, 14, 45), pelanggan: "Eka Putri", total: 380000, status: "Selesai" },
        { id: "ONL-20260518-004", tanggal: new Date(2026, 4, 18, 16, 20), pelanggan: "Fajar Nugroho", total: 295000, status: "Selesai" },
      ],
      pembelian: [
        { nomorPembelian: "PO-20260518-001", tanggal: new Date(2026, 4, 18, 8, 30), supplier: "PT Sumber Jaya", totalBeli: 2450000, totalLaba: 620000, hasRepack: false },
      ],
      konsinyasi: [
        { nomorKonsinyasi: "KON-20260518-001", tanggal: new Date(2026, 4, 18, 9, 0), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 3200000, totalYangDibayar: 2400000, totalDikembalikan: 640000 },
      ],
      cashIn: [
        { tanggal: new Date(2026, 4, 18, 8, 0), jumlah: 2000000, keterangan: "Setoran modal harian" },
      ],
      cashOut: [
        { tanggal: new Date(2026, 4, 18, 15, 0), jumlah: 150000, keterangan: "Beli alat tulis kantor" },
      ],
    }
  },

  // Laporan Bulanan April 2026
  {
    id: "RPT-20260501-001",
    tanggalPembuatan: new Date(2026, 4, 1, 9, 0),
    periodeMulai: new Date(2026, 3, 1),
    periodeAkhir: new Date(2026, 3, 30, 23, 59, 59),
    tipeReport: "monthly",
    data: {
      posTransactions: [
        // Week 1 April 2026
        { id: "ORD-20260401-001", tanggal: new Date(2026, 3, 1, 10, 30), kasir: "Budi Santoso", total: 235000, metode: "Tunai" },
        { id: "ORD-20260403-001", tanggal: new Date(2026, 3, 3, 11, 15), kasir: "Siti Rahmawati", total: 450000, metode: "QRIS" },
        { id: "ORD-20260405-001", tanggal: new Date(2026, 3, 5, 9, 20), kasir: "Budi Santoso", total: 189000, metode: "Debit Card" },
        // Week 2 April 2026
        { id: "ORD-20260407-001", tanggal: new Date(2026, 3, 7, 14, 45), kasir: "Siti Rahmawati", total: 567000, metode: "QRIS" },
        { id: "ORD-20260409-001", tanggal: new Date(2026, 3, 9, 10, 10), kasir: "Budi Santoso", total: 298000, metode: "Tunai" },
        { id: "ORD-20260411-001", tanggal: new Date(2026, 3, 11, 13, 30), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },
        { id: "ORD-20260413-001", tanggal: new Date(2026, 3, 13, 15, 20), kasir: "Budi Santoso", total: 378000, metode: "Debit Card" },
        // Week 3 April 2026
        { id: "ORD-20260415-001", tanggal: new Date(2026, 3, 15, 11, 20), kasir: "Siti Rahmawati", total: 312000, metode: "Tunai" },
        { id: "ORD-20260417-001", tanggal: new Date(2026, 3, 17, 15, 15), kasir: "Budi Santoso", total: 489000, metode: "QRIS" },
        { id: "ORD-20260419-001", tanggal: new Date(2026, 3, 19, 9, 45), kasir: "Siti Rahmawati", total: 423000, metode: "Debit Card" },
        { id: "ORD-20260421-001", tanggal: new Date(2026, 3, 21, 13, 50), kasir: "Budi Santoso", total: 356000, metode: "QRIS" },
        // Week 4 April 2026
        { id: "ORD-20260423-001", tanggal: new Date(2026, 3, 23, 10, 45), kasir: "Siti Rahmawati", total: 267000, metode: "Tunai" },
        { id: "ORD-20260425-001", tanggal: new Date(2026, 3, 25, 14, 20), kasir: "Budi Santoso", total: 521000, metode: "QRIS" },
        { id: "ORD-20260427-001", tanggal: new Date(2026, 3, 27, 11, 35), kasir: "Siti Rahmawati", total: 398000, metode: "Debit Card" },
        { id: "ORD-20260429-001", tanggal: new Date(2026, 3, 29, 15, 10), kasir: "Budi Santoso", total: 534000, metode: "QRIS" },
      ],
      onlineTransactions: [
        { id: "ONL-20260402-001", tanggal: new Date(2026, 3, 2, 14, 20), pelanggan: "Ahmad Hidayat", total: 385000, status: "Selesai" },
        { id: "ONL-20260406-001", tanggal: new Date(2026, 3, 6, 10, 15), pelanggan: "Dewi Lestari", total: 520000, status: "Selesai" },
        { id: "ONL-20260410-001", tanggal: new Date(2026, 3, 10, 16, 30), pelanggan: "Rudi Hermawan", total: 295000, status: "Selesai" },
        { id: "ONL-20260414-001", tanggal: new Date(2026, 3, 14, 11, 45), pelanggan: "Eka Putri", total: 445000, status: "Selesai" },
        { id: "ONL-20260418-001", tanggal: new Date(2026, 3, 18, 13, 20), pelanggan: "Fajar Nugroho", total: 380000, status: "Selesai" },
        { id: "ONL-20260422-001", tanggal: new Date(2026, 3, 22, 15, 40), pelanggan: "Gita Permata", total: 498000, status: "Selesai" },
        { id: "ONL-20260426-001", tanggal: new Date(2026, 3, 26, 10, 25), pelanggan: "Hendra Wijaya", total: 423000, status: "Selesai" },
        { id: "ONL-20260430-001", tanggal: new Date(2026, 3, 30, 14, 50), pelanggan: "Indah Sari", total: 512000, status: "Selesai" },
      ],
      pembelian: [
        { nomorPembelian: "PO-20260402-001", tanggal: new Date(2026, 3, 2, 9, 30), supplier: "PT Sumber Jaya", totalBeli: 3210000, totalLaba: 820000, hasRepack: false },
        { nomorPembelian: "PO-20260410-001", tanggal: new Date(2026, 3, 10, 14, 15), supplier: "CV Berkah Abadi", totalBeli: 5660000, totalLaba: 1460000, hasRepack: true, repackCost: 250000 },
        { nomorPembelian: "PO-20260418-001", tanggal: new Date(2026, 3, 18, 10, 20), supplier: "PT Maju Jaya", totalBeli: 4350000, totalLaba: 1120000, hasRepack: false },
        { nomorPembelian: "PO-20260425-001", tanggal: new Date(2026, 3, 25, 11, 45), supplier: "CV Sejahtera", totalBeli: 2980000, totalLaba: 780000, hasRepack: true, repackCost: 180000 },
      ],
      konsinyasi: [
        { nomorKonsinyasi: "KON-20260405-001", tanggal: new Date(2026, 3, 5, 10, 0), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 4500000, totalYangDibayar: 3200000, totalDikembalikan: 850000 },
        { nomorKonsinyasi: "KON-20260420-001", tanggal: new Date(2026, 3, 20, 14, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 3200000, totalYangDibayar: 2400000, totalDikembalikan: 640000 },
      ],
      cashIn: [
        { tanggal: new Date(2026, 3, 1, 8, 0), jumlah: 8000000, keterangan: "Modal awal bulan" },
        { tanggal: new Date(2026, 3, 15, 10, 30), jumlah: 3000000, keterangan: "Tambahan modal dari investor" },
      ],
      cashOut: [
        { tanggal: new Date(2026, 3, 5, 16, 0), jumlah: 800000, keterangan: "Bayar listrik dan air" },
        { tanggal: new Date(2026, 3, 10, 9, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2026, 3, 15, 11, 0), jumlah: 700000, keterangan: "THR karyawan" },
        { tanggal: new Date(2026, 3, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan" },
        { tanggal: new Date(2026, 3, 25, 10, 0), jumlah: 600000, keterangan: "Maintenance peralatan" },
        { tanggal: new Date(2026, 3, 28, 13, 0), jumlah: 400000, keterangan: "Promosi media sosial" },
      ],
    }
  },

  // Laporan Custom Range Maret 2026
  {
    id: "RPT-20260401-002",
    tanggalPembuatan: new Date(2026, 3, 1, 10, 15),
    periodeMulai: new Date(2026, 2, 1),
    periodeAkhir: new Date(2026, 2, 31, 23, 59, 59),
    tipeReport: "custom",
    data: {
      posTransactions: [
        // Week 1 Maret 2026
        { id: "ORD-20260302-001", tanggal: new Date(2026, 2, 2, 10, 30), kasir: "Budi Santoso", total: 267000, metode: "Tunai" },
        { id: "ORD-20260304-001", tanggal: new Date(2026, 2, 4, 11, 15), kasir: "Siti Rahmawati", total: 398000, metode: "QRIS" },
        { id: "ORD-20260306-001", tanggal: new Date(2026, 2, 6, 14, 20), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },
        // Week 2 Maret 2026
        { id: "ORD-20260309-001", tanggal: new Date(2026, 2, 9, 9, 45), kasir: "Siti Rahmawati", total: 312000, metode: "QRIS" },
        { id: "ORD-20260311-001", tanggal: new Date(2026, 2, 11, 13, 10), kasir: "Budi Santoso", total: 478000, metode: "Tunai" },
        { id: "ORD-20260313-001", tanggal: new Date(2026, 2, 13, 10, 50), kasir: "Siti Rahmawati", total: 389000, metode: "QRIS" },
        { id: "ORD-20260315-001", tanggal: new Date(2026, 2, 15, 15, 30), kasir: "Budi Santoso", total: 521000, metode: "Debit Card" },
        // Week 3 Maret 2026
        { id: "ORD-20260317-001", tanggal: new Date(2026, 2, 17, 11, 20), kasir: "Siti Rahmawati", total: 289000, metode: "Tunai" },
        { id: "ORD-20260319-001", tanggal: new Date(2026, 2, 19, 14, 15), kasir: "Budi Santoso", total: 456000, metode: "QRIS" },
        { id: "ORD-20260321-001", tanggal: new Date(2026, 2, 21, 9, 35), kasir: "Siti Rahmawati", total: 412000, metode: "Debit Card" },
        { id: "ORD-20260323-001", tanggal: new Date(2026, 2, 23, 13, 50), kasir: "Budi Santoso", total: 534000, metode: "QRIS" },
        // Week 4 & 5 Maret 2026
        { id: "ORD-20260325-001", tanggal: new Date(2026, 2, 25, 10, 40), kasir: "Siti Rahmawati", total: 378000, metode: "Tunai" },
        { id: "ORD-20260327-001", tanggal: new Date(2026, 2, 27, 14, 25), kasir: "Budi Santoso", total: 467000, metode: "QRIS" },
        { id: "ORD-20260329-001", tanggal: new Date(2026, 2, 29, 11, 15), kasir: "Siti Rahmawati", total: 398000, metode: "Debit Card" },
        { id: "ORD-20260331-001", tanggal: new Date(2026, 2, 31, 15, 45), kasir: "Budi Santoso", total: 512000, metode: "QRIS" },
      ],
      onlineTransactions: [
        { id: "ONL-20260303-001", tanggal: new Date(2026, 2, 3, 14, 20), pelanggan: "Ahmad Hidayat", total: 425000, status: "Selesai" },
        { id: "ONL-20260307-001", tanggal: new Date(2026, 2, 7, 10, 15), pelanggan: "Dewi Lestari", total: 365000, status: "Selesai" },
        { id: "ONL-20260312-001", tanggal: new Date(2026, 2, 12, 16, 30), pelanggan: "Rudi Hermawan", total: 495000, status: "Selesai" },
        { id: "ONL-20260316-001", tanggal: new Date(2026, 2, 16, 11, 45), pelanggan: "Eka Putri", total: 340000, status: "Selesai" },
        { id: "ONL-20260320-001", tanggal: new Date(2026, 2, 20, 13, 25), pelanggan: "Fajar Nugroho", total: 478000, status: "Selesai" },
        { id: "ONL-20260324-001", tanggal: new Date(2026, 2, 24, 15, 35), pelanggan: "Gita Permata", total: 412000, status: "Selesai" },
        { id: "ONL-20260328-001", tanggal: new Date(2026, 2, 28, 10, 50), pelanggan: "Hendra Wijaya", total: 534000, status: "Selesai" },
      ],
      pembelian: [
        { nomorPembelian: "PO-20260303-001", tanggal: new Date(2026, 2, 3, 9, 30), supplier: "PT Sumber Jaya", totalBeli: 4560000, totalLaba: 1180000, hasRepack: true, repackCost: 320000 },
        { nomorPembelian: "PO-20260310-001", tanggal: new Date(2026, 2, 10, 14, 15), supplier: "CV Berkah Abadi", totalBeli: 3890000, totalLaba: 990000, hasRepack: false },
        { nomorPembelian: "PO-20260318-001", tanggal: new Date(2026, 2, 18, 10, 20), supplier: "PT Maju Jaya", totalBeli: 5120000, totalLaba: 1320000, hasRepack: false },
        { nomorPembelian: "PO-20260325-001", tanggal: new Date(2026, 2, 25, 11, 45), supplier: "CV Sejahtera", totalBeli: 3650000, totalLaba: 920000, hasRepack: true, repackCost: 280000 },
      ],
      konsinyasi: [
        { nomorKonsinyasi: "KON-20260308-001", tanggal: new Date(2026, 2, 8, 10, 0), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 5200000, totalYangDibayar: 4100000, totalDikembalikan: 780000 },
        { nomorKonsinyasi: "KON-20260322-001", tanggal: new Date(2026, 2, 22, 14, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 4300000, totalYangDibayar: 3450000, totalDikembalikan: 680000 },
      ],
      cashIn: [
        { tanggal: new Date(2026, 2, 1, 8, 0), jumlah: 7000000, keterangan: "Modal awal bulan" },
        { tanggal: new Date(2026, 2, 15, 10, 30), jumlah: 2000000, keterangan: "Tambahan modal" },
      ],
      cashOut: [
        { tanggal: new Date(2026, 2, 5, 16, 0), jumlah: 750000, keterangan: "Bayar listrik dan air" },
        { tanggal: new Date(2026, 2, 10, 9, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2026, 2, 15, 10, 0), jumlah: 600000, keterangan: "Maintenance peralatan" },
        { tanggal: new Date(2026, 2, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan" },
        { tanggal: new Date(2026, 2, 25, 11, 0), jumlah: 350000, keterangan: "Beli perlengkapan kantor" },
      ],
    }
  },

  // Laporan Tahunan 2025
  {
    id: "RPT-20260105-001",
    tanggalPembuatan: new Date(2026, 0, 5, 14, 0),
    periodeMulai: new Date(2025, 0, 1),
    periodeAkhir: new Date(2025, 11, 31, 23, 59, 59),
    tipeReport: "yearly",
    data: {
      posTransactions: [
        // Januari 2025 (5 transactions)
        { id: "ORD-20250105-001", tanggal: new Date(2025, 0, 5, 10, 30), kasir: "Budi Santoso", total: 245000, metode: "Tunai" },
        { id: "ORD-20250108-001", tanggal: new Date(2025, 0, 8, 14, 20), kasir: "Siti Rahmawati", total: 389000, metode: "QRIS" },
        { id: "ORD-20250112-001", tanggal: new Date(2025, 0, 12, 11, 15), kasir: "Budi Santoso", total: 456000, metode: "Debit Card" },
        { id: "ORD-20250118-001", tanggal: new Date(2025, 0, 18, 15, 30), kasir: "Siti Rahmawati", total: 312000, metode: "QRIS" },
        { id: "ORD-20250125-001", tanggal: new Date(2025, 0, 25, 9, 45), kasir: "Budi Santoso", total: 523000, metode: "Tunai" },

        // Februari 2025 (5 transactions)
        { id: "ORD-20250202-001", tanggal: new Date(2025, 1, 2, 9, 45), kasir: "Siti Rahmawati", total: 298000, metode: "QRIS" },
        { id: "ORD-20250209-001", tanggal: new Date(2025, 1, 9, 13, 20), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },
        { id: "ORD-20250213-001", tanggal: new Date(2025, 1, 13, 10, 50), kasir: "Siti Rahmawati", total: 521000, metode: "QRIS" },
        { id: "ORD-20250219-001", tanggal: new Date(2025, 1, 19, 14, 15), kasir: "Budi Santoso", total: 367000, metode: "Tunai" },
        { id: "ORD-20250226-001", tanggal: new Date(2025, 1, 26, 11, 30), kasir: "Siti Rahmawati", total: 489000, metode: "QRIS" },

        // Maret 2025 (5 transactions)
        { id: "ORD-20250305-001", tanggal: new Date(2025, 2, 5, 11, 30), kasir: "Budi Santoso", total: 412000, metode: "Debit Card" },
        { id: "ORD-20250310-001", tanggal: new Date(2025, 2, 10, 15, 20), kasir: "Siti Rahmawati", total: 489000, metode: "QRIS" },
        { id: "ORD-20250316-001", tanggal: new Date(2025, 2, 16, 9, 45), kasir: "Budi Santoso", total: 356000, metode: "Tunai" },
        { id: "ORD-20250322-001", tanggal: new Date(2025, 2, 22, 13, 10), kasir: "Siti Rahmawati", total: 523000, metode: "QRIS" },
        { id: "ORD-20250329-001", tanggal: new Date(2025, 2, 29, 10, 15), kasir: "Budi Santoso", total: 467000, metode: "Debit Card" },

        // April 2025 (5 transactions)
        { id: "ORD-20250405-001", tanggal: new Date(2025, 3, 5, 10, 15), kasir: "Siti Rahmawati", total: 398000, metode: "QRIS" },
        { id: "ORD-20250410-001", tanggal: new Date(2025, 3, 10, 14, 30), kasir: "Budi Santoso", total: 512000, metode: "Tunai" },
        { id: "ORD-20250416-001", tanggal: new Date(2025, 3, 16, 11, 20), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },
        { id: "ORD-20250422-001", tanggal: new Date(2025, 3, 22, 15, 10), kasir: "Budi Santoso", total: 378000, metode: "Debit Card" },
        { id: "ORD-20250428-001", tanggal: new Date(2025, 3, 28, 9, 50), kasir: "Siti Rahmawati", total: 534000, metode: "QRIS" },

        // Mei 2025 (5 transactions)
        { id: "ORD-20250505-001", tanggal: new Date(2025, 4, 5, 11, 20), kasir: "Budi Santoso", total: 467000, metode: "Tunai" },
        { id: "ORD-20250512-001", tanggal: new Date(2025, 4, 12, 14, 40), kasir: "Siti Rahmawati", total: 389000, metode: "QRIS" },
        { id: "ORD-20250518-001", tanggal: new Date(2025, 4, 18, 10, 25), kasir: "Budi Santoso", total: 523000, metode: "Debit Card" },
        { id: "ORD-20250523-001", tanggal: new Date(2025, 4, 23, 13, 15), kasir: "Siti Rahmawati", total: 412000, metode: "QRIS" },
        { id: "ORD-20250530-001", tanggal: new Date(2025, 4, 30, 15, 30), kasir: "Budi Santoso", total: 498000, metode: "Tunai" },

        // Juni 2025 (5 transactions)
        { id: "ORD-20250605-001", tanggal: new Date(2025, 5, 5, 14, 30), kasir: "Siti Rahmawati", total: 512000, metode: "QRIS" },
        { id: "ORD-20250610-001", tanggal: new Date(2025, 5, 10, 9, 45), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },
        { id: "ORD-20250617-001", tanggal: new Date(2025, 5, 17, 13, 20), kasir: "Siti Rahmawati", total: 567000, metode: "QRIS" },
        { id: "ORD-20250623-001", tanggal: new Date(2025, 5, 23, 10, 50), kasir: "Budi Santoso", total: 398000, metode: "Tunai" },
        { id: "ORD-20250629-001", tanggal: new Date(2025, 5, 29, 14, 15), kasir: "Siti Rahmawati", total: 478000, metode: "QRIS" },

        // Juli 2025 (5 transactions)
        { id: "ORD-20250705-001", tanggal: new Date(2025, 6, 5, 9, 45), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },
        { id: "ORD-20250711-001", tanggal: new Date(2025, 6, 11, 13, 15), kasir: "Siti Rahmawati", total: 523000, metode: "QRIS" },
        { id: "ORD-20250717-001", tanggal: new Date(2025, 6, 17, 10, 30), kasir: "Budi Santoso", total: 412000, metode: "Tunai" },
        { id: "ORD-20250724-001", tanggal: new Date(2025, 6, 24, 14, 50), kasir: "Siti Rahmawati", total: 489000, metode: "QRIS" },
        { id: "ORD-20250730-001", tanggal: new Date(2025, 6, 30, 11, 20), kasir: "Budi Santoso", total: 534000, metode: "Debit Card" },

        // Agustus 2025 (5 transactions)
        { id: "ORD-20250805-001", tanggal: new Date(2025, 7, 5, 13, 15), kasir: "Siti Rahmawati", total: 389000, metode: "QRIS" },
        { id: "ORD-20250812-001", tanggal: new Date(2025, 7, 12, 10, 40), kasir: "Budi Santoso", total: 467000, metode: "Tunai" },
        { id: "ORD-20250818-001", tanggal: new Date(2025, 7, 18, 14, 25), kasir: "Siti Rahmawati", total: 512000, metode: "QRIS" },
        { id: "ORD-20250824-001", tanggal: new Date(2025, 7, 24, 9, 55), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },
        { id: "ORD-20250830-001", tanggal: new Date(2025, 7, 30, 13, 35), kasir: "Siti Rahmawati", total: 578000, metode: "QRIS" },

        // September 2025 (5 transactions)
        { id: "ORD-20250905-001", tanggal: new Date(2025, 8, 5, 10, 50), kasir: "Budi Santoso", total: 534000, metode: "Tunai" },
        { id: "ORD-20250911-001", tanggal: new Date(2025, 8, 11, 14, 20), kasir: "Siti Rahmawati", total: 478000, metode: "QRIS" },
        { id: "ORD-20250917-001", tanggal: new Date(2025, 8, 17, 11, 30), kasir: "Budi Santoso", total: 412000, metode: "Debit Card" },
        { id: "ORD-20250923-001", tanggal: new Date(2025, 8, 23, 15, 15), kasir: "Siti Rahmawati", total: 556000, metode: "QRIS" },
        { id: "ORD-20250929-001", tanggal: new Date(2025, 8, 29, 9, 45), kasir: "Budi Santoso", total: 489000, metode: "Tunai" },

        // Oktober 2025 (5 transactions)
        { id: "ORD-20251005-001", tanggal: new Date(2025, 9, 5, 15, 20), kasir: "Siti Rahmawati", total: 478000, metode: "QRIS" },
        { id: "ORD-20251012-001", tanggal: new Date(2025, 9, 12, 10, 35), kasir: "Budi Santoso", total: 523000, metode: "Debit Card" },
        { id: "ORD-20251018-001", tanggal: new Date(2025, 9, 18, 13, 50), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },
        { id: "ORD-20251024-001", tanggal: new Date(2025, 9, 24, 11, 15), kasir: "Budi Santoso", total: 512000, metode: "Tunai" },
        { id: "ORD-20251030-001", tanggal: new Date(2025, 9, 30, 14, 40), kasir: "Siti Rahmawati", total: 567000, metode: "QRIS" },

        // November 2025 (5 transactions)
        { id: "ORD-20251105-001", tanggal: new Date(2025, 10, 5, 11, 30), kasir: "Budi Santoso", total: 423000, metode: "Debit Card" },
        { id: "ORD-20251112-001", tanggal: new Date(2025, 10, 12, 15, 20), kasir: "Siti Rahmawati", total: 489000, metode: "QRIS" },
        { id: "ORD-20251118-001", tanggal: new Date(2025, 10, 18, 9, 50), kasir: "Budi Santoso", total: 534000, metode: "Tunai" },
        { id: "ORD-20251124-001", tanggal: new Date(2025, 10, 24, 13, 25), kasir: "Siti Rahmawati", total: 478000, metode: "QRIS" },
        { id: "ORD-20251129-001", tanggal: new Date(2025, 10, 29, 10, 40), kasir: "Budi Santoso", total: 512000, metode: "Debit Card" },

        // Desember 2025 (5 transactions)
        { id: "ORD-20251205-001", tanggal: new Date(2025, 11, 5, 14, 45), kasir: "Siti Rahmawati", total: 567000, metode: "QRIS" },
        { id: "ORD-20251212-001", tanggal: new Date(2025, 11, 12, 11, 25), kasir: "Budi Santoso", total: 623000, metode: "Tunai" },
        { id: "ORD-20251218-001", tanggal: new Date(2025, 11, 18, 15, 10), kasir: "Siti Rahmawati", total: 545000, metode: "QRIS" },
        { id: "ORD-20251224-001", tanggal: new Date(2025, 11, 24, 9, 35), kasir: "Budi Santoso", total: 689000, metode: "Debit Card" },
        { id: "ORD-20251230-001", tanggal: new Date(2025, 11, 30, 13, 55), kasir: "Siti Rahmawati", total: 734000, metode: "QRIS" },
      ],
      onlineTransactions: [
        { id: "ONL-20250110-001", tanggal: new Date(2025, 0, 10, 14, 20), pelanggan: "Ahmad Hidayat", total: 385000, status: "Selesai" },
        { id: "ONL-20250210-001", tanggal: new Date(2025, 1, 10, 10, 15), pelanggan: "Dewi Lestari", total: 425000, status: "Selesai" },
        { id: "ONL-20250310-001", tanggal: new Date(2025, 2, 10, 16, 30), pelanggan: "Rudi Hermawan", total: 365000, status: "Selesai" },
        { id: "ONL-20250410-001", tanggal: new Date(2025, 3, 10, 11, 45), pelanggan: "Eka Putri", total: 495000, status: "Selesai" },
        { id: "ONL-20250510-001", tanggal: new Date(2025, 4, 10, 13, 20), pelanggan: "Fajar Nugroho", total: 445000, status: "Selesai" },
        { id: "ONL-20250610-001", tanggal: new Date(2025, 5, 10, 10, 15), pelanggan: "Gita Permata", total: 520000, status: "Selesai" },
        { id: "ONL-20250710-001", tanggal: new Date(2025, 6, 10, 15, 30), pelanggan: "Hendra Wijaya", total: 398000, status: "Selesai" },
        { id: "ONL-20250810-001", tanggal: new Date(2025, 7, 10, 11, 20), pelanggan: "Indah Sari", total: 467000, status: "Selesai" },
        { id: "ONL-20250910-001", tanggal: new Date(2025, 8, 10, 14, 10), pelanggan: "Joko Susilo", total: 412000, status: "Selesai" },
        { id: "ONL-20251010-001", tanggal: new Date(2025, 9, 10, 9, 50), pelanggan: "Kartika Dewi", total: 534000, status: "Selesai" },
        { id: "ONL-20251110-001", tanggal: new Date(2025, 10, 10, 13, 40), pelanggan: "Lukman Hakim", total: 478000, status: "Selesai" },
        { id: "ONL-20251210-001", tanggal: new Date(2025, 11, 10, 10, 25), pelanggan: "Maya Kusuma", total: 556000, status: "Selesai" },
      ],
      pembelian: [
        { nomorPembelian: "PO-20250108-001", tanggal: new Date(2025, 0, 8, 9, 30), supplier: "PT Sumber Jaya", totalBeli: 5210000, totalLaba: 1320000, hasRepack: true, repackCost: 420000 },
        { nomorPembelian: "PO-20250208-001", tanggal: new Date(2025, 1, 8, 14, 15), supplier: "CV Berkah Abadi", totalBeli: 4660000, totalLaba: 1160000, hasRepack: false },
        { nomorPembelian: "PO-20250308-001", tanggal: new Date(2025, 2, 8, 10, 20), supplier: "PT Maju Jaya", totalBeli: 6350000, totalLaba: 1620000, hasRepack: true, repackCost: 380000 },
        { nomorPembelian: "PO-20250408-001", tanggal: new Date(2025, 3, 8, 11, 45), supplier: "CV Sejahtera", totalBeli: 3980000, totalLaba: 980000, hasRepack: false },
        { nomorPembelian: "PO-20250508-001", tanggal: new Date(2025, 4, 8, 9, 15), supplier: "PT Sumber Jaya", totalBeli: 5450000, totalLaba: 1390000, hasRepack: true, repackCost: 310000 },
        { nomorPembelian: "PO-20250608-001", tanggal: new Date(2025, 5, 8, 13, 30), supplier: "CV Berkah Abadi", totalBeli: 4120000, totalLaba: 1050000, hasRepack: false },
        { nomorPembelian: "PO-20250708-001", tanggal: new Date(2025, 6, 8, 10, 45), supplier: "PT Maju Jaya", totalBeli: 5890000, totalLaba: 1520000, hasRepack: false },
        { nomorPembelian: "PO-20250808-001", tanggal: new Date(2025, 7, 8, 14, 20), supplier: "CV Sejahtera", totalBeli: 4560000, totalLaba: 1180000, hasRepack: true, repackCost: 290000 },
        { nomorPembelian: "PO-20250908-001", tanggal: new Date(2025, 8, 8, 9, 50), supplier: "PT Sumber Jaya", totalBeli: 6120000, totalLaba: 1580000, hasRepack: false },
        { nomorPembelian: "PO-20251008-001", tanggal: new Date(2025, 9, 8, 11, 10), supplier: "CV Berkah Abadi", totalBeli: 4890000, totalLaba: 1260000, hasRepack: true, repackCost: 340000 },
        { nomorPembelian: "PO-20251108-001", tanggal: new Date(2025, 10, 8, 15, 30), supplier: "PT Maju Jaya", totalBeli: 5340000, totalLaba: 1370000, hasRepack: false },
        { nomorPembelian: "PO-20251208-001", tanggal: new Date(2025, 11, 8, 10, 15), supplier: "CV Sejahtera", totalBeli: 6780000, totalLaba: 1740000, hasRepack: true, repackCost: 450000 },
      ],
      konsinyasi: [
        { nomorKonsinyasi: "KON-20250115-001", tanggal: new Date(2025, 0, 15, 10, 0), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 6200000, totalYangDibayar: 4800000, totalDikembalikan: 980000 },
        { nomorKonsinyasi: "KON-20250315-001", tanggal: new Date(2025, 2, 15, 14, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 4500000, totalYangDibayar: 3600000, totalDikembalikan: 720000 },
        { nomorKonsinyasi: "KON-20250515-001", tanggal: new Date(2025, 4, 15, 9, 20), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 5800000, totalYangDibayar: 4500000, totalDikembalikan: 890000 },
        { nomorKonsinyasi: "KON-20250715-001", tanggal: new Date(2025, 6, 15, 11, 40), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 5200000, totalYangDibayar: 4100000, totalDikembalikan: 820000 },
        { nomorKonsinyasi: "KON-20250915-001", tanggal: new Date(2025, 8, 15, 13, 50), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 6500000, totalYangDibayar: 5200000, totalDikembalikan: 1040000 },
        { nomorKonsinyasi: "KON-20251115-001", tanggal: new Date(2025, 10, 15, 10, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 4800000, totalYangDibayar: 3850000, totalDikembalikan: 770000 },
      ],
      cashIn: [
        { tanggal: new Date(2025, 0, 1, 8, 0), jumlah: 10000000, keterangan: "Modal awal tahun" },
        { tanggal: new Date(2025, 3, 15, 10, 0), jumlah: 5000000, keterangan: "Tambahan modal Q2" },
        { tanggal: new Date(2025, 6, 1, 9, 0), jumlah: 7000000, keterangan: "Investasi H2" },
        { tanggal: new Date(2025, 9, 10, 11, 0), jumlah: 4000000, keterangan: "Dana ekspansi Q4" },
      ],
      cashOut: [
        { tanggal: new Date(2025, 0, 5, 9, 0), jumlah: 900000, keterangan: "Bayar listrik dan air Januari" },
        { tanggal: new Date(2025, 0, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 0, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Januari" },
        { tanggal: new Date(2025, 1, 5, 9, 0), jumlah: 850000, keterangan: "Bayar listrik dan air Februari" },
        { tanggal: new Date(2025, 1, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 1, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Februari" },
        { tanggal: new Date(2025, 2, 5, 9, 0), jumlah: 880000, keterangan: "Bayar listrik dan air Maret" },
        { tanggal: new Date(2025, 2, 10, 9, 0), jumlah: 1500000, keterangan: "Renovasi toko" },
        { tanggal: new Date(2025, 2, 12, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 2, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Maret" },
        { tanggal: new Date(2025, 3, 5, 9, 0), jumlah: 920000, keterangan: "Bayar listrik dan air April" },
        { tanggal: new Date(2025, 3, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 3, 20, 14, 0), jumlah: 2700000, keterangan: "Gaji karyawan + THR April" },
        { tanggal: new Date(2025, 4, 5, 9, 0), jumlah: 890000, keterangan: "Bayar listrik dan air Mei" },
        { tanggal: new Date(2025, 4, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 4, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Mei" },
        { tanggal: new Date(2025, 5, 5, 9, 0), jumlah: 950000, keterangan: "Bayar listrik dan air Juni" },
        { tanggal: new Date(2025, 5, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 5, 15, 10, 0), jumlah: 2000000, keterangan: "Beli peralatan baru" },
        { tanggal: new Date(2025, 5, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Juni" },
        { tanggal: new Date(2025, 6, 5, 9, 0), jumlah: 1000000, keterangan: "Bayar listrik dan air Juli" },
        { tanggal: new Date(2025, 6, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 6, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Juli" },
        { tanggal: new Date(2025, 7, 5, 9, 0), jumlah: 970000, keterangan: "Bayar listrik dan air Agustus" },
        { tanggal: new Date(2025, 7, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 7, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Agustus" },
        { tanggal: new Date(2025, 8, 5, 9, 0), jumlah: 930000, keterangan: "Bayar listrik dan air September" },
        { tanggal: new Date(2025, 8, 5, 14, 0), jumlah: 1200000, keterangan: "Marketing campaign" },
        { tanggal: new Date(2025, 8, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 8, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan September" },
        { tanggal: new Date(2025, 9, 5, 9, 0), jumlah: 950000, keterangan: "Bayar listrik dan air Oktober" },
        { tanggal: new Date(2025, 9, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 9, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan Oktober" },
        { tanggal: new Date(2025, 10, 5, 9, 0), jumlah: 910000, keterangan: "Bayar listrik dan air November" },
        { tanggal: new Date(2025, 10, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 10, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan November" },
        { tanggal: new Date(2025, 11, 5, 9, 0), jumlah: 1050000, keterangan: "Bayar listrik dan air Desember" },
        { tanggal: new Date(2025, 11, 10, 10, 0), jumlah: 450000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2025, 11, 15, 11, 0), jumlah: 1000000, keterangan: "Dekorasi akhir tahun" },
        { tanggal: new Date(2025, 11, 20, 14, 0), jumlah: 3000000, keterangan: "Gaji karyawan + Bonus Desember" },
      ],
    }
  },

  // Laporan Tahunan 2024
  {
    id: "RPT-20250110-001",
    tanggalPembuatan: new Date(2025, 0, 10, 9, 30),
    periodeMulai: new Date(2024, 0, 1),
    periodeAkhir: new Date(2024, 11, 31, 23, 59, 59),
    tipeReport: "yearly",
    data: {
      posTransactions: [
        // Januari 2024
        { id: "ORD-20240105-001", tanggal: new Date(2024, 0, 5, 10, 30), kasir: "Budi Santoso", total: 234000, metode: "Tunai" },
        { id: "ORD-20240110-001", tanggal: new Date(2024, 0, 10, 11, 20), kasir: "Siti Rahmawati", total: 345000, metode: "QRIS" },
        { id: "ORD-20240115-001", tanggal: new Date(2024, 0, 15, 14, 15), kasir: "Budi Santoso", total: 298000, metode: "Debit Card" },
        { id: "ORD-20240122-001", tanggal: new Date(2024, 0, 22, 9, 45), kasir: "Siti Rahmawati", total: 189000, metode: "QRIS" },
        { id: "ORD-20240128-001", tanggal: new Date(2024, 0, 28, 13, 30), kasir: "Budi Santoso", total: 412000, metode: "Tunai" },

        // Februari 2024
        { id: "ORD-20240203-001", tanggal: new Date(2024, 1, 3, 10, 20), kasir: "Siti Rahmawati", total: 267000, metode: "QRIS" },
        { id: "ORD-20240208-001", tanggal: new Date(2024, 1, 8, 15, 10), kasir: "Budi Santoso", total: 356000, metode: "Debit Card" },
        { id: "ORD-20240215-001", tanggal: new Date(2024, 1, 15, 11, 50), kasir: "Siti Rahmawati", total: 423000, metode: "QRIS" },
        { id: "ORD-20240220-001", tanggal: new Date(2024, 1, 20, 14, 40), kasir: "Budi Santoso", total: 534000, metode: "Tunai" },
        { id: "ORD-20240227-001", tanggal: new Date(2024, 1, 27, 9, 30), kasir: "Siti Rahmawati", total: 298000, metode: "QRIS" },

        // Maret 2024
        { id: "ORD-20240305-001", tanggal: new Date(2024, 2, 5, 13, 20), kasir: "Budi Santoso", total: 456000, metode: "Debit Card" },
        { id: "ORD-20240312-001", tanggal: new Date(2024, 2, 12, 10, 10), kasir: "Siti Rahmawati", total: 389000, metode: "QRIS" },
        { id: "ORD-20240318-001", tanggal: new Date(2024, 2, 18, 15, 30), kasir: "Budi Santoso", total: 512000, metode: "Tunai" },
        { id: "ORD-20240325-001", tanggal: new Date(2024, 2, 25, 11, 45), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },

        // April 2024
        { id: "ORD-20240402-001", tanggal: new Date(2024, 3, 2, 9, 15), kasir: "Budi Santoso", total: 378000, metode: "Debit Card" },
        { id: "ORD-20240409-001", tanggal: new Date(2024, 3, 9, 14, 20), kasir: "Siti Rahmawati", total: 489000, metode: "QRIS" },
        { id: "ORD-20240415-001", tanggal: new Date(2024, 3, 15, 10, 50), kasir: "Budi Santoso", total: 356000, metode: "Tunai" },
        { id: "ORD-20240422-001", tanggal: new Date(2024, 3, 22, 13, 10), kasir: "Siti Rahmawati", total: 523000, metode: "QRIS" },
        { id: "ORD-20240428-001", tanggal: new Date(2024, 3, 28, 11, 30), kasir: "Budi Santoso", total: 412000, metode: "Debit Card" },

        // Mei 2024
        { id: "ORD-20240505-001", tanggal: new Date(2024, 4, 5, 10, 15), kasir: "Siti Rahmawati", total: 467000, metode: "QRIS" },
        { id: "ORD-20240512-001", tanggal: new Date(2024, 4, 12, 15, 20), kasir: "Budi Santoso", total: 398000, metode: "Tunai" },
        { id: "ORD-20240518-001", tanggal: new Date(2024, 4, 18, 9, 45), kasir: "Siti Rahmawati", total: 534000, metode: "QRIS" },
        { id: "ORD-20240525-001", tanggal: new Date(2024, 4, 25, 13, 15), kasir: "Budi Santoso", total: 289000, metode: "Debit Card" },

        // Juni 2024
        { id: "ORD-20240603-001", tanggal: new Date(2024, 5, 3, 11, 30), kasir: "Siti Rahmawati", total: 523000, metode: "QRIS" },
        { id: "ORD-20240610-001", tanggal: new Date(2024, 5, 10, 14, 45), kasir: "Budi Santoso", total: 478000, metode: "Tunai" },
        { id: "ORD-20240617-001", tanggal: new Date(2024, 5, 17, 10, 20), kasir: "Siti Rahmawati", total: 412000, metode: "QRIS" },
        { id: "ORD-20240624-001", tanggal: new Date(2024, 5, 24, 15, 10), kasir: "Budi Santoso", total: 556000, metode: "Debit Card" },

        // Juli 2024
        { id: "ORD-20240705-001", tanggal: new Date(2024, 6, 5, 9, 30), kasir: "Siti Rahmawati", total: 467000, metode: "QRIS" },
        { id: "ORD-20240712-001", tanggal: new Date(2024, 6, 12, 13, 20), kasir: "Budi Santoso", total: 389000, metode: "Tunai" },
        { id: "ORD-20240718-001", tanggal: new Date(2024, 6, 18, 10, 50), kasir: "Siti Rahmawati", total: 512000, metode: "QRIS" },
        { id: "ORD-20240725-001", tanggal: new Date(2024, 6, 25, 14, 15), kasir: "Budi Santoso", total: 445000, metode: "Debit Card" },

        // Agustus 2024
        { id: "ORD-20240802-001", tanggal: new Date(2024, 7, 2, 11, 20), kasir: "Siti Rahmawati", total: 398000, metode: "QRIS" },
        { id: "ORD-20240809-001", tanggal: new Date(2024, 7, 9, 15, 30), kasir: "Budi Santoso", total: 478000, metode: "Tunai" },
        { id: "ORD-20240816-001", tanggal: new Date(2024, 7, 16, 9, 45), kasir: "Siti Rahmawati", total: 423000, metode: "QRIS" },
        { id: "ORD-20240823-001", tanggal: new Date(2024, 7, 23, 13, 10), kasir: "Budi Santoso", total: 534000, metode: "Debit Card" },
        { id: "ORD-20240830-001", tanggal: new Date(2024, 7, 30, 10, 25), kasir: "Siti Rahmawati", total: 367000, metode: "QRIS" },

        // September 2024
        { id: "ORD-20240905-001", tanggal: new Date(2024, 8, 5, 14, 40), kasir: "Budi Santoso", total: 512000, metode: "Tunai" },
        { id: "ORD-20240912-001", tanggal: new Date(2024, 8, 12, 11, 15), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },
        { id: "ORD-20240919-001", tanggal: new Date(2024, 8, 19, 15, 20), kasir: "Budi Santoso", total: 389000, metode: "Debit Card" },
        { id: "ORD-20240926-001", tanggal: new Date(2024, 8, 26, 9, 50), kasir: "Siti Rahmawati", total: 567000, metode: "QRIS" },

        // Oktober 2024
        { id: "ORD-20241003-001", tanggal: new Date(2024, 9, 3, 13, 30), kasir: "Budi Santoso", total: 478000, metode: "Tunai" },
        { id: "ORD-20241010-001", tanggal: new Date(2024, 9, 10, 10, 20), kasir: "Siti Rahmawati", total: 412000, metode: "QRIS" },
        { id: "ORD-20241017-001", tanggal: new Date(2024, 9, 17, 14, 45), kasir: "Budi Santoso", total: 523000, metode: "Debit Card" },
        { id: "ORD-20241024-001", tanggal: new Date(2024, 9, 24, 11, 10), kasir: "Siti Rahmawati", total: 456000, metode: "QRIS" },
        { id: "ORD-20241031-001", tanggal: new Date(2024, 9, 31, 15, 25), kasir: "Budi Santoso", total: 389000, metode: "Tunai" },

        // November 2024
        { id: "ORD-20241107-001", tanggal: new Date(2024, 10, 7, 9, 30), kasir: "Siti Rahmawati", total: 445000, metode: "QRIS" },
        { id: "ORD-20241114-001", tanggal: new Date(2024, 10, 14, 13, 20), kasir: "Budi Santoso", total: 512000, metode: "Debit Card" },
        { id: "ORD-20241121-001", tanggal: new Date(2024, 10, 21, 10, 40), kasir: "Siti Rahmawati", total: 478000, metode: "QRIS" },
        { id: "ORD-20241128-001", tanggal: new Date(2024, 10, 28, 14, 15), kasir: "Budi Santoso", total: 534000, metode: "Tunai" },

        // Desember 2024
        { id: "ORD-20241205-001", tanggal: new Date(2024, 11, 5, 11, 30), kasir: "Siti Rahmawati", total: 589000, metode: "QRIS" },
        { id: "ORD-20241212-001", tanggal: new Date(2024, 11, 12, 15, 20), kasir: "Budi Santoso", total: 623000, metode: "Debit Card" },
        { id: "ORD-20241219-001", tanggal: new Date(2024, 11, 19, 9, 45), kasir: "Siti Rahmawati", total: 456000, metode: "QRIS" },
        { id: "ORD-20241226-001", tanggal: new Date(2024, 11, 26, 13, 10), kasir: "Budi Santoso", total: 712000, metode: "Tunai" },
      ],
      onlineTransactions: [
        { id: "ONL-20240110-001", tanggal: new Date(2024, 0, 10, 14, 20), pelanggan: "Ahmad Hidayat", total: 365000, status: "Selesai" },
        { id: "ONL-20240120-001", tanggal: new Date(2024, 0, 20, 10, 15), pelanggan: "Dewi Lestari", total: 412000, status: "Selesai" },
        { id: "ONL-20240205-001", tanggal: new Date(2024, 1, 5, 16, 30), pelanggan: "Rudi Hermawan", total: 398000, status: "Selesai" },
        { id: "ONL-20240218-001", tanggal: new Date(2024, 1, 18, 11, 45), pelanggan: "Eka Putri", total: 478000, status: "Selesai" },
        { id: "ONL-20240310-001", tanggal: new Date(2024, 2, 10, 13, 20), pelanggan: "Fajar Nugroho", total: 434000, status: "Selesai" },
        { id: "ONL-20240322-001", tanggal: new Date(2024, 2, 22, 10, 15), pelanggan: "Gita Permata", total: 512000, status: "Selesai" },
        { id: "ONL-20240408-001", tanggal: new Date(2024, 3, 8, 15, 30), pelanggan: "Hendra Wijaya", total: 445000, status: "Selesai" },
        { id: "ONL-20240425-001", tanggal: new Date(2024, 3, 25, 11, 20), pelanggan: "Indah Sari", total: 398000, status: "Selesai" },
        { id: "ONL-20240512-001", tanggal: new Date(2024, 4, 12, 14, 10), pelanggan: "Joko Susilo", total: 467000, status: "Selesai" },
        { id: "ONL-20240528-001", tanggal: new Date(2024, 4, 28, 9, 50), pelanggan: "Kartika Dewi", total: 389000, status: "Selesai" },
        { id: "ONL-20240605-001", tanggal: new Date(2024, 5, 5, 13, 40), pelanggan: "Lukman Hakim", total: 534000, status: "Selesai" },
        { id: "ONL-20240620-001", tanggal: new Date(2024, 5, 20, 10, 25), pelanggan: "Maya Kusuma", total: 478000, status: "Selesai" },
        { id: "ONL-20240708-001", tanggal: new Date(2024, 6, 8, 15, 15), pelanggan: "Nanda Pratama", total: 412000, status: "Selesai" },
        { id: "ONL-20240722-001", tanggal: new Date(2024, 6, 22, 11, 30), pelanggan: "Omar Syarif", total: 556000, status: "Selesai" },
        { id: "ONL-20240805-001", tanggal: new Date(2024, 7, 5, 14, 20), pelanggan: "Putri Ayu", total: 423000, status: "Selesai" },
        { id: "ONL-20240820-001", tanggal: new Date(2024, 7, 20, 10, 45), pelanggan: "Qori Andini", total: 498000, status: "Selesai" },
        { id: "ONL-20240910-001", tanggal: new Date(2024, 8, 10, 16, 10), pelanggan: "Rizki Fauzan", total: 445000, status: "Selesai" },
        { id: "ONL-20240925-001", tanggal: new Date(2024, 8, 25, 13, 25), pelanggan: "Sari Dewi", total: 512000, status: "Selesai" },
        { id: "ONL-20241008-001", tanggal: new Date(2024, 9, 8, 11, 35), pelanggan: "Tono Hartono", total: 467000, status: "Selesai" },
        { id: "ONL-20241022-001", tanggal: new Date(2024, 9, 22, 15, 20), pelanggan: "Umar Bakri", total: 534000, status: "Selesai" },
        { id: "ONL-20241110-001", tanggal: new Date(2024, 10, 10, 9, 55), pelanggan: "Vina Amalia", total: 478000, status: "Selesai" },
        { id: "ONL-20241125-001", tanggal: new Date(2024, 10, 25, 14, 30), pelanggan: "Wawan Setiawan", total: 512000, status: "Selesai" },
        { id: "ONL-20241208-001", tanggal: new Date(2024, 11, 8, 10, 40), pelanggan: "Xaverius Yanto", total: 589000, status: "Selesai" },
        { id: "ONL-20241220-001", tanggal: new Date(2024, 11, 20, 13, 50), pelanggan: "Yuni Kartika", total: 623000, status: "Selesai" },
      ],
      pembelian: [
        { nomorPembelian: "PO-20240110-001", tanggal: new Date(2024, 0, 10, 9, 30), supplier: "PT Sumber Jaya", totalBeli: 4850000, totalLaba: 1220000, hasRepack: false },
        { nomorPembelian: "PO-20240125-001", tanggal: new Date(2024, 0, 25, 14, 15), supplier: "CV Berkah Abadi", totalBeli: 3560000, totalLaba: 890000, hasRepack: true, repackCost: 280000 },
        { nomorPembelian: "PO-20240208-001", tanggal: new Date(2024, 1, 8, 10, 20), supplier: "PT Maju Jaya", totalBeli: 5120000, totalLaba: 1280000, hasRepack: false },
        { nomorPembelian: "PO-20240222-001", tanggal: new Date(2024, 1, 22, 11, 45), supplier: "CV Sejahtera", totalBeli: 4680000, totalLaba: 1170000, hasRepack: true, repackCost: 310000 },
        { nomorPembelian: "PO-20240310-001", tanggal: new Date(2024, 2, 10, 9, 15), supplier: "PT Sumber Jaya", totalBeli: 5890000, totalLaba: 1480000, hasRepack: false },
        { nomorPembelian: "PO-20240325-001", tanggal: new Date(2024, 2, 25, 13, 30), supplier: "CV Berkah Abadi", totalBeli: 4230000, totalLaba: 1060000, hasRepack: false },
        { nomorPembelian: "PO-20240408-001", tanggal: new Date(2024, 3, 8, 10, 45), supplier: "PT Maju Jaya", totalBeli: 5650000, totalLaba: 1420000, hasRepack: true, repackCost: 350000 },
        { nomorPembelian: "PO-20240505-001", tanggal: new Date(2024, 4, 5, 14, 20), supplier: "CV Sejahtera", totalBeli: 3980000, totalLaba: 990000, hasRepack: false },
        { nomorPembelian: "PO-20240520-001", tanggal: new Date(2024, 4, 20, 9, 50), supplier: "PT Sumber Jaya", totalBeli: 6120000, totalLaba: 1540000, hasRepack: true, repackCost: 420000 },
        { nomorPembelian: "PO-20240605-001", tanggal: new Date(2024, 5, 5, 11, 10), supplier: "CV Berkah Abadi", totalBeli: 4560000, totalLaba: 1140000, hasRepack: false },
        { nomorPembelian: "PO-20240618-001", tanggal: new Date(2024, 5, 18, 15, 30), supplier: "PT Maju Jaya", totalBeli: 5340000, totalLaba: 1340000, hasRepack: false },
        { nomorPembelian: "PO-20240708-001", tanggal: new Date(2024, 6, 8, 9, 20), supplier: "CV Sejahtera", totalBeli: 4890000, totalLaba: 1220000, hasRepack: true, repackCost: 290000 },
        { nomorPembelian: "PO-20240805-001", tanggal: new Date(2024, 7, 5, 13, 40), supplier: "PT Sumber Jaya", totalBeli: 5670000, totalLaba: 1420000, hasRepack: false },
        { nomorPembelian: "PO-20240820-001", tanggal: new Date(2024, 7, 20, 10, 25), supplier: "CV Berkah Abadi", totalBeli: 4120000, totalLaba: 1030000, hasRepack: true, repackCost: 320000 },
        { nomorPembelian: "PO-20240910-001", tanggal: new Date(2024, 8, 10, 14, 15), supplier: "PT Maju Jaya", totalBeli: 6230000, totalLaba: 1580000, hasRepack: false },
        { nomorPembelian: "PO-20241008-001", tanggal: new Date(2024, 9, 8, 11, 30), supplier: "CV Sejahtera", totalBeli: 4780000, totalLaba: 1195000, hasRepack: false },
        { nomorPembelian: "PO-20241022-001", tanggal: new Date(2024, 9, 22, 15, 20), supplier: "PT Sumber Jaya", totalBeli: 5890000, totalLaba: 1470000, hasRepack: true, repackCost: 380000 },
        { nomorPembelian: "PO-20241110-001", tanggal: new Date(2024, 10, 10, 9, 45), supplier: "CV Berkah Abadi", totalBeli: 5120000, totalLaba: 1280000, hasRepack: false },
        { nomorPembelian: "PO-20241125-001", tanggal: new Date(2024, 10, 25, 13, 50), supplier: "PT Maju Jaya", totalBeli: 4560000, totalLaba: 1140000, hasRepack: true, repackCost: 340000 },
        { nomorPembelian: "PO-20241205-001", tanggal: new Date(2024, 11, 5, 10, 15), supplier: "CV Sejahtera", totalBeli: 6780000, totalLaba: 1695000, hasRepack: false },
        { nomorPembelian: "PO-20241220-001", tanggal: new Date(2024, 11, 20, 14, 30), supplier: "PT Sumber Jaya", totalBeli: 7120000, totalLaba: 1780000, hasRepack: true, repackCost: 450000 },
      ],
      konsinyasi: [
        { nomorKonsinyasi: "KON-20240215-001", tanggal: new Date(2024, 1, 15, 10, 0), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 5500000, totalYangDibayar: 4200000, totalDikembalikan: 920000 },
        { nomorKonsinyasi: "KON-20240420-001", tanggal: new Date(2024, 3, 20, 14, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 4800000, totalYangDibayar: 3850000, totalDikembalikan: 760000 },
        { nomorKonsinyasi: "KON-20240615-001", tanggal: new Date(2024, 5, 15, 9, 20), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 5200000, totalYangDibayar: 4100000, totalDikembalikan: 830000 },
        { nomorKonsinyasi: "KON-20240820-001", tanggal: new Date(2024, 7, 20, 11, 40), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 4600000, totalYangDibayar: 3700000, totalDikembalikan: 720000 },
        { nomorKonsinyasi: "KON-20241015-001", tanggal: new Date(2024, 9, 15, 13, 50), vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 5800000, totalYangDibayar: 4650000, totalDikembalikan: 920000 },
        { nomorKonsinyasi: "KON-20241210-001", tanggal: new Date(2024, 11, 10, 10, 30), vendor: "CV Mitra Konsinyasi", totalNilaiKonsinyasi: 6200000, totalYangDibayar: 4950000, totalDikembalikan: 980000 },
      ],
      cashIn: [
        { tanggal: new Date(2024, 0, 1, 8, 0), jumlah: 15000000, keterangan: "Modal awal usaha" },
        { tanggal: new Date(2024, 2, 15, 10, 0), jumlah: 3000000, keterangan: "Tambahan modal Q1" },
        { tanggal: new Date(2024, 5, 1, 9, 0), jumlah: 5000000, keterangan: "Investasi H2" },
        { tanggal: new Date(2024, 9, 10, 11, 0), jumlah: 2500000, keterangan: "Dana ekspansi Q4" },
      ],
      cashOut: [
        { tanggal: new Date(2024, 0, 5, 9, 0), jumlah: 850000, keterangan: "Bayar listrik dan air Januari" },
        { tanggal: new Date(2024, 0, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 0, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Januari" },
        { tanggal: new Date(2024, 1, 5, 9, 0), jumlah: 800000, keterangan: "Bayar listrik dan air Februari" },
        { tanggal: new Date(2024, 1, 10, 9, 0), jumlah: 3000000, keterangan: "Setup toko awal" },
        { tanggal: new Date(2024, 1, 12, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 1, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Februari" },
        { tanggal: new Date(2024, 2, 5, 9, 0), jumlah: 780000, keterangan: "Bayar listrik dan air Maret" },
        { tanggal: new Date(2024, 2, 12, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 2, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Maret" },
        { tanggal: new Date(2024, 3, 5, 9, 0), jumlah: 820000, keterangan: "Bayar listrik dan air April" },
        { tanggal: new Date(2024, 3, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 3, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan + THR April" },
        { tanggal: new Date(2024, 4, 5, 9, 0), jumlah: 790000, keterangan: "Bayar listrik dan air Mei" },
        { tanggal: new Date(2024, 4, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 4, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Mei" },
        { tanggal: new Date(2024, 5, 5, 9, 0), jumlah: 850000, keterangan: "Bayar listrik dan air Juni" },
        { tanggal: new Date(2024, 5, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 5, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Juni" },
        { tanggal: new Date(2024, 6, 5, 9, 0), jumlah: 900000, keterangan: "Bayar listrik dan air Juli" },
        { tanggal: new Date(2024, 6, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 6, 15, 10, 0), jumlah: 1500000, keterangan: "Promosi grand opening" },
        { tanggal: new Date(2024, 6, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Juli" },
        { tanggal: new Date(2024, 7, 5, 9, 0), jumlah: 880000, keterangan: "Bayar listrik dan air Agustus" },
        { tanggal: new Date(2024, 7, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 7, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Agustus" },
        { tanggal: new Date(2024, 8, 5, 9, 0), jumlah: 820000, keterangan: "Bayar listrik dan air September" },
        { tanggal: new Date(2024, 8, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 8, 15, 14, 0), jumlah: 1200000, keterangan: "Marketing campaign" },
        { tanggal: new Date(2024, 8, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan September" },
        { tanggal: new Date(2024, 9, 5, 9, 0), jumlah: 850000, keterangan: "Bayar listrik dan air Oktober" },
        { tanggal: new Date(2024, 9, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 9, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan Oktober" },
        { tanggal: new Date(2024, 10, 5, 9, 0), jumlah: 800000, keterangan: "Bayar listrik dan air November" },
        { tanggal: new Date(2024, 10, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 10, 20, 14, 0), jumlah: 2000000, keterangan: "Gaji karyawan November" },
        { tanggal: new Date(2024, 11, 5, 9, 0), jumlah: 920000, keterangan: "Bayar listrik dan air Desember" },
        { tanggal: new Date(2024, 11, 10, 10, 0), jumlah: 400000, keterangan: "Bayar internet dan telepon" },
        { tanggal: new Date(2024, 11, 15, 11, 0), jumlah: 800000, keterangan: "Dekorasi akhir tahun" },
        { tanggal: new Date(2024, 11, 20, 14, 0), jumlah: 2500000, keterangan: "Gaji karyawan + Bonus Desember" },
      ],
    }
  },
];

type SortField = "tanggalPembuatan" | "periodeMulai";
type SortDirection = "asc" | "desc" | null;

export default function Laporan() {

    

  // State untuk create report
  const [reportType, setReportType] = useState<"daily" | "monthly" | "yearly" | "custom">("daily");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear());
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [generatedReport, setGeneratedReport] = useState<ReportData | null>(null);

  // State untuk history
  const [reportHistory, setReportHistory] = useState<ReportData[]>(mockReportHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // State untuk modal
  const [viewingReport, setViewingReport] = useState<ReportData | null>(null);

  const handleGenerateReport = () => {
    let periodeMulai: Date;
    let periodeAkhir: Date;

    if (reportType === "daily") {
      periodeMulai = new Date(selectedDate);
      periodeMulai.setHours(0, 0, 0, 0);
      periodeAkhir = new Date(selectedDate);
      periodeAkhir.setHours(23, 59, 59, 999);
    } else if (reportType === "monthly") {
      periodeMulai = new Date(selectedYear, selectedMonth, 1);
      periodeAkhir = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    } else if (reportType === "yearly") {
      periodeMulai = new Date(yearlyYear, 0, 1);
      periodeAkhir = new Date(yearlyYear, 11, 31, 23, 59, 59, 999);
    } else {
      if (!customDateFrom || !customDateTo) {
        alert("Harap pilih rentang tanggal untuk laporan custom");
        return;
      }
      periodeMulai = new Date(customDateFrom);
      periodeMulai.setHours(0, 0, 0, 0);
      periodeAkhir = new Date(customDateTo);
      periodeAkhir.setHours(23, 59, 59, 999);

      if (periodeMulai > periodeAkhir) {
        alert("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
        return;
      }
    }

    // Generate mock report data (based on current date to make it realistic)
    const newReport: ReportData = {
      id: `RPT-${format(new Date(), "yyyyMMdd")}-${String(reportHistory.length + 1).padStart(3, '0')}`,
      tanggalPembuatan: new Date(),
      periodeMulai,
      periodeAkhir,
      tipeReport: reportType,
      data: {
        posTransactions: [
          { id: "ORD-NEW-001", tanggal: periodeMulai, kasir: "Budi Santoso", total: 235000, metode: "Tunai" },
          { id: "ORD-NEW-002", tanggal: periodeMulai, kasir: "Siti Rahmawati", total: 450000, metode: "QRIS" },
          { id: "ORD-NEW-003", tanggal: periodeMulai, kasir: "Budi Santoso", total: 180000, metode: "Debit Card" },
        ],
        onlineTransactions: [
          { id: "ONL-NEW-001", tanggal: periodeMulai, pelanggan: "Ahmad Hidayat", total: 385000, status: "Selesai" },
          { id: "ONL-NEW-002", tanggal: periodeMulai, pelanggan: "Dewi Lestari", total: 320000, status: "Selesai" },
        ],
        pembelian: [
          { nomorPembelian: "PO-NEW-001", tanggal: periodeMulai, supplier: "PT Sumber Jaya", totalBeli: 3210000, totalLaba: 820000, hasRepack: true, repackCost: 280000 },
          { nomorPembelian: "PO-NEW-002", tanggal: periodeMulai, supplier: "CV Berkah Abadi", totalBeli: 4660000, totalLaba: 1160000, hasRepack: false },
        ],
        konsinyasi: [
          { nomorKonsinyasi: "KON-NEW-001", tanggal: periodeMulai, vendor: "PT Konsinyasi Jaya", totalNilaiKonsinyasi: 4500000, totalYangDibayar: 3200000, totalDikembalikan: 850000 },
        ],
        cashIn: [
          { tanggal: periodeMulai, jumlah: 5000000, keterangan: "Modal periode baru" },
          { tanggal: periodeMulai, jumlah: 2000000, keterangan: "Tambahan investasi" },
        ],
        cashOut: [
          { tanggal: periodeMulai, jumlah: 800000, keterangan: "Bayar listrik dan air" },
          { tanggal: periodeMulai, jumlah: 450000, keterangan: "Bayar internet dan telepon" },
          { tanggal: periodeMulai, jumlah: 2500000, keterangan: "Gaji karyawan" },
        ],
      }
    };

    setGeneratedReport(newReport);
    // Automatically save to history
    setReportHistory([newReport, ...reportHistory]);
  };

  const handleDownloadReport = (report: ReportData) => {
    const periodeText = getPeriodeText(report);
    alert(`Mengunduh laporan:\n\nID: ${report.id}\nPeriode: ${periodeText}\n\nFile akan diunduh sebagai PDF/Excel`);
  };

  const getPeriodeText = (report: ReportData) => {
    if (report.tipeReport === "daily") {
      return format(report.periodeMulai, "dd MMMM yyyy", { locale: id });
    } else if (report.tipeReport === "monthly") {
      return format(report.periodeMulai, "MMMM yyyy", { locale: id });
    } else if (report.tipeReport === "yearly") {
      return format(report.periodeMulai, "yyyy", { locale: id });
    } else {
      return `${format(report.periodeMulai, "dd MMM yyyy", { locale: id })} - ${format(report.periodeAkhir, "dd MMM yyyy", { locale: id })}`;
    }
  };

  // Filter history
  const filteredHistory = useMemo(() => {
    return reportHistory.filter(report => {
      const query = searchQuery.toLowerCase();
      return report.id.toLowerCase().includes(query);
    });
  }, [reportHistory, searchQuery]);

  // Sort history
  const sortedHistory = useMemo(() => {
    if (!sortField || !sortDirection) return filteredHistory;

    return [...filteredHistory].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "tanggalPembuatan" || sortField === "periodeMulai") {
        aValue = a[sortField].getTime();
        bValue = b[sortField].getTime();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredHistory, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = sortedHistory.slice(startIndex, startIndex + itemsPerPage);

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

  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="laporan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div>
            <h1 style={{ color: '#000000' }}>Laporan</h1>
            <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Buat dan kelola laporan keuangan toko
            </p>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto px-8 py-6">
          <div className="space-y-6">
            {/* Create Report Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="mb-4" style={{ color: '#000000' }}>Buat Laporan Baru</h2>

              {/* Report Type Selection */}
              <div className="mb-6">
                <label className="block mb-3" style={{ color: '#000000' }}>
                  Pilih Tipe Laporan
                </label>
                <div className="grid grid-cols-4 gap-4">
                  <button
                    onClick={() => setReportType("daily")}
                    className="p-4 rounded-lg border-2 transition-colors text-left"
                    style={{
                      borderColor: reportType === "daily" ? '#27b446' : '#e5e7eb',
                      backgroundColor: reportType === "daily" ? 'rgba(39, 180, 70, 0.05)' : 'transparent'
                    }}
                  >
                    <p style={{ color: '#000000' }}>Harian</p>
                    <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Laporan per hari
                    </p>
                  </button>

                  <button
                    onClick={() => setReportType("monthly")}
                    className="p-4 rounded-lg border-2 transition-colors text-left"
                    style={{
                      borderColor: reportType === "monthly" ? '#27b446' : '#e5e7eb',
                      backgroundColor: reportType === "monthly" ? 'rgba(39, 180, 70, 0.05)' : 'transparent'
                    }}
                  >
                    <p style={{ color: '#000000' }}>Bulanan</p>
                    <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Laporan per bulan
                    </p>
                  </button>

                  <button
                    onClick={() => setReportType("yearly")}
                    className="p-4 rounded-lg border-2 transition-colors text-left"
                    style={{
                      borderColor: reportType === "yearly" ? '#27b446' : '#e5e7eb',
                      backgroundColor: reportType === "yearly" ? 'rgba(39, 180, 70, 0.05)' : 'transparent'
                    }}
                  >
                    <p style={{ color: '#000000' }}>Tahunan</p>
                    <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Laporan per tahun
                    </p>
                  </button>

                  <button
                    onClick={() => setReportType("custom")}
                    className="p-4 rounded-lg border-2 transition-colors text-left"
                    style={{
                      borderColor: reportType === "custom" ? '#27b446' : '#e5e7eb',
                      backgroundColor: reportType === "custom" ? 'rgba(39, 180, 70, 0.05)' : 'transparent'
                    }}
                  >
                    <p style={{ color: '#000000' }}>Custom</p>
                    <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Tentukan periode
                    </p>
                  </button>
                </div>
              </div>

              {/* Date Selection */}
              <div className="flex items-end gap-2">
                {reportType === "daily" && (
                  <>
                    <div className="flex-1">
                      <label className="block mb-2" style={{ color: '#000000' }}>
                        Pilih Tanggal
                      </label>
                      <div className="relative max-w-xs">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                          style={{
                            color: '#1a0408',
                            '--tw-ring-color': '#27b446'
                          } as any}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.4 }} />
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}
                    >
                      <FileText className="w-5 h-5" />
                      Buat Laporan
                    </button>
                  </>
                )}

                {reportType === "monthly" && (
                  <>
                    <div className="flex-1 grid grid-cols-2 gap-4 max-w-lg">
                      <div>
                        <label className="block mb-2" style={{ color: '#000000' }}>
                          Pilih Bulan
                        </label>
                        <div className="relative">
                          <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                            style={{
                              color: '#1a0408',
                              '--tw-ring-color': '#27b446'
                            } as any}
                          >
                            {months.map((month, index) => (
                              <option key={index} value={index}>{month}</option>
                            ))}
                          </select>
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                            style={{ color: '#1a0408', opacity: 0.6 }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block mb-2" style={{ color: '#000000' }}>
                          Pilih Tahun
                        </label>
                        <div className="relative">
                          <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                            style={{
                              color: '#1a0408',
                              '--tw-ring-color': '#27b446'
                            } as any}
                          >
                            {years.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                          <ChevronDown
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                            style={{ color: '#1a0408', opacity: 0.6 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}
                    >
                      <FileText className="w-5 h-5" />
                      Buat Laporan
                    </button>
                  </>
                )}

                {reportType === "yearly" && (
                  <>
                    <div className="flex-1">
                      <label className="block mb-2" style={{ color: '#000000' }}>
                        Pilih Tahun
                      </label>
                      <div className="relative max-w-xs">
                        <select
                          value={yearlyYear}
                          onChange={(e) => setYearlyYear(Number(e.target.value))}
                          className="appearance-none w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                          style={{
                            color: '#1a0408',
                            '--tw-ring-color': '#27b446'
                          } as any}
                        >
                          {years.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                        <ChevronDown
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                          style={{ color: '#1a0408', opacity: 0.6 }}
                        />
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}
                    >
                      <FileText className="w-5 h-5" />
                      Buat Laporan
                    </button>
                  </>
                )}

                {reportType === "custom" && (
                  <>
                    <div className="flex-1 grid grid-cols-2 gap-4 max-w-lg">
                      <div>
                        <label className="block mb-2" style={{ color: '#000000' }}>
                          Dari Tanggal
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={customDateFrom}
                            onChange={(e) => setCustomDateFrom(e.target.value)}
                            className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                            style={{
                              color: '#1a0408',
                              '--tw-ring-color': '#27b446'
                            } as any}
                          />
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.4 }} />
                        </div>
                      </div>

                      <div>
                        <label className="block mb-2" style={{ color: '#000000' }}>
                          Sampai Tanggal
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={customDateTo}
                            onChange={(e) => setCustomDateTo(e.target.value)}
                            className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                            style={{
                              color: '#1a0408',
                              '--tw-ring-color': '#27b446'
                            } as any}
                          />
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.4 }} />
                        </div>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerateReport}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}
                    >
                      <FileText className="w-5 h-5" />
                      Buat Laporan
                    </button>
                  </>
                )}
              </div>

              {/* Generated Report Preview */}
              {generatedReport && (
                <div className="mt-6 p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p style={{ color: '#000000' }}>Laporan berhasil dibuat!</p>
                      <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                        Periode: {getPeriodeText(generatedReport)}
                      </p>
                    </div>
                    <button
                      onClick={() => setGeneratedReport(null)}
                      className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{ color: '#1a0408' }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewingReport(generatedReport)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}
                    >
                      <Eye className="w-4 h-4" />
                      Lihat
                    </button>

                    <button
                      onClick={() => handleDownloadReport(generatedReport)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors"
                      style={{
                        borderColor: '#27b446',
                        color: '#27b446'
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Unduh
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Report History Section */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 style={{ color: '#000000' }}>Riwayat Laporan</h2>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Daftar laporan yang pernah dibuat
                </p>
              </div>

              {/* Search */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                  <input
                    type="text"
                    placeholder="Cari ID Laporan..."
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

              {/* Table */}
              <table className="w-full">
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <button
                        onClick={() => handleSort("tanggalPembuatan")}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                        style={{ color: '#000000' }}
                      >
                        Tanggal Pembuatan
                        {getSortIcon("tanggalPembuatan")}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <button
                        onClick={() => handleSort("periodeMulai")}
                        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                        style={{ color: '#000000' }}
                      >
                        Periode Laporan
                        {getSortIcon("periodeMulai")}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        <div style={{ color: '#1a0408', opacity: 0.4 }}>
                          Belum ada riwayat laporan
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((report) => (
                      <tr
                        key={report.id}
                        className="border-b border-gray-200 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                          <div>
                            <p style={{ color: '#27b446' }}>{report.id}</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                              {format(report.tanggalPembuatan, "dd MMM yyyy, HH:mm", { locale: id })}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                          {getPeriodeText(report)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewingReport(report)}
                              className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                              style={{
                                borderColor: '#27b446',
                                color: '#27b446'
                              }}
                              title="Lihat Laporan"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadReport(report)}
                              className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                              style={{
                                borderColor: '#27b446',
                                color: '#27b446'
                              }}
                              title="Unduh Laporan"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {sortedHistory.length > 0 && (
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
                      Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, sortedHistory.length)} dari {sortedHistory.length} laporan
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
      </div>

      {/* View Report Modal */}
      {viewingReport && (
        <ViewReportModal
          report={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}
    </div>
  );
}

interface ViewReportModalProps {
  report: ReportData;
  onClose: () => void;
}

// Helper functions for segmentation
function getWeeksInRange(start: Date, end: Date) {
  const weeks = eachWeekOfInterval(
    { start, end },
    { weekStartsOn: 1 } // Monday
  );

  return weeks.map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const actualEnd = weekEnd > end ? end : weekEnd;

    return {
      weekNumber: index + 1,
      start: weekStart < start ? start : weekStart,
      end: actualEnd
    };
  });
}

function getMonthsInRange(start: Date, end: Date) {
  const months = eachMonthOfInterval({ start, end });

  return months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const actualEnd = monthEnd > end ? end : monthEnd;
    const actualStart = monthStart < start ? start : startOfMonth(monthStart);

    return {
      monthDate: monthStart,
      start: actualStart,
      end: actualEnd
    };
  });
}

function filterDataByDateRange(data: any[], dateField: string, start: Date, end: Date) {
  return data.filter(item => {
    const itemDate = item[dateField];
    return isWithinInterval(itemDate, { start, end });
  });
}

function ViewReportModal({ report, onClose }: ViewReportModalProps) {
  // Calculate totals
  const totalPOS = report.data.posTransactions.reduce((sum, item) => sum + item.total, 0);
  const totalOnline = report.data.onlineTransactions.reduce((sum, item) => sum + item.total, 0);
  const totalPembelian = report.data.pembelian.reduce((sum, item) => sum + item.totalBeli, 0);
  const totalRepackCost = report.data.pembelian.reduce((sum, item) => sum + (item.repackCost || 0), 0);
  const totalLabaPembelian = report.data.pembelian.reduce((sum, item) => sum + item.totalLaba, 0);
  const totalKonsinyasiYangDibayar = report.data.konsinyasi.reduce((sum, item) => sum + item.totalYangDibayar, 0);
  const totalCashIn = report.data.cashIn.reduce((sum, item) => sum + item.jumlah, 0);
  const totalCashOut = report.data.cashOut.reduce((sum, item) => sum + item.jumlah, 0);

  const totalPendapatan = totalPOS + totalOnline + totalCashIn;
  const totalPengeluaran = totalPembelian + totalRepackCost + totalKonsinyasiYangDibayar + totalCashOut;
  const netProfit = totalPendapatan - totalPengeluaran + totalLabaPembelian;

  const getPeriodeText = () => {
    if (report.tipeReport === "daily") {
      return format(report.periodeMulai, "dd MMMM yyyy", { locale: id });
    } else if (report.tipeReport === "monthly") {
      return format(report.periodeMulai, "MMMM yyyy", { locale: id });
    } else if (report.tipeReport === "yearly") {
      return format(report.periodeMulai, "yyyy", { locale: id });
    } else {
      return `${format(report.periodeMulai, "dd MMM yyyy", { locale: id })} - ${format(report.periodeAkhir, "dd MMM yyyy", { locale: id })}`;
    }
  };

  // Prepare segmentation based on report type
  const segments = (() => {
    if (report.tipeReport === "daily") {
      return null; // No segmentation for daily
    } else if (report.tipeReport === "monthly") {
      // Weekly segmentation for monthly report
      const weeks = getWeeksInRange(report.periodeMulai, report.periodeAkhir);
      return weeks.map(week => ({
        title: `Minggu ${week.weekNumber} (${format(week.start, "dd MMM", { locale: id })} - ${format(week.end, "dd MMM", { locale: id })})`,
        start: week.start,
        end: week.end
      }));
    } else if (report.tipeReport === "yearly" || report.tipeReport === "custom") {
      // Monthly segmentation, then weekly within each month
      const months = getMonthsInRange(report.periodeMulai, report.periodeAkhir);
      return months.map(month => {
        const weeks = getWeeksInRange(month.start, month.end);
        return {
          title: format(month.monthDate, "MMMM yyyy", { locale: id }),
          start: month.start,
          end: month.end,
          weeks: weeks.map(week => ({
            title: `Minggu ${week.weekNumber} (${format(week.start, "dd MMM", { locale: id })} - ${format(week.end, "dd MMM", { locale: id })})`,
            start: week.start,
            end: week.end
          }))
        };
      });
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-6xl mx-4 h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: '#000000' }}>Laporan Keuangan</h2>
            <p style={{ color: '#27b446' }}>{report.id}</p>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Periode: {getPeriodeText()}
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Summary */}
          <div className="mb-6 p-6 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <h3 className="mb-4" style={{ color: '#000000' }}>Ringkasan Total</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Pendapatan</p>
                <p className="text-2xl" style={{ color: '#27b446' }}>
                  Rp {totalPendapatan.toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Pengeluaran</p>
                <p className="text-2xl" style={{ color: '#e40b18' }}>
                  Rp {totalPengeluaran.toLocaleString('id-ID')}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Laba Bersih</p>
                <p className="text-2xl" style={{ color: netProfit >= 0 ? '#27b446' : '#e40b18' }}>
                  Rp {netProfit.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>

          {/* Segmented or Non-segmented Data */}
          {!segments ? (
            // Daily report - no segmentation
            <DailyReportContent data={report.data} />
          ) : report.tipeReport === "monthly" ? (
            // Monthly report - weekly segmentation
            <MonthlyReportContent data={report.data} segments={segments} />
          ) : (
            // Yearly/Custom report - monthly then weekly segmentation
            <YearlyCustomReportContent data={report.data} segments={segments} />
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
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

// Component for daily report (no segmentation)
function DailyReportContent({ data }: { data: ReportData['data'] }) {
  return (
    <>
      <DataSection
        title="Transaksi POS"
        transactions={data.posTransactions}
        type="pos"
      />
      <DataSection
        title="Transaksi Online"
        transactions={data.onlineTransactions}
        type="online"
      />
      <DataSection
        title="Pembelian Stok"
        transactions={data.pembelian}
        type="pembelian"
      />
      <DataSection
        title="Konsinyasi"
        transactions={data.konsinyasi}
        type="konsinyasi"
      />
      <div className="grid grid-cols-2 gap-6">
        <DataSection
          title="Cash In"
          transactions={data.cashIn}
          type="cashIn"
        />
        <DataSection
          title="Cash Out"
          transactions={data.cashOut}
          type="cashOut"
        />
      </div>
    </>
  );
}

// Component for monthly report (weekly segmentation)
function MonthlyReportContent({ data, segments }: { data: ReportData['data']; segments: any[] }) {
  return (
    <div className="space-y-6">
      {segments.map((segment, index) => {
        const weekData = {
          posTransactions: filterDataByDateRange(data.posTransactions, 'tanggal', segment.start, segment.end),
          onlineTransactions: filterDataByDateRange(data.onlineTransactions, 'tanggal', segment.start, segment.end),
          pembelian: filterDataByDateRange(data.pembelian, 'tanggal', segment.start, segment.end),
          konsinyasi: filterDataByDateRange(data.konsinyasi, 'tanggal', segment.start, segment.end),
          cashIn: filterDataByDateRange(data.cashIn, 'tanggal', segment.start, segment.end),
          cashOut: filterDataByDateRange(data.cashOut, 'tanggal', segment.start, segment.end),
        };

        return (
          <div key={index} className="border-2 border-gray-200 rounded-lg p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.01)' }}>
            <h3 className="mb-4 pb-2 border-b-2" style={{ color: '#27b446', borderColor: '#27b446' }}>
              {segment.title}
            </h3>
            <div className="space-y-4">
              <DataSection
                title="Transaksi POS"
                transactions={weekData.posTransactions}
                type="pos"
              />
              <DataSection
                title="Transaksi Online"
                transactions={weekData.onlineTransactions}
                type="online"
              />
              <DataSection
                title="Pembelian Stok"
                transactions={weekData.pembelian}
                type="pembelian"
              />
              <DataSection
                title="Konsinyasi"
                transactions={weekData.konsinyasi}
                type="konsinyasi"
              />
              <div className="grid grid-cols-2 gap-4">
                <DataSection
                  title="Cash In"
                  transactions={weekData.cashIn}
                  type="cashIn"
                />
                <DataSection
                  title="Cash Out"
                  transactions={weekData.cashOut}
                  type="cashOut"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Component for yearly/custom report (monthly then weekly segmentation)
function YearlyCustomReportContent({ data, segments }: { data: ReportData['data']; segments: any[] }) {
  return (
    <div className="space-y-6">
      {segments.map((monthSegment: any, monthIndex: number) => {
        return (
          <div key={monthIndex} className="border-2 border-gray-300 rounded-lg p-5" style={{ backgroundColor: 'rgba(39, 180, 70, 0.03)' }}>
            <h2 className="mb-4 pb-3 border-b-2 text-xl" style={{ color: '#27b446', borderColor: '#27b446' }}>
              {monthSegment.title}
            </h2>
            <div className="space-y-5">
              {monthSegment.weeks.map((weekSegment: any, weekIndex: number) => {
                const weekData = {
                  posTransactions: filterDataByDateRange(data.posTransactions, 'tanggal', weekSegment.start, weekSegment.end),
                  onlineTransactions: filterDataByDateRange(data.onlineTransactions, 'tanggal', weekSegment.start, weekSegment.end),
                  pembelian: filterDataByDateRange(data.pembelian, 'tanggal', weekSegment.start, weekSegment.end),
                  konsinyasi: filterDataByDateRange(data.konsinyasi, 'tanggal', weekSegment.start, weekSegment.end),
                  cashIn: filterDataByDateRange(data.cashIn, 'tanggal', weekSegment.start, weekSegment.end),
                  cashOut: filterDataByDateRange(data.cashOut, 'tanggal', weekSegment.start, weekSegment.end),
                };

                return (
                  <div key={weekIndex} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <h4 className="mb-3 pb-2 border-b" style={{ color: '#1a0408', borderColor: '#e5e7eb' }}>
                      {weekSegment.title}
                    </h4>
                    <div className="space-y-4">
                      <DataSection
                        title="Transaksi POS"
                        transactions={weekData.posTransactions}
                        type="pos"
                        compact
                      />
                      <DataSection
                        title="Transaksi Online"
                        transactions={weekData.onlineTransactions}
                        type="online"
                        compact
                      />
                      <DataSection
                        title="Pembelian Stok"
                        transactions={weekData.pembelian}
                        type="pembelian"
                        compact
                      />
                      <DataSection
                        title="Konsinyasi"
                        transactions={weekData.konsinyasi}
                        type="konsinyasi"
                        compact
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <DataSection
                          title="Cash In"
                          transactions={weekData.cashIn}
                          type="cashIn"
                          compact
                        />
                        <DataSection
                          title="Cash Out"
                          transactions={weekData.cashOut}
                          type="cashOut"
                          compact
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Reusable component for rendering data sections
function DataSection({ title, transactions, type, compact = false }: {
  title: string;
  transactions: any[];
  type: 'pos' | 'online' | 'pembelian' | 'konsinyasi' | 'cashIn' | 'cashOut';
  compact?: boolean;
}) {
  const total = transactions.reduce((sum, item) => {
    if (type === 'pos' || type === 'online') return sum + item.total;
    if (type === 'pembelian') return sum + item.totalBeli + (item.repackCost || 0);
    if (type === 'konsinyasi') return sum + item.totalYangDibayar;
    if (type === 'cashIn' || type === 'cashOut') return sum + item.jumlah;
    return sum;
  }, 0);

  const titleColor = type === 'cashOut' || type === 'pembelian' || type === 'konsinyasi' ? '#e40b18' : '#27b446';

  return (
    <div className={compact ? "mb-3" : "mb-6"}>
      <div className="flex items-center justify-between mb-2">
        <h4 className={compact ? "text-sm font-semibold" : ""} style={{ color: '#000000' }}>{title}</h4>
        {transactions.length > 0 && (
          <p className={compact ? "text-sm" : ""} style={{ color: titleColor }}>
            Rp {total.toLocaleString('id-ID')}
          </p>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              {type === 'pos' && (
                <>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>ID</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Tanggal</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Kasir</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Metode</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Total</th>
                </>
              )}
              {type === 'online' && (
                <>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>ID</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Tanggal</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Pelanggan</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Status</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Total</th>
                </>
              )}
              {type === 'pembelian' && (
                <>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>No. Pembelian</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Tanggal</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Supplier</th>
                  <th className={`px-3 py-2 text-center ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Repack</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Total</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Laba</th>
                </>
              )}
              {type === 'konsinyasi' && (
                <>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>No. Konsinyasi</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Tanggal</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Vendor</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Nilai Konsinyasi</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Yang Dibayar</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Dikembalikan</th>
                </>
              )}
              {(type === 'cashIn' || type === 'cashOut') && (
                <>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Tanggal</th>
                  <th className={`px-3 py-2 text-left ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Keterangan</th>
                  <th className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>Jumlah</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={type === 'pembelian' || type === 'konsinyasi' ? 6 : type === 'cashIn' || type === 'cashOut' ? 3 : 5} className={`px-3 py-4 text-center ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408', opacity: 0.4 }}>
                  Tidak ada data
                </td>
              </tr>
            ) : (
              transactions.map((item, index) => (
                <tr key={index} className="border-t border-gray-200">
                  {type === 'pos' && (
                    <>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.id}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {format(item.tanggal, compact ? "dd/MM HH:mm" : "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.kasir}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.metode}</td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>
                        Rp {item.total.toLocaleString('id-ID')}
                      </td>
                    </>
                  )}
                  {type === 'online' && (
                    <>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.id}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {format(item.tanggal, compact ? "dd/MM HH:mm" : "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.pelanggan}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.status}</td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#000000' }}>
                        Rp {item.total.toLocaleString('id-ID')}
                      </td>
                    </>
                  )}
                  {type === 'pembelian' && (
                    <>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.nomorPembelian}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {format(item.tanggal, compact ? "dd/MM HH:mm" : "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.supplier}</td>
                      <td className={`px-3 py-2 text-center ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {item.hasRepack ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: '#27b446' }}>
                            Ya
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#e40b18' }}>
                        Rp {(item.totalBeli + (item.repackCost || 0)).toLocaleString('id-ID')}
                        {item.repackCost && (
                          <span className="block text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                            (Repack: Rp {item.repackCost.toLocaleString('id-ID')})
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#27b446' }}>
                        Rp {item.totalLaba.toLocaleString('id-ID')}
                      </td>
                    </>
                  )}
                  {type === 'konsinyasi' && (
                    <>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.nomorKonsinyasi}</td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {format(item.tanggal, compact ? "dd/MM HH:mm" : "dd MMM yyyy, HH:mm", { locale: id })}
                      </td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.vendor}</td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        Rp {item.totalNilaiKonsinyasi.toLocaleString('id-ID')}
                      </td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#e40b18' }}>
                        Rp {item.totalYangDibayar.toLocaleString('id-ID')}
                      </td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: '#3b82f6' }}>
                        Rp {item.totalDikembalikan.toLocaleString('id-ID')}
                      </td>
                    </>
                  )}
                  {(type === 'cashIn' || type === 'cashOut') && (
                    <>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>
                        {format(item.tanggal, compact ? "dd/MM" : "dd MMM yyyy", { locale: id })}
                      </td>
                      <td className={`px-3 py-2 ${compact ? 'text-xs' : ''}`} style={{ color: '#1a0408' }}>{item.keterangan}</td>
                      <td className={`px-3 py-2 text-right ${compact ? 'text-xs' : ''}`} style={{ color: type === 'cashIn' ? '#27b446' : '#e40b18' }}>
                        Rp {item.jumlah.toLocaleString('id-ID')}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
