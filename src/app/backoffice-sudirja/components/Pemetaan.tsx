"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateOngkir, createOngkir, deleteOngkir, downloadOngkirCsv, listOngkir, updateOngkir,
} from "@/lib/ongkir-api";
import { parseCsv, statusToIsActive, STATUS_HEADER_ALIASES } from "./BulkUploadReference";
import BulkUploadModal, { type BulkUploadOutcome } from "./BulkUploadModal";
import type { CreateOngkirInput, OngkirDTO } from "@/lib/ongkir-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Edit, Trash2, MapPin, Download, Upload,
  CheckCircle, CheckSquare, Square, AlertTriangle
} from "lucide-react";

type SortField = "id" | "kode" | "kecamatan" | "ongkir";
type SortDirection = "asc" | "desc" | null;

const emptyForm: CreateOngkirInput = { kode: "", kecamatan: "", ongkir: 0, isActive: true };

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ---------------------------------------------------------------------------
// Ongkir Form Modal (create & edit)
// ---------------------------------------------------------------------------

interface OngkirFormProps {
  title: string;
  subtitle?: string;
  value: CreateOngkirInput;
  onChange: (v: CreateOngkirInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  kodeDisabled?: boolean;
  error?: string;
}

function OngkirForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, kodeDisabled, error }: OngkirFormProps) {
  const set = (key: keyof CreateOngkirInput, next: unknown) => onChange({ ...value, [key]: next } as CreateOngkirInput);

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: '#27b446' }}>{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="space-y-4">
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>ID <span style={{ color: '#e40b18' }}>*</span></label>
              {kodeDisabled ? (
                <>
                  <div className="px-4 py-3 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb', color: '#1a0408', opacity: 0.7 }}>
                    {value.kode}
                  </div>
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>ID tidak dapat diubah</p>
                </>
              ) : (
                <>
                  <input
                    value={value.kode}
                    onChange={(e) => set("kode", e.target.value)}
                    placeholder="Contoh: PM019"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                    style={{ color: '#1a0408', textTransform: 'uppercase', '--tw-ring-color': '#27b446' } as any}
                  />
                  <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>ID harus unik dan belum pernah digunakan</p>
                </>
              )}
            </div>
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>Kecamatan <span style={{ color: '#e40b18' }}>*</span></label>
              <input
                value={value.kecamatan}
                onChange={(e) => set("kecamatan", e.target.value)}
                placeholder="Contoh: Arcamanik"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
            </div>
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>Ongkir (Rp) <span style={{ color: '#e40b18' }}>*</span></label>
              <input
                type="number" min="0" value={value.ongkir || ""}
                onChange={(e) => set("ongkir", Number(e.target.value))}
                placeholder="Contoh: 20000"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
            </div>
            <div>
              <label className="block mb-2" style={{ color: '#000000' }}>Status</label>
              <button
                type="button"
                onClick={() => set("isActive", !value.isActive)}
                className="w-full px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2"
                style={{
                  borderColor: '#27b446',
                  color: value.isActive ? '#27b446' : '#e40b18',
                  backgroundColor: value.isActive ? 'rgba(39, 180, 70, 0.05)' : '#fee2e2'
                }}
              >
                {value.isActive ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {value.isActive ? "Aktif" : "Nonaktif"}
              </button>
            </div>
            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                <p className="text-sm">⚠ {error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Simpan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Single Delete Confirm Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  item: OngkirDTO;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ item, busy, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(228,11,24,0.1)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#e40b18' }} />
        </div>
        <h2 style={{ color: '#000000' }}>Konfirmasi Hapus</h2>
      </div>
      <div className="px-6 py-4">
        <p style={{ color: '#1a0408' }}>
          Hapus data pemetaan <span className="font-semibold" style={{ color: '#000000' }}>{item.kecamatan}</span> ({item.kode})?
        </p>
        <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>Tindakan ini tidak dapat dibatalkan.</p>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>
          Batal
        </button>
        <button onClick={onConfirm} disabled={busy}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#e40b18' }}>
          {busy ? "Menghapus..." : "Ya, Hapus"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Bulk Delete Confirm Modal
// ---------------------------------------------------------------------------

interface BulkDeleteConfirmModalProps {
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function BulkDeleteConfirmModal({ count, busy, onClose, onConfirm }: BulkDeleteConfirmModalProps) {
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(228,11,24,0.1)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#e40b18' }} />
        </div>
        <h2 style={{ color: '#000000' }}>Konfirmasi Hapus Massal</h2>
      </div>
      <div className="px-6 py-4">
        <p style={{ color: '#1a0408' }}>
          Hapus <span className="font-semibold" style={{ color: '#000000' }}>{count} data</span> pemetaan yang dipilih?
        </p>
        <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>Tindakan ini tidak dapat dibatalkan.</p>
      </div>
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>
          Batal
        </button>
        <button onClick={onConfirm} disabled={busy}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#e40b18' }}>
          {busy ? "Menghapus..." : `Ya, Hapus ${count} Data`}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pemetaan main page
// ---------------------------------------------------------------------------

export default function Pemetaan() {
  const [items, setItems] = useState<OngkirDTO[]>([]);
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
  const [editing, setEditing] = useState<OngkirDTO | null>(null);
  const [deleting, setDeleting] = useState<OngkirDTO | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [form, setForm] = useState<CreateOngkirInput>(emptyForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listOngkir({
        page, pageSize: itemsPerPage, search,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data pemetaan & ongkir.");
    } finally {
      setLoading(false);
    }
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

  const allPageSelected = items.length > 0 && items.every((o) => selected.has(o.id));

  const handleSelectAll = () => {
    if (allPageSelected) setSelected(new Set());
    else setSelected(new Set(items.map((o) => o.id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const saveCreate = async () => {
    setFormError("");
    setBusy(true);
    try {
      await createOngkir(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan data ongkir.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setFormError("");
    setBusy(true);
    try {
      await updateOngkir(editing.kode, {
        kecamatan: form.kecamatan,
        ongkir: form.ongkir,
        isActive: form.isActive,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan data ongkir.");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteOngkir(deleting.kode);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus data ongkir.");
    } finally { setBusy(false); }
  };

  const confirmBulkDelete = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const kodes = items.filter((o) => selected.has(o.id)).map((o) => o.kode);
      const results = await Promise.allSettled(kodes.map((kode) => deleteOngkir(kode)));
      const failed = results.filter((r) => r.status === "rejected").length;
      setShowBulkDeleteConfirm(false);
      setSelected(new Set());
      await load();
      if (failed > 0) setError(`Gagal menghapus ${failed} dari ${kodes.length} data ongkir.`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus data ongkir terpilih.");
    } finally { setBusy(false); }
  };

  const bulkSetActive = async (active: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => {
        const item = items.find((o) => o.id === id);
        return item ? updateOngkir(item.kode, { isActive: active }) : Promise.resolve(null);
      }));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status data terpilih.");
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
          kode: value(row, "kode", "id", "kode kecamatan"),
          kecamatan: value(row, "kecamatan", "nama kecamatan"),
          ongkir: Number(value(row, "ongkir", "biaya", "harga")) || 0,
          ...(isActive === undefined ? {} : { isActive }),
        };
      });
      const result = await bulkCreateOngkir(payload);
      return {
        success: result.success,
        // result.failures.row = index baris data (1-based) → nomor baris CSV = index + 2 (header di baris 1).
        failures: result.failures.map((f) => ({ row: f.row + 1, label: f.kode, message: f.message })),
      };
    } catch (err) {
      throw new Error(err instanceof ApiClientError ? err.message : "Gagal membaca file. Pastikan file CSV pemetaan ongkir valid.");
    }
  };

  const exportData = async () => {
    try {
      const result = await listOngkir({ page: 1, pageSize: 100, search });
      downloadOngkirCsv(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export data ongkir.");
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
  const hasActiveFilters = !!search;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pemetaan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pemetaan & Ongkir</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola pemetaan kecamatan dan biaya ongkos kirim
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => void exportData()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                title="Export seluruh data ongkir (CSV)">
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
                      <button onClick={() => { setForm(emptyForm); setShowAddMenu(false); setFormError(""); setShowCreate(true); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}>
                        <Edit className="w-5 h-5" style={{ color: '#27b446' }} />
                        <div>
                          <p style={{ color: '#000000' }}>Manual</p>
                          <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p>
                        </div>
                      </button>
                      <button onClick={() => { setShowAddMenu(false); setShowBulk(true); }}
                        className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200"
                        style={{ color: '#1a0408' }}>
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
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                <input
                  type="text"
                  placeholder="Cari kode atau kecamatan..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                  style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: '#e40b18', color: '#e40b18' }}
              >
                <X className="w-4 h-4" />
                Hapus Filter
              </button>
            )}
          </div>
          <div className="mt-4">
            <p style={{ color: '#1a0408', opacity: 0.6 }}>
              Menampilkan {items.length} dari {total} data
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-lg border-2" style={{ borderColor: '#e40b18', backgroundColor: 'rgba(228,11,24,0.04)' }}>
              <span className="text-sm" style={{ color: '#1a0408' }}>
                {selected.size} data dipilih
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => void bulkSetActive(true)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#27b446' }}
                >
                  Aktifkan
                </button>
                <button
                  onClick={() => void bulkSetActive(false)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#e40b18' }}
                >
                  Nonaktifkan
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#e40b18' }}
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selected.size})
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-4 py-2 rounded-lg border transition-colors hover:bg-red-50"
                  style={{ borderColor: '#e40b18', color: '#e40b18' }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pemetaan & ongkir...</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <tr>
                        <th className="px-4 py-4 w-10">
                          <button onClick={handleSelectAll} className="flex items-center justify-center"
                            style={{ color: allPageSelected ? '#27b446' : '#9ca3af' }}
                            title={allPageSelected ? "Batalkan pilihan" : "Pilih semua"}>
                            {allPageSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("id")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            ID
                            {getSortIcon("id")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kode")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kode
                            {getSortIcon("kode")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kecamatan")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kecamatan
                            {getSortIcon("kecamatan")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-right">
                          <button onClick={() => handleSort("ongkir")} className="flex items-center gap-2 ml-auto hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Ongkir
                            {getSortIcon("ongkir")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000', width: 90 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center" style={{ color: '#1a0408', opacity: 0.4 }}>
                            {hasActiveFilters ? "Tidak ada data yang sesuai dengan filter" : "Belum ada data"}
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-200 transition-colors hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <button onClick={() => handleSelect(item.id, !selected.has(item.id))}
                                className="flex items-center justify-center"
                                style={{ color: selected.has(item.id) ? '#27b446' : '#9ca3af' }}
                                title={selected.has(item.id) ? "Batalkan pilihan" : "Pilih data"}>
                                {selected.has(item.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-6 py-4" style={{ color: '#27b446' }}>{item.id}</td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 rounded-lg text-sm" style={{ backgroundColor: '#f3f4f6', fontFamily: 'monospace', color: '#1a0408' }}>
                                {item.kode}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2" style={{ color: '#1a0408' }}>
                                <MapPin className="w-4 h-4" style={{ color: '#27b446' }} />
                                {item.kecamatan}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right" style={{ color: '#000000' }}>{formatRp(item.ongkir)}</td>
                            <td className="px-6 py-4 text-center">
                              {item.isActive ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                                  style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                                  <CheckCircle className="w-4 h-4" />
                                  Aktif
                                </span>
                              ) : (
                                <span className="inline-flex px-3 py-1 rounded-full text-sm"
                                  style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                                  Nonaktif
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setFormError("");
                                    setEditing(item);
                                    setForm({ kode: item.kode, kecamatan: item.kecamatan, ongkir: item.ongkir, isActive: item.isActive });
                                  }}
                                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                  style={{ color: '#27b446' }}
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleting(item)}
                                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                  style={{ color: '#e40b18' }}
                                  title="Hapus"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
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
                          style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}>
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                      </div>
                      <span style={{ color: '#1a0408', opacity: 0.7 }}>
                        Menampilkan {rangeStart} - {rangeEnd} dari {total} data
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}>
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="flex gap-1">
                        {pageNumbers.map((pageNum) => (
                          <button key={pageNum} onClick={() => setPage(pageNum)} className="w-10 h-10 rounded-lg transition-colors"
                            style={{
                              backgroundColor: page === pageNum ? '#27b446' : 'transparent',
                              color: page === pageNum ? 'white' : '#1a0408',
                              border: page === pageNum ? 'none' : '1px solid #e5e7eb'
                            }}>
                            {pageNum}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                        style={{ color: '#1a0408' }}>
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
        <OngkirForm
          title="Tambah Data Pemetaan & Ongkir"
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
        <OngkirForm
          title="Edit Data Pemetaan & Ongkir"
          subtitle={editing.kode}
          value={form}
          onChange={setForm}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy}
          kodeDisabled
          error={formError}
        />
      )}

      {/* Single delete confirm modal */}
      {deleting && (
        <DeleteConfirmModal
          item={deleting}
          busy={busy}
          onClose={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      {/* Bulk delete confirm modal */}
      {showBulkDeleteConfirm && (
        <BulkDeleteConfirmModal
          count={selected.size}
          busy={busy}
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => void confirmBulkDelete()}
        />
      )}

      {/* Bulk Upload */}
      {showBulk && (
        <BulkUploadModal
          title="Upload Pemetaan & Ongkir Bulk"
          resultLabel="ongkir"
          columns={["kode", "kecamatan", "ongkir"]}
          formatNote="Baris pertama file adalah header. Kolom 'ongkir' harus angka rupiah (tanpa titik/Rp). Alias yang dikenali: 'id' / 'kode kecamatan' (kode), 'nama kecamatan' (kecamatan), 'biaya' / 'harga' (ongkir). Kolom opsional: Status (Aktif/Nonaktif, default Aktif)."
          sample={{
            headers: ["kode", "kecamatan", "ongkir", "status"],
            rows: [
              ["327101", "Sukarami", "10000", "Aktif"],
              ["327102", "Ilir Barat I", "12000", "Nonaktif"],
            ],
          }}
          sampleFilename="sample-ongkir.csv"
          onFile={importFile}
          onDone={() => void load()}
          onClose={() => setShowBulk(false)}
        />
      )}
    </div>
  );
}
