"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateSupplier, createSupplier, deleteSupplier, downloadSupplierCsv,
  listSupplier, updateSupplier,
} from "@/lib/supplier-api";
import { parseCsv, statusToIsActive, STATUS_HEADER_ALIASES } from "./BulkUploadReference";
import BulkUploadModal, { type BulkUploadOutcome } from "./BulkUploadModal";
import type { CreateSupplierInput, SupplierDTO } from "@/lib/supplier-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Download, Upload,
  Pencil, Trash2, CheckCircle, Phone, Mail, Building2, MapPin, Banknote,
  AlertTriangle, Truck,
} from "lucide-react";

type SortField = "id" | "kode" | "nama" | "kota" | "created_at";
type SortDirection = "asc" | "desc" | null;

const emptyForm: CreateSupplierInput = {
  nama: "", alamat: "", kota: "", provinsi: "", negara: "Indonesia", kodepos: "",
  telepon: "", fax: "", bank: "", norek: "", atasnama: "", kontak: "", email: "",
  keterangan: "", isActive: true,
};

// Opsi dropdown bank (referensi statis UI, bukan data layer).
const BANK_LIST = [
  "BCA", "BRI", "BNI", "Mandiri", "CIMB Niaga", "Danamon", "Permata",
  "BTN", "Panin", "Maybank", "OCBC NISP", "BNC", "Lainnya",
];

// ---------------------------------------------------------------------------
// Kecil-kecil UI form
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#1a0408", opacity: 0.4 }}>
      {children}
    </p>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-sm" style={{ color: "#1a0408" }}>
        {label} {required && <span style={{ color: "#e40b18" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Modal (create & edit) — 14 field sesuai DTO supplier
// ---------------------------------------------------------------------------

interface SupplierFormProps {
  title: string;
  subtitle: string;
  value: CreateSupplierInput;
  onChange: (v: CreateSupplierInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
}

function SupplierForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, error }: SupplierFormProps) {
  const set = (key: keyof CreateSupplierInput, next: unknown) => onChange({ ...value, [key]: next } as CreateSupplierInput);
  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;
  const iCls = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 text-sm";
  const monoCls = `${iCls} font-mono`;
  const selectCls = `${iCls} appearance-none pr-8 cursor-pointer`;
  const areaCls = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 text-sm resize-none";

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col shadow-2xl">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex flex-col flex-1 min-h-0">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
          <div className="space-y-4">

            {/* Informasi Utama */}
            <div>
              <SectionTitle>Informasi Utama</SectionTitle>
              <div className="grid grid-cols-1 gap-4">
                <FormField label="Nama Supplier" required>
                  <input value={value.nama ?? ""} onChange={(e) => set("nama", e.target.value)}
                    placeholder="Nama perusahaan atau vendor" className={iCls} style={inputStyle} />
                </FormField>
                <FormField label="Alamat">
                  <textarea value={value.alamat ?? ""} onChange={(e) => set("alamat", e.target.value)}
                    placeholder="Jl. ..." rows={2} className={areaCls} style={inputStyle} />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Kota">
                    <input value={value.kota ?? ""} onChange={(e) => set("kota", e.target.value)}
                      placeholder="Nama kota" className={iCls} style={inputStyle} />
                  </FormField>
                  <FormField label="Kode Pos">
                    <input value={value.kodepos ?? ""} onChange={(e) => set("kodepos", e.target.value)}
                      placeholder="12345" className={monoCls} style={inputStyle} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Provinsi">
                    <input value={value.provinsi ?? ""} onChange={(e) => set("provinsi", e.target.value)}
                      placeholder="Nama provinsi" className={iCls} style={inputStyle} />
                  </FormField>
                  <FormField label="Negara">
                    <input value={value.negara ?? ""} onChange={(e) => set("negara", e.target.value)}
                      placeholder="Nama negara" className={iCls} style={inputStyle} />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Kontak */}
            <div className="border-t border-gray-100 pt-4">
              <SectionTitle>Kontak</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Telepon">
                  <input value={value.telepon ?? ""} onChange={(e) => set("telepon", e.target.value)}
                    placeholder="021-xxxxxxx" className={monoCls} style={inputStyle} />
                </FormField>
                <FormField label="Fax">
                  <input value={value.fax ?? ""} onChange={(e) => set("fax", e.target.value)}
                    placeholder="Nomor fax" className={monoCls} style={inputStyle} />
                </FormField>
                <FormField label="Kontak (PIC)">
                  <input value={value.kontak ?? ""} onChange={(e) => set("kontak", e.target.value)}
                    placeholder="Nama penanggung jawab" className={iCls} style={inputStyle} />
                </FormField>
                <FormField label="Email">
                  <input type="email" value={value.email ?? ""} onChange={(e) => set("email", e.target.value)}
                    placeholder="email@supplier.com" className={iCls} style={inputStyle} />
                </FormField>
              </div>
            </div>

            {/* Informasi Rekening */}
            <div className="border-t border-gray-100 pt-4">
              <SectionTitle>Informasi Rekening</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Bank">
                  <div className="relative">
                    <select value={value.bank ?? ""} onChange={(e) => set("bank", e.target.value)}
                      className={selectCls} style={inputStyle}>
                      <option value="">Pilih Bank</option>
                      {BANK_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
                      {value.bank && !BANK_LIST.includes(value.bank) && (
                        <option value={value.bank}>{value.bank}</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "#1a0408", opacity: 0.5 }} />
                  </div>
                </FormField>
                <FormField label="No. Rekening">
                  <input value={value.norek ?? ""} onChange={(e) => set("norek", e.target.value)}
                    placeholder="Nomor rekening" className={monoCls} style={inputStyle} />
                </FormField>
                <div className="col-span-2">
                  <FormField label="Atas Nama">
                    <input value={value.atasnama ?? ""} onChange={(e) => set("atasnama", e.target.value)}
                      placeholder="Sesuai buku rekening" className={iCls} style={inputStyle} />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Keterangan */}
            <div className="border-t border-gray-100 pt-4">
              <SectionTitle>Keterangan</SectionTitle>
              <FormField label="Keterangan">
                <textarea value={value.keterangan ?? ""} onChange={(e) => set("keterangan", e.target.value)}
                  placeholder="Catatan tambahan tentang supplier ini..." rows={3} className={areaCls} style={inputStyle} />
              </FormField>
            </div>

            {/* Status */}
            <div className="border-t border-gray-100 pt-4">
              <SectionTitle>Status</SectionTitle>
              <div className="flex items-center gap-3">
                {([true, false] as const).map((val) => (
                  <button key={String(val)} type="button" onClick={() => set("isActive", val)}
                    className="flex items-center gap-2 cursor-pointer">
                    <span
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: value.isActive === val ? "#27b446" : "#d1d5db",
                        backgroundColor: value.isActive === val ? "#27b446" : "white",
                      }}>
                      {value.isActive === val && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="text-sm" style={{ color: "#1a0408" }}>{val ? "Aktif" : "Nonaktif"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-lg border-2 hover:bg-red-50 transition-colors"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Tambah Supplier"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({ sup, onClose, onEdit }: { sup: SupplierDTO; onClose: () => void; onEdit: (s: SupplierDTO) => void }) {
  const row = (icon: React.ReactNode, label: string, val: string | null) => (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span style={{ color: '#27b446', marginTop: '2px' }}>{icon}</span>
      <div>
        <p className="text-xs" style={{ color: '#1a0408', opacity: 0.5 }}>{label}</p>
        <p className="text-sm" style={{ color: '#1a0408' }}>{val || <span style={{ opacity: 0.4 }}>—</span>}</p>
      </div>
    </div>
  );
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Detail Supplier</h2>
          <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{sup.kode}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto px-6 py-4 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: '#000000' }}>
              <Building2 className="w-5 h-5" style={{ color: '#27b446' }} /> {sup.nama}
            </h3>
            {sup.isActive ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm mt-1"
                style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                <CheckCircle className="w-4 h-4" /> Aktif
              </span>
            ) : (
              <span className="inline-flex px-3 py-1 rounded-full text-sm mt-1" style={{ backgroundColor: 'rgba(228, 11, 24, 0.1)', color: '#e40b18' }}>Nonaktif</span>
            )}
          </div>
          <button onClick={() => onEdit(sup)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}>
            <Pencil className="w-4 h-4" /> Edit
          </button>
        </div>

        <div>
          {row(<MapPin className="w-4 h-4" />, "Alamat", sup.alamat)}
          {row(<MapPin className="w-4 h-4" />, "Kota / Provinsi / Negara", [sup.kota, sup.provinsi, sup.negara].filter(Boolean).join(", "))}
          {row(<MapPin className="w-4 h-4" />, "Kode Pos", sup.kodepos)}
          {row(<Phone className="w-4 h-4" />, "Telepon", sup.telepon)}
          {row(<Phone className="w-4 h-4" />, "Fax", sup.fax)}
          {row(<Mail className="w-4 h-4" />, "Email", sup.email)}
          {row(<Mail className="w-4 h-4" />, "Kontak (PIC)", sup.kontak)}
          {row(<Banknote className="w-4 h-4" />, "Rekening Bank", sup.bank ? `${sup.bank}${sup.norek ? ` · ${sup.norek}` : ""}${sup.atasnama ? ` (${sup.atasnama})` : ""}` : null)}
          {row(<Mail className="w-4 h-4" />, "Keterangan", sup.keterangan)}
        </div>
      </div>
      <div className="px-6 py-4 border-t border-gray-200">
        <button onClick={onClose} className="w-full py-3 rounded-lg border-2 hover:bg-red-50 transition-colors"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>Tutup</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Supplier main page
// ---------------------------------------------------------------------------

export default function Supplier() {
  const [items, setItems] = useState<SupplierDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [viewing, setViewing] = useState<SupplierDTO | null>(null);
  const [deleting, setDeleting] = useState<SupplierDTO | null>(null);
  const [form, setForm] = useState<CreateSupplierInput>(emptyForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSupplier({
        page, pageSize: itemsPerPage, search,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data supplier.");
    } finally { setLoading(false); }
  }, [page, itemsPerPage, search, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [items]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortField(null); setSortDirection(null); }
    } else { setSortField(field); setSortDirection("asc"); }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="w-4 h-4" style={{ color: "#27b446" }} />
      : <ArrowDown className="w-4 h-4" style={{ color: "#27b446" }} />;
  };

  const handleSelectAll = () => {
    if (items.length > 0 && items.every((s) => selected.has(s.id))) setSelected(new Set());
    else setSelected(new Set(items.map((s) => s.id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const toForm = (s: SupplierDTO): CreateSupplierInput => ({
    nama: s.nama, alamat: s.alamat ?? "", kota: s.kota ?? "", provinsi: s.provinsi ?? "",
    negara: s.negara ?? "Indonesia", kodepos: s.kodepos ?? "", telepon: s.telepon ?? "",
    fax: s.fax ?? "", bank: s.bank ?? "", norek: s.norek ?? "", atasnama: s.atasnama ?? "",
    kontak: s.kontak ?? "", email: s.email ?? "", keterangan: s.keterangan ?? "", isActive: s.isActive,
  });

  const saveCreate = async () => {
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama supplier wajib diisi."); return; }
    setBusy(true);
    try {
      await createSupplier(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan supplier.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama supplier wajib diisi."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      const keys = ["nama", "alamat", "kota", "provinsi", "negara", "kodepos", "telepon", "fax", "bank", "norek", "atasnama", "kontak", "email", "keterangan"] as const;
      for (const k of keys) {
        const v = (form[k] as string) ?? "";
        const cur = (editing[k] as string) ?? "";
        if (v !== cur) payload[k] = v || null;
      }
      if (form.isActive !== editing.isActive) payload.isActive = form.isActive;
      const updated = await updateSupplier(editing.id, payload);
      setEditing(null);
      await load();
      if (updated) setViewing(updated);
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan supplier.");
    } finally { setBusy(false); }
  };

  const bulkSetActive = async (active: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => updateSupplier(id, { isActive: active })));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status supplier.");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSupplier(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus supplier.");
    } finally { setBusy(false); }
  };

  const importFile = async (file: File): Promise<BulkUploadOutcome> => {
    try {
      const rows = parseCsv(await file.text());
      const header = rows[0].map((x) => x.trim().toLowerCase());
      const value = (row: string[], ...names: string[]) => {
        const index = names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        return index >= 0 ? row[index] ?? "" : "";
      };
      const payload = rows.slice(1).map((row) => {
        // Kolom OPSIONAL status → isActive; kosong/tak dikenal → field tidak
        // dikirim (default server = Aktif).
        const isActive = statusToIsActive(value(row, ...STATUS_HEADER_ALIASES));
        return {
          nama: value(row, "nama", "nama supplier"),
          alamat: value(row, "alamat") || null,
          kota: value(row, "kota") || null,
          provinsi: value(row, "provinsi") || null,
          negara: value(row, "negara") || "Indonesia",
          kodepos: value(row, "kodepos", "kode pos") || null,
          telepon: value(row, "telepon", "no telepon", "phone") || null,
          fax: value(row, "fax") || null,
          bank: value(row, "bank") || null,
          norek: value(row, "norek", "no rekening", "no rek") || null,
          atasnama: value(row, "atasnama", "atas nama") || null,
          kontak: value(row, "kontak", "kontak person", "pic") || null,
          email: value(row, "email") || null,
          keterangan: value(row, "keterangan", "ket") || null,
          ...(isActive === undefined ? {} : { isActive }),
        };
      });
      const result = await bulkCreateSupplier(payload);
      return {
        success: result.success,
        // result.failures.row = index baris data (1-based) → nomor baris CSV = index + 2 (header di baris 1).
        failures: result.failures.map((f) => ({ row: f.row + 1, label: f.nama, message: f.message })),
      };
    } catch (err) {
      throw new Error(err instanceof ApiClientError ? err.message : "Gagal membaca file. Pastikan file CSV supplier valid.");
    }
  };

  const exportData = async () => {
    try {
      const result = await listSupplier({ page: 1, pageSize: 100, search });
      downloadSupplierCsv(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export data supplier.");
    }
  };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, totalPages]);

  const rangeStart = total === 0 ? 0 : (page - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(page * itemsPerPage, total);
  const activeCount = items.filter((s) => s.isActive).length;
  const ringStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="supplier" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl mb-1" style={{ color: '#000000' }}>Supplier</h1>
              <p style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data vendor dan pemasok produk
              </p>
            </div>

            {selected.size > 0 ? (
              <div className="flex items-center gap-3">
                <span style={{ color: '#1a0408' }}>{selected.size} supplier dipilih</span>
                <button onClick={() => void bulkSetActive(true)} disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#27b446' }}>Aktifkan</button>
                <button onClick={() => void bulkSetActive(false)} disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#e40b18' }}>Nonaktifkan</button>
                <button onClick={() => setSelected(new Set())}
                  className="px-4 py-2 rounded-lg border transition-colors hover:bg-red-50" style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
              </div>
            ) : (
              <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
                className="px-4 py-3 rounded-lg text-white transition-opacity hover:opacity-90 flex items-center gap-2"
                style={{ backgroundColor: '#27b446' }}>
                <Plus className="w-5 h-5" />
                Tambah Supplier
              </button>
            )}
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(39,180,70,0.1)' }}>
                <Building2 className="w-4 h-4" style={{ color: '#27b446' }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#1a0408', opacity: 0.55 }}>Total Supplier</p>
                <p className="text-sm font-medium" style={{ color: '#000000' }}>{total}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(39,180,70,0.1)' }}>
                <Truck className="w-4 h-4" style={{ color: '#27b446' }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: '#1a0408', opacity: 0.55 }}>Aktif</p>
                <p className="text-sm font-medium" style={{ color: '#27b446' }}>{activeCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search + aksi data */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input type="text" placeholder="Cari berdasarkan ID, nama, kota, atau telepon..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={ringStyle} />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button onClick={() => void exportData()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-opacity hover:opacity-90 text-sm"
              style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
              title="Export seluruh data supplier (CSV)">
              <Download className="w-4 h-4" />
              Export Data
            </button>
            <button onClick={() => setShowBulk(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-opacity hover:opacity-90 text-sm"
              style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
              title="Bulk upload supplier dari CSV">
              <Upload className="w-4 h-4" />
              Bulk Upload
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data supplier...</p></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button onClick={handleSelectAll} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                            {items.length > 0 && items.every((s) => selected.has(s.id)) ? <CheckCircle className="w-5 h-5" /> : <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kode")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kode {getSortIcon("kode")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("nama")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Nama Supplier {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Alamat</th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kota")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kota {getSortIcon("kota")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kontak</th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Bank</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-16 text-center">
                            <Building2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.2 }} />
                            <p style={{ color: '#1a0408', opacity: 0.5 }}>
                              {search ? "Tidak ada supplier ditemukan" : "Belum ada data supplier"}
                            </p>
                            {!search && (
                              <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
                                className="mt-3 px-4 py-2 rounded-lg text-white text-sm hover:opacity-90"
                                style={{ backgroundColor: '#27b446' }}>
                                Tambah Supplier Pertama
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : items.map((s, index) => (
                        <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => { setFormError(""); setEditing(s); setForm(toForm(s)); }}
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleSelect(s.id, !selected.has(s.id))} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                              {selected.has(s.id) ? <CheckCircle className="w-5 h-5" /> : <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />}
                            </button>
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408', fontFamily: 'monospace' }}>{s.kode}</td>
                          <td className="px-6 py-4">
                            <p className="font-medium" style={{ color: '#000000' }}>{s.nama}</p>
                            {s.kontak && (
                              <p className="text-xs mt-0.5" style={{ color: '#1a0408', opacity: 0.55 }}>PIC: {s.kontak}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm" style={{ color: '#1a0408' }}>
                            {s.alamat || <span style={{ opacity: 0.3 }}>-</span>}
                          </td>
                          <td className="px-6 py-4">
                            <p style={{ color: '#1a0408' }}>{s.kota || <span style={{ opacity: 0.3 }}>-</span>}</p>
                            {s.provinsi && (
                              <p className="text-xs mt-0.5" style={{ color: '#1a0408', opacity: 0.55 }}>{s.provinsi}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {s.telepon && <p className="text-sm" style={{ color: '#1a0408' }}>{s.telepon}</p>}
                            {s.email && <p className="text-xs mt-0.5" style={{ color: '#27b446' }}>{s.email}</p>}
                            {!s.telepon && !s.email && <span style={{ color: '#1a0408', opacity: 0.3 }}>-</span>}
                          </td>
                          <td className="px-6 py-4">
                            {s.bank ? (
                              <div>
                                <p className="text-sm" style={{ color: '#1a0408' }}>{s.bank}</p>
                                {s.norek && (
                                  <p className="text-xs mt-0.5" style={{ color: '#1a0408', opacity: 0.55, fontFamily: 'monospace' }}>{s.norek}</p>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#1a0408', opacity: 0.3 }}>-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-sm"
                              style={{
                                backgroundColor: s.isActive ? 'rgba(39,180,70,0.1)' : 'rgba(228,11,24,0.1)',
                                color: s.isActive ? '#27b446' : '#e40b18',
                              }}>
                              {s.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); setFormError(""); setEditing(s); setForm(toForm(s)); }}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#27b446' }} title="Edit Supplier">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setDeleting(s); }}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                style={{ color: '#e40b18' }} title="Hapus Supplier">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {items.length > 0 && (
                  <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                      <div className="relative">
                        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                          className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                          style={ringStyle}>
                          <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                      </div>
                      <span style={{ color: '#1a0408', opacity: 0.7 }}>Menampilkan {rangeStart} - {rangeEnd} dari {total} supplier</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex gap-1">
                        {pageNumbers.map((pn) => (
                          <button key={pn} onClick={() => setPage(pn)} className="w-10 h-10 rounded-lg transition-colors"
                            style={{ backgroundColor: page === pn ? '#27b446' : 'transparent', color: page === pn ? 'white' : '#1a0408', border: page === pn ? 'none' : '1px solid #e5e7eb' }}>
                            {pn}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors" style={{ color: '#1a0408' }}>
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <SupplierForm
          title="Tambah Supplier Baru"
          subtitle="Isi data pemasok (supplier) baru"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveCreate()}
          onClose={() => { setShowCreate(false); setForm(emptyForm); }}
          busy={busy}
          error={formError}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <SupplierForm
          title={`Edit Supplier — ${editing.kode}`}
          subtitle="Perbarui data supplier"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy}
          error={formError}
        />
      )}

      {/* Detail modal */}
      {viewing && !editing && (
        <DetailModal
          sup={viewing}
          onClose={() => setViewing(null)}
          onEdit={(s) => { setFormError(""); setEditing(s); setForm(toForm(s)); }}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: '#e40b18' }} />
              </div>
              <div>
                <h2 style={{ color: '#000000' }}>Konfirmasi Hapus Supplier</h2>
                <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <p style={{ color: '#1a0408' }}>
              Hapus supplier <span className="font-medium" style={{ color: '#000000' }}>{deleting.nama}</span> ({deleting.kode})?
            </p>
            <p className="mt-2 text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
              Data supplier yang sudah dihapus tidak dapat dikembalikan. Pertimbangkan untuk menonaktifkan jika supplier masih digunakan.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button onClick={() => setDeleting(null)}
              className="flex-1 py-3 rounded-lg border-2 hover:bg-red-50 transition-colors"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
            <button onClick={() => void confirmDelete()} disabled={busy}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#e40b18' }}>{busy ? "Menghapus..." : "Hapus"}</button>
          </div>
        </Modal>
      )}

      {/* Bulk Upload */}
      {showBulk && (
        <BulkUploadModal
          title="Upload Supplier Bulk"
          resultLabel="supplier"
          columns={["nama", "alamat", "kota", "provinsi", "negara", "kodepos", "telepon", "fax", "bank", "norek", "atasnama", "kontak", "email", "keterangan"]}
          formatNote="Baris pertama file adalah header. Hanya kolom 'nama' yang wajib diisi; kolom lain opsional (negara default 'Indonesia'). Alias yang dikenali: 'nama supplier' (nama), 'kode pos' (kodepos), 'no telepon' / 'phone' (telepon), 'no rekening' / 'no rek' (norek), 'atas nama' (atasnama), 'kontak person' / 'pic' (kontak), 'ket' (keterangan). Kolom opsional: Status (Aktif/Nonaktif, default Aktif)."
          sample={{
            headers: ["nama", "alamat", "kota", "provinsi", "negara", "kodepos", "telepon", "fax", "bank", "norek", "atasnama", "kontak", "email", "keterangan", "status"],
            rows: [
              ["PT Sumber Pangan", "Jl. Industri No. 5", "Palembang", "Sumatera Selatan", "Indonesia", "30111", "0711-123456", "", "BCA", "1234567890", "Budi Santoso", "Andi Wijaya", "andi@sumbepangan.co.id", "Supplier beras", "Aktif"],
              ["CV Maju Jaya", "Jl. Raya Sukarami No. 12", "Palembang", "Sumatera Selatan", "Indonesia", "30121", "081234567890", "", "Mandiri", "9876543210", "Sari Dewi", "Sari Dewi", "sari@majujaya.co.id", "Supplier minyak goreng", "Nonaktif"],
            ],
          }}
          sampleFilename="sample-supplier.csv"
          onFile={importFile}
          onDone={() => void load()}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
