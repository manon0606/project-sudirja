"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreatePembelian, createPembelian, deletePembelian, downloadPembelianCsv, listPembelian,
} from "@/lib/pembelian-api";
import { listSupplier } from "@/lib/supplier-api";
import { listProduk } from "@/lib/product-api";
import { parseCsv } from "./BulkUploadReference";
import BulkUploadModal, { type BulkUploadFailure, type BulkUploadOutcome } from "./BulkUploadModal";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import type { PembelianDTO } from "@/lib/pembelian-types";
import type { SupplierDTO } from "@/lib/supplier-types";
import type { ProdukDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2, Eye,
  Download, Upload, Building2, Calendar, TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";

type SortField = "no_pembelian" | "tanggal" | "supplier" | "created_at";
type SortDirection = "asc" | "desc" | null;

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ---------------------------------------------------------------------------
// Create Modal (supplier & produk dari master + satuan)
// ---------------------------------------------------------------------------

interface DraftItem {
  produkId: number | null;
  sku: string;
  nama: string;
  qty: number;
  hargaBeli: number;
  hargaJual: number;
  diskon: number;
  satuanOptions: Array<{ produkSatuanId: number; satuanNama: string; harga: number }>;
  produkSatuanId: number | null;
}

function CreatePembelianModal({ onClose, onCreated, suppliers }: {
  onClose: () => void;
  onCreated: () => void;
  suppliers: SupplierDTO[];
}) {
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [supplierId, setSupplierId] = useState("");
  const [ppn, setPpn] = useState("0");
  const [catatan, setCatatan] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ProdukDTO[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown hasil pencarian saat klik di luar.
  useEffect(() => {
    if (!showResults) return;
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showResults]);

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
    const def = satuanOptions[0] ?? null;
    setItems([...items, {
      produkId: p.id, sku: p.sku, nama: p.nama, qty: 1,
      hargaBeli: 0, hargaJual: def ? def.harga : 0, diskon: 0,
      satuanOptions: satuanOptions.length ? satuanOptions : [{ produkSatuanId: 0, satuanNama: "(tanpa satuan)", harga: 0 }],
      produkSatuanId: def ? def.produkSatuanId : null,
    }]);
    setSearchQ(""); setShowResults(false); setError("");
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
      if (!it.qty || it.qty <= 0) { setError(`Qty untuk ${it.nama} harus > 0.`); return; }
      if (!it.produkSatuanId) { setError(`Pilih satuan produk untuk ${it.nama}.`); return; }
      if (it.hargaBeli < 0 || !Number.isFinite(it.hargaBeli)) { setError(`Harga beli ${it.nama} tidak valid.`); return; }
    }
    setBusy(true);
    try {
      await createPembelian({
        tanggal: `${tanggal}T00:00:00`,
        supplierId: Number(supplierId),
        ppn: Number(ppn) || 0,
        catatan: catatan || null,
        items: items.map((it) => ({
          produkId: it.produkId, produkSatuanId: it.produkSatuanId, sku: it.sku, namaProduk: it.nama,
          qty: it.qty, hargaBeli: it.hargaBeli, hargaJual: it.hargaJual, diskon: it.diskon,
        })),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat pembelian.");
    } finally { setBusy(false); }
  };

  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[94vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Buat Pembelian Baru</h2>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Pencatatan pembelian produk dari supplier (stok bertambah)</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
                <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
              </div>
            )}
            {/* Info dasar */}
            <div className="grid grid-cols-3 gap-4">
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Tanggal *</span>
                <DatePicker value={tanggal} onChange={setTanggal} placeholder="Pilih tanggal"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
              <label className="col-span-1">
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Supplier *</span>
                <div className="relative">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                    className="appearance-none w-full pl-3 pr-9 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
                    <option value="">-- Pilih --</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama} ({s.kode})</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                </div>
              </label>
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>PPN (%)</span>
                <input type="number" min="0" max="100" value={ppn} onChange={(e) => setPpn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
              <label className="col-span-3">
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Catatan</span>
                <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
            </div>

            {/* Cari produk */}
            <div>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Cari Produk (dari produk master)</span>
              <div className="relative" ref={searchBoxRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)}
                  placeholder="Ketik SKU atau nama produk..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
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
              <span className="block mb-2 text-sm" style={{ color: '#000000' }}>Item Pembelian ({items.length})</span>
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
                        <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Diskon %</th>
                        <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Harga Jual</th>
                        <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Subtotal</th>
                        <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const subtotal = Math.round(it.hargaBeli * it.qty * (1 - it.diskon / 100) * 100) / 100;
                        return (
                          <tr key={it.sku} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 min-w-[180px]">
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
                                  className="w-full px-2 py-1 rounded border border-gray-300 text-xs focus:outline-none focus:ring-2" style={inputStyle}
                                >
                                  {it.satuanOptions.map((o) => <option key={o.produkSatuanId} value={o.produkSatuanId}>{o.satuanNama}</option>)}
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
                                  className="w-12 text-center rounded border border-gray-300 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
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
                              <input type="number" min="0" max="100" value={it.diskon || ""} onChange={(e) => updateItem(idx, { diskon: Number(e.target.value) || 0 })}
                                placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" value={it.hargaJual || ""} onChange={(e) => updateItem(idx, { hargaJual: Number(e.target.value) })}
                                placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                            </td>
                            <td className="px-4 py-2 text-right" style={{ color: '#27b446', fontWeight: 500 }}>
                              {formatRp(subtotal)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg border" style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border transition-colors hover:bg-red-50" style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
          <button onClick={() => void submit()} disabled={busy}
            className="px-6 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : "Simpan Pembelian"}
          </button>
        </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({ data, onClose, onDelete }: { data: PembelianDTO; onClose: () => void; onDelete: (id: number) => void }) {
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Detail Pembelian</h2>
            <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{data.noPembelian}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm mb-1 flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                <Building2 className="w-4 h-4" /> Supplier
              </p>
              <p className="font-medium" style={{ color: '#000000' }}>{data.supplier.nama}</p>
              <p className="text-xs font-mono" style={{ color: '#27b446' }}>{data.supplier.kode}</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
              <p className="text-sm mb-1 flex items-center gap-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                <Calendar className="w-4 h-4" /> Tanggal
              </p>
              <p style={{ color: '#1a0408' }}>{fmtWib(data.tanggal, "dd MMM yyyy")}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden mb-5">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#1a0408' }}>Produk</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Satuan</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Qty</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>H.Beli</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Diskon</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>H.Jual</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#1a0408' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2">
                      <p style={{ color: '#1a0408' }}>{it.namaProduk}</p>
                      <p className="text-xs font-mono" style={{ color: '#27b446' }}>{it.sku}</p>
                    </td>
                    <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.satuanNama ?? "-"}</td>
                    <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.qty}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaBeli)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{it.diskon > 0 ? `${it.diskon}%` : "-"}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaJual)}</td>
                    <td className="px-4 py-2 text-right" style={{ color: '#27b446' }}>{formatRp(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: '#1a0408' }}>Subtotal Pembelian</span>
              <span style={{ color: '#1a0408' }}>{formatRp(data.totalPembelian)}</span>
            </div>
            {data.totalPpn > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#1a0408' }}>PPN ({data.ppn}%)</span>
                <span style={{ color: '#1a0408' }}>{formatRp(data.totalPpn)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span style={{ color: '#000000' }}>Grand Total</span>
              <span className="text-lg" style={{ color: '#27b446' }}>{formatRp(data.grandTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <div>
                <p style={{ color: '#000000' }}>Estimasi Laba (jika semua terjual)</p>
                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Selisih harga jual − harga beli</p>
              </div>
              <p className="text-xl flex items-center gap-1" style={{ color: '#27b446' }}>
                <TrendingUp className="w-5 h-5" /> {formatRp(data.estimasiLaba)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button onClick={() => onDelete(data.id)}
            className="px-4 py-2 rounded-lg border-2 transition-colors hover:opacity-80"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Hapus (kembalikan stok)
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>Tutup</button>
        </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pembelian main page
// ---------------------------------------------------------------------------

export default function Pembelian() {
  const [items, setItems] = useState<PembelianDTO[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [viewing, setViewing] = useState<PembelianDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown "Tambah Data" saat klik di luar.
  useEffect(() => {
    if (!showAddMenu) return;
    const onDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showAddMenu]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPagination((p) => ({ ...p, page: 1 })); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await listPembelian({
        page: pagination.page, pageSize: pagination.pageSize, search: debouncedSearch,
        dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
        sortBy: sortField ?? undefined, sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data pembelian.");
    } finally { setLoading(false); }
  }, [pagination.page, pagination.pageSize, debouncedSearch, dateFrom, dateTo, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);
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

  const hasActiveFilters = search || dateFrom || dateTo;
  const clearFilters = () => { setSearch(""); setDateFrom(""); setDateTo(""); };

  const hapus = async (id: number) => {
    if (!window.confirm("Yakin hapus pembelian ini? Stok produk akan dikembalikan.")) return;
    setBusy(true); setError("");
    try {
      await deletePembelian(id);
      setViewing(null);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Gagal menghapus."); }
    finally { setBusy(false); }
  };

  const exportData = async () => {
    try {
      const result = await listPembelian({ page: 1, pageSize: 1000, search: debouncedSearch });
      downloadPembelianCsv(result.items);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Gagal export data."); }
  };

  // Proses file CSV bulk upload (dipanggil BulkUploadModal) — hasil per baris
  // dikembalikan sebagai {success, failures}, error file dilempar sebagai Error.
  const importFile = async (file: File): Promise<BulkUploadOutcome> => {
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) throw new Error("File CSV kosong.");
      const header = rows[0].map((x) => x.trim().toLowerCase());
      const value = (row: string[], ...names: string[]) => {
        const idx = names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        return idx >= 0 ? row[idx] ?? "" : "";
      };
      const supplierCodeMap = new Map(suppliers.map((s) => [s.kode, s.id]));
      const supplierNameMap = new Map(suppliers.map((s) => [s.nama.toLowerCase(), s.id]));
      const grouped = new Map<number, { tanggal: string; supplierId: number; firstRow: number; rows: Array<{ sku: string; nama: string; qty: number; hargaBeli: number; hargaJual: number; diskon: number }> }>();
      const failures: BulkUploadFailure[] = [];
      rows.slice(1).forEach((row, idx) => {
        const supplierRef = value(row, "supplier", "supplier kode", "kode supplier", "vendor");
        const supplierId = supplierCodeMap.get(supplierRef) ?? supplierNameMap.get(supplierRef.toLowerCase());
        if (!supplierId) { failures.push({ row: idx + 2, message: `supplier tidak dikenal (${supplierRef})` }); return; }
        const tanggal = value(row, "tanggal") || format(new Date(), "yyyy-MM-dd");
        const sku = value(row, "sku", "kode produk");
        const nama = value(row, "nama produk", "nama", "produk");
        const qty = Number(value(row, "qty", "jumlah")) || 0;
        const hargaBeli = Number(value(row, "harga beli", "harga_beli")) || 0;
        const hargaJual = Number(value(row, "harga jual", "harga_jual")) || 0;
        const diskon = Number(value(row, "diskon")) || 0;
        if (!sku || !nama || qty <= 0) { failures.push({ row: idx + 2, message: "data produk/qty tidak valid" }); return; }
        const g = grouped.get(supplierId) ?? { tanggal, supplierId, firstRow: idx + 2, rows: [] };
        if (!grouped.has(supplierId)) { g.tanggal = tanggal; grouped.set(supplierId, g); }
        g.rows.push({ sku, nama, qty, hargaBeli, hargaJual, diskon });
      });
      let success = 0;
      for (const [supplierId, g] of grouped) {
        try {
          await createPembelian({
            tanggal: `${g.tanggal}T00:00:00`, supplierId, ppn: 0,
            items: g.rows.map((r) => ({ produkId: null, sku: r.sku, namaProduk: r.nama, qty: r.qty, hargaBeli: r.hargaBeli, hargaJual: r.hargaJual, diskon: r.diskon })),
          });
          success++;
        } catch { failures.push({ row: g.firstRow, message: `pembelian supplier ${supplierId}: gagal` }); }
      }
      return { success, failures };
    } catch (err) {
      if (err instanceof ApiClientError) throw new Error(err.message);
      if (err instanceof Error) throw err;
      throw new Error("CSV pembelian tidak valid.");
    }
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
      <AdminSidebar activePage="pembelian" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pembelian</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Pencatatan pembelian produk dari supplier (stok bertambah)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void exportData()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                title="Export seluruh data pembelian (CSV)">
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <div className="relative" ref={addMenuRef}>
                <button onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}>
                  <Plus className="w-5 h-5" />
                  Tambah Data
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showAddMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                      <button onClick={() => { setShowAddMenu(false); setShowCreate(true); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                        <Plus className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div><p style={{ color: '#000000' }}>Manual</p><p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p></div>
                      </button>
                      <button onClick={() => { setShowAddMenu(false); setShowBulk(true); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200" style={{ color: '#1a0408' }}>
                        <Upload className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div><p style={{ color: '#000000' }}>Bulk Upload</p><p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>CSV</p></div>
                      </button>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari no. pembelian atau supplier..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
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
                <DatePicker value={dateFrom} max={dateTo || undefined} onChange={(v) => { setDateFrom(v); if (dateTo && v && v > dateTo) setDateTo(""); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <DatePicker value={dateTo} min={dateFrom || undefined} onChange={(v) => { setDateTo(v); if (dateFrom && v && v < dateFrom) setDateFrom(""); setPagination((p) => ({ ...p, page: 1 })); }}
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
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pembelian...</p></div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("no_pembelian")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            No. Pembelian {getSortIcon("no_pembelian")}
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
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Total Beli</th>
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Estimasi Laba</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, index) => (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(p)} style={{ color: '#27b446', fontFamily: 'monospace' }}>{p.noPembelian}</td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(p)} style={{ color: '#1a0408' }}>
                            {fmtWib(p.tanggal, "dd MMM yyyy")}
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(p)} style={{ color: '#1a0408' }}>
                            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 shrink-0" style={{ color: '#27b446' }} />{p.supplier.nama}</div>
                            <p className="text-xs font-mono" style={{ color: '#27b446' }}>{p.supplier.kode}</p>
                          </td>
                          <td className="px-6 py-4 text-center" style={{ color: '#1a0408' }}>{p.items.length} item</td>
                          <td className="px-6 py-4 text-right font-medium" style={{ color: '#1a0408' }}>{formatRp(p.grandTotal)}</td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center gap-1 font-medium" style={{ color: '#27b446' }}>
                              <TrendingUp className="w-4 h-4" /> {formatRp(p.estimasiLaba)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => setViewing(p)} className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                              style={{ color: '#1a0408' }} title="Detail Pembelian">
                              <Eye className="w-4 h-4" />
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
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Menampilkan {rangeStart} - {rangeEnd} dari {pagination.total} pembelian</span>
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
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Belum ada data pembelian</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>Catat pembelian produk dari supplier</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreatePembelianModal
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
          onDelete={(id) => void hapus(id)}
        />
      )}

      {/* Bulk upload modal */}
      {showBulk && (
        <BulkUploadModal
          title="Upload Pembelian Bulk"
          resultLabel="pembelian"
          columns={["Supplier", "Tanggal", "SKU", "Nama Produk", "Qty", "Harga Beli", "Harga Jual", "Diskon"]}
          formatNote="Supplier bisa kode (SUP-001) atau nama. Tanggal format YYYY-MM-DD (opsional, default hari ini). Qty minimal 1. Diskon per item (opsional, default 0). Setiap baris = satu item; baris dengan supplier sama digabung jadi satu pembelian."
          sample={{
            headers: ["Supplier", "Tanggal", "SKU", "Nama Produk", "Qty", "Harga Beli", "Harga Jual", "Diskon"],
            rows: [
              ["SUP-001", "2026-09-27", "IND-001", "Indomie", "24", "19500", "24000", "0"],
              ["SUP-001", "2026-09-27", "TEB-001", "Teh Botol", "12", "2900", "5000", "0"],
            ],
          }}
          sampleFilename="sample-pembelian.csv"
          onFile={importFile}
          onDone={() => void load()}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
