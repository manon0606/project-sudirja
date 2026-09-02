"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateKonsinyasi, createKonsinyasi, deleteKonsinyasi, downloadKonsinyasiCsv,
  listKonsinyasi, updateKonsinyasiStatus,
} from "@/lib/konsinyasi-api";
import { listSupplier } from "@/lib/supplier-api";
import { listProduk } from "@/lib/product-api";
import { parseCsv } from "./BulkUploadReference";
import type { KonsinyasiDTO } from "@/lib/konsinyasi-types";
import type { SupplierDTO } from "@/lib/supplier-types";
import type { ProdukDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2,
  Download, Upload, Building2, CheckCircle, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type SortField = "no_konsinyasi" | "tanggal" | "supplier" | "status" | "created_at";
type SortDirection = "asc" | "desc" | null;

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function toLocalInput(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ---------------------------------------------------------------------------
// Create Konsinyasi Modal (supplier & produk dari master)
// ---------------------------------------------------------------------------

interface DraftItem {
  produkId: number | null;
  sku: string;
  nama: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  // Satuan produk (stok konsinyasi ditambah ke satuan ini).
  satuanOptions: Array<{ produkSatuanId: number; satuanNama: string; harga: number }>;
  produkSatuanId: number | null;
}

function CreateKonsinyasiModal({ onClose, onCreated, suppliers }: {
  onClose: () => void;
  onCreated: () => void;
  suppliers: SupplierDTO[];
}) {
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierId, setSupplierId] = useState("");
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ProdukDTO[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Search produk master (sku/nama) → auto harga jual = harga terkecil.
  useEffect(() => {
    if (!searchQ.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await listProduk({ search: searchQ.trim(), pageSize: 6 });
        if (!cancelled) setResults(res.items);
      } catch { if (!cancelled) setResults([]); }
      finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQ]);

  const addProduk = (p: ProdukDTO) => {
    if (items.some((i) => i.sku === p.sku)) { setError("Produk sudah ditambahkan."); return; }
    const satuanOptions = p.satuan.map((s) => ({ produkSatuanId: s.id, satuanNama: s.satuanNama, harga: s.harga }));
    // Default: satuan pertama (paling kecil id / urutan produk_satuan).
    const defaultSat = satuanOptions[0] ?? null;
    const hargaJual = satuanOptions.length ? Math.min(...satuanOptions.map((s) => s.harga)) : 0;
    setItems([...items, {
      produkId: p.id, sku: p.sku, nama: p.nama, qty: 1, hargaBeli: 0,
      hargaJual: defaultSat ? defaultSat.harga : hargaJual,
      satuanOptions: satuanOptions.length ? satuanOptions : [{ produkSatuanId: 0, satuanNama: "(tanpa satuan)", harga: 0 }],
      produkSatuanId: defaultSat ? defaultSat.produkSatuanId : null,
    }]);
    setSearchQ("");
    setShowResults(false);
    setError("");
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const submit = async () => {
    setError("");
    if (!supplierId) { setError("Pilih supplier terlebih dahulu."); return; }
    if (!items.length) { setError("Minimal 1 produk harus ditambahkan."); return; }
    for (const it of items) {
      if (!it.qty || it.qty <= 0) { setError(`Qty konsinyasi untuk ${it.nama} harus > 0.`); return; }
      if (!it.produkSatuanId) { setError(`Pilih satuan produk untuk ${it.nama}.`); return; }
      if (!it.hargaBeli || it.hargaBeli < 0) { setError(`Harga beli untuk ${it.nama} wajib diisi.`); return; }
      if (!it.hargaJual || it.hargaJual < 0) { setError(`Harga jual untuk ${it.nama} wajib diisi.`); return; }
    }
    setBusy(true);
    try {
      await createKonsinyasi({
        tanggal: `${tanggal}T00:00:00`,
        supplierId: Number(supplierId),
        catatan: catatan || null,
        items: items.map((it) => ({
          produkId: it.produkId, produkSatuanId: it.produkSatuanId, sku: it.sku, namaProduk: it.nama,
          qtyKonsinyasi: it.qty, hargaBeli: it.hargaBeli, hargaJual: it.hargaJual,
        })),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat konsinyasi.");
    } finally { setBusy(false); }
  };

  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Buat Konsinyasi Baru</h2>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Titipan barang dari supplier</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="space-y-5">
            {/* Info dasar */}
            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Tanggal *</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Supplier *</span>
                <div className="relative">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                    className="appearance-none w-full pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.nama} ({s.kode}){s.kota ? ` — ${s.kota}` : ""}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                </div>
              </label>
              <label className="col-span-2">
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Catatan</span>
                <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
            </div>

            {/* Cari produk */}
            <div>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Cari Produk (dari produk master)</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)}
                  placeholder="Ketik SKU atau nama produk..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
                {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#1a0408', opacity: 0.5 }}>Mencari...</span>}
                {showResults && results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                    {results.map((p) => (
                      <button key={p.id} type="button" onClick={() => addProduk(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        <div className="flex justify-between items-center">
                          <div>
                            <p style={{ color: '#1a0408' }}>{p.nama}</p>
                            <p className="text-xs font-mono" style={{ color: '#27b446' }}>{p.sku}</p>
                          </div>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                            Harga jual: {p.satuan.length ? formatRp(Math.min(...p.satuan.map((s) => s.harga))) : "—"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <span className="block mb-2 text-sm" style={{ color: '#000000' }}>Item Konsinyasi ({items.length})</span>
              {items.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed" style={{ borderColor: '#d1d5db' }}>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Belum ada produk. Cari & tambahkan produk di atas.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs" style={{ color: '#1a0408' }}>Produk</th>
                        <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Qty</th>
                        <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Harga Beli</th>
                        <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Harga Jual</th>
                        <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.sku} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-2">
                            <p style={{ color: '#1a0408' }}>{it.nama}</p>
                            <p className="text-xs font-mono mb-1" style={{ color: '#27b446' }}>{it.sku}</p>
                            {it.satuanOptions.length > 1 ? (
                              <select
                                value={String(it.produkSatuanId ?? "")}
                                onChange={(e) => {
                                  const psId = Number(e.target.value);
                                  const opt = it.satuanOptions.find((o) => o.produkSatuanId === psId);
                                  updateItem(idx, { produkSatuanId: psId, hargaJual: opt ? opt.harga : it.hargaJual });
                                }}
                                className="w-full px-2 py-1 rounded border border-gray-300 text-xs focus:outline-none focus:ring-2"
                                style={inputStyle}
                              >
                                {it.satuanOptions.map((o) => (
                                  <option key={o.produkSatuanId} value={o.produkSatuanId}>{o.satuanNama}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#f3f4f6', color: '#1a0408' }}>
                                {it.satuanOptions[0]?.satuanNama ?? "-"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => updateItem(idx, { qty: Math.max(1, it.qty - 1) })}
                                className="w-7 h-7 rounded border flex items-center justify-center" style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input type="number" value={it.qty} min={1} onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                                className="w-14 text-center rounded border border-gray-300 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                              <button type="button" onClick={() => updateItem(idx, { qty: it.qty + 1 })}
                                className="w-7 h-7 rounded border flex items-center justify-center" style={{ borderColor: '#27b446', color: '#27b446' }}>
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={it.hargaBeli || ""} onChange={(e) => updateItem(idx, { hargaBeli: Number(e.target.value) })}
                              placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" value={it.hargaJual || ""} onChange={(e) => updateItem(idx, { hargaJual: Number(e.target.value) })}
                              placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg border" style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border transition-colors" style={{ borderColor: '#1a0408', color: '#1a0408' }}>Batal</button>
          <button onClick={() => void submit()} disabled={busy}
            className="px-6 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : "Simpan Konsinyasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({ data, onClose, onSetSelesai, onDelete }: {
  data: KonsinyasiDTO;
  onClose: () => void;
  onSetSelesai: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const totalBeli = data.items.reduce((s, it) => s + it.hargaBeli * it.qtyKonsinyasi, 0);
  const totalTerjual = data.items.reduce((s, it) => s + it.hargaBeli * it.qtyTerjual, 0);
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Konsinyasi</h2>
            <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{data.noKonsinyasi}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm mb-1 flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                <Building2 className="w-4 h-4" /> Supplier
              </p>
              <p className="font-medium" style={{ color: '#000000' }}>{data.supplier.nama}</p>
              <p className="text-xs font-mono" style={{ color: '#27b446' }}>{data.supplier.kode}</p>
              {data.supplier.kota && <p className="text-xs mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>{data.supplier.kota}</p>}
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
              <p className="text-sm mb-1 flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                <Calendar className="w-4 h-4" /> Tanggal
              </p>
              <p style={{ color: '#1a0408' }}>{format(new Date(data.tanggal), "dd MMM yyyy", { locale: localeId })}</p>
              <p className="mt-2 inline-flex px-3 py-1 rounded-full text-sm"
                style={{ backgroundColor: data.status === 'aktif' ? 'rgba(39, 180, 70, 0.1)' : '#6b7280', color: data.status === 'aktif' ? '#27b446' : 'white' }}>
                {data.status === 'aktif' ? 'Aktif' : 'Selesai'}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg border border-gray-200 overflow-hidden mb-5">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#1a0408' }}>Produk</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Qty</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Terjual</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Kembali</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>H.Beli</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>H.Jual</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2">
                      <p style={{ color: '#1a0408' }}>{it.namaProduk}</p>
                      <p className="text-xs font-mono" style={{ color: '#27b446' }}>{it.sku}</p>
                    </td>
                    <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.qtyKonsinyasi}</td>
                    <td className="px-4 py-2 text-center" style={{ color: '#27b446' }}>{it.qtyTerjual}</td>
                    <td className="px-4 py-2 text-center" style={{ color: '#e40b18' }}>{it.qtyDikembalikan}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaBeli)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaJual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: '#1a0408' }}>Total Nilai Konsinyasi (harga beli)</span>
              <span style={{ color: '#1a0408' }}>{formatRp(totalBeli)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: '#1a0408' }}>Nilai Terjual (yang dibayar ke supplier)</span>
              <span style={{ color: '#27b446' }}>{formatRp(totalTerjual)}</span>
            </div>
            {data.catatan && (
              <p className="text-sm mt-2 pt-2 border-t border-gray-200" style={{ color: '#1a0408', opacity: 0.7 }}>
                Catatan: {data.catatan}
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {data.status === "aktif" && (
              <button onClick={() => onSetSelesai(data.id)}
                className="px-4 py-2 rounded-lg border-2 transition-colors hover:opacity-80"
                style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
                Tandai Selesai
              </button>
            )}
            <button onClick={() => onDelete(data.id)}
              className="px-4 py-2 rounded-lg border-2 transition-colors hover:opacity-80"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Hapus
            </button>
          </div>
          <button onClick={onClose} className="px-5 py-2 rounded-lg border transition-colors"
            style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Konsinyasi main page
// ---------------------------------------------------------------------------

export default function Konsinyasi() {
  const [items, setItems] = useState<KonsinyasiDTO[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [viewing, setViewing] = useState<KonsinyasiDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPagination((p) => ({ ...p, page: 1 })); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listKonsinyasi({
        page: pagination.page, pageSize: pagination.pageSize, search: debouncedSearch,
        status: statusFilter, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        sortBy: sortField ?? undefined, sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data konsinyasi.");
    } finally { setLoading(false); }
  }, [pagination.page, pagination.pageSize, debouncedSearch, statusFilter, dateFrom, dateTo, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);

  // Load supplier (utk create manual).
  useEffect(() => {
    listSupplier({ pageSize: 500 }).then((r) => setSuppliers(r.items)).catch(() => undefined);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortField(null); setSortDirection(null); }
    } else { setSortField(field); setSortDirection("asc"); }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const hasActiveFilters = search || dateFrom || dateTo || statusFilter;
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); setStatusFilter(""); };

  const setSelesai = async (id: number) => {
    setBusy(true); setError("");
    try {
      const updated = await updateKonsinyasiStatus(id, "selesai");
      setItems((prev) => prev.map((k) => k.id === updated.id ? updated : k));
      setViewing((cur) => cur && cur.id === updated.id ? updated : cur);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status."); }
    finally { setBusy(false); }
  };

  const hapus = async (id: number) => {
    if (!window.confirm("Yakin hapus konsinyasi ini?")) return;
    setBusy(true); setError("");
    try {
      await deleteKonsinyasi(id);
      setViewing(null);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Gagal menghapus."); }
    finally { setBusy(false); }
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      const header = rows[0].map((x) => x.trim().toLowerCase());
      const value = (row: string[], ...names: string[]) => {
        const idx = names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        return idx >= 0 ? row[idx] ?? "" : "";
      };
      // Format: supplier kode/nama, tanggal, sku, nama produk, qty, harga beli, harga jual
      const supplierCodeMap = new Map(suppliers.map((s) => [s.kode, s.id]));
      const supplierNameMap = new Map(suppliers.map((s) => [s.nama.toLowerCase(), s.id]));
      const grouped = new Map<number, { tanggal: string; supplierId: number; rows: Array<{ sku: string; nama: string; qty: number; hargaBeli: number; hargaJual: number }> }>();
      const failures: string[] = [];

      rows.slice(1).forEach((row, idx) => {
        const supplierRef = value(row, "supplier", "supplier kode", "kode supplier", "vendor");
        let supplierId = supplierCodeMap.get(supplierRef) ?? supplierNameMap.get(supplierRef.toLowerCase());
        if (!supplierId) { failures.push(`baris ${idx + 2}: supplier tidak dikenal (${supplierRef})`); return; }
        const tanggal = value(row, "tanggal") || format(new Date(), "yyyy-MM-dd");
        const sku = value(row, "sku", "kode produk");
        const nama = value(row, "nama produk", "nama", "produk");
        const qty = Number(value(row, "qty", "qty konsinyasi")) || 0;
        const hargaBeli = Number(value(row, "harga beli", "harga_beli")) || 0;
        const hargaJual = Number(value(row, "harga jual", "harga_jual")) || 0;
        if (!sku || !nama || qty <= 0) { failures.push(`baris ${idx + 2}: data produk/qty tidak valid`); return; }
        const key = `${supplierId}-${tanggal}`;
        const g = grouped.get(supplierId) ?? { tanggal, supplierId, rows: [] };
        if (!grouped.has(supplierId)) { g.tanggal = tanggal; grouped.set(supplierId, g); }
        g.rows.push({ sku, nama, qty, hargaBeli, hargaJual });
      });

      let success = 0;
      for (const [supplierId, g] of grouped) {
        try {
          await createKonsinyasi({
            tanggal: `${g.tanggal}T00:00:00`, supplierId,
            items: g.rows.map((r) => ({ produkId: null, sku: r.sku, namaProduk: r.nama, qtyKonsinyasi: r.qty, hargaBeli: r.hargaBeli, hargaJual: r.hargaJual })),
          });
          success++;
        } catch { failures.push(`konsinyasi supplier ${supplierId}: gagal`); }
      }
      alert(`Berhasil: ${success} konsinyasi${failures.length ? `, gagal: ${failures.length} (${failures.slice(0, 3).join("; ")})` : ""}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "CSV konsinyasi tidak valid.");
    }
  };

  const exportData = async () => {
    try {
      const result = await listKonsinyasi({ page: 1, pageSize: 1000, search: debouncedSearch, status: statusFilter });
      downloadKonsinyasiCsv(result.items);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Gagal export data."); }
  };

  const pageNumbers = useMemo(() => {
    const tp = pagination.totalPages;
    if (tp <= 5) return Array.from({ length: tp }, (_, i) => i + 1);
    const pg = pagination.page;
    if (pg <= 3) return [1, 2, 3, 4, 5];
    if (pg >= tp - 2) return [tp - 4, tp - 3, tp - 2, tp - 1, tp];
    return [pg - 2, pg - 1, pg, pg + 1, pg + 2];
  }, [pagination.page, pagination.totalPages]);

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

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
                Kelola titipan barang dari supplier
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void exportData()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                title="Export seluruh data konsinyasi (CSV)">
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <div className="relative">
                <button onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}>
                  <Plus className="w-5 h-5" />
                  Tambah Data
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                      <button onClick={() => { setShowAddMenu(false); setShowCreate(true); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                        <Plus className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div>
                          <p style={{ color: '#000000' }}>Manual</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p>
                        </div>
                      </button>
                      <button onClick={() => { setShowAddMenu(false); fileRef.current?.click(); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200" style={{ color: '#1a0408' }}>
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
              <input ref={fileRef} hidden type="file" accept=".csv" onChange={importCsv} />
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. konsinyasi atau supplier..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                <option value="">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>
            <button onClick={() => setShowDateFilter(!showDateFilter)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors"
              style={{ backgroundColor: showDateFilter ? '#27b446' : 'white', borderColor: '#27b446', color: showDateFilter ? 'white' : '#27b446' }}>
              <Calendar className="w-5 h-5" /> Filter Tanggal
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                <X className="w-4 h-4" /> Hapus Filter
              </button>
            )}
          </div>
          {showDateFilter && (
            <div className="mt-4 flex items-center gap-4 p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Dari Tanggal</label>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data konsinyasi...</p></div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("no_konsinyasi")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            No. Konsinyasi {getSortIcon("no_konsinyasi")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("tanggal")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Tanggal {getSortIcon("tanggal")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("supplier")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Supplier {getSortIcon("supplier")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Item</th>
                        <th className="px-6 py-4 text-center">
                          <button onClick={() => handleSort("status")} className="flex items-center gap-2 hover:opacity-70 transition-opacity mx-auto" style={{ color: '#000000' }}>
                            Status {getSortIcon("status")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((k, index) => (
                        <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(k)} style={{ color: '#27b446', fontFamily: 'monospace' }}>{k.noKonsinyasi}</td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(k)} style={{ color: '#1a0408' }}>
                            {format(new Date(k.tanggal), "dd MMM yyyy", { locale: localeId })}
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(k)} style={{ color: '#1a0408' }}>
                            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 shrink-0" style={{ color: '#27b446' }} />{k.supplier.nama}</div>
                            <p className="text-xs font-mono" style={{ color: '#27b446' }}>{k.supplier.kode}</p>
                          </td>
                          <td className="px-6 py-4 text-center" style={{ color: '#1a0408' }}>{k.items.length} item</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                              style={{ backgroundColor: k.status === 'aktif' ? 'rgba(39, 180, 70, 0.1)' : '#f3f4f6', color: k.status === 'aktif' ? '#27b446' : '#6b7280' }}>
                              {k.status === 'aktif' ? <CheckCircle className="w-4 h-4" /> : null}
                              {k.status === 'aktif' ? 'Aktif' : 'Selesai'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => setViewing(k)} className="px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                              style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
                              Detail
                            </button>
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
                      <select value={pagination.pageSize} onChange={(e) => { setPagination((p) => ({ ...p, pageSize: Number(e.target.value), page: 1 })); }}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                        style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                    </div>
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Menampilkan {rangeStart} - {rangeEnd} dari {pagination.total} konsinyasi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))} disabled={pagination.page === 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-1">
                      {pageNumbers.map((pn) => (
                        <button key={pn} onClick={() => setPagination((p) => ({ ...p, page: pn }))} className="w-10 h-10 rounded-lg transition-colors"
                          style={{ backgroundColor: pagination.page === pn ? '#27b446' : 'transparent', color: pagination.page === pn ? 'white' : '#1a0408', border: pagination.page === pn ? 'none' : '1px solid #e5e7eb' }}>
                          {pn}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(pagination.totalPages, p.page + 1) }))} disabled={pagination.page === pagination.totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Building2 className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Belum ada data konsinyasi</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>Buat konsinyasi titipan barang dari supplier</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateKonsinyasiModal
          suppliers={suppliers}
          onClose={() => setShowCreate(false)}
          onCreated={() => void load()}
        />
      )}

      {/* Detail modal */}
      {viewing && (
        <DetailModal
          data={viewing}
          onClose={() => setViewing(null)}
          onSetSelesai={(id) => void setSelesai(id)}
          onDelete={(id) => void hapus(id)}
        />
      )}
    </div>
  );
}
