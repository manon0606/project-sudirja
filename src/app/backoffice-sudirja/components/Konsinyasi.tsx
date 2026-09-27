"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateKonsinyasi, createKonsinyasi, deleteKonsinyasi, downloadKonsinyasiCsv,
  listKonsinyasi, returKonsinyasi, updateKonsinyasiStatus,
} from "@/lib/konsinyasi-api";
import { listSupplier } from "@/lib/supplier-api";
import { listProduk } from "@/lib/product-api";
import { parseCsv } from "./BulkUploadReference";
import type { KonsinyasiDTO } from "@/lib/konsinyasi-types";
import type { SupplierDTO } from "@/lib/supplier-types";
import type { ProdukDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2, Eye,
  Download, Upload, Building2, Calendar, Undo2, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";

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
  const productListRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll ke item terbaru saat produk ditambahkan.
  useEffect(() => {
    if (!productListRef.current || items.length === 0) return;
    const t = setTimeout(() => {
      productListRef.current?.scrollTo({ top: productListRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [items.length]);

  // Konflik sku + satuan antar baris dihitung ulang dari `items` setiap render
  // (derived, bukan snapshot per-baris) — error otomatis hilang saat baris
  // ditukar/diubah/dihapus sehingga submit tidak pernah terkunci oleh error basi.
  const satuanErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    const firstIdxByKey = new Map<string, number>();
    items.forEach((it, idx) => {
      if (!it.produkSatuanId) return;
      const key = `${it.sku}||${it.produkSatuanId}`;
      const first = firstIdxByKey.get(key);
      if (first === undefined) { firstIdxByKey.set(key, idx); return; }
      const opt = it.satuanOptions.find((o) => o.produkSatuanId === it.produkSatuanId);
      errs[idx] = `Satuan "${opt?.satuanNama ?? String(it.produkSatuanId)}" sudah digunakan untuk produk ini`;
    });
    return errs;
  }, [items]);

  const addProduk = (p: ProdukDTO) => {
    const satuanOptions = p.satuan.map((s) => ({ produkSatuanId: s.id, satuanNama: s.satuanNama, harga: s.harga }));
    const hargaTerkecil = satuanOptions.length ? Math.min(...satuanOptions.map((s) => s.harga)) : 0;
    // Produk boleh muncul lebih dari sekali asalkan satuan berbeda
    // (mis. Pcs & Dus) — stok konsinyasi ditambahkan per produk_satuan.
    setItems((prev) => [...prev, {
      produkId: p.id, sku: p.sku, nama: p.nama, qty: 1, hargaBeli: 0,
      hargaJual: hargaTerkecil,
      satuanOptions: satuanOptions.length ? satuanOptions : [{ produkSatuanId: 0, satuanNama: "(tanpa satuan)", harga: 0 }],
      produkSatuanId: null, // satuan wajib dipilih per item.
    }]);
    setSearchQ("");
    setShowResults(false);
    setError("");
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  // Ganti satuan item: isi harga jual default dari satuan terpilih. Opsi satuan
  // TIDAK di-disable walau dipakai baris lain (agar penukaran/penataan ulang
  // satuan untuk SKU yang sama tetap bisa) — duplikat sku+satuan ditolak oleh
  // `satuanErrors` (derived) dan pengecekan `seenKeys` di submit.
  const changeSatuan = (idx: number, value: string) => {
    const psId = value === "" ? null : Number(value);
    const opt = items[idx].satuanOptions.find((o) => o.produkSatuanId === psId);
    setItems((prev) => prev.map((it, i) => i === idx
      ? { ...it, produkSatuanId: psId, hargaJual: opt ? opt.harga : it.hargaJual }
      : it));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

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
    if (Object.keys(satuanErrors).length > 0) {
      setError("Terdapat konflik satuan pada produk. Periksa kembali pilihan satuan.");
      return;
    }
    const seenKeys = new Set<string>();
    for (const it of items) {
      const key = `${it.sku}||${it.produkSatuanId}`;
      if (seenKeys.has(key)) {
        setError(`Produk "${it.nama}" dengan satuan yang sama sudah ada lebih dari sekali.`);
        return;
      }
      seenKeys.add(key);
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
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-6xl mx-4 h-[98vh] overflow-hidden shadow-2xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 style={{ color: '#000000' }}>Buat Konsinyasi Baru</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 px-6 py-4">
        <div className="space-y-6">
          {/* Info dasar */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Nomor Konsinyasi <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input type="text" value="" disabled placeholder="Otomatis (dibuat sistem)"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 cursor-not-allowed"
                style={{ color: '#1a0408', backgroundColor: '#f9fafb', opacity: 0.8 }} />
            </div>
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Tanggal <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <DatePicker value={tanggal} onChange={(v) => setTanggal(v)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={inputStyle} />
            </div>
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>
                Supplier <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <div className="relative">
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                  className="appearance-none w-full pl-4 pr-10 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                  style={inputStyle}>
                  <option value="">-- Pilih Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama} ({s.kode}){s.kota ? ` — ${s.kota}` : ""}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#27b446' }} />
              </div>
            </div>
            <div className="col-span-3">
              <label className="block mb-2" style={{ color: '#000000' }}>Catatan</label>
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={inputStyle} />
            </div>
          </div>

          {/* Cari produk */}
          <div>
            <label className="block mb-2" style={{ color: '#000000' }}>Tambah Produk</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)}
                placeholder="Cari produk berdasarkan SKU atau nama..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={inputStyle} />
              {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#1a0408', opacity: 0.5 }}>Mencari...</span>}
              {showResults && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {results.map((p) => (
                    <button key={p.id} type="button" onClick={() => addProduk(p)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                      <div className="flex justify-between items-center">
                        <div>
                          <p style={{ color: '#1a0408' }}>{p.nama}</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>SKU: {p.sku}</p>
                        </div>
                        <p style={{ color: '#27b446' }}>
                          {p.satuan.length ? formatRp(Math.min(...p.satuan.map((s) => s.harga))) : "—"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>Produk Dipilih ({items.length})</label>
              <div ref={productListRef} className="border border-gray-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000', whiteSpace: 'nowrap' }}>Satuan <span style={{ color: '#e40b18' }}>*</span></th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000', whiteSpace: 'nowrap' }}>Qty Konsinyasi</th>
                      <th className="px-4 py-3 text-right" style={{ color: '#000000', whiteSpace: 'nowrap' }}>Harga Beli</th>
                      <th className="px-4 py-3 text-right" style={{ color: '#000000', whiteSpace: 'nowrap' }}>Harga Jual</th>
                      <th className="px-4 py-3 text-right" style={{ color: '#000000', whiteSpace: 'nowrap' }}>Total Nilai</th>
                      <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const hasSatuanError = !!satuanErrors[idx];
                      const usedBySameSku = items
                        .filter((_, i) => i !== idx)
                        .filter((other) => other.sku === it.sku && other.produkSatuanId)
                        .map((other) => other.produkSatuanId);
                      return (
                        <tr key={`${it.sku}-${idx}`} className="border-t border-gray-200">
                          <td className="px-4 py-3" style={{ minWidth: 160 }}>
                            <p style={{ color: '#1a0408' }}>{it.nama}</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{it.sku}</p>
                          </td>
                          <td className="px-4 py-3" style={{ minWidth: 130 }}>
                            <div className="relative">
                              <select
                                value={String(it.produkSatuanId ?? "")}
                                onChange={(e) => changeSatuan(idx, e.target.value)}
                                className="w-full appearance-none pl-3 pr-8 py-1.5 rounded-lg border focus:outline-none focus:ring-2 cursor-pointer text-sm"
                                style={{
                                  borderColor: hasSatuanError ? '#e40b18' : it.produkSatuanId ? '#27b446' : '#d1d5db',
                                  color: it.produkSatuanId ? '#1a0408' : '#9ca3af',
                                  backgroundColor: hasSatuanError ? '#fff5f5' : '#ffffff',
                                  '--tw-ring-color': hasSatuanError ? '#e40b18' : '#27b446',
                                } as React.CSSProperties}
                              >
                                <option value="">Pilih Satuan</option>
                                {it.satuanOptions.map((o) => {
                                  const used = usedBySameSku.includes(o.produkSatuanId);
                                  return (
                                    <option key={o.produkSatuanId} value={o.produkSatuanId}
                                      style={{ color: used ? '#9ca3af' : '#1a0408' }}>
                                      {o.satuanNama}{used ? " (terpakai)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                                style={{ color: hasSatuanError ? '#e40b18' : it.produkSatuanId ? '#27b446' : '#9ca3af' }} />
                            </div>
                            {hasSatuanError && (
                              <p className="text-xs mt-1" style={{ color: '#e40b18' }}>{satuanErrors[idx]}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => updateItem(idx, { qty: Math.max(1, it.qty - 1) })}
                                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                                style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
                                <Minus className="w-4 h-4" />
                              </button>
                              <input type="number" value={it.qty} min={1}
                                onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                                className="w-16 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                                style={inputStyle} />
                              <button type="button" onClick={() => updateItem(idx, { qty: it.qty + 1 })}
                                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                                style={{ borderColor: '#27b446', color: '#27b446' }}>
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={it.hargaBeli || ""} placeholder="0"
                              onChange={(e) => updateItem(idx, { hargaBeli: Number(e.target.value) })}
                              className="w-full text-right px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                              style={inputStyle} />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={it.hargaJual || ""} placeholder="0"
                              onChange={(e) => updateItem(idx, { hargaJual: Number(e.target.value) })}
                              className="w-full text-right px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                              style={inputStyle} />
                          </td>
                          <td className="px-4 py-3 text-right" style={{ color: '#000000', whiteSpace: 'nowrap' }}>
                            {formatRp(it.hargaBeli * it.qty)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => removeItem(idx)}
                              className="w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-colors hover:bg-red-50"
                              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="p-6 text-center rounded-lg border border-dashed" style={{ borderColor: '#d1d5db' }}>
              <p className="text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Belum ada produk. Cari & tambahkan produk di atas.</p>
            </div>
          )}

          {/* Total Summary */}
          {items.length > 0 && (
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: '#000000' }}>Total Nilai Konsinyasi</span>
                <span className="text-xl" style={{ color: '#27b446' }}>
                  {formatRp(items.reduce((sum, it) => sum + it.hargaBeli * it.qty, 0))}
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
        <button onClick={onClose} className="flex-1 py-3 rounded-lg border transition-colors"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
        <button onClick={() => void submit()} disabled={busy}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#27b446' }}>
          {busy ? "Menyimpan..." : "Simpan Konsinyasi"}
        </button>
      </div>
    </Modal>
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
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Detail Konsinyasi</h2>
          <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{data.noKonsinyasi}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-4">
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
            <p style={{ color: '#1a0408' }}>{fmtWib(data.tanggal, "dd MMM yyyy")}</p>
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
                <th className="px-4 py-2 text-center text-xs" style={{ color: '#1a0408' }}>Satuan</th>
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
                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#f0fdf4', color: '#27b446', border: '1px solid #d1fae5' }}>
                      {it.satuanNama || '-'}
                    </span>
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
              style={{ borderColor: '#27b446', color: '#27b446' }}>
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
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>Tutup</button>
      </div>
    </Modal>
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
  const [returning, setReturning] = useState<KonsinyasiDTO | null>(null);
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

  // Pengembalian sisa konsinyasi (retur sebagian/penuh) dari grid.
  const prosesRetur = async (id: number, items: Array<{ id: number; qtyReturn: number }>) => {
    setBusy(true);
    try {
      await returKonsinyasi(id, items);
      setReturning(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memproses pengembalian konsinyasi.");
    } finally {
      setBusy(false);
    }
  };

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
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border-2 focus:outline-none focus:ring-2 cursor-pointer"
                style={{ color: '#1a0408', borderColor: '#27b446', '--tw-ring-color': '#27b446' } as any}>
                <option value="">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="selesai">Selesai</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#27b446' }} />
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
                <DatePicker value={dateFrom} max={dateTo || undefined}
                  onChange={(v) => { setDateFrom(v); if (dateTo && v && v > dateTo) setDateTo(""); setPagination((p) => ({ ...p, page: 1 })); }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              </div>
              <div className="flex-1">
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Sampai Tanggal</label>
                <DatePicker value={dateTo} min={dateFrom || undefined}
                  onChange={(v) => { setDateTo(v); if (dateFrom && v && v < dateFrom) setDateFrom(""); setPagination((p) => ({ ...p, page: 1 })); }}
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
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data konsinyasi...</p></div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <tr>
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
                      {items.map((k) => (
                        <tr key={k.id} className="border-b border-gray-200 cursor-pointer transition-colors hover:bg-gray-50"
                          onClick={() => setViewing(k)}>
                          <td className="px-6 py-4" style={{ color: '#27b446', fontFamily: 'monospace' }}>{k.noKonsinyasi}</td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {fmtWib(k.tanggal, "dd MMM yyyy")}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 shrink-0" style={{ color: '#27b446' }} />{k.supplier.nama}</div>
                            <p className="text-xs font-mono" style={{ color: '#27b446' }}>{k.supplier.kode}</p>
                          </td>
                          <td className="px-6 py-4 text-center" style={{ color: '#1a0408' }}>{k.items.length} item</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-sm text-white"
                              style={{ backgroundColor: k.status === 'aktif' ? '#27b446' : '#6b7280' }}>
                              {k.status === 'aktif' ? 'Aktif' : 'Selesai'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              {k.status === 'aktif' && (
                                <button onClick={() => setReturning(k)}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-green-50"
                                  style={{ borderColor: '#27b446', color: '#27b446' }}>
                                  <Undo2 className="w-4 h-4" />
                                  Pengembalian
                                </button>
                              )}
                              <button onClick={() => setViewing(k)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:opacity-80"
                                style={{ borderColor: '#27b446', color: '#27b446' }}>
                                <Eye className="w-4 h-4" />
                                Detail
                              </button>
                            </div>
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

      {/* Return (pengembalian sisa) modal */}
      {returning && (
        <ReturnKonsinyasiModal
          data={returning}
          busy={busy}
          onClose={() => setReturning(null)}
          onReturn={(id, items) => void prosesRetur(id, items)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Return Konsinyasi Modal — pengembalian sisa barang titipan ke supplier
// (mengikuti desain V3.1 ReturnKonsinyasiModal).
// ---------------------------------------------------------------------------

interface ReturnKonsinyasiModalProps {
  data: KonsinyasiDTO;
  busy: boolean;
  onClose: () => void;
  onReturn: (id: number, items: Array<{ id: number; qtyReturn: number }>) => void;
}

function ReturnKonsinyasiModal({ data, busy, onClose, onReturn }: ReturnKonsinyasiModalProps) {
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");

  const itemsWithReturn = data.items.map((item) => {
    const qtyReturn = returnItems[item.id] ?? 0;
    const qtyTersisa = Math.max(0, item.qtyKonsinyasi - item.qtyTerjual - item.qtyDikembalikan);
    return { ...item, qtyTersisa, qtyReturn, nilaiReturn: item.hargaBeli * qtyReturn };
  }).filter((item) => item.qtyTersisa > 0);

  const totalNilaiReturn = itemsWithReturn.reduce((sum, item) => sum + item.nilaiReturn, 0);
  const totalQtyReturn = itemsWithReturn.reduce((sum, item) => sum + item.qtyReturn, 0);

  const handleUpdateReturn = (id: number, qty: number, maxQty: number) => {
    const validQty = Math.min(Math.max(0, Math.floor(qty) || 0), maxQty);
    setReturnItems((prev) => ({ ...prev, [id]: validQty }));
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
    const selected = itemsWithReturn
      .filter((item) => item.qtyReturn > 0)
      .map((item) => ({ id: item.id, qtyReturn: item.qtyReturn }));
    onReturn(data.id, selected);
  };

  if (showConfirmation) {
    return (
      <Modal onClose={() => setShowConfirmation(false)} className="bg-white rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
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
              {formatRp(totalNilaiReturn)}
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
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}
          >
            {busy ? "Memproses..." : "Ya, Kembalikan"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Pengembalian Konsinyasi</h2>
          <p style={{ color: '#3b82f6' }}>{data.noKonsinyasi}</p>
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
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Satuan</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Tersisa</th>
                    <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty Dikembalikan</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                    <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Nilai Return</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsWithReturn.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-4 py-3">
                        <p style={{ color: '#1a0408' }}>{item.namaProduk}</p>
                        <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                          {item.sku}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#f0fdf4', color: '#27b446', border: '1px solid #d1fae5' }}>
                          {item.satuanNama || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" style={{ color: '#1a0408' }}>
                        {item.qtyTersisa}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdateReturn(item.id, item.qtyReturn - 1, item.qtyTersisa)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#e5e7eb', color: '#1a0408' }}
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="number"
                            value={item.qtyReturn || ''}
                            onChange={(e) => handleUpdateReturn(item.id, parseInt(e.target.value) || 0, item.qtyTersisa)}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0"
                            min={0}
                            max={item.qtyTersisa}
                            className="w-16 text-center px-2 py-1 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                            style={{ color: '#1a0408', '--tw-ring-color': '#3b82f6' } as React.CSSProperties}
                          />
                          <button
                            onClick={() => handleUpdateReturn(item.id, item.qtyReturn + 1, item.qtyTersisa)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-gray-50"
                            style={{ borderColor: '#27b446', color: '#27b446' }}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#1a0408' }}>
                        {formatRp(item.hargaBeli)}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#3b82f6' }}>
                        {formatRp(item.nilaiReturn)}
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
                  {formatRp(totalNilaiReturn)}
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
          style={{ borderColor: '#e40b18', color: '#e40b18' }}
        >
          Batal
        </button>
        <button
          onClick={handleSubmit}
          disabled={totalQtyReturn === 0}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#27b446' }}
        >
          Proses Pengembalian
        </button>
      </div>
    </Modal>
  );
}
