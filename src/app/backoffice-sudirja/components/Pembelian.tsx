"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreatePembelian, createPembelian, deletePembelian, downloadPembelianCsv, listPembelian,
} from "@/lib/pembelian-api";
import { listSupplier } from "@/lib/supplier-api";
import { updateStok } from "@/lib/stok-api";
import {
  createKategori, createMerk, createProduk, createSatuan,
  listAllActiveKategori, listAllActiveMerk, listAllActiveSatuan, listProduk,
} from "@/lib/product-api";
import { parseCsv } from "./BulkUploadReference";
import BulkUploadModal, { type BulkUploadFailure, type BulkUploadOutcome } from "./BulkUploadModal";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import type { PembelianDTO, PembelianItemDTO } from "@/lib/pembelian-types";
import type { SupplierDTO } from "@/lib/supplier-types";
import type { KategoriDTO, MerkDTO, ProdukDTO, SatuanDTO } from "@/lib/product-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Minus, Trash2, Eye,
  Download, Upload, Building2, Calendar, TrendingUp, TrendingDown, Split, Layers, Info
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";

type SortField = "no_pembelian" | "tanggal" | "supplier" | "created_at";
type SortDirection = "asc" | "desc" | null;

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/** Gaya input standar halaman ini (teks #1a0408, focus ring hijau #27b446). */
const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

/** Nilai sentinel opsi "+ ... baru" pada select kategori/merk/satuan. */
const NEW_REF_VALUE = "__new__";

/** Batas format SKU & kode item — sama dengan validasi server (products-service). */
const SKU_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;
const KODE_ITEM_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Pesan error API + detail validasi server (bila ada) untuk ditampilkan di form. */
function apiErrorText(err: unknown, fallback: string): string {
  if (!(err instanceof ApiClientError)) return fallback;
  const details = err.details ? Object.values(err.details).filter(Boolean) : [];
  return details.length > 0 ? `${err.message} ${details.join(" ")}` : err.message;
}

// ---------------------------------------------------------------------------
// Quick-create produk (inline di dalam CreatePembelianModal)
// ---------------------------------------------------------------------------

/** Satu baris satuan pada form produk baru. */
interface NewSatuanRow {
  rowId: number;
  /** kode satuan master; NEW_REF_VALUE = satuan baru; "" = belum dipilih. */
  satuanKode: string;
  satuanNamaBaru: string;
  jumlahUnitBaru: string;
  kodeItem: string;
  /** Disimpan sebagai string supaya kosong ≠ 0. */
  harga: string;
  /** Stok awal per satuan — string: kosong = 0. */
  stok: string;
}

const emptySatuanRow = (rowId: number): NewSatuanRow =>
  ({ rowId, satuanKode: "", satuanNamaBaru: "", jumlahUnitBaru: "", kodeItem: "", harga: "", stok: "" });

/**
 * Panel inline untuk membuat produk + satuannya tanpa keluar dari form
 * pembelian. Produk tetap tersimpan di master (API yang sama dengan menu
 * Produk), lalu hasilnya langsung dijadikan item pembelian.
 */
function NewProdukPanel({
  satuanList, merkList, kategoriList, refsLoading, refsError,
  onKategoriCreated, onMerkCreated, onSatuanCreated, onProductCreated, onBatal,
}: {
  satuanList: SatuanDTO[];
  merkList: MerkDTO[];
  kategoriList: KategoriDTO[];
  refsLoading: boolean;
  refsError: string;
  onKategoriCreated: (k: KategoriDTO) => void;
  onMerkCreated: (m: MerkDTO) => void;
  onSatuanCreated: (s: SatuanDTO) => void;
  onProductCreated: (produk: ProdukDTO | null, sku: string, defaultKodeItem: string, bahan: DraftBahan[]) => void;
  onBatal: () => void;
}) {
  const [sku, setSku] = useState("");
  const [nama, setNama] = useState("");
  const [kategoriKode, setKategoriKode] = useState("");
  const [kategoriBaru, setKategoriBaru] = useState("");
  const [merkKode, setMerkKode] = useState("");
  const [merkBaru, setMerkBaru] = useState("");
  const rowSeq = useRef(1);
  const [rows, setRows] = useState<NewSatuanRow[]>(() => [emptySatuanRow(0)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Bahan kebutuhan repack yang diisi sekaligus saat membuat produk baru (desain V3.1). */
  const [bahan, setBahan] = useState<DraftBahan[]>([]);

  const updateRow = (idx: number, patch: Partial<NewSatuanRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => {
    const rowId = rowSeq.current++;
    setRows((prev) => [...prev, emptySatuanRow(rowId)]);
  };
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const validate = (): string => {
    const skuTrim = sku.trim();
    if (!skuTrim) return "SKU wajib diisi.";
    if (!SKU_PATTERN.test(skuTrim)) return "SKU hanya boleh huruf/angka/-/_ (maks 50 karakter).";
    if (!nama.trim()) return "Nama produk wajib diisi.";
    if (!kategoriKode) return "Pilih kategori produk (atau tambah kategori baru).";
    if (kategoriKode === NEW_REF_VALUE && !kategoriBaru.trim()) return "Nama kategori baru wajib diisi.";
    if (!merkKode) return "Pilih merk produk (atau tambah merk baru).";
    if (merkKode === NEW_REF_VALUE && !merkBaru.trim()) return "Nama merk baru wajib diisi.";
    if (rows.length === 0) return "Tambahkan minimal 1 satuan.";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const label = `Satuan baris ${i + 1}`;
      if (!r.satuanKode) return `${label}: pilih satuannya.`;
      if (r.satuanKode === NEW_REF_VALUE) {
        if (!r.satuanNamaBaru.trim()) return `${label}: nama satuan baru wajib diisi.`;
        const unit = Number(r.jumlahUnitBaru);
        if (!r.jumlahUnitBaru.trim() || !Number.isFinite(unit) || unit < 1) return `${label}: jumlah unit minimal 1.`;
      }
      const kodeItem = r.kodeItem.trim();
      if (!kodeItem) return `${label}: kode item wajib diisi.`;
      if (!KODE_ITEM_PATTERN.test(kodeItem)) return `${label}: kode item hanya boleh huruf/angka/-/_ (maks 64 karakter).`;
      if (!r.harga.trim() || !Number.isFinite(Number(r.harga)) || Number(r.harga) < 0) return `${label}: harga jual wajib diisi dan tidak boleh negatif.`;
      const stok = r.stok.trim();
      if (stok !== "" && (!Number.isInteger(Number(stok)) || Number(stok) < 0)) return `${label}: stok awal harus angka bulat 0 atau lebih.`;
    }
    const kodeSatuan = rows.map((r) => r.satuanKode).filter((k) => k && k !== NEW_REF_VALUE);
    if (new Set(kodeSatuan).size !== kodeSatuan.length) return "Satu satuan tidak boleh dipakai dua kali.";
    const kodeItems = rows.map((r) => r.kodeItem.trim());
    if (new Set(kodeItems).size !== kodeItems.length) return "Kode item harus unik antar baris.";
    return "";
  };

  const simpan = async () => {
    const pesanValidasi = validate();
    if (pesanValidasi) { setError(pesanValidasi); return; }
    setError("");
    setBusy(true);
    const skuFinal = sku.trim();
    const defaultKodeItem = rows[0].kodeItem.trim();
    try {
      // Semua referensi baru dibuat paralel — kategori/merk/satuan tidak
      // saling bergantung, jadi tidak perlu berurutan.
      const kategoriPromise = kategoriKode === NEW_REF_VALUE
        ? createKategori({ nama: kategoriBaru.trim() }).then((k) => { onKategoriCreated(k); return k.kode; })
        : Promise.resolve(kategoriKode);
      const merkPromise = merkKode === NEW_REF_VALUE
        ? createMerk({ nama: merkBaru.trim() }).then((m) => { onMerkCreated(m); return m.kode; })
        : Promise.resolve(merkKode);
      const satuanPromises = rows.map((r) => r.satuanKode === NEW_REF_VALUE
        ? createSatuan({ nama: r.satuanNamaBaru.trim(), jumlahUnit: Number(r.jumlahUnitBaru) })
            .then((s) => { onSatuanCreated(s); return s.kode; })
        : Promise.resolve(r.satuanKode));

      const [kategoriKodeFinal, merkKodeFinal] = await Promise.all([kategoriPromise, merkPromise]);
      const satuanKodes = await Promise.all(satuanPromises);

      await createProduk({
        sku: skuFinal,
        nama: nama.trim(),
        kategoriKode: kategoriKodeFinal,
        merkKode: merkKodeFinal,
        satuan: rows.map((r, i) => ({
          satuanKode: satuanKodes[i],
          kodeItem: r.kodeItem.trim(),
          harga: Number(r.harga),
        })),
      });

      // Stok awal per satuan (opsional). Baris stok sudah dibuat server (qty 0),
      // diisi lewat API stok yang sama dengan menu Stok (+ riwayat mutasi).
      // Gagal mengisi stok tidak menggagalkan produk — bisa disetel di menu Stok.
      const stokAwal = rows
        .map((r, i) => ({ satuanKode: satuanKodes[i], qty: Number(r.stok.trim()) || 0 }))
        .filter((s) => s.qty > 0);
      if (stokAwal.length) {
        try {
          await updateStok(skuFinal, { catatan: "Stok awal produk baru (form pembelian)", satuan: stokAwal });
        } catch {
          // Produk tetap tersimpan; stok menyusul dari pembelian / menu Stok.
        }
      }

      // Ambil DTO produknya supaya bisa langsung dipakai jadi item pembelian.
      // Gagal memuat ≠ gagal membuat: produknya sudah tersimpan di master.
      let produk: ProdukDTO | null = null;
      try {
        const hasil = await listProduk({ search: skuFinal, pageSize: 5 });
        produk = hasil.items.find((p) => p.sku === skuFinal) ?? null;
      } catch {
        // Biarkan null → pengguna diarahkan menambah item lewat pencarian.
      }
      onProductCreated(produk, skuFinal, defaultKodeItem, bahan.filter((b) => b.namaBarang.trim()));
    } catch (err) {
      setError(apiErrorText(err, "Gagal menyimpan produk baru."));
    } finally { setBusy(false); }
  };

  const fieldClass = "w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2";

  return (
    <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs mb-1" style={{ color: '#27b446', letterSpacing: '0.08em' }}>PRODUK BARU</p>
          <p className="text-sm" style={{ color: '#000000' }}>Buat produk + satuannya, langsung jadi item pembelian</p>
        </div>
        <p className="text-xs text-right" style={{ color: '#1a0408', opacity: 0.6 }}>Tersimpan juga di master produk</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>SKU *</span>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="mis. MIE-002"
            className={fieldClass} style={inputStyle} />
        </label>
        <label>
          <span className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Produk *</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Mie Goreng 85g"
            className={fieldClass} style={inputStyle} />
        </label>
        <label>
          <span className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>Kategori *</span>
          <div className="relative">
            <select value={kategoriKode} onChange={(e) => setKategoriKode(e.target.value)}
              className="appearance-none w-full pl-3 pr-9 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
              <option value="">-- Pilih --</option>
              {kategoriList.map((k) => <option key={k.kode} value={k.kode}>{k.nama}</option>)}
              <option value={NEW_REF_VALUE}>+ Kategori baru</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
          </div>
          {kategoriKode === NEW_REF_VALUE && (
            <input value={kategoriBaru} onChange={(e) => setKategoriBaru(e.target.value)} placeholder="Nama kategori baru"
              className={`${fieldClass} mt-2`} style={inputStyle} />
          )}
        </label>
        <label>
          <span className="block mb-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>Merk *</span>
          <div className="relative">
            <select value={merkKode} onChange={(e) => setMerkKode(e.target.value)}
              className="appearance-none w-full pl-3 pr-9 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
              <option value="">-- Pilih --</option>
              {merkList.map((m) => <option key={m.kode} value={m.kode}>{m.nama}</option>)}
              <option value={NEW_REF_VALUE}>+ Merk baru</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
          </div>
          {merkKode === NEW_REF_VALUE && (
            <input value={merkBaru} onChange={(e) => setMerkBaru(e.target.value)} placeholder="Nama merk baru"
              className={`${fieldClass} mt-2`} style={inputStyle} />
          )}
        </label>
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between gap-3">
        <span className="text-xs" style={{ color: '#000000' }}>Satuan, kode item, harga jual &amp; stok awal *</span>
        <span className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>Kode item dipakai sebagai barcode — harus unik</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={row.rowId} className="p-3 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: '#27b446', fontFamily: 'monospace' }}>SATUAN {idx + 1}</span>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(idx)} title="Hapus baris satuan"
                  className="p-1.5 rounded-lg transition-colors hover:bg-gray-100" style={{ color: '#e40b18' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select value={row.satuanKode} onChange={(e) => updateRow(idx, { satuanKode: e.target.value })}
                aria-label={`Satuan baris ${idx + 1}`}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
                <option value="">-- Pilih Satuan --</option>
                {satuanList.map((s) => <option key={s.kode} value={s.kode}>{s.nama}</option>)}
                <option value={NEW_REF_VALUE}>+ Satuan baru</option>
              </select>
              {row.satuanKode === NEW_REF_VALUE && (
                <>
                  <input value={row.satuanNamaBaru} onChange={(e) => updateRow(idx, { satuanNamaBaru: e.target.value })}
                    aria-label={`Nama satuan baru baris ${idx + 1}`}
                    placeholder="Nama satuan baru" className={fieldClass} style={inputStyle} />
                  <input type="number" min={1} value={row.jumlahUnitBaru} onChange={(e) => updateRow(idx, { jumlahUnitBaru: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    aria-label={`Jumlah unit satuan baru baris ${idx + 1}`}
                    placeholder="Jumlah unit" className={fieldClass} style={inputStyle} />
                </>
              )}
              <input value={row.kodeItem} onChange={(e) => updateRow(idx, { kodeItem: e.target.value })}
                aria-label={`Kode item baris ${idx + 1}`}
                placeholder="Kode item (barcode)" className={fieldClass} style={inputStyle} />
              <input type="number" min={0} value={row.harga} onChange={(e) => updateRow(idx, { harga: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                aria-label={`Harga jual baris ${idx + 1}`}
                placeholder="Harga jual" className={`${fieldClass} text-right`} style={inputStyle} />
              <input type="number" min={0} value={row.stok} onChange={(e) => updateRow(idx, { stok: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                aria-label={`Stok awal baris ${idx + 1}`}
                placeholder="Stok awal" className={`${fieldClass} text-right`} style={inputStyle} />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow}
        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed text-sm transition-colors hover:bg-white"
        style={{ borderColor: 'rgba(39, 180, 70, 0.5)', color: '#27b446' }}>
        <Plus className="w-4 h-4" /> Tambah Satuan
      </button>
      <p className="mt-1 text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
        Satuan produk <strong>wajib diisi</strong> — produk baru otomatis dibuat di master dengan satuan ini agar pembelian &amp; penjualannya terpantau.
      </p>

      {/* Bahan Kebutuhan Repack saat membuat produk baru (desain V3.1) */}
      <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: '#000000' }}>Bahan Kebutuhan Repack</span>
          <button type="button" onClick={() => setBahan((prev) => [...prev, emptyBahan()])}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}>
            <Plus className="w-3.5 h-3.5" /> Tambah Bahan
          </button>
        </div>
        {bahan.length === 0 ? (
          <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
            Opsional. Biaya bahan menambah biaya pembelian produk ini (tidak masuk stok) dan ikut menghitung keuntungan penjualan.
          </p>
        ) : (
          <div className="space-y-2">
            {bahan.map((b, bi) => (
              <div key={bi} className="flex items-center gap-2">
                <input type="text" value={b.namaBarang} placeholder="Nama Barang"
                  aria-label={`Nama bahan repack baris ${bi + 1}`}
                  onChange={(e) => setBahan((prev) => prev.map((x, j) => (j === bi ? { ...x, namaBarang: e.target.value } : x)))}
                  className={fieldClass} style={inputStyle} />
                <input type="number" min={0} value={b.biaya || ""} placeholder="Biaya"
                  aria-label={`Biaya bahan repack baris ${bi + 1}`}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setBahan((prev) => prev.map((x, j) => (j === bi ? { ...x, biaya: Math.max(0, Number(e.target.value) || 0) } : x)))}
                  className={`${fieldClass} w-40 text-right`} style={inputStyle} />
                <button type="button" onClick={() => setBahan((prev) => prev.filter((_, j) => j !== bi))}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors hover:bg-red-50"
                  style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-right pt-2 border-t border-gray-200" style={{ color: '#1a0408', opacity: 0.7 }}>
              Total Biaya Repack: <span style={{ color: '#000000' }}>{formatRp(round2(bahan.reduce((s, b) => s + (b.biaya || 0), 0)))}</span>
            </p>
          </div>
        )}
      </div>

      {refsLoading && (
        <p className="text-xs mt-3" style={{ color: '#1a0408', opacity: 0.6 }}>Memuat kategori, merk, dan satuan...</p>
      )}
      {refsError && <p className="text-xs mt-3" style={{ color: '#e40b18' }}>{refsError}</p>}
      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
          <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={onBatal} disabled={busy}
          className="px-4 py-2 rounded-lg border text-sm transition-colors hover:bg-red-50 disabled:opacity-50"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
        <button type="button" onClick={() => void simpan()} disabled={busy || refsLoading}
          className="px-5 py-2 rounded-lg text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#27b446' }}>
          {busy ? "Menyimpan..." : "Simpan Produk"}
        </button>
      </div>
    </div>
  );
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
  /** Toggle repack (desain V3.1) — repack cukup menambah bahan, tanpa pecahan. */
  isRepack: boolean;
  /** Bahan kebutuhan repack: menambah biaya item & mengurangi laba (tidak masuk stok). */
  bahan: DraftBahan[];
}

/** Satu baris bahan kebutuhan repack (desain V3.1: nama barang + biaya). */
interface DraftBahan {
  namaBarang: string;
  biaya: number;
}

const emptyBahan = (): DraftBahan => ({ namaBarang: "", biaya: 0 });

const round2 = (n: number) => Math.round(n * 100) / 100;

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
  const [notice, setNotice] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [showNewProduk, setShowNewProduk] = useState(false);
  const [satuanList, setSatuanList] = useState<SatuanDTO[]>([]);
  const [merkList, setMerkList] = useState<MerkDTO[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriDTO[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState("");
  const refsLoadedRef = useRef(false);
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

  // Satu-satunya tempat ProdukDTO → item pembelian, dipakai hasil pencarian
  // maupun produk yang baru dibuat dari panel "Produk Baru".
  // Semua opsi satuan produk otomatis jadi baris beli (qty 0 = belum dipilih,
  // dilewati saat simpan) — kecuali produk satu-satuan yang langsung qty 1.
  const addProduk = (p: ProdukDTO, _defaultKodeItem?: string, bahanAwal: DraftBahan[] = []): boolean => {
    const satuanOptions = p.satuan.map((s) => ({ produkSatuanId: s.id, satuanNama: s.satuanNama, harga: s.harga }));
    const sudahAda = new Set(items.map((i) => i.produkSatuanId));
    const baru = satuanOptions.filter((o) => !sudahAda.has(o.produkSatuanId));
    if (!baru.length) { setError("Semua satuan produk sudah ditambahkan."); return false; }
    const qtyAwal = satuanOptions.length === 1 ? 1 : 0;
    const rows: DraftItem[] = baru.map((o) => ({
      produkId: p.id, sku: p.sku, nama: p.nama,
      qty: qtyAwal, hargaBeli: 0, hargaJual: o.harga, diskon: 0,
      satuanOptions, produkSatuanId: o.produkSatuanId,
      isRepack: false, bahan: [],
    }));
    // Bahan repack awal (dari panel Produk Baru) menempel di baris pertama.
    if (bahanAwal.length && rows.length) { rows[0].isRepack = true; rows[0].bahan = bahanAwal.map((b) => ({ ...b })); }
    setItems((prev) => [...prev, ...rows.filter((r) => !prev.some((i) => i.produkSatuanId === r.produkSatuanId))]);
    setSearchQ(""); setShowResults(false); setError(""); setNotice(null);
    return true;
  };

  // Daftar kategori/merk/satuan dimuat lazy: hanya saat panel "Produk Baru"
  // pertama kali dibuka, bukan saat modal mount.
  const openNewProduk = async () => {
    setNotice(null);
    setShowNewProduk(true);
    if (refsLoadedRef.current) return;
    refsLoadedRef.current = true;
    setRefsLoading(true); setRefsError("");
    try {
      const [satuan, merk, kategori] = await Promise.all([
        listAllActiveSatuan(), listAllActiveMerk(), listAllActiveKategori(),
      ]);
      setSatuanList(satuan.items); setMerkList(merk.items); setKategoriList(kategori.items);
    } catch (e) {
      refsLoadedRef.current = false; // biar bisa dicoba lagi saat panel dibuka ulang
      setRefsError(e instanceof ApiClientError ? e.message : "Gagal memuat kategori/merk/satuan.");
    } finally { setRefsLoading(false); }
  };

  const toggleNewProduk = () => {
    if (showNewProduk) { setShowNewProduk(false); return; }
    void openNewProduk();
  };

  // Hasil panel produk baru: jadikan item pembelian memakai addProduk yang sama.
  const handleProdukBaruDone = (produk: ProdukDTO | null, sku: string, defaultKodeItem: string, bahanAwal: DraftBahan[] = []) => {
    setShowNewProduk(false);
    if (!produk) {
      setNotice({ tone: "warning", text: `Produk ${sku} sudah dibuat, tapi datanya belum bisa dimuat otomatis. Cari SKU ${sku} di kolom pencarian produk.` });
      return;
    }
    if (!addProduk(produk, defaultKodeItem, bahanAwal)) {
      setError("");
      setNotice({ tone: "warning", text: `Produk ${sku} sudah dibuat, tapi sudah ada di daftar item pembelian.` });
      return;
    }
    setNotice({ tone: "success", text: `Produk ${sku} dibuat dan ditambahkan ke item pembelian.` });
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- Repack (desain V3.1): toggle + bahan kebutuhan (tanpa pecahan) ---
  const toggleRepack = (idx: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, isRepack: !it.isRepack } : it)));
  };
  const addBahan = (itemIdx: number) => {
    setItems((prev) => prev.map((it, i) => (i === itemIdx ? { ...it, bahan: [...it.bahan, emptyBahan()] } : it)));
  };
  const updateBahan = (itemIdx: number, bIdx: number, patch: Partial<DraftBahan>) => {
    setItems((prev) => prev.map((it, i) =>
      (i === itemIdx ? { ...it, bahan: it.bahan.map((b, j) => (j === bIdx ? { ...b, ...patch } : b)) } : it)));
  };
  const removeBahan = (itemIdx: number, bIdx: number) => {
    setItems((prev) => prev.map((it, i) =>
      (i === itemIdx ? { ...it, bahan: it.bahan.filter((_, j) => j !== bIdx) } : it)));
  };

  const submit = async () => {
    setError("");
    if (!supplierId) { setError("Pilih supplier terlebih dahulu."); return; }
    // Baris dengan qty 0 = belum dipilih dan dilewati.
    const dibeli = items.filter((it) => it.qty > 0);
    if (!dibeli.length) { setError("Minimal 1 produk harus ditambahkan."); return; }
    for (const it of dibeli) {
      if (!it.produkSatuanId) { setError(`Pilih satuan produk untuk ${it.nama}.`); return; }
      if (it.hargaBeli < 0 || !Number.isFinite(it.hargaBeli)) { setError(`Harga beli ${it.nama} tidak valid.`); return; }
      // Anti-rugi (desain V3.1): harga jual harus lebih tinggi dari harga beli.
      // Hanya baris yang dibeli (qty > 0) yang divalidasi — baris satuan yang tidak
      // dibeli (qty 0) tidak ikut pembelian dan boleh bernilai 0.
      if (!(it.hargaJual > it.hargaBeli)) { setError(`Harga Jual untuk ${it.nama} harus lebih tinggi dari Harga Beli.`); return; }
      // Bahan repack: nama wajib, biaya tidak negatif (menambah biaya pembelian).
      for (const b of it.bahan) {
        if (!b.namaBarang.trim()) { setError(`Bahan repack ${it.nama}: nama barang wajib diisi.`); return; }
        if (!Number.isFinite(b.biaya) || b.biaya < 0) { setError(`Bahan repack ${it.nama}: biaya tidak boleh negatif.`); return; }
      }
    }
    setBusy(true);
    try {
      await createPembelian({
        tanggal: `${tanggal}T${new Date().toTimeString().slice(0, 8)}`,
        supplierId: Number(supplierId),
        ppn: Number(ppn) || 0,
        catatan: catatan || null,
        items: dibeli.map((it) => {
          const bahan = it.bahan
            .filter((b) => b.namaBarang.trim())
            .map((b) => ({ namaBarang: b.namaBarang.trim(), biaya: Number(b.biaya) || 0 }));
          return {
            produkId: it.produkId, produkSatuanId: it.produkSatuanId, sku: it.sku, namaProduk: it.nama,
            qty: it.qty, hargaBeli: it.hargaBeli, hargaJual: it.hargaJual, diskon: it.diskon,
            isRepack: it.isRepack || bahan.length > 0,
            ...(bahan.length ? { bahan } : {}),
          };
        }),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat pembelian.");
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-6xl mx-4 max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 style={{ color: '#000000' }}>Buat Pembelian Baru</h2>
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
            {notice && (
              <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: notice.tone === "success" ? '#dcfce7' : '#fef3c7' }}>
                <p className="text-sm" style={{ color: notice.tone === "success" ? '#166534' : '#92400e' }}>
                  {notice.tone === "success" ? "✓" : "!"} {notice.text}
                </p>
              </div>
            )}
            {/* Layout 2 kolom ala desain V3.1: kiri info & produk, kanan Ringkasan Total */}
            <div className={`grid grid-cols-1 gap-5 ${items.length > 0 ? "lg:grid-cols-3" : ""}`}>
            <div className={`space-y-5 ${items.length > 0 ? "lg:col-span-2" : ""}`}>
            {/* Info dasar (3 kolom ala desain V3.1: Nomor | Tanggal | Supplier) */}
            <div className="grid grid-cols-3 gap-4">
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>
                  Nomor Pembelian <span style={{ color: '#e40b18' }}>*</span>
                </span>
                <input type="text" value="Otomatis saat disimpan" disabled
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 cursor-not-allowed"
                  style={{ color: '#1a0408', backgroundColor: '#f9fafb', opacity: 0.8 }} />
              </label>
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>
                  Tanggal <span style={{ color: '#e40b18' }}>*</span>
                </span>
                <DatePicker value={tanggal} onChange={setTanggal} placeholder="Pilih tanggal"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>
                  Supplier <span style={{ color: '#e40b18' }}>*</span>
                </span>
                <div className="relative">
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                    className="appearance-none w-full pl-3 pr-9 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer" style={inputStyle}>
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                </div>
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label>
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>PPn (%)</span>
                <input type="number" min="0" max="100" value={ppn} onChange={(e) => setPpn(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-32 px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
              <label className="flex-1 min-w-[220px]">
                <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Catatan</span>
                <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
              </label>
            </div>

            {/* Cari produk (master) + quick-create produk baru */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="block" style={{ color: '#000000' }}>Tambah Produk</label>
                <button type="button" onClick={toggleNewProduk}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-sm transition-colors hover:bg-green-50"
                  style={{ borderColor: '#27b446', color: '#27b446' }}>
                  <Plus className="w-4 h-4" /> {showNewProduk ? "Tutup Produk Baru" : "Produk Baru"}
                </button>
              </div>
              <div className="relative" ref={searchBoxRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)}
                  placeholder="Cari produk berdasarkan SKU atau nama..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
                {showResults && results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-56 overflow-y-auto">
                    {results.map((p) => (
                      <button key={p.id} type="button" onClick={() => addProduk(p)}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
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
                {showResults && searchQ.trim() !== "" && results.length === 0 && !showNewProduk && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 px-4 py-3">
                    <p className="text-sm mb-2" style={{ color: '#1a0408' }}>
                      Produk &ldquo;{searchQ.trim()}&rdquo; belum ada di master produk.
                    </p>
                    <button type="button" onClick={toggleNewProduk}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#27b446' }}>
                      <Plus className="w-3.5 h-3.5" /> Buat Produk Baru (satuan wajib)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Panel produk baru (inline, tanpa keluar form) */}
            {showNewProduk && (
              <div className="mt-4">
              <NewProdukPanel
                satuanList={satuanList}
                merkList={merkList}
                kategoriList={kategoriList}
                refsLoading={refsLoading}
                refsError={refsError}
                onKategoriCreated={(k) => setKategoriList((prev) => prev.some((x) => x.kode === k.kode) ? prev : [...prev, k].sort((a, b) => a.nama.localeCompare(b.nama)))}
                onMerkCreated={(m) => setMerkList((prev) => prev.some((x) => x.kode === m.kode) ? prev : [...prev, m].sort((a, b) => a.nama.localeCompare(b.nama)))}
                onSatuanCreated={(s) => setSatuanList((prev) => prev.some((x) => x.kode === s.kode) ? prev : [...prev, s].sort((a, b) => a.kode.localeCompare(b.kode)))}
                onProductCreated={handleProdukBaruDone}
                onBatal={() => setShowNewProduk(false)}
              />
              </div>
            )}

            </div>

            {/* Ringkasan Total — kolom kanan (desain V3.1) */}
            {items.length > 0 && (
              <div className="lg:col-span-1">
                <div className="p-4 rounded-lg border-2 lg:sticky lg:top-0" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                  <h3 className="mb-3" style={{ color: '#000000' }}>Ringkasan Total</h3>
                  <div className="space-y-2">
                    {(() => {
                      const subtotalItems = round2(items.reduce((sum, it) => sum + Math.round(it.hargaBeli * it.qty * (1 - it.diskon / 100) * 100) / 100, 0));
                      const totalBahan = round2(items.reduce((sum, it) => sum + it.bahan.reduce((s, b) => s + (b.biaya || 0), 0), 0));
                      const subtotalRepack = round2(subtotalItems + totalBahan);
                      const ppnAmount = round2((subtotalRepack * (Number(ppn) || 0)) / 100);
                      const grandTotal = round2(subtotalRepack + ppnAmount);
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span style={{ color: '#1a0408', opacity: 0.7 }}>Subtotal Pembelian</span>
                            <span style={{ color: '#1a0408' }}>{formatRp(subtotalItems)}</span>
                          </div>
                          {totalBahan > 0 && (
                            <div className="flex justify-between text-sm">
                              <span style={{ color: '#1a0408', opacity: 0.7 }}>Total Biaya Repack</span>
                              <span style={{ color: '#1a0408' }}>{formatRp(totalBahan)}</span>
                            </div>
                          )}
                          {Number(ppn) > 0 && (
                            <div className="flex justify-between text-sm">
                              <span style={{ color: '#1a0408', opacity: 0.7 }}>PPn ({ppn}%)</span>
                              <span style={{ color: '#1a0408' }}>{formatRp(ppnAmount)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t-2 border-gray-300 flex justify-between items-center">
                            <span className="text-sm" style={{ color: '#000000' }}>Grand Total</span>
                            <span className="text-xl" style={{ color: '#27b446' }}>{formatRp(grandTotal)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Items */}
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>Produk Dipilih ({items.length})</label>
              {items.length === 0 ? (
                <div className="p-6 text-center rounded-lg border border-dashed" style={{ borderColor: '#d1d5db' }}>
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>Belum ada produk. Cari & tambahkan produk di atas.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[700px] overflow-y-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th className="px-4 py-3 text-left" style={{ color: '#000000' }}>Produk</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Qty</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Beli</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Harga Jual</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Diskon (%)</th>
                        <th className="px-4 py-3 text-right" style={{ color: '#000000' }}>Subtotal</th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>
                          <span className="inline-flex items-center gap-1 justify-center" title="Aktifkan jika produk ini direpack jadi satuan lebih kecil. Bahan repack tidak masuk stok tetapi masuk perhitungan rugi laba.">
                            Repack <Info className="w-3 h-3" />
                          </span>
                        </th>
                        <th className="px-4 py-3 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const subtotal = Math.round(it.hargaBeli * it.qty * (1 - it.diskon / 100) * 100) / 100;
                        // Biaya bahan repack menambah biaya pembelian item (pola server).
                        const biayaBahan = round2(it.bahan.reduce((sum, b) => sum + (b.biaya || 0), 0));
                        const satuanNama = it.satuanOptions.find((o) => o.produkSatuanId === it.produkSatuanId)?.satuanNama ?? "-";
                        return (
                          <Fragment key={`${it.sku}-${it.produkSatuanId}`}>
                            <tr className="border-b border-gray-100 last:border-0">
                              <td className="px-4 py-2 min-w-[180px]">
                                <p style={{ color: '#1a0408' }}>{it.nama}</p>
                                <p className="text-xs font-mono mb-1" style={{ color: '#27b446' }}>{it.sku}</p>
                                <span className="inline-flex px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#f3f4f6', color: '#1a0408' }}>
                                  {satuanNama}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button type="button" onClick={() => updateItem(idx, { qty: Math.max(0, it.qty - 1) })}
                                    className="w-7 h-7 rounded border flex items-center justify-center" style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <input type="number" value={it.qty} min={0} onChange={(e) => updateItem(idx, { qty: Math.max(0, Number(e.target.value) || 0) })}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className="w-12 text-center rounded border border-gray-300 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                                  <button type="button" onClick={() => updateItem(idx, { qty: it.qty + 1 })}
                                    className="w-7 h-7 rounded border flex items-center justify-center" style={{ borderColor: '#27b446', color: '#27b446' }}>
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {it.qty === 0 && (
                                  <p className="text-[10px] text-center mt-0.5" style={{ color: '#1a0408', opacity: 0.5 }}>qty 0 = tidak dibeli</p>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" value={it.hargaBeli || ""} onChange={(e) => updateItem(idx, { hargaBeli: Number(e.target.value) })}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" value={it.hargaJual || ""} onChange={(e) => updateItem(idx, { hargaJual: Number(e.target.value) })}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" min="0" max="100" value={it.diskon || ""} onChange={(e) => updateItem(idx, { diskon: Number(e.target.value) || 0 })}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  placeholder="0" className="w-full text-right rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-2" style={inputStyle} />
                              </td>
                              <td className="px-4 py-2 text-right" style={{ color: '#27b446', fontWeight: 500 }}>
                                {formatRp(subtotal)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button type="button" onClick={() => toggleRepack(idx)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${it.isRepack ? 'bg-[#27b446]' : 'bg-gray-300'}`}
                                  aria-label={`Toggle repack ${it.nama}`}>
                                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${it.isRepack ? 'translate-x-5' : 'translate-x-1'}`} />
                                </button>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg border" style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                            {it.isRepack && (
                              <tr style={{ backgroundColor: 'rgba(39, 180, 70, 0.04)' }}>
                                <td colSpan={8} className="px-4 py-3">
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                      <Split className="w-4 h-4" style={{ color: '#27b446' }} />
                                      <span className="text-xs" style={{ color: '#27b446', letterSpacing: '0.08em' }}>BAHAN KEBUTUHAN REPACK</span>
                                      <span className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                                        {it.nama} · {satuanNama} — biaya bahan menambah biaya pembelian item (tidak masuk stok)
                                      </span>
                                    </div>
                                    <button type="button" onClick={() => addBahan(idx)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: '#27b446' }}>
                                      <Plus className="w-3.5 h-3.5" /> Tambah Bahan
                                    </button>
                                  </div>

                                  {/* Bahan Kebutuhan Repack (desain V3.1) */}
                                  <div className="p-3 rounded-lg border border-gray-200 bg-white">
                                    {it.bahan.length === 0 ? (
                                      <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                                        Belum ada bahan. Biaya bahan menambah biaya pembelian item (tidak masuk stok) dan mengurangi laba.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {it.bahan.map((b, bi) => (
                                          <div key={bi} className="flex items-center gap-2">
                                            <input type="text" value={b.namaBarang} placeholder="Nama Barang"
                                              onChange={(e) => updateBahan(idx, bi, { namaBarang: e.target.value })}
                                              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2" style={inputStyle} />
                                            <input type="number" min={0} value={b.biaya || ""} placeholder="Biaya"
                                              onWheel={(e) => e.currentTarget.blur()}
                                              onChange={(e) => updateBahan(idx, bi, { biaya: Math.max(0, Number(e.target.value) || 0) })}
                                              className="w-40 px-3 py-1.5 rounded-lg border border-gray-300 text-right focus:outline-none focus:ring-2" style={inputStyle} />
                                            <button type="button" onClick={() => removeBahan(idx, bi)}
                                              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors hover:bg-red-50"
                                              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ))}
                                        <div className="text-right pt-2 border-t border-gray-200">
                                          <p className="text-xs" style={{ color: '#1a0408', opacity: 0.7 }}>
                                            Total Biaya Repack: <span style={{ color: '#000000' }}>{formatRp(biayaBahan)}</span> · bahan tidak masuk stok tetapi masuk perhitungan rugi laba
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50" style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
          <button onClick={() => void submit()} disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
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

/** Laba estimasi per item (cermin `estimasiLaba` server): pecahan → Σ (jual − alokasi)×qty
 *  (alokasi sudah memuat biaya bahan repack); tanpa pecahan → (jual − beli setelah diskon)×qty
 *  dikurangi biaya bahan repack. */
function labaItemDto(it: PembelianItemDTO): number {
  const pecahan = Array.isArray(it.pecahan) ? it.pecahan : [];
  if (pecahan.length) {
    return pecahan.reduce((s, p) => s + ((p.hargaJualSatuan ?? 0) - p.hargaBeliAlokasi) * p.qty, 0);
  }
  return (it.hargaJual - it.hargaBeli * (1 - it.diskon / 100)) * it.qty - (it.biayaRepack || 0);
}

function DetailModal({ data, onClose, onDelete }: { data: PembelianDTO; onClose: () => void; onDelete: (id: number) => void }) {
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
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

          {/* Daftar Produk (judul kartu ala desain V3.1) */}
          <h3 className="mb-3" style={{ color: '#000000' }}>Daftar Produk</h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden mb-5">
            <table className="w-full">
              <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#000000' }}>SKU</th>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#000000' }}>Nama Produk</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#000000' }}>Satuan</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#000000' }}>Qty</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#000000' }}>Harga Beli</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#000000' }}>Harga Jual</th>
                  <th className="px-4 py-2 text-center text-xs" style={{ color: '#000000' }}>Diskon</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#000000' }}>Total</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#000000' }}>Laba</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => {
                  // Data lama mungkin belum punya pecahan → aman tanpa pecahan.
                  const pecahan = Array.isArray(it.pecahan) ? it.pecahan : [];
                  return (
                    <Fragment key={it.id}>
                      <tr className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2">
                          <p className="text-xs font-mono" style={{ color: '#27b446' }}>{it.sku}</p>
                        </td>
                        <td className="px-4 py-2">
                          <p style={{ color: '#1a0408' }}>{it.namaProduk}</p>
                          {it.isRepack && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: '#27b446' }}>
                              Repack ({it.jumlahRepack}x)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.satuanNama ?? "-"}</td>
                        <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.qty}</td>
                        <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaBeli)}</td>
                        <td className="px-4 py-2 text-right" style={{ color: '#1a0408' }}>{formatRp(it.hargaJual)}</td>
                        <td className="px-4 py-2 text-center" style={{ color: '#1a0408' }}>{it.diskon > 0 ? `${it.diskon}%` : "-"}</td>
                        <td className="px-4 py-2 text-right">
                          <p style={{ color: '#000000' }}>{formatRp(it.subtotal)}</p>
                          {it.biayaRepack > 0 && (
                            <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>Repack: +{formatRp(it.biayaRepack)}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {(() => {
                            const labaItem = round2(labaItemDto(it));
                            return (
                              <>
                                <p style={{ color: labaItem < 0 ? '#e40b18' : '#27b446' }}>{formatRp(labaItem)}</p>
                                <p className="text-xs" style={{ color: '#1a0408', opacity: 0.6 }}>
                                  ({it.hargaBeli > 0 ? `${round2(((it.hargaJual - it.hargaBeli * (1 - it.diskon / 100)) / it.hargaBeli) * 100)}%` : "—"})
                                </p>
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                      {pecahan.map((p) => {
                        // Data lama mungkin belum punya hargaJualSatuan → guard.
                        const hargaJualSatuan = typeof p.hargaJualSatuan === "number" ? p.hargaJualSatuan : null;
                        const labaBaris = round2(((hargaJualSatuan ?? 0) - p.hargaBeliAlokasi) * p.qty);
                        return (
                        <tr key={`${it.id}-pecahan-${p.id}`} style={{ backgroundColor: '#fcfaff' }}>
                          <td className="px-4 py-1.5" />
                          <td className="px-4 py-1.5 pl-8">
                            <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#27b446' }}>
                              <Layers className="w-3 h-3" /> Pecahan
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-center text-xs" style={{ color: '#1a0408', opacity: 0.85 }}>{p.satuanNama ?? "-"}</td>
                          <td className="px-4 py-1.5 text-center text-xs" style={{ color: '#1a0408', opacity: 0.85 }}>
                            {p.qty}
                            <span className="block text-[10px]" style={{ opacity: 0.7 }}>
                              {p.isiBase === null ? "isi —" : `isi ${p.isiBase} g`}
                            </span>
                          </td>
                          <td className="px-4 py-1.5 text-right text-xs" style={{ color: '#1a0408', opacity: 0.85 }}>{formatRp(p.hargaBeliAlokasi)}</td>
                          <td className="px-4 py-1.5 text-right text-xs" style={{ color: hargaJualSatuan === null ? '#1a0408' : undefined, opacity: hargaJualSatuan === null ? 0.5 : 0.85 }}>
                            {hargaJualSatuan === null ? "—" : formatRp(hargaJualSatuan)}
                          </td>
                          <td className="px-4 py-1.5 text-center text-xs" style={{ color: '#1a0408', opacity: 0.5 }}>—</td>
                          <td className="px-4 py-1.5 text-right text-xs" style={{ color: '#000000' }}>{formatRp(p.subtotalAlokasi)}</td>
                          <td className="px-4 py-1.5 text-right text-xs" style={{ color: labaBaris < 0 ? '#e40b18' : '#27b446' }}>
                            {hargaJualSatuan === null ? "—" : formatRp(labaBaris)}
                          </td>
                        </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <h3 className="mb-3" style={{ color: '#000000' }}>Ringkasan</h3>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: '#1a0408', opacity: 0.7 }}>Subtotal Pembelian</span>
              <span style={{ color: '#1a0408' }}>{formatRp(round2(data.totalPembelian - data.totalBiayaRepack))}</span>
            </div>
            {data.totalBiayaRepack > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#1a0408', opacity: 0.7 }}>Total Biaya Repack</span>
                <span style={{ color: '#1a0408' }}>{formatRp(data.totalBiayaRepack)}</span>
              </div>
            )}
            {data.totalPpn > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: '#1a0408', opacity: 0.7 }}>PPn ({data.ppn}%)</span>
                <span style={{ color: '#1a0408' }}>{formatRp(data.totalPpn)}</span>
              </div>
            )}
            <div className="pt-2 border-t-2 border-gray-300 flex justify-between items-center">
              <span className="text-lg" style={{ color: '#000000' }}>Grand Total</span>
              <span className="text-xl" style={{ color: '#27b446' }}>{formatRp(data.grandTotal)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <div>
                <p style={{ color: '#000000' }}>Total Laba (Estimasi)</p>
                <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Jika semua produk terjual</p>
              </div>
              <p className="text-2xl flex items-center gap-1" style={{ color: data.estimasiLaba < 0 ? '#e40b18' : '#27b446' }}>
                {data.estimasiLaba < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />} {formatRp(data.estimasiLaba)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button onClick={() => onDelete(data.id)}
            className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#e40b18' }}>
            Hapus (kembalikan stok)
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>Tutup</button>
        </div>
    </Modal>
  );
}

/**
 * Parse kolom bulk opsional `Bahan Repack` — `Nama Barang:Biaya` dipisah `;`
 * (mis. `Plastik:500;Lakban:250`) menjadi daftar bahan repack item (biaya,
 * tidak masuk stok). Mengembalikan pesan error atau "" bila semua baris valid.
 */
function parseBahanBulk(raw: string, keluar: DraftBahan[]): string {
  const bagian = raw.split(";").map((x) => x.trim()).filter(Boolean);
  for (const bag of bagian) {
    const kolom = bag.split(":").map((x) => x.trim());
    if (kolom.length !== 2) return `format bahan "${bag}" salah (harus Nama Barang:Biaya)`;
    const [namaBarang, biayaTeks] = kolom;
    if (!namaBarang) return "nama barang bahan tidak boleh kosong";
    const biaya = Number(biayaTeks);
    if (!Number.isFinite(biaya) || biaya < 0) return `biaya bahan "${namaBarang}" harus angka >= 0`;
    keluar.push({ namaBarang, biaya });
  }
  return "";
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
  const [viewing, setViewing] = useState<PembelianDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

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
    listSupplier({ pageSize: 500 }).then((r) => setSuppliers(r.items.filter((s) => s.isActive))).catch(() => undefined);
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
      // Resolusi SKU → produk master (untuk produkSatuanId sesuai nama satuan).
      const produkCache = new Map<string, ProdukDTO | null>();
      const findProduk = async (sku: string): Promise<ProdukDTO | null> => {
        const key = sku.trim().toLowerCase();
        if (produkCache.has(key)) return produkCache.get(key) ?? null;
        let found: ProdukDTO | null = null;
        try {
          const res = await listProduk({ search: sku.trim(), pageSize: 10 });
          found = res.items.find((p) => p.sku.toLowerCase() === key) ?? null;
        } catch { found = null; }
        produkCache.set(key, found);
        return found;
      };
      const grouped = new Map<number, { tanggal: string; supplierId: number; firstRow: number; rows: Array<{ sku: string; nama: string; produkId: number | null; produkSatuanId: number | null; bahan: DraftBahan[]; qty: number; hargaBeli: number; hargaJual: number; diskon: number }> }>();
      const failures: BulkUploadFailure[] = [];

      for (let idx = 0; idx < rows.length - 1; idx++) {
        const row = rows[idx + 1];
        const supplierRef = value(row, "supplier", "supplier kode", "kode supplier", "vendor");
        const supplierId = supplierCodeMap.get(supplierRef) ?? supplierNameMap.get(supplierRef.toLowerCase());
        if (!supplierId) { failures.push({ row: idx + 2, message: `supplier tidak dikenal (${supplierRef})` }); continue; }
        const tanggal = value(row, "tanggal") || format(new Date(), "yyyy-MM-dd");
        const sku = value(row, "sku", "kode produk");
        const nama = value(row, "nama produk", "nama", "produk");
        const satuanNama = value(row, "satuan").trim();
        const bahanRaw = value(row, "bahan repack", "bahan").trim();
        const qty = Number(value(row, "qty", "jumlah")) || 0;
        const hargaBeli = Number(value(row, "harga beli", "harga_beli")) || 0;
        const hargaJual = Number(value(row, "harga jual", "harga_jual")) || 0;
        const diskon = Number(value(row, "diskon")) || 0;
        if (!sku || !nama || qty <= 0) { failures.push({ row: idx + 2, message: "data produk/qty tidak valid" }); continue; }
        // Anti-rugi (desain V3.1): harga jual wajib lebih tinggi dari harga beli.
        if (!(hargaJual > hargaBeli)) { failures.push({ row: idx + 2, message: `harga jual harus lebih tinggi dari harga beli (SKU ${sku})` }); continue; }
        // Kolom Satuan: memilih satuan beli (multi-satuan = beberapa baris SKU sama).
        // Kolom Bahan Repack opsional: `Nama Barang:Biaya` dipisah `;` → biaya repack
        // item (tidak masuk stok) dan menandai item sebagai repack.
        let produkId: number | null = null;
        let produkSatuanId: number | null = null;
        const bahan: DraftBahan[] = [];
        if (satuanNama) {
          const produk = await findProduk(sku);
          if (!produk) { failures.push({ row: idx + 2, message: `SKU ${sku} tidak ditemukan di produk master` }); continue; }
          produkId = produk.id;
          const opt = produk.satuan.find((s) => s.satuanNama.trim().toLowerCase() === satuanNama.toLowerCase());
          if (!opt) { failures.push({ row: idx + 2, message: `satuan "${satuanNama}" tidak dikenal untuk SKU ${sku}` }); continue; }
          produkSatuanId = opt.id;
        }
        if (bahanRaw) {
          const pesan = parseBahanBulk(bahanRaw, bahan);
          if (pesan) { failures.push({ row: idx + 2, message: `${pesan} (SKU ${sku})` }); continue; }
        }
        const g = grouped.get(supplierId) ?? { tanggal, supplierId, firstRow: idx + 2, rows: [] };
        if (!grouped.has(supplierId)) { g.tanggal = tanggal; grouped.set(supplierId, g); }
        g.rows.push({ sku, nama, produkId, produkSatuanId, bahan, qty, hargaBeli, hargaJual, diskon });
      }
      let success = 0;
      for (const [supplierId, g] of grouped) {
        try {
          await createPembelian({
            tanggal: `${g.tanggal}T${new Date().toTimeString().slice(0, 8)}`, supplierId, ppn: 0,
            items: g.rows.map((r) => ({
              produkId: r.produkId, produkSatuanId: r.produkSatuanId, sku: r.sku, namaProduk: r.nama,
              qty: r.qty, hargaBeli: r.hargaBeli, hargaJual: r.hargaJual, diskon: r.diskon,
              isRepack: r.bahan.length > 0,
              ...(r.bahan.length ? { bahan: r.bahan } : {}),
            })),
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
                Kelola data pembelian dan restock produk
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => void exportData()}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-colors"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'white' }}
                title="Export seluruh data pembelian (CSV)">
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <button onClick={() => setShowBulk(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 transition-colors"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'white' }}
                title="Bulk upload pembelian dari CSV">
                <Upload className="w-5 h-5" />
                Bulk Upload
              </button>
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#27b446' }}>
                <Plus className="w-5 h-5" />
                Buat Pembelian Baru
              </button>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari Nomor Pembelian atau Supplier..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={inputStyle} />
              </div>
            </div>
            <button onClick={() => setShowDateFilter(!showDateFilter)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors"
              style={{ backgroundColor: showDateFilter ? '#27b446' : 'white', borderColor: '#27b446', color: showDateFilter ? 'white' : '#27b446' }}>
              Filter Tanggal
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

          {/* Results count */}
          <div className="mt-4">
            <p style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {items.length} dari {pagination.total} data
              {hasActiveFilters && " (difilter)"}
            </p>
          </div>
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
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pembelian...</p></div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("no_pembelian")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Nomor Pembelian {getSortIcon("no_pembelian")}
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
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Jumlah Item</th>
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Total Beli</th>
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Estimasi Laba</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.id} onClick={() => setViewing(p)}
                          className="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4" style={{ color: '#27b446', fontFamily: 'monospace' }}>{p.noPembelian}</td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
                            {fmtWib(p.tanggal, "dd MMM yyyy")}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>
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
                        style={inputStyle}>
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                    </div>
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Menampilkan {rangeStart} - {rangeEnd} dari {pagination.total} data</span>
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
          columns={["Supplier", "Tanggal", "SKU", "Nama Produk", "Satuan", "Qty", "Harga Beli", "Harga Jual", "Diskon", "Bahan Repack"]}
          formatNote="Supplier bisa kode (SUP-001) atau nama. Tanggal format YYYY-MM-DD (opsional, default hari ini). Satuan (opsional) = nama satuan beli yang terdaftar di master produk (mis. Dus, Pcs); bila kosong sistem memakai satuan pertama produk. Membeli beberapa satuan dari satu produk: tulis beberapa baris dengan SKU sama. Bahan Repack (opsional) = daftar bahan format Nama Barang:Biaya dipisah ';' (mis. Plastik:500;Lakban:250) — biaya bahan menambah biaya item (tidak masuk stok) dan menandai item sebagai repack. Qty minimal 1. Harga Jual wajib lebih tinggi dari Harga Beli (anti-rugi; baris yang melanggar dihitung gagal). Diskon per item (opsional, default 0). Setiap baris = satu item; baris dengan supplier sama digabung jadi satu pembelian."
          sample={{
            headers: ["Supplier", "Tanggal", "SKU", "Nama Produk", "Satuan", "Qty", "Harga Beli", "Harga Jual", "Diskon", "Bahan Repack"],
            rows: [
              ["SUP-001", "2026-09-27", "IND-001", "Indomie", "Dus", "24", "19500", "24000", "0", ""],
              ["SUP-001", "2026-09-27", "IND-001", "Indomie", "Pcs", "20", "950", "1200", "0", "Plastik:500"],
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
