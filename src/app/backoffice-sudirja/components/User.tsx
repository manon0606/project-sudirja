"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import { ApiClientError } from "@/lib/api-client";
import {
  bulkCreateUsers, createRole, createUser, deleteRole, deleteUser, downloadUsersCsv,
  listRoles, listUsers, updateRole, updateUser,
} from "@/lib/user-api";
import {
  getKomisiSettings, listKomisiRekap, listKomisiTransaksi, updateKomisiSetting,
} from "@/lib/komisi-api";
import { parseCsv } from "./BulkUploadReference";
import type { CreateUserInput, RoleDTO, UserDTO } from "@/lib/user-types";
import { FEATURE_CODES } from "@/lib/user-types";
import type { KomisiRekapDTO, KomisiSettingDTO, KomisiTransaksiDTO } from "@/lib/komisi-types";
import { fmtWib } from "@/lib/date-utils";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, Users, ChevronDown, Plus, Eye, EyeOff,
  Download, Upload, Edit, CheckCircle, Percent, Wallet, Shield, Trash2, KeyRound,
  Pencil, AlertTriangle, Lock, ToggleLeft, ToggleRight, TrendingUp, FileText
} from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pesanan: "Pesanan",
  produk: "Produk",
  stok: "Stok",
  promo: "Promo",
  user: "User & Role",
  pembelian: "Pembelian",
  konsinyasi: "Konsinyasi",
  laporan: "Laporan",
  pelanggan: "Pelanggan",
  supplier: "Supplier",
  commerce: "Commerce",
  pemetaan: "Pemetaan & Ongkir",
  settings: "Settings (API Key)",
};

// Pengelompokan fitur untuk editor akses — mengikuti struktur grup menu desain V3.1.
const FEATURE_GROUPS: Array<{ group: string; codes: string[] }> = [
  { group: "Operasional", codes: ["dashboard"] },
  { group: "Pesanan", codes: ["pesanan"] },
  { group: "Produk", codes: ["produk"] },
  { group: "Stok", codes: ["stok"] },
  { group: "Pembelian", codes: ["pembelian"] },
  { group: "Konsinyasi", codes: ["konsinyasi"] },
  { group: "Pemasaran", codes: ["promo"] },
  { group: "Laporan", codes: ["laporan"] },
  { group: "Lainnya", codes: ["pelanggan", "supplier", "commerce", "pemetaan"] },
  { group: "Pengaturan", codes: ["user", "settings"] },
];

const emptyForm: CreateUserInput = {
  username: "", password: "", fullName: "", role: "kasir", phone: "", email: "", isActive: true,
};

type SortField = "id" | "username" | "full_name" | "role" | "created_at";
type SortDirection = "asc" | "desc" | null;
type Tab = "users" | "roles" | "komisi";

const ROLE_BADGE_COLORS = ['#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#fce7f3', '#fee2e2', '#e0f2fe', '#ecfccb'];
function roleBadgeIndex(role: string) {
  let h = 0;
  for (let i = 0; i < role.length; i++) h = (h * 31 + role.charCodeAt(i)) >>> 0;
  return h % ROLE_BADGE_COLORS.length;
}
function getRoleBadge(role: string) {
  const bg = ROLE_BADGE_COLORS[roleBadgeIndex(role)];
  return { bg, color: '#1f2937' };
}

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

// Gaya input standar desain V3.1 — teks body + focus ring hijau.
const INPUT_RING = { color: '#1a0408', '--tw-ring-color': '#27b446' } as React.CSSProperties;
const INPUT_CLS = "w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2";
const SELECT_CLS = "w-full appearance-none px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer";

function statusPillStyle(aktif: boolean) {
  return aktif
    ? { backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }
    : { backgroundColor: 'rgba(228, 11, 24, 0.1)', color: '#e40b18' };
}

// ---------------------------------------------------------------------------
// User Form Modal (create & edit)
// ---------------------------------------------------------------------------

interface UserFormProps {
  title: string;
  subtitle: string;
  value: CreateUserInput;
  onChange: (v: CreateUserInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  requirePassword?: boolean;
  roles: RoleDTO[];
}

function UserForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, requirePassword, roles }: UserFormProps) {
  const set = (key: keyof CreateUserInput, next: unknown) => onChange({ ...value, [key]: next } as CreateUserInput);
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = (pw: string) => {
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
    return { hasUpper, hasLower, hasNumber, hasSpecial, hasMin: pw.length >= 8, ok: hasUpper && hasLower && hasNumber && hasSpecial && pw.length >= 8 };
  };
  const v = validatePassword(value.password);
  const requirements = [
    { text: "Minimal 8 karakter", met: v.hasMin },
    { text: "Huruf besar (A-Z)", met: v.hasUpper },
    { text: "Huruf kecil (a-z)", met: v.hasLower },
    { text: "Angka (0-9)", met: v.hasNumber },
    { text: "Karakter spesial", met: v.hasSpecial },
  ];

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="flex flex-col min-h-0 flex-1"
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Username (akun login) *</label>
            <input
              required value={value.username} onChange={(e) => set("username", e.target.value)}
              placeholder="cth: siti.nurhaliza"
              className={INPUT_CLS}
              style={{ ...INPUT_RING, fontFamily: 'monospace' }}
            />
            <p className="text-xs mt-1" style={{ color: '#1a0408', opacity: 0.45 }}>Username & password dipakai untuk login portal</p>
          </div>
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Nama Lengkap *</label>
            <input
              required value={value.fullName} onChange={(e) => set("fullName", e.target.value)}
              placeholder="cth: Siti Nurhaliza"
              className={INPUT_CLS}
              style={INPUT_RING}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Role *</label>
            <div className="relative">
              <select
                value={value.role}
                onChange={(e) => set("role", e.target.value)}
                className={SELECT_CLS}
                style={INPUT_RING}
              >
                {roles.map((r) => <option key={r.name} value={r.name}>{r.label} ({r.name})</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
              <KeyRound className="w-3.5 h-3.5" />
              {requirePassword ? "Password *" : "Password Baru (opsional)"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={value.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 8 karakter, huruf & angka"
                className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2"
                style={INPUT_RING}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {value.password && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-xs mb-2" style={{ color: '#1a0408', opacity: 0.7 }}>Ketentuan Password:</p>
              <ul className="space-y-1">
                {requirements.map((req, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: req.met ? '#27b446' : 'rgba(26, 4, 8, 0.1)', color: req.met ? 'white' : 'transparent' }}>
                      {req.met && '✓'}
                    </span>
                    <span style={{ color: req.met ? '#27b446' : '#1a0408', opacity: req.met ? 1 : 0.5 }}>{req.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Nomor HP</label>
            <input
              value={value.phone ?? ""} onChange={(e) => set("phone", e.target.value)}
              placeholder="cth: 081234567890"
              className={INPUT_CLS}
              style={INPUT_RING}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Email</label>
            <input
              type="email" value={value.email ?? ""} onChange={(e) => set("email", e.target.value)}
              placeholder="cth: user@email.com"
              className={INPUT_CLS}
              style={INPUT_RING}
            />
          </div>
          <div>
            <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>Status</label>
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
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}>
            Batal
          </button>
          <button type="submit" disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}>
            {busy ? "Menyimpan..." : title.startsWith("Edit") ? "Simpan Perubahan" : "Tambah Pengguna"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Role & Akses Section
// ---------------------------------------------------------------------------

function RoleSection() {
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPerms, setNewPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDTO | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editLabel, setEditLabel] = useState("");
  const [deletingRole, setDeletingRole] = useState<RoleDTO | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await listRoles());
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat daftar role.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    setBusy(true);
    setError("");
    try {
      await createRole({ name: newName, label: newLabel, permissions: newPerms });
      setShowCreate(false);
      setNewName(""); setNewLabel(""); setNewPerms([]);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal membuat role.");
    } finally { setBusy(false); }
  };

  const handleSavePerms = async (role: RoleDTO) => {
    setBusy(true);
    setError("");
    try {
      await updateRole(role.name, { label: editLabel, permissions: editPerms });
      setEditingRole(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan akses role.");
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setBusy(true);
    setError("");
    try {
      await deleteRole(deletingRole.name);
      setDeletingRole(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menghapus role.");
    } finally { setBusy(false); }
  };

  const togglePerm = (list: string[], setList: (v: string[]) => void, code: string) => {
    setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  };

  const togglePermGroup = (codes: string[], perms: string[], setPerms: (v: string[]) => void) => {
    const allSel = codes.every((c) => perms.includes(c));
    setPerms(FEATURE_CODES.filter((c) => (allSel ? !codes.includes(c) : perms.includes(c) || codes.includes(c))).map((c) => c));
  };

  const renderPermEditor = (perms: string[], setPerms: (v: string[]) => void) => {
    const allSelected = perms.length === FEATURE_CODES.length;
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium" style={{ color: '#1a0408' }}>Akses Fitur Admin</span>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: '#1a0408', opacity: 0.5 }}>
              {perms.length} dari {FEATURE_CODES.length} dipilih
            </span>
            <button type="button"
              onClick={() => setPerms(allSelected ? [] : FEATURE_CODES.map((c) => c))}
              className="text-xs px-3 py-1 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: '#27b446', color: '#27b446' }}>
              {allSelected ? "Batal Semua" : "Pilih Semua"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FEATURE_GROUPS.map((g) => {
            const allSel = g.codes.every((c) => perms.includes(c));
            const someSel = g.codes.some((c) => perms.includes(c));
            return (
              <div key={g.group} className="p-4 rounded-xl border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
                <button type="button"
                  onClick={() => togglePermGroup(g.codes, perms, setPerms)}
                  className="w-full flex items-center gap-2 mb-3 select-none text-left">
                  <span className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: someSel ? '#27b446' : '#d1d5db',
                      backgroundColor: allSel ? '#27b446' : someSel ? 'rgba(39,180,70,0.12)' : 'white',
                    }}>
                    {allSel && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {!allSel && someSel && (
                      <span className="w-1.5 h-0.5 rounded" style={{ backgroundColor: '#27b446' }} />
                    )}
                  </span>
                  <span className="text-sm font-medium" style={{ color: '#000000' }}>{g.group}</span>
                </button>
                <div className="space-y-2 pl-1">
                  {g.codes.map((code) => {
                    const checked = perms.includes(code);
                    return (
                      <button key={code} type="button"
                        onClick={() => togglePerm(perms, setPerms, code)}
                        className="w-full flex items-center gap-2 select-none text-left">
                        <span className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: checked ? '#27b446' : '#d1d5db', backgroundColor: checked ? '#27b446' : 'white' }}>
                          {checked && (
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="text-sm" style={{ color: '#1a0408' }}>{FEATURE_LABELS[code] ?? code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
          <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
        </div>
      )}

      {/* Create role modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 style={{ color: '#000000' }}>Tambah Role</h2>
              <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>Role otomatis masuk ke pengaturan komisi</p>
            </div>
            <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                  Kode Role <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input value={newName} onChange={(e) => setNewName(e.target.value.toLowerCase())}
                  placeholder="cth: manajer_toko"
                  className={INPUT_CLS}
                  style={{ ...INPUT_RING, fontFamily: 'monospace' }} />
                <p className="text-xs mt-1" style={{ color: '#1a0408', opacity: 0.45 }}>Unik, huruf kecil, tanpa spasi</p>
              </div>
              <div>
                <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
                  Label <span style={{ color: '#e40b18' }}>*</span>
                </label>
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="cth: Manajer Toko"
                  className={INPUT_CLS}
                  style={INPUT_RING} />
              </div>
            </div>
            {renderPermEditor(newPerms, setNewPerms)}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Batal
            </button>
            <button onClick={() => void handleCreate()} disabled={busy || !newName || !newLabel}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#27b446' }}>
              {busy ? "Menyimpan..." : "Simpan Role"}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit permissions modal */}
      {editingRole && (
        <Modal onClose={() => setEditingRole(null)} className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 style={{ color: '#000000' }}>Konfigurasi Akses — {editingRole.label}</h2>
              <p className="text-sm mt-0.5 font-mono" style={{ color: '#27b446' }}>{editingRole.name}</p>
            </div>
            <button onClick={() => setEditingRole(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>Label Role</label>
              <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                className={INPUT_CLS}
                style={INPUT_RING} />
            </div>
            {editingRole.isSystem && (
              <p className="text-xs" style={{ color: '#e40b18' }}>
                ⚠ Mengubah akses role sistem akan langsung memengaruhi semua user ber-role ini.
              </p>
            )}
            {renderPermEditor(editPerms, setEditPerms)}
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
            <button onClick={() => setEditingRole(null)}
              className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Batal
            </button>
            <button onClick={() => void handleSavePerms(editingRole)} disabled={busy}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#27b446' }}>
              {busy ? "Menyimpan..." : "Simpan Akses"}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deletingRole && (
        <Modal onClose={() => setDeletingRole(null)} className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fee2e2' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: '#e40b18' }} />
              </div>
              <div>
                <h2 style={{ color: '#000000' }}>Konfirmasi Hapus Role</h2>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-4">
            <p style={{ color: '#1a0408' }}>
              Hapus role <span style={{ color: '#000000' }}>{deletingRole.label}</span> ({deletingRole.name})?
            </p>
            <p className="mt-2 text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
              Data role yang sudah dihapus tidak dapat dikembalikan.
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button onClick={() => setDeletingRole(null)}
              className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Batal
            </button>
            <button onClick={() => void handleDelete()} disabled={busy}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#e40b18' }}>
              {busy ? "Menghapus..." : "Hapus"}
            </button>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: '#27b446' }} />
            <div>
              <h2 style={{ color: '#000000' }}>Role & Akses Fitur</h2>
              <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola role dinamis & izin akses fitur admin. Role baru otomatis masuk pengaturan komisi.
              </p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}>
            <Plus className="w-5 h-5" />
            Tambah Role
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat role...</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>ID Role</th>
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kode</th>
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Nama Role</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Akses Fitur</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role, index) => (
                  <tr key={role.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                    <td className="px-6 py-4">
                      <span style={{ color: '#1a0408', fontFamily: 'monospace' }}>{role.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-md text-sm"
                        style={{ backgroundColor: '#f3f4f6', color: '#1a0408', fontFamily: 'monospace' }}>
                        {role.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span style={{ color: '#1a0408' }}>{role.label}</span>
                        {role.isSystem && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
                            <Lock className="w-3 h-3" />
                            Sistem
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {role.permissions.length === 0 ? (
                        <span className="text-sm" style={{ color: '#1a0408', opacity: 0.4 }}>Tidak ada akses</span>
                      ) : role.permissions.length === FEATURE_CODES.length ? (
                        <span className="inline-flex px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'rgba(39,180,70,0.1)', color: '#27b446' }}>
                          Semua fitur
                        </span>
                      ) : (
                        <span className="inline-flex px-3 py-1 rounded-full text-sm"
                          style={{ backgroundColor: 'rgba(39,180,70,0.1)', color: '#27b446' }}>
                          {role.permissions.length} menu
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditingRole(role); setEditPerms(role.permissions); setEditLabel(role.label); }}
                          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                          style={{ color: '#27b446' }}
                          title="Atur Akses">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (!role.isSystem) setDeletingRole(role); }}
                          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                          style={{ color: role.isSystem ? '#1a0408' : '#e40b18', opacity: role.isSystem ? 0.2 : 1, cursor: role.isSystem ? 'not-allowed' : 'pointer' }}
                          title={role.isSystem ? "Role sistem tidak bisa dihapus" : "Hapus Role"}
                          disabled={role.isSystem}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komisi section (role dinamis)
// ---------------------------------------------------------------------------

function KomisiSection() {
  const [settings, setSettings] = useState<KomisiSettingDTO[]>([]);
  const [rekap, setRekap] = useState<KomisiRekapDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingRole, setSavingRole] = useState("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editPersen, setEditPersen] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: number; name: string } | null>(null);
  const [transaksi, setTransaksi] = useState<KomisiTransaksiDTO[]>([]);
  const [transaksiLoading, setTransaksiLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [transaksiSearch, setTransaksiSearch] = useState("");
  const [transaksiDateFrom, setTransaksiDateFrom] = useState("");
  const [transaksiDateTo, setTransaksiDateTo] = useState("");
  const [transaksiStatus, setTransaksiStatus] = useState<"" | "terhitung" | "dibayar">("");

  const loadSettings = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([getKomisiSettings(), listRoles()]);
      setSettings(s);
      setRoles(r);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pengaturan komisi.");
    }
  }, []);

  const loadRekap = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listKomisiRekap({ page, pageSize, search, role: roleFilter });
      setRekap(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat rekap komisi.");
    } finally { setLoading(false); }
  }, [page, pageSize, search, roleFilter]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);
  useEffect(() => { void loadRekap(); }, [loadRekap]);

  const handleSaveSetting = async (role: string) => {
    const persen = Number(editPersen);
    if (!Number.isFinite(persen) || persen < 0 || persen > 100) {
      setError("Persen komisi harus 0-100.");
      return;
    }
    setSavingRole(role);
    try {
      await updateKomisiSetting(role, persen, settings.find((s) => s.role === role)?.aktif ?? true);
      setEditingRole(null);
      await loadSettings();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan pengaturan komisi.");
    } finally { setSavingRole(""); }
  };

  const handleToggleAktif = async (role: string) => {
    const cur = settings.find((s) => s.role === role);
    if (!cur) return;
    setSavingRole(role);
    try {
      await updateKomisiSetting(role, cur.persenKomisi, !cur.aktif);
      await loadSettings();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status komisi.");
    } finally { setSavingRole(""); }
  };

  const openTransaksi = async (userId: number, name: string) => {
    setSelectedUser({ id: userId, name });
    setTransaksiLoading(true);
    try {
      const result = await listKomisiTransaksi(userId, 1, 50);
      setTransaksi(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat transaksi komisi.");
    } finally { setTransaksiLoading(false); }
  };

  const resetTransaksiFilters = () => {
    setTransaksiSearch("");
    setTransaksiDateFrom("");
    setTransaksiDateTo("");
    setTransaksiStatus("");
  };

  // Filter lokal (client-side) atas transaksi yang sudah dimuat — pencarian,
  // rentang tanggal (WIB), dan status; sama seperti perilaku filter desain.
  const filteredTransaksi = useMemo(() => {
    const q = transaksiSearch.trim().toLowerCase();
    return transaksi.filter((t) => {
      if (q && !t.noPesanan.toLowerCase().includes(q) && !t.userName.toLowerCase().includes(q)) return false;
      if (transaksiStatus && t.status !== transaksiStatus) return false;
      const tgl = fmtWib(t.createdAt, "yyyy-MM-dd");
      if (transaksiDateFrom && tgl < transaksiDateFrom) return false;
      if (transaksiDateTo && tgl > transaksiDateTo) return false;
      return true;
    });
  }, [transaksi, transaksiSearch, transaksiDateFrom, transaksiDateTo, transaksiStatus]);

  const exportRekapCsv = async () => {
    try {
      const result = await listKomisiRekap({ page: 1, pageSize: 100, search, role: roleFilter });
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["User ID", "User", "Role", "Transaksi", "Total Komisi", "Terbayar", "Belum Dibayar"];
      const rows = result.items.map((r) =>
        [r.userId, r.userName, r.roleLabel, r.totalTransaksi, r.totalNominal, r.totalDibayar, r.totalBelumDibayar].map(esc).join(","),
      );
      const blob = new Blob(["\uFEFF", [headers.map(esc).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rekap-komisi-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export rekap komisi.");
    }
  };

  const exportRekapPdf = async () => {
    try {
      const result = await listKomisiRekap({ page: 1, pageSize: 100, search, role: roleFilter });
      const rows = result.items.map((r) =>
        `<tr><td>${r.userId}</td><td>${r.userName}</td><td>${r.roleLabel}</td><td>${r.totalTransaksi}</td>` +
        `<td>${formatRp(r.totalNominal)}</td><td>${formatRp(r.totalDibayar)}</td><td>${formatRp(r.totalBelumDibayar)}</td></tr>`,
      ).join("");
      const html = `<html><head><title>Rekap Komisi</title>
        <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
        h2{color:#000;margin-bottom:4px}p{color:#666;margin-bottom:16px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
        th{background:#27b446;color:white}tr:nth-child(even){background:#f9f9f9}</style>
        </head><body>
        <h2>Rekap Komisi</h2>
        <p>Diekspor: ${fmtWib(new Date(), "dd MMMM yyyy HH:mm")} WIB</p>
        <table><thead><tr>
          <th>User ID</th><th>User</th><th>Role</th><th>Transaksi</th>
          <th>Total Komisi</th><th>Terbayar</th><th>Belum Dibayar</th>
        </tr></thead><tbody>${rows}</tbody></table>
        </body></html>`;
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.print(); }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export rekap komisi.");
    }
  };

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }, [page, totalPages]);

  const roleLabel = (role: string) => roles.find((r) => r.name === role)?.label ?? role;

  const editTarget = editingRole ? settings.find((s) => s.role === editingRole) : undefined;
  const persenNum = Number(editPersen);
  const persenError = editingRole !== null && (editPersen === "" || !Number.isFinite(persenNum) || persenNum < 0 || persenNum > 100)
    ? "Persen komisi harus 0-100."
    : "";

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
          <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
        </div>
      )}

      {/* Edit nilai komisi modal */}
      {editingRole !== null && (
        <Modal onClose={() => setEditingRole(null)} className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 style={{ color: '#000000' }}>Edit Nilai Komisi</h2>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.7 }}>{roleLabel(editingRole)}</p>
            </div>
            <button onClick={() => setEditingRole(null)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-5">
            <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
              Nilai Komisi (%) <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.01"
                value={editPersen}
                onChange={(e) => setEditPersen(e.target.value)}
                className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-200 focus:outline-none focus:ring-2"
                style={INPUT_RING} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-medium" style={{ color: '#27b446' }}>%</span>
            </div>
            {persenError && <p className="text-xs mt-1" style={{ color: '#e40b18' }}>{persenError}</p>}
            <p className="text-xs mt-2" style={{ color: '#1a0408', opacity: 0.45 }}>
              Nilai sebelumnya: {editTarget?.persenKomisi ?? 0}%
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button onClick={() => setEditingRole(null)}
              className="flex-1 py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Batal
            </button>
            <button onClick={() => void handleSaveSetting(editingRole)} disabled={savingRole === editingRole}
              className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#27b446' }}>
              {savingRole === editingRole ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </Modal>
      )}

      {/* Pengaturan Komisi — dinamis dari roles */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Percent className="w-5 h-5" style={{ color: '#27b446' }} />
          <div>
            <h2 style={{ color: '#000000' }}>Pengaturan Komisi per Role</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Atur nilai komisi per role. Komisi tidak dapat dihapus, hanya bisa dinonaktifkan.
              Role baru yang dibuat di tab Role & Akses otomatis muncul di sini (persen 0%).
            </p>
          </div>
        </div>
        {settings.length === 0 ? (
          <div className="px-6 py-8">
            <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat pengaturan...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                  <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Role</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Nilai (%)</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                  <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s, index) => (
                  <tr key={s.role} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                    <td className="px-6 py-4">
                      <p style={{ color: '#1a0408' }}>{s.roleLabel}</p>
                      <p className="text-xs font-mono" style={{ color: '#1a0408', opacity: 0.5 }}>{s.role}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-medium text-lg"
                        style={{ color: s.aktif ? '#27b446' : '#1a0408', opacity: s.aktif ? 1 : 0.4 }}>
                        {s.persenKomisi}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-sm" style={statusPillStyle(s.aktif)}>
                        {s.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => { setEditingRole(s.role); setEditPersen(String(s.persenKomisi)); }}
                          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                          style={{ color: '#27b446' }}
                          title="Edit Nilai Komisi">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => void handleToggleAktif(s.role)} disabled={savingRole === s.role}
                          className="p-2 rounded-lg transition-colors hover:bg-gray-100 disabled:opacity-50"
                          style={{ color: s.aktif ? '#27b446' : '#e40b18' }}
                          title={s.aktif ? "Nonaktifkan" : "Aktifkan"}>
                          {s.aktif ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rekap Komisi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" style={{ color: '#27b446' }} />
            <div>
              <h2 style={{ color: '#000000' }}>Rekap Komisi User</h2>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Riwayat komisi yang diterima setiap pengguna
              </p>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <button onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#27b446' }}>
              <Download className="w-4 h-4" />
              Ekspor
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden">
                  <button onClick={() => { setShowExportMenu(false); void exportRekapCsv(); }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors"
                    style={{ color: '#1a0408' }}>
                    <Download className="w-4 h-4" style={{ color: '#27b446' }} />
                    Ekspor CSV
                  </button>
                  <button onClick={() => { setShowExportMenu(false); void exportRekapPdf(); }}
                    className="w-full px-4 py-3 text-left flex items-center gap-2 text-sm hover:bg-gray-50 transition-colors border-t border-gray-100"
                    style={{ color: '#1a0408' }}>
                    <FileText className="w-4 h-4" style={{ color: '#27b446' }} />
                    Ekspor PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex-1 relative" style={{ minWidth: '200px' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#1a0408', opacity: 0.4 }} />
            <input
              type="text" placeholder="Cari nama atau username..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm"
              style={INPUT_RING}
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                style={{ color: '#1a0408', opacity: 0.6 }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative">
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm cursor-pointer"
              style={INPUT_RING}>
              <option value="">Semua Role</option>
              {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
          </div>
          {(search || roleFilter) && (
            <button onClick={() => { setSearch(""); setRoleFilter(""); setPage(1); }}
              className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-100 transition-colors"
              style={{ color: '#1a0408', opacity: 0.6 }}>
              <X className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>User</th>
                <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Role</th>
                <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Transaksi</th>
                <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Total Komisi</th>
                <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Terbayar</th>
                <th className="px-6 py-4 text-right" style={{ color: '#000000' }}>Belum Dibayar</th>
                <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat rekap komisi...</p>
                </td></tr>
              ) : rekap.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <Wallet className="w-12 h-12 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.3 }} />
                  <p style={{ color: '#1a0408', opacity: 0.6 }}>Belum ada data komisi</p>
                </td></tr>
              ) : (
                rekap.map((r, index) => (
                  <tr key={r.userId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                    <td className="px-6 py-4">
                      <p style={{ color: '#1a0408' }}>{r.userName}</p>
                      <p className="text-xs" style={{ color: '#1a0408', opacity: 0.5, fontFamily: 'monospace' }}>ID {r.userId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 rounded-full text-sm" style={getRoleBadge(r.role)}>
                        {roleLabel(r.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center" style={{ color: '#1a0408' }}>{r.totalTransaksi}</td>
                    <td className="px-6 py-4 text-right font-medium" style={{ color: '#27b446' }}>{formatRp(r.totalNominal)}</td>
                    <td className="px-6 py-4 text-right" style={{ color: '#1a0408' }}>{formatRp(r.totalDibayar)}</td>
                    <td className="px-6 py-4 text-right" style={{ color: r.totalBelumDibayar > 0 ? '#e40b18' : '#1a0408' }}>{formatRp(r.totalBelumDibayar)}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => { resetTransaksiFilters(); void openTransaksi(r.userId, r.userName); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-sm transition-all hover:opacity-80"
                        style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                        <Eye className="w-4 h-4" />
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && rekap.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <span style={{ color: '#1a0408', opacity: 0.7 }}>
              Menampilkan {rekap.length} dari {total} user
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                style={{ color: '#1a0408' }}>
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1">
                {pageNumbers.map((p) => (
                  <button key={p} onClick={() => setPage(p)} className="w-10 h-10 rounded-lg transition-colors"
                    style={{
                      backgroundColor: page === p ? '#27b446' : 'transparent',
                      color: page === p ? 'white' : '#1a0408',
                      border: page === p ? 'none' : '1px solid #e5e7eb'
                    }}>
                    {p}
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
      </div>

      {/* Modal detail transaksi komisi */}
      {selectedUser && (
        <Modal onClose={() => setSelectedUser(null)} className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 style={{ color: '#000000' }}>Transaksi Komisi</h2>
              <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>{selectedUser.name}</p>
            </div>
            <button onClick={() => setSelectedUser(null)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter transaksi (client-side atas data yang dimuat) */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 flex-shrink-0">
            <div className="flex-1 relative" style={{ minWidth: '180px' }}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input type="text" placeholder="Cari no. pesanan atau nama..." value={transaksiSearch}
                onChange={(e) => setTransaksiSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm"
                style={INPUT_RING} />
            </div>
            <DatePicker value={transaksiDateFrom} onChange={setTransaksiDateFrom}
              placeholder="Dari tanggal"
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm"
              style={INPUT_RING} />
            <DatePicker value={transaksiDateTo} onChange={setTransaksiDateTo}
              placeholder="Sampai tanggal"
              className="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm"
              style={INPUT_RING} />
            <div className="relative">
              <select value={transaksiStatus}
                onChange={(e) => setTransaksiStatus(e.target.value as "" | "terhitung" | "dibayar")}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 text-sm cursor-pointer"
                style={INPUT_RING}>
                <option value="">Semua Status</option>
                <option value="terhitung">Terhitung</option>
                <option value="dibayar">Dibayar</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>
            {(transaksiSearch || transaksiDateFrom || transaksiDateTo || transaksiStatus) && (
              <button onClick={resetTransaksiFilters}
                className="px-3 py-2 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-100 transition-colors"
                style={{ color: '#1a0408', opacity: 0.6 }}>
                <X className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {transaksiLoading ? (
              <div className="py-12 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat...</p></div>
            ) : filteredTransaksi.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 mx-auto mb-2" style={{ color: '#1a0408', opacity: 0.2 }} />
                <p style={{ color: '#1a0408', opacity: 0.5 }}>Tidak ada transaksi komisi ditemukan</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                    <th className="px-5 py-3 text-left text-sm" style={{ color: '#000000' }}>Tanggal</th>
                    <th className="px-5 py-3 text-left text-sm" style={{ color: '#000000' }}>No. Pesanan</th>
                    <th className="px-5 py-3 text-right text-sm" style={{ color: '#000000' }}>Dasar</th>
                    <th className="px-5 py-3 text-right text-sm" style={{ color: '#000000' }}>%</th>
                    <th className="px-5 py-3 text-right text-sm" style={{ color: '#000000' }}>Komisi</th>
                    <th className="px-5 py-3 text-center text-sm" style={{ color: '#000000' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransaksi.map((t, i) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fcfaff' }}>
                      <td className="px-5 py-3 text-sm" style={{ color: '#1a0408' }}>{fmtWib(t.createdAt, "dd/MM/yyyy")}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: '#27b446', fontFamily: 'monospace' }}>{t.noPesanan}</td>
                      <td className="px-5 py-3 text-sm text-right" style={{ color: '#1a0408' }}>{formatRp(t.dasarKomisi)}</td>
                      <td className="px-5 py-3 text-sm text-right" style={{ color: '#1a0408' }}>{t.persenKomisi}%</td>
                      <td className="px-5 py-3 text-sm text-right font-medium" style={{ color: '#27b446' }}>{formatRp(t.nominalKomisi)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs"
                          style={t.status === 'dibayar'
                            ? { backgroundColor: 'rgba(39,180,70,0.1)', color: '#27b446' }
                            : { backgroundColor: '#fef3c7', color: '#92400e' }}>
                          {t.status === 'dibayar' ? 'Dibayar' : 'Terhitung'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex-shrink-0">
            <button onClick={() => setSelectedUser(null)}
              className="w-full py-3 rounded-lg border-2 transition-colors hover:bg-red-50"
              style={{ borderColor: '#e40b18', color: '#e40b18' }}>
              Tutup
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User main page
// ---------------------------------------------------------------------------

export default function User() {
  const [tab, setTab] = useState<Tab>("users");
  const [items, setItems] = useState<UserDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [form, setForm] = useState<CreateUserInput>(emptyForm);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsers({
        page, pageSize: itemsPerPage,
        search, role: roleFilter,
        sortBy: sortField ?? undefined,
        sortOrder: sortDirection ?? undefined,
      });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data user.");
    } finally { setLoading(false); }
  }, [page, itemsPerPage, search, roleFilter, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelected(new Set()); }, [items]);

  // Muat daftar role untuk dropdown & filter.
  useEffect(() => {
    listRoles().then(setRoles).catch(() => undefined);
  }, []);

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
      ? <ArrowUp className="w-4 h-4" style={{ color: '#27b446' }} />
      : <ArrowDown className="w-4 h-4" style={{ color: '#27b446' }} />;
  };

  const handleSelectAll = () => {
    if (items.length > 0 && items.every((u) => selected.has(u.id))) setSelected(new Set());
    else setSelected(new Set(items.map((u) => u.id)));
  };

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const saveCreate = async () => {
    setBusy(true);
    try {
      await createUser(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan user.");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (form.username !== editing.username) payload.username = form.username;
      if (form.fullName !== editing.fullName) payload.fullName = form.fullName;
      if (form.role !== editing.role) payload.role = form.role;
      if ((form.phone ?? "") !== (editing.phone ?? "")) payload.phone = form.phone || null;
      if ((form.email ?? "") !== (editing.email ?? "")) payload.email = form.email || null;
      if (form.isActive !== editing.isActive) payload.isActive = form.isActive;
      if (form.password) payload.password = form.password;
      await updateUser(editing.id, payload);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan user.");
    } finally { setBusy(false); }
  };

  const bulkSetActive = async (active: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => updateUser(id, { isActive: active })));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status user terpilih.");
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
        username: value(row, "username", "user"),
        password: value(row, "password"),
        fullName: value(row, "nama", "nama lengkap", "full name"),
        role: (value(row, "role", "posisi") || "kasir"),
        phone: value(row, "nomor hp", "no hp", "phone") || null,
        email: value(row, "email") || null,
        isActive: true,
      }));
      const result = await bulkCreateUsers(payload);
      alert(`Berhasil: ${result.success}, gagal: ${result.failures.length}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "CSV user tidak valid.");
    }
  };

  const exportData = async () => {
    try {
      const result = await listUsers({ page: 1, pageSize: 100, search, role: roleFilter });
      downloadUsersCsv(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export data user.");
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

  const roleLabelOf = (role: string) => roles.find((r) => r.name === role)?.label ?? role;

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="user" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl mb-1" style={{ color: '#000000' }}>Manajemen User</h1>
              <p style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola pengguna, role, dan komisi
              </p>
            </div>

            {tab === "users" && selected.size > 0 ? (
              <div className="flex items-center gap-3">
                <span style={{ color: '#1a0408' }}>{selected.size} user dipilih</span>
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
            ) : tab === "users" ? (
              <div className="flex items-center gap-3">
                <button onClick={() => void exportData()}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                  style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                  title="Export seluruh data user (CSV)">
                  <Download className="w-5 h-5" />
                  Export Data
                </button>
                <div className="relative">
                  <button onClick={() => setShowAddMenu(!showAddMenu)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#27b446' }}>
                    <Plus className="w-5 h-5" />
                    Tambah User
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showAddMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAddMenu(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-20">
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
            ) : null}
          </div>
        </div>

        {/* Tabs: User | Role & Akses | Komisi */}
        <div className="bg-white border-b border-gray-200 px-8">
          <div className="flex">
            {([
              { id: "users" as Tab, label: "User", Icon: Users },
              { id: "roles" as Tab, label: "Role & Akses", Icon: Shield },
              { id: "komisi" as Tab, label: "Komisi", Icon: TrendingUp },
            ]).map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 -mb-px transition-colors"
                style={{
                  borderBottomColor: tab === id ? '#27b446' : 'transparent',
                  color: tab === id ? '#27b446' : '#1a0408',
                  opacity: tab === id ? 1 : 0.55,
                }}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "roles" ? (
          <div className="flex-1 overflow-auto p-8">
            <RoleSection />
          </div>
        ) : tab === "komisi" ? (
          <div className="flex-1 overflow-auto p-8">
            <KomisiSection />
          </div>
        ) : (
          <>
            {/* Filter Section */}
            <div className="bg-white border-b border-gray-200 px-8 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
                  <input type="text" placeholder="Cari berdasarkan ID, username, atau nama..." value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                    style={INPUT_RING} />
                  {search && (
                    <button onClick={() => { setSearch(""); setPage(1); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                      style={{ color: '#1a0408', opacity: 0.6 }}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                    className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                    style={INPUT_RING}>
                    <option value="">Semua Role</option>
                    {roles.map((r) => <option key={r.name} value={r.name}>{r.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
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
                  <div className="py-16 text-center"><p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data user...</p></div>
                ) : items.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                            <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                              <button onClick={handleSelectAll} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                                {items.length > 0 && items.every((u) => selected.has(u.id)) ? (
                                  <CheckCircle className="w-5 h-5" />
                                ) : (
                                  <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />
                                )}
                              </button>
                            </th>
                            <th className="px-6 py-4 text-left">
                              <button onClick={() => handleSort("id")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                                ID {getSortIcon("id")}
                              </button>
                            </th>
                            <th className="px-6 py-4 text-left">
                              <button onClick={() => handleSort("username")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                                Username {getSortIcon("username")}
                              </button>
                            </th>
                            <th className="px-6 py-4 text-left">
                              <button onClick={() => handleSort("full_name")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                                Nama {getSortIcon("full_name")}
                              </button>
                            </th>
                            <th className="px-6 py-4 text-left">
                              <button onClick={() => handleSort("role")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                                Role {getSortIcon("role")}
                              </button>
                            </th>
                            <th className="px-6 py-4 text-left" style={{ color: '#000000' }}>Kontak</th>
                            <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                            <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((user, index) => (
                            <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                              style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}>
                              <td className="px-6 py-4 text-center">
                                <button onClick={() => handleSelect(user.id, !selected.has(user.id))}
                                  className="flex items-center justify-center" style={{ color: '#27b446' }}>
                                  {selected.has(user.id) ? <CheckCircle className="w-5 h-5" /> : <span className="w-5 h-5 border-2 rounded" style={{ borderColor: '#27b446' }} />}
                                </button>
                              </td>
                              <td className="px-6 py-4" style={{ color: '#1a0408', fontFamily: 'monospace' }}>{user.id}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 rounded-md text-sm" style={{ backgroundColor: '#f3f4f6', fontFamily: 'monospace', color: '#1a0408' }}>
                                  {user.username}
                                </span>
                              </td>
                              <td className="px-6 py-4" style={{ color: '#1a0408' }}>{user.fullName}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex px-3 py-1 rounded-full text-sm" style={getRoleBadge(user.role)}>
                                  {user.roleLabel}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm" style={{ color: '#1a0408' }}>
                                {user.phone && <p>{user.phone}</p>}
                                {user.email && <p style={{ opacity: 0.6 }}>{user.email}</p>}
                                {!user.phone && !user.email && <p style={{ opacity: 0.4 }}>—</p>}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                                  style={statusPillStyle(user.isActive)}>
                                  <CheckCircle className="w-4 h-4" />
                                  {user.isActive ? "Aktif" : "Tidak Aktif"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button onClick={() => {
                                  setEditing(user);
                                  setForm({
                                    username: user.username, password: "", fullName: user.fullName,
                                    role: user.role, phone: user.phone ?? "", email: user.email ?? "",
                                    isActive: user.isActive,
                                  });
                                }}
                                  className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                  style={{ color: '#27b446' }}
                                  title="Edit User">
                                  <Pencil className="w-4 h-4" />
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
                          <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                            className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                            style={INPUT_RING}>
                            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                        </div>
                        <span style={{ color: '#1a0408', opacity: 0.7 }}>
                          Menampilkan {rangeStart} - {rangeEnd} dari {total} user
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
                              style={{ backgroundColor: page === pageNum ? '#27b446' : 'transparent', color: page === pageNum ? 'white' : '#1a0408', border: page === pageNum ? 'none' : '1px solid #e5e7eb' }}>
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
                    <Users className="w-12 h-12 mx-auto mb-3" style={{ color: '#1a0408', opacity: 0.3 }} />
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>Tidak ada pengguna ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <UserForm
          title="Tambah User"
          subtitle="Buat akun login (admin) + profil user terkait"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveCreate()}
          onClose={() => { setShowCreate(false); setForm(emptyForm); }}
          busy={busy}
          requirePassword
          roles={roles}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <UserForm
          title={`Edit User — ${editing.username}`}
          subtitle="Perbarui data user (kosongkan password jika tidak diubah)"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy}
          roles={roles}
        />
      )}
    </div>
  );
}
