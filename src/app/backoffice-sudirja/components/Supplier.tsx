"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateSupplier, createSupplier, deleteSupplier, downloadSupplierCsv,
  listSupplier, updateSupplier,
} from "@/lib/supplier-api";
import { parseCsv } from "./BulkUploadReference";
import type { CreateSupplierInput, SupplierDTO } from "@/lib/supplier-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Download, Upload,
  Edit, Trash2, CheckCircle, Phone, Mail, Building2, MapPin, Banknote
} from "lucide-react";

type SortField = "id" | "kode" | "nama" | "kota" | "created_at";
type SortDirection = "asc" | "desc" | null;

const emptyForm: CreateSupplierInput = {
  nama: "", alamat: "", kota: "", provinsi: "", negara: "Indonesia", kodepos: "",
  telepon: "", fax: "", bank: "", norek: "", atasnama: "", kontak: "", email: "",
  keterangan: "", isActive: true,
};

// Field form utk create/edit (14 kolom sesuai format supplier).
const FIELD_LABELS: Record<string, string> = {
  nama: "Nama Supplier",
  alamat: "Alamat",
  kota: "Kota",
  provinsi: "Provinsi",
  negara: "Negara",
  kodepos: "Kode Pos",
  telepon: "Telepon",
  fax: "Fax",
  bank: "Bank",
  norek: "No. Rekening",
  atasnama: "Atas Nama",
  kontak: "Kontak (PIC)",
  email: "Email",
  keterangan: "Keterangan",
};

// ---------------------------------------------------------------------------
// Form Modal (create & edit) — form grid 2 kolom utk semua field
// ---------------------------------------------------------------------------

interface SupplierFormProps {
  title: string;
  subtitle: string;
  value: CreateSupplierInput;
  onChange: (v: CreateSupplierInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
}

function SupplierForm({ title, subtitle, value, onChange, onSubmit, onClose, busy }: SupplierFormProps) {
  const set = (key: keyof CreateSupplierInput, next: unknown) => onChange({ ...value, [key]: next } as CreateSupplierInput);
  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as any;

  const renderField = (key: keyof CreateSupplierInput, required = false, full = false) => (
    <label key={key} className={full ? "col-span-2" : ""}>
      <span className="block mb-1 text-sm" style={{ color: '#000000' }}>
        {FIELD_LABELS[key] ?? key} {required && <span style={{ color: '#e40b18' }}>*</span>}
      </span>
      {key === "alamat" || key === "keterangan" ? (
        <textarea value={(value[key] as string) ?? ""} onChange={(e) => set(key, e.target.value)} rows={key === "alamat" ? 2 : 2}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
          style={inputStyle} />
      ) : key === "kodepos" || key === "telepon" || key === "fax" || key === "norek" ? (
        <input value={(value[key] as string) ?? ""} onChange={(e) => set(key, e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 font-mono"
          style={inputStyle} />
      ) : (
        <input value={(value[key] as string) ?? ""} onChange={(e) => set(key, e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
          style={inputStyle} />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            {renderField("nama", true, true)}
            {renderField("alamat", false, true)}
            {renderField("kota")}
            {renderField("provinsi")}
            {renderField("negara")}
            {renderField("kodepos")}
            {renderField("telepon")}
            {renderField("fax")}
            {renderField("bank")}
            {renderField("norek")}
            {renderField("atasnama", false, true)}
            {renderField("kontak")}
            {renderField("email")}
            {renderField("keterangan", false, true)}

            {/* Status */}
            <label className="col-span-2">
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Status</span>
              <button type="button" onClick={() => set("isActive", !value.isActive)}
                className="w-full px-4 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-2"
                style={{
                  borderColor: '#27b446',
                  color: value.isActive ? '#27b446' : '#e40b18',
                  backgroundColor: value.isActive ? 'rgba(39, 180, 70, 0.05)' : '#fee2e2'
                }}>
                {value.isActive ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {value.isActive ? "Aktif" : "Nonaktif"}
              </button>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border transition-colors" style={{ borderColor: '#1a0408', color: '#1a0408' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="px-6 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Tambah Supplier"}
          </button>
        </div>
      </form>
    </div>
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
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
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
                <span className="inline-flex px-3 py-1 rounded-full text-sm mt-1" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Nonaktif</span>
              )}
            </div>
            <button onClick={() => onEdit(sup)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}>
              <Edit className="w-4 h-4" /> Edit
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
          <button onClick={onClose} className="w-full py-3 rounded-lg border transition-colors"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>Tutup</button>
        </div>
      </div>
    </div>
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [viewing, setViewing] = useState<SupplierDTO | null>(null);
  const [deleting, setDeleting] = useState<SupplierDTO | null>(null);
  const [form, setForm] = useState<CreateSupplierInput>(emptyForm);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
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
    setBusy(true);
    try {
      await createSupplier(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan supplier.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
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
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan supplier.");
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

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = parseCsv(await file.text());
      const header = rows[0].map((x) => x.trim().toLowerCase());
      const value = (row: string[], ...names: string[]) => {
        const index = names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        return index >= 0 ? row[index] ?? "" : "";
      };
      const payload = rows.slice(1).map((row) => ({
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
      }));
      const result = await bulkCreateSupplier(payload);
      alert(`Berhasil: ${result.success}, gagal: ${result.failures.length}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "CSV supplier tidak valid.");
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

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="supplier" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Supplier</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data pemasok (supplier) barang
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
                  className="px-4 py-2 rounded-lg border transition-colors" style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>Batal</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => void exportData()}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                  style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                  title="Export seluruh data supplier (CSV)">
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
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          style={{ color: '#1a0408' }}>
                          <Edit className="w-5 h-5" style={{ color: '#27b446' }} />
                          <div>
                            <p style={{ color: '#000000' }}>Manual</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p>
                          </div>
                        </button>
                        <button onClick={() => { setShowAddMenu(false); fileRef.current?.click(); }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200"
                          style={{ color: '#1a0408' }}>
                          <Upload className="w-5 h-5" style={{ color: '#27b446' }} />
                          <div>
                            <p style={{ color: '#000000' }}>Bulk Upload</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>CSV atau XLSX</p>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileRef} hidden type="file" accept=".csv" onChange={importCsv} />
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input type="text" placeholder="Cari kode, nama, kota, atau telepon..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any} />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
            ) : items.length > 0 ? (
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
                            Nama {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Alamat</th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kota")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kota {getSortIcon("kota")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kontak</th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Rekening</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s, index) => (
                        <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => handleSelect(s.id, !selected.has(s.id))} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                              {selected.has(s.id) ? <CheckCircle className="w-5 h-5" /> : <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />}
                            </button>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#27b446', fontFamily: 'monospace' }}>{s.kode}</td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#1a0408' }}>
                            <div className="flex items-center gap-2"><Building2 className="w-4 h-4 shrink-0" style={{ color: '#27b446' }} />{s.nama}</div>
                          </td>
                          <td className="px-6 py-4 text-sm cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#1a0408' }}>{s.alamat || <span style={{ opacity: 0.4 }}>—</span>}</td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#1a0408' }}>
                            {s.kota || <span style={{ opacity: 0.4 }}>—</span>}
                            {s.provinsi && <div style={{ opacity: 0.5, fontSize: '0.8rem' }}>{s.provinsi}</div>}
                          </td>
                          <td className="px-6 py-4 text-sm cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#1a0408' }}>
                            {s.kontak && <div>{s.kontak}</div>}
                            {(s.telepon || s.email) && <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>{s.telepon || s.email}</div>}
                            {!s.kontak && !s.telepon && !s.email && <span style={{ opacity: 0.4 }}>—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm cursor-pointer" onClick={() => setViewing(s)} style={{ color: '#1a0408' }}>
                            {s.bank ? <div>{s.bank}</div> : <span style={{ opacity: 0.4 }}>—</span>}
                            {s.norek && <div style={{ opacity: 0.6, fontSize: '0.8rem', fontFamily: 'monospace' }}>{s.norek}</div>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {s.isActive ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                                style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                                <CheckCircle className="w-4 h-4" /> Aktif
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Nonaktif</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => { setEditing(s); setForm(toForm(s)); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                                <Edit className="w-4 h-4" /> Edit
                              </button>
                              <button onClick={() => setDeleting(s)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                                style={{ borderColor: '#e40b18', color: '#e40b18', backgroundColor: 'rgba(228, 11, 24, 0.05)' }}>
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
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Tampilkan</span>
                    <div className="relative">
                      <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                        style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
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
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Building2 className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Supplier tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>Coba gunakan kata kunci pencarian yang berbeda</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <SupplierForm
          title="Tambah Supplier"
          subtitle="Isi data pemasok (supplier) baru"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveCreate()}
          onClose={() => { setShowCreate(false); setForm(emptyForm); }}
          busy={busy}
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
        />
      )}

      {/* Detail modal */}
      {viewing && !editing && (
        <DetailModal
          sup={viewing}
          onClose={() => setViewing(null)}
          onEdit={(s) => { setEditing(s); setForm(toForm(s)); }}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200"><h2 style={{ color: '#000000' }}>Hapus Supplier</h2></div>
            <div className="px-6 py-4">
              <p style={{ color: '#1a0408' }}>
                Yakin ingin menghapus <strong>{deleting.nama}</strong> ({deleting.kode})?
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={() => setDeleting(null)} className="flex-1 py-3 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>Batal</button>
              <button onClick={() => void confirmDelete()} disabled={busy}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#e40b18' }}>{busy ? "Menghapus..." : "Hapus"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
