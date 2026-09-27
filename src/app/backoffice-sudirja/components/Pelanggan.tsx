"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreatePelanggan, createPelanggan, deletePelanggan, downloadPelangganCsv,
  listPelanggan, updatePelanggan,
} from "@/lib/pelanggan-api";
import { parseCsv } from "./BulkUploadReference";
import type { CreatePelangganInput, PelangganDTO } from "@/lib/pelanggan-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Users, Plus, Download, Upload,
  Edit, Trash2, CheckCircle, Phone, Mail, MapPin, ShoppingBag,
  Calendar, CheckSquare, Square, AlertTriangle, UserCheck, UserX
} from "lucide-react";
import { fmtWib } from "@/lib/date-utils";

type SortField = "id" | "kode" | "nama" | "kecamatan" | "created_at";
type SortDirection = "asc" | "desc" | null;

const emptyForm: CreatePelangganInput = {
  nama: "", email: "", telepon: "", alamat: "", kecamatan: "", isMember: false, isActive: true,
};

/** Gaya input dengan focus ring hijau (dipakai bersama). */
const focusRingStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as React.CSSProperties;

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// ---------------------------------------------------------------------------
// Form Modal (create & edit)
// ---------------------------------------------------------------------------

interface PelangganFormProps {
  title: string;
  subtitle: string;
  value: CreatePelangganInput;
  onChange: (v: CreatePelangganInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
}

function PelangganForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, error }: PelangganFormProps) {
  const set = (key: keyof CreatePelangganInput, next: unknown) => onChange({ ...value, [key]: next } as CreatePelangganInput);
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 min-h-0">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="col-span-2">
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Nama Pelanggan *</span>
              <input value={value.nama} onChange={(e) => set("nama", e.target.value)}
                placeholder="cth: Ahmad Hidayat"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Email</span>
              <input type="email" value={value.email ?? ""} onChange={(e) => set("email", e.target.value)}
                placeholder="cth: nama@email.com"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Telepon</span>
              <input value={value.telepon ?? ""} onChange={(e) => set("telepon", e.target.value)}
                placeholder="cth: 081234567890"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
            </label>
            <label className="col-span-2">
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Alamat</span>
              <textarea value={value.alamat ?? ""} onChange={(e) => set("alamat", e.target.value)} rows={2}
                placeholder="cth: Jl. Merdeka No. 123, RT 01/RW 05"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Kecamatan</span>
              <input value={value.kecamatan ?? ""} onChange={(e) => set("kecamatan", e.target.value)}
                placeholder="cth: Ciputat"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
            </label>
            <label>
              <span className="block mb-1 text-sm" style={{ color: '#000000' }}>Keanggotaan</span>
              <button type="button" onClick={() => set("isMember", !value.isMember)}
                className="w-full px-4 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-2"
                style={{
                  borderColor: '#27b446',
                  color: value.isMember ? '#27b446' : '#1a0408',
                  backgroundColor: value.isMember ? 'rgba(39, 180, 70, 0.05)' : '#f9fafb'
                }}>
                {value.isMember ? <CheckCircle className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                {value.isMember ? "Member" : "Reguler"}
              </button>
            </label>
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
            className="px-4 py-2 rounded-lg border transition-colors hover:bg-red-50" style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="px-6 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Tambah Pelanggan"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

interface DetailModalProps {
  pelanggan: PelangganDTO;
  onClose: () => void;
  onEdit: (p: PelangganDTO) => void;
  onToggleMember: (p: PelangganDTO) => void;
  busy: boolean;
}

function DetailModal({ pelanggan, onClose, onEdit, onToggleMember, busy }: DetailModalProps) {
  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Detail Pelanggan</h2>
          <p style={{ color: '#27b446', fontFamily: 'monospace' }}>{pelanggan.kode}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
        {/* Informasi Pelanggan */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: '#000000' }}>Informasi Pelanggan</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(pelanggan)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: '#27b446', color: '#27b446' }}>
                <Edit className="w-4 h-4" />
                Edit
              </button>
              {pelanggan.isMember ? (
                <button onClick={() => onToggleMember(pelanggan)} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-50"
                  style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                  <X className="w-4 h-4" />
                  Lepas Membership
                </button>
              ) : (
                <button onClick={() => onToggleMember(pelanggan)} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#27b446' }}>
                  <CheckCircle className="w-4 h-4" />
                  Set Sebagai Member
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Nama Lengkap</p>
                </div>
                <p style={{ color: '#000000' }}>{pelanggan.nama}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Email</p>
                </div>
                <p style={{ color: '#000000' }}>{pelanggan.email || "—"}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Nomor Telepon</p>
                </div>
                <p style={{ color: '#000000' }}>{pelanggan.telepon || "—"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Alamat Lengkap</p>
                </div>
                <p style={{ color: '#000000' }}>{pelanggan.alamat || "—"}</p>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Kec. {pelanggan.kecamatan || "-"}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Tanggal Daftar</p>
                </div>
                <p style={{ color: '#000000' }}>{fmtWib(pelanggan.createdAt, "dd MMMM yyyy")}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4" style={{ color: '#27b446' }} />
                  <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Status</p>
                </div>
                <div className="flex items-center gap-2">
                  {pelanggan.isMember ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                      <CheckCircle className="w-4 h-4" /> Member
                    </span>
                  ) : (
                    <span className="inline-flex px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>Reguler</span>
                  )}
                  {pelanggan.isActive ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                      <CheckCircle className="w-4 h-4" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Nonaktif</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistik Pembelian */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="w-5 h-5" style={{ color: '#27b446' }} />
            <h3 style={{ color: '#000000' }}>Statistik Pembelian</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Transaksi</p>
              <p className="text-2xl" style={{ color: '#27b446' }}>{pelanggan.totalTransaksi ?? 0}</p>
            </div>
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Total Belanja</p>
              <p className="text-2xl" style={{ color: '#27b446' }}>{formatRp(pelanggan.totalBelanja ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200">
        <button onClick={onClose} className="w-full py-3 rounded-lg border transition-colors"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}>
          Tutup
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
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(228,11,24,0.1)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: '#e40b18' }} />
        </div>
        <h2 style={{ color: '#000000' }}>Konfirmasi Hapus Pelanggan</h2>
      </div>
      <div className="px-6 py-4">
        <p style={{ color: '#1a0408' }}>
          Hapus <span className="font-semibold" style={{ color: '#000000' }}>{count} pelanggan</span> yang dipilih beserta seluruh riwayat pembeliannya?
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
          {busy ? "Menghapus..." : `Ya, Hapus ${count} Pelanggan`}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Pelanggan main page
// ---------------------------------------------------------------------------

export default function Pelanggan() {
  const [items, setItems] = useState<PelangganDTO[]>([]);
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
  const [editing, setEditing] = useState<PelangganDTO | null>(null);
  const [viewing, setViewing] = useState<PelangganDTO | null>(null);
  const [deleting, setDeleting] = useState<PelangganDTO | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [form, setForm] = useState<CreatePelangganInput>(emptyForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPelanggan({
        page, pageSize: itemsPerPage, search,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data pelanggan.");
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
    if (items.length > 0 && items.every((p) => selected.has(p.id))) setSelected(new Set());
    else setSelected(new Set(items.map((p) => p.id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const saveCreate = async () => {
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama pelanggan wajib diisi."); return; }
    setBusy(true);
    try {
      await createPelanggan(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan pelanggan.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setFormError("");
    if (!form.nama.trim()) { setFormError("Nama pelanggan wajib diisi."); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (form.nama !== editing.nama) payload.nama = form.nama;
      if ((form.email ?? "") !== (editing.email ?? "")) payload.email = form.email || null;
      if ((form.telepon ?? "") !== (editing.telepon ?? "")) payload.telepon = form.telepon || null;
      if ((form.alamat ?? "") !== (editing.alamat ?? "")) payload.alamat = form.alamat || null;
      if ((form.kecamatan ?? "") !== (editing.kecamatan ?? "")) payload.kecamatan = form.kecamatan || null;
      if (form.isMember !== editing.isMember) payload.isMember = form.isMember;
      if (form.isActive !== editing.isActive) payload.isActive = form.isActive;
      const updated = await updatePelanggan(editing.id, payload);
      setEditing(null);
      setViewing(null);
      await load();
      // Update modal detail jika masih tampil.
      if (updated) setViewing(updated);
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan pelanggan.");
    } finally { setBusy(false); }
  };

  const toggleMember = async (p: PelangganDTO) => {
    setBusy(true);
    try {
      const updated = await updatePelanggan(p.id, { isMember: !p.isMember });
      await load();
      if (updated) setViewing(updated);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status member.");
    } finally { setBusy(false); }
  };

  const bulkSetMember = async (member: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled([...selected].map((id) => updatePelanggan(id, { isMember: member })));
      const failed = results.filter((r) => r.status === "rejected").length;
      setSelected(new Set());
      await load();
      if (failed > 0) setError(`Gagal mengubah status member untuk ${failed} pelanggan.`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status member.");
    } finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePelanggan(deleting.id);
      setDeleting(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus pelanggan.");
    } finally { setBusy(false); }
  };

  const confirmBulkDelete = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled([...selected].map((id) => deletePelanggan(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      setShowBulkDeleteConfirm(false);
      setSelected(new Set());
      await load();
      if (failed > 0) setError(`Gagal menghapus ${failed} pelanggan.`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus pelanggan.");
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
        nama: value(row, "nama", "nama pelanggan"),
        email: value(row, "email") || null,
        telepon: value(row, "telepon", "no hp", "no telepon", "phone") || null,
        alamat: value(row, "alamat") || null,
        kecamatan: value(row, "kecamatan") || null,
      }));
      const result = await bulkCreatePelanggan(payload);
      alert(`Berhasil: ${result.success}, gagal: ${result.failures.length}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "CSV pelanggan tidak valid.");
    }
  };

  const exportData = async () => {
    try {
      const result = await listPelanggan({ page: 1, pageSize: 100, search });
      downloadPelangganCsv(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export data pelanggan.");
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

  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const selectedList = items.filter((p) => selected.has(p.id));
  const selectedAllMember = selectedList.length > 0 && selectedList.every((p) => p.isMember);
  const selectedAllReguler = selectedList.length > 0 && selectedList.every((p) => !p.isMember);
  const selectedMixed = selectedList.length > 0 && !selectedAllMember && !selectedAllReguler;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="pelanggan" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Pelanggan</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola data pelanggan untuk pesanan online (commerce)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => void exportData()}
                className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                title="Export seluruh data pelanggan (CSV)">
                <Download className="w-5 h-5" />
                Export Data
              </button>
              <div className="relative">
                <button onClick={() => setShowAddMenu(!showAddMenu)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#27b446' }}>
                  <Plus className="w-5 h-5" />
                  Tambah Pelanggan
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                      <button onClick={() => { setShowAddMenu(false); setFormError(""); setShowCreate(true); }}
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
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input type="text" placeholder="Cari kode, nama, telepon, atau email..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={focusRingStyle} />
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

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg border-2" style={{ borderColor: '#e40b18', backgroundColor: 'rgba(228,11,24,0.04)' }}>
              <span className="text-sm" style={{ color: '#1a0408' }}>
                {selected.size} pelanggan dipilih
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {(selectedAllReguler || selectedMixed) && (
                  <button onClick={() => void bulkSetMember(true)} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#27b446' }}>
                    <UserCheck className="w-4 h-4" />
                    Set sebagai Member
                  </button>
                )}
                {(selectedAllMember || selectedMixed) && (
                  <button onClick={() => void bulkSetMember(false)} disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#6b7280' }}>
                    <UserX className="w-4 h-4" />
                    Set sebagai Reguler
                  </button>
                )}
                <button onClick={() => setShowBulkDeleteConfirm(true)} disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#e40b18' }}>
                  <Trash2 className="w-4 h-4" />
                  Hapus ({selected.size})
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="px-4 py-2 rounded-lg border transition-colors hover:bg-red-50"
                  style={{ borderColor: '#e40b18', color: '#e40b18' }}>
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data pelanggan...</p></div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button onClick={handleSelectAll} className="flex items-center justify-center" style={{ color: '#27b446' }}
                            title={allSelected ? "Batalkan semua" : "Pilih semua"}>
                            {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kode")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            ID Pelanggan {getSortIcon("kode")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("nama")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Nama {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kontak</th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kecamatan")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kecamatan {getSortIcon("kecamatan")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("created_at")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Tanggal Daftar {getSortIcon("created_at")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Transaksi</th>
                        <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Total Belanja</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, index) => (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => handleSelect(p.id, !selected.has(p.id))} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                              {selected.has(p.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(p)} style={{ color: '#27b446', fontFamily: 'monospace' }}>{p.kode}</td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(p)} style={{ color: '#1a0408' }}>
                            <div>{p.nama}</div>
                            {p.isMember && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs mt-1"
                                style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                                <CheckCircle className="w-3 h-3" /> Member
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm" style={{ color: '#1a0408' }}>
                            {p.telepon && <div>{p.telepon}</div>}
                            {p.email && <div style={{ opacity: 0.6 }}>{p.email}</div>}
                            {!p.telepon && !p.email && <span style={{ opacity: 0.4 }}>—</span>}
                          </td>
                          <td className="px-6 py-4" style={{ color: '#1a0408' }}>{p.kecamatan || <span style={{ opacity: 0.4 }}>—</span>}</td>
                          <td className="px-6 py-4 text-sm" style={{ color: '#1a0408' }}>{fmtWib(p.createdAt, "dd MMM yyyy")}</td>
                          <td className="px-6 py-4 text-right" style={{ color: '#1a0408' }}>{p.totalTransaksi ?? 0}</td>
                          <td className="px-6 py-4 text-right font-medium" style={{ color: '#27b446' }}>{formatRp(p.totalBelanja ?? 0)}</td>
                          <td className="px-6 py-4 text-center">
                            {p.isActive ? (
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
                              <button onClick={() => { setFormError(""); setEditing(p); setForm({ nama: p.nama, email: p.email ?? "", telepon: p.telepon ?? "", alamat: p.alamat ?? "", kecamatan: p.kecamatan ?? "", isMember: p.isMember, isActive: p.isActive }); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                                style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                                <Edit className="w-4 h-4" /> Edit
                              </button>
                              <button onClick={() => setDeleting(p)}
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
                        style={focusRingStyle}>
                        <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                    </div>
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>Menampilkan {rangeStart} - {rangeEnd} dari {total} pelanggan</span>
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
                    <Users className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Pelanggan tidak ditemukan</p>
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
        <PelangganForm
          title="Tambah Pelanggan"
          subtitle="Tambah data pelanggan baru"
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
        <PelangganForm
          title={`Edit Pelanggan — ${editing.kode}`}
          subtitle="Perbarui data pelanggan"
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
          pelanggan={viewing}
          onClose={() => setViewing(null)}
          onEdit={(p) => { setFormError(""); setEditing(p); setForm({ nama: p.nama, email: p.email ?? "", telepon: p.telepon ?? "", alamat: p.alamat ?? "", kecamatan: p.kecamatan ?? "", isMember: p.isMember, isActive: p.isActive }); }}
          onToggleMember={(p) => void toggleMember(p)}
          busy={busy}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(228,11,24,0.1)' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: '#e40b18' }} />
            </div>
            <h2 style={{ color: '#000000' }}>Konfirmasi Hapus Pelanggan</h2>
          </div>
          <div className="px-6 py-4">
            <p style={{ color: '#1a0408' }}>
              Yakin ingin menghapus <span className="font-semibold" style={{ color: '#000000' }}>{deleting.nama}</span> ({deleting.kode})?
            </p>
            <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button onClick={() => setDeleting(null)} className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>Batal</button>
            <button onClick={() => void confirmDelete()} disabled={busy}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#e40b18' }}>{busy ? "Menghapus..." : "Hapus"}</button>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirm */}
      {showBulkDeleteConfirm && (
        <BulkDeleteConfirmModal
          count={selected.size}
          busy={busy}
          onClose={() => setShowBulkDeleteConfirm(false)}
          onConfirm={() => void confirmBulkDelete()}
        />
      )}
    </div>
  );
}
