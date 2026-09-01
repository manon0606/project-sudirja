"use client";

import { useState } from "react";
import AdminSidebar from "../components/AdminSidebar";

const sales = [82, 56, 64, 48, 73, 91, 68, 78, 58, 75, 88, 96];
const orders = [
  { id: "#ORD-240812", customer: "Andi Pratama", amount: "Rp 248.000", status: "Selesai", time: "10:42" },
  { id: "#ORD-240811", customer: "Siti Rahma", amount: "Rp 126.500", status: "Diproses", time: "10:35" },
  { id: "#ORD-240810", customer: "Budi Santoso", amount: "Rp 385.000", status: "Selesai", time: "10:18" },
  { id: "#ORD-240809", customer: "Nadia Putri", amount: "Rp 74.000", status: "Menunggu", time: "09:56" },
];

export default function DashboardPage() {
  const [range, setRange] = useState("7 hari terakhir");

  return (
    <main className="flex min-h-screen bg-[#fcfaff] text-[#1a0408]">
      <AdminSidebar activePage="dashboard" />
      <section className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-[#e9e4e7] bg-white px-5 sm:px-8">
          <div><p className="text-xs text-[#1a0408]/45">Selasa, 12 Agustus 2025</p><h1 className="mt-1 text-xl font-semibold tracking-[-0.04em] sm:text-2xl">Selamat datang, Admin</h1></div>
          <div className="flex items-center gap-3"><button aria-label="Notifications" className="relative rounded-lg border border-[#e6e1e4] p-2.5 text-[#1a0408]/55 hover:bg-[#faf9f9]">♢<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#27b446]" /></button><div className="hidden h-8 w-px bg-[#ece8ea] sm:block" /><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#27b446] text-sm font-bold text-white">A</div></div>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-6 p-5 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[['Total Penjualan','Rp 24.580.000','+12,5%'],['Total Pesanan','284','+8,2%'],['Produk Terjual','1.248','+16,4%'],['Pelanggan Baru','86','+4,6%']].map(([title, value, growth]) => <div key={title} className="rounded-2xl border border-[#e8e3e6] bg-white p-5"><div className="flex items-start justify-between"><p className="text-sm text-[#1a0408]/55">{title}</p><span className="rounded-lg bg-[#eaf8ed] px-2 py-1 text-xs text-[#218c39]">↗</span></div><p className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{value}</p><p className="mt-2 text-xs text-[#218c39]">{growth} <span className="text-[#1a0408]/40">dari bulan lalu</span></p></div>)}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <section className="rounded-2xl border border-[#e8e3e6] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold tracking-[-0.02em]">Penjualan</h2><p className="mt-1 text-xs text-[#1a0408]/45">Performa penjualan toko</p></div><select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-lg border border-[#e3dee1] bg-white px-3 py-2 text-xs outline-none focus:border-[#27b446]"><option>7 hari terakhir</option><option>30 hari terakhir</option><option>Tahun ini</option></select></div><div className="mt-8 flex h-48 items-end gap-2 border-b border-[#eee9eb] px-1 sm:gap-3">{sales.map((height, index) => <div key={index} className="group flex h-full flex-1 flex-col justify-end"><div className="relative w-full rounded-t-md bg-[#27b446]/75 transition hover:bg-[#27b446]" style={{ height: `${height}%` }}><span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-[#1a0408] px-1.5 py-1 text-[10px] text-white group-hover:block">{height}k</span></div></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-[#1a0408]/40"><span>01 Agu</span><span>03 Agu</span><span>05 Agu</span><span>07 Agu</span><span>09 Agu</span><span>11 Agu</span></div></section>
            <section className="rounded-2xl border border-[#e8e3e6] bg-white p-5 sm:p-6"><div><h2 className="font-semibold tracking-[-0.02em]">Ringkasan pesanan</h2><p className="mt-1 text-xs text-[#1a0408]/45">Status pesanan hari ini</p></div><div className="mt-8 flex items-center justify-center"><div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: "conic-gradient(#27b446 0 72%, #f4c544 72% 87%, #e8e3e6 87% 100%)" }}><div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white"><strong className="text-2xl">284</strong><span className="text-[10px] text-[#1a0408]/45">Total pesanan</span></div></div></div><div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs"><div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#27b446]" /><b>204</b><p className="mt-1 text-[#1a0408]/45">Selesai</p></div><div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#f4c544]" /><b>43</b><p className="mt-1 text-[#1a0408]/45">Diproses</p></div><div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#e8e3e6]" /><b>37</b><p className="mt-1 text-[#1a0408]/45">Lainnya</p></div></div></section>
          </div>
          <section className="overflow-hidden rounded-2xl border border-[#e8e3e6] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9eb] p-5 sm:p-6"><div><h2 className="font-semibold tracking-[-0.02em]">Pesanan terbaru</h2><p className="mt-1 text-xs text-[#1a0408]/45">Aktivitas transaksi terbaru</p></div><button className="text-xs font-semibold text-[#218c39] hover:underline">Lihat semua →</button></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-[#fcfbfc] text-[11px] uppercase tracking-wide text-[#1a0408]/40"><tr><th className="px-6 py-3 font-medium">ID Pesanan</th><th className="px-6 py-3 font-medium">Pelanggan</th><th className="px-6 py-3 font-medium">Total</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium">Waktu</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-t border-[#f0edef] hover:bg-[#fcfbfc]"><td className="px-6 py-4 font-mono text-xs">{order.id}</td><td className="px-6 py-4">{order.customer}</td><td className="px-6 py-4 font-medium">{order.amount}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] ${order.status === "Selesai" ? "bg-[#eaf8ed] text-[#218c39]" : order.status === "Diproses" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{order.status}</span></td><td className="px-6 py-4 text-xs text-[#1a0408]/45">{order.time}</td></tr>)}</tbody></table></div></section>
        </div>
      </section>
    </main>
  );
}
