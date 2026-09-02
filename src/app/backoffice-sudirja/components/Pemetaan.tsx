"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateOngkir, createOngkir, deleteOngkir, downloadOngkirCsv, listOngkir, updateOngkir,
} from "@/lib/ongkir-api";
import { parseCsv } from "./BulkUploadReference";
import type { CreateOngkirInput, OngkirDTO } from "@/lib/ongkir-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Plus, Edit, Trash2, MapPin, Download, Upload,
  CheckCircle
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
  subtitle: string;
  value: CreateOngkirInput;
  onChange: (v: CreateOngkirInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  kodeDisabled?: boolean;
}

function OngkirForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, kodeDisabled }: OngkirFormProps) {
  const set = (key: keyof CreateOngkirInput, next: unknown) => onChange({ ...value, [key]: next } as CreateOngkirInput);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      >
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
          <div className="space-y-4">
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Kode *</span>
              <input
                required value={value.kode} disabled={kodeDisabled}
                onChange={(e) => set("kode", e.target.value)}
                placeholder="cth: KCM001"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:cursor-not-allowed"
                style={{ color: '#1a0408', fontFamily: 'monospace', '--tw-ring-color': '#27b446' } as any}
              />
              {kodeDisabled && <p className="text-xs mt-1" style={{ color: '#1a0408', opacity: 0.5 }}>Kode tidak dapat diubah</p>}
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Kecamatan *</span>
              <input
                required value={value.kecamatan}
                onChange={(e) => set("kecamatan", e.target.value)}
                placeholder="cth: Bandung Wetan"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Ongkir (Rp) *</span>
              <input
                required type="number" min="0" value={value.ongkir || ""}
                onChange={(e) => set("ongkir", Number(e.target.value))}
                placeholder="cth: 15000"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Status</span>
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
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Simpan Data"}
          </button>
        </div>
      </form>
    </div>
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
  const [form, setForm] = useState<CreateOngkirInput>(emptyForm);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleSelectAll = () => {
    if (items.length > 0 && items.every((o) => selected.has(o.id))) setSelected(new Set());
    else setSelected(new Set(items.map((o) => o.id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const saveCreate = async () => {
    setBusy(true);
    try {
      await createOngkir(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan data ongkir.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
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
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan data ongkir.");
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
        kode: value(row, "kode", "id", "kode kecamatan"),
        kecamatan: value(row, "kecamatan", "nama kecamatan"),
        ongkir: Number(value(row, "ongkir", "biaya", "harga")) || 0,
      }));
      const result = await bulkCreateOngkir(payload);
      alert(`Berhasil: ${result.success}, gagal: ${result.failures.length}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "CSV pemetaan ongkir tidak valid.");
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

            {selected.size > 0 ? (
              <div className="flex items-center gap-3">
                <span style={{ color: '#1a0408' }}>{selected.size} data dipilih</span>
                <button onClick={() => void bulkSetActive(true)} disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#27b446' }}>
                  Aktifkan
                </button>
                <button onClick={() => void bulkSetActive(false)} disabled={busy}
                  className="px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#e40b18' }}>
                  Nonaktifkan
                </button>
              </div>
            ) : (
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

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari kode atau kecamatan..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
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
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pemetaan & ongkir...</p>
              </div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button onClick={handleSelectAll} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                            {items.length > 0 && items.every((o) => selected.has(o.id)) ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />
                            )}
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
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => handleSelect(item.id, !selected.has(item.id))}
                              className="flex items-center justify-center" style={{ color: '#27b446' }}>
                              {selected.has(item.id) ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4" style={{ color: '#27b446', fontFamily: 'monospace' }}>{item.id}</td>
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
                          <td className="px-6 py-4 text-right font-medium" style={{ color: '#000000' }}>{formatRp(item.ongkir)}</td>
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
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setEditing(item);
                                  setForm({ kode: item.kode, kecamatan: item.kecamatan, ongkir: item.ongkir, isActive: item.isActive });
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleting(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                                style={{ borderColor: '#e40b18', color: '#e40b18', backgroundColor: 'rgba(228, 11, 24, 0.05)' }}
                              >
                                <Trash2 className="w-4 h-4" />
                                Hapus
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
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <MapPin className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Data ongkir tidak ditemukan</p>
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
        <OngkirForm
          title="Tambah Data Pemetaan & Ongkir"
          subtitle="Isi data kecamatan dan biaya ongkir"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveCreate()}
          onClose={() => { setShowCreate(false); setForm(emptyForm); }}
          busy={busy}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <OngkirForm
          title={`Edit Data — ${editing.kode}`}
          subtitle="Perbarui data kecamatan dan biaya ongkir"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy}
          kodeDisabled
        />
      )}

      {/* Delete confirm modal */}
      {deleting && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 style={{ color: '#000000' }}>Hapus Data Ongkir</h2>
            </div>
            <div className="px-6 py-4">
              <p style={{ color: '#1a0408' }}>
                Yakin ingin menghapus <strong>{deleting.kecamatan}</strong> ({deleting.kode})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button onClick={() => setDeleting(null)}
                className="flex-1 py-3 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#e5e7eb', color: '#1a0408' }}>
                Batal
              </button>
              <button onClick={() => void confirmDelete()} disabled={busy}
                className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#e40b18' }}>
                {busy ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
