"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import { useUser } from "../components/useUser";
import { getDashboard } from "@/lib/dashboard-api";
import type { DashboardDTO } from "@/lib/dashboard-types";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type Range = "7" | "30" | "year";

function formatRp(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function todayLabel(): string {
  const d = new Date();
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][d.getDay()];
  const bln = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][d.getMonth()];
  return `${hari}, ${d.getDate()} ${bln} ${d.getFullYear()}`;
}

function Card({ title, value, growth, label = "dari periode sebelumnya" }: { title: string; value: string; growth: number | null; label?: string }) {
  return (
    <div className="rounded-2xl border border-[#e8e3e6] bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-[#1a0408]/55">{title}</p>
        <span className="rounded-lg bg-[#eaf8ed] px-2 py-1 text-xs text-[#218c39]">
          {growth === null ? "•" : growth >= 0 ? "↗" : "↘"}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-2 text-xs text-[#218c39]">
        {growth === null ? "Data baru" : `${growth >= 0 ? "+" : ""}${growth}%`} <span className="text-[#1a0408]/40">{label}</span>
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const [range, setRange] = useState<Range>("7");
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboard(range));
    } catch {
      setError("Gagal memuat data dashboard.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const s = data?.summary;
  const st = data?.statusHariIni;
  const grafik = data?.grafik ?? [];
  const maxGrafik = Math.max(1, ...grafik.map((g) => g.total));

  return (
    <main className="flex min-h-screen bg-[#fcfaff] text-[#1a0408]">
      <AdminSidebar activePage="dashboard" />
      <section className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-[#e9e4e7] bg-white px-5 sm:px-8">
          <div>
            <p className="text-xs text-[#1a0408]/45">{todayLabel()}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
              Selamat datang, {user.fullName || "Admin"}
            </h1>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#27b446] text-sm font-bold text-white">
            {(user.fullName || "A").charAt(0)}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-6 p-5 sm:p-8">
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              ⚠ {error}
            </div>
          )}

          {loading && !data ? (
            <div className="py-24 text-center text-sm text-[#1a0408]/45">Memuat dashboard...</div>
          ) : s ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card title="Total Penjualan" value={formatRp(s.totalPenjualan)} growth={s.pertumbuhan.totalPenjualan} />
                <Card title="Total Pesanan" value={String(s.totalPesanan)} growth={s.pertumbuhan.totalPesanan} />
                <Card title="Produk Terjual" value={String(s.produkTerjual)} growth={s.pertumbuhan.produkTerjual} />
                <Card title="Pelanggan Baru" value={String(s.pelangganBaru)} growth={s.pertumbuhan.pelangganBaru} />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                <section className="rounded-2xl border border-[#e8e3e6] bg-white p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold tracking-[-0.02em]">Penjualan</h2>
                      <p className="mt-1 text-xs text-[#1a0408]/45">Performa penjualan toko</p>
                    </div>
                    <select
                      value={range}
                      onChange={(e) => setRange(e.target.value as Range)}
                      className="rounded-lg border border-[#e3dee1] bg-white px-3 py-2 text-xs outline-none focus:border-[#27b446]"
                    >
                      <option value="7">7 hari terakhir</option>
                      <option value="30">30 hari terakhir</option>
                      <option value="year">Tahun ini</option>
                    </select>
                  </div>
                  <div className="mt-8 flex h-48 items-end gap-1 border-b border-[#eee9eb] px-1 sm:gap-2 overflow-x-auto">
                    {grafik.map((g, i) => (
                      <div key={i} className="group relative flex h-full flex-1 min-w-[14px] flex-col justify-end">
                        <div
                          className="relative w-full rounded-t-md bg-[#27b446]/75 transition hover:bg-[#27b446]"
                          style={{ height: `${Math.max(2, (g.total / maxGrafik) * 100)}%` }}
                        >
                          <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#1a0408] px-1.5 py-1 text-[10px] text-white group-hover:block">
                            {formatRp(g.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] text-[#1a0408]/40">
                    {grafik.slice(0, 5).map((g, i) => <span key={i}>{g.label}</span>)}
                    {grafik.length > 5 && <span>… {grafik[grafik.length - 1].label}</span>}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#e8e3e6] bg-white p-5 sm:p-6">
                  <div>
                    <h2 className="font-semibold tracking-[-0.02em]">Ringkasan pesanan</h2>
                    <p className="mt-1 text-xs text-[#1a0408]/45">Status pesanan hari ini</p>
                  </div>
                  {st && st.total > 0 ? (
                    <>
                      <div className="mt-8 flex items-center justify-center">
                        <div
                          className="relative flex h-40 w-40 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(#27b446 0 ${(st.selesai / st.total) * 100}%, #f4c544 ${(st.selesai / st.total) * 100}% ${((st.selesai + st.diproses) / st.total) * 100}%, #e8e3e6 ${((st.selesai + st.diproses) / st.total) * 100}% 100%)`,
                          }}
                        >
                          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                            <strong className="text-2xl">{st.total}</strong>
                            <span className="text-[10px] text-[#1a0408]/45">Total pesanan</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-7 grid grid-cols-3 gap-2 text-center text-xs">
                        <div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#27b446]" /><b>{st.selesai}</b><p className="mt-1 text-[#1a0408]/45">Selesai</p></div>
                        <div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#f4c544]" /><b>{st.diproses}</b><p className="mt-1 text-[#1a0408]/45">Diproses</p></div>
                        <div><span className="mx-auto mb-1 block h-2 w-2 rounded-full bg-[#e8e3e6]" /><b>{st.lainnya}</b><p className="mt-1 text-[#1a0408]/45">Lainnya</p></div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-10 text-center text-sm text-[#1a0408]/40">Belum ada pesanan hari ini</div>
                  )}
                </section>
              </div>

              <section className="overflow-hidden rounded-2xl border border-[#e8e3e6] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9eb] p-5 sm:p-6">
                  <div>
                    <h2 className="font-semibold tracking-[-0.02em]">Pesanan terbaru</h2>
                    <p className="mt-1 text-xs text-[#1a0408]/45">Aktivitas transaksi terbaru</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {data?.pesananTerbaru.length ? (
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead className="bg-[#fcfbfc] text-[11px] uppercase tracking-wide text-[#1a0408]/40">
                        <tr>
                          <th className="px-6 py-3 font-medium">ID Pesanan</th>
                          <th className="px-6 py-3 font-medium">Pelanggan / Kasir</th>
                          <th className="px-6 py-3 font-medium">Total</th>
                          <th className="px-6 py-3 font-medium">Status</th>
                          <th className="px-6 py-3 font-medium">Waktu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pesananTerbaru.map((o) => (
                          <tr key={o.noPesanan} className="border-t border-[#f0edef] hover:bg-[#fcfbfc]">
                            <td className="px-6 py-4 font-mono text-xs">{o.noPesanan}</td>
                            <td className="px-6 py-4">
                              {o.nama}
                              <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] text-[#1a0408]/45">{o.asal === "commerce" ? "Online" : "Offline"}</span>
                            </td>
                            <td className="px-6 py-4 font-medium">{formatRp(o.total)}</td>
                            <td className="px-6 py-4">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] ${o.status === "Selesai" ? "bg-[#eaf8ed] text-[#218c39]" : o.status === "Diproses" || o.status === "Menunggu Pembayaran" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-[#1a0408]/45">
                              {format(new Date(o.waktu), "dd MMM HH:mm", { locale: localeId })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-10 text-center text-sm text-[#1a0408]/40">Belum ada pesanan</div>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
