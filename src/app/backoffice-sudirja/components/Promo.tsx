"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { bulkCreatePromos, createPromo, downloadPromoCsv, listPromos, updatePromo } from "@/lib/promo-api";
import { parseCsv } from "./BulkUploadReference";
import Modal from "./Modal";
import DatePicker from "./DatePicker";
import type { BulkPromoResult, CreatePromoInput, PromoDTO, PromoType } from "@/lib/promo-types";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  X, ChevronLeft, ChevronRight, ChevronDown, Tag, Calendar, CheckCircle, Percent, DollarSign, Truck,
  CheckSquare, Square, Download, Plus, Upload, Edit, Pencil, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { fmtWib } from "@/lib/date-utils";

const types: PromoType[] = ["Diskon Ongkir", "Diskon Nominal", "Diskon %"];
const emptyForm: CreatePromoInput = {
  kode: "", nama: "", tipe: "Diskon %", deskripsi: "", nilaiDiskon: 0, minimalBelanja: 0,
  maksimalDiskon: null, tanggalMulai: "", tanggalBerakhir: "", batasKuota: 1,
  syaratKetentuan: [], isActive: true,
};

type SortField = "id" | "kode" | "nama" | "tipe";
type SortDirection = "asc" | "desc" | null;

function toDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTipeIcon(tipe: string, size = "w-4 h-4") {
  switch (tipe) {
    case "Diskon Ongkir": return <Truck className={size} />;
    case "Diskon Nominal": return <DollarSign className={size} />;
    case "Diskon %": return <Percent className={size} />;
    default: return <Tag className={size} />;
  }
}

function getTipeColor(tipe: string) {
  switch (tipe) {
    case "Diskon Ongkir": return { bg: '#dbeafe', color: '#1e40af' };
    case "Diskon Nominal": return { bg: '#dcfce7', color: '#166534' };
    case "Diskon %": return { bg: '#fef3c7', color: '#92400e' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
}

function formatDiskon(promo: PromoDTO): string {
  if (promo.tipe === "Diskon %") return `${promo.nilaiDiskon}%`;
  return `Rp ${promo.nilaiDiskon.toLocaleString('id-ID')}`;
}

// ---------------------------------------------------------------------------
// Form modal (create & edit) — mengikuti desain V3.1 (AddPromoModal/EditPromoModal).
// ---------------------------------------------------------------------------

interface PromoFormProps {
  title: string;
  subtitle: string;
  value: CreatePromoInput;
  onChange: (v: CreatePromoInput) => void;
  onSubmit: () => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
}

function PromoForm({ title, subtitle, value, onChange, onSubmit, onClose, busy, error }: PromoFormProps) {
  const set = (key: keyof CreatePromoInput, next: unknown) =>
    onChange({ ...value, [key]: next } as CreatePromoInput);

  const [newSyarat, setNewSyarat] = useState("");
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});
  const isEdit = title.startsWith("Edit");

  const addSyarat = () => {
    const text = newSyarat.trim();
    if (!text) return;
    set("syaratKetentuan", [...(value.syaratKetentuan ?? []), text]);
    setNewSyarat("");
  };

  const removeSyarat = (idx: number) =>
    set("syaratKetentuan", (value.syaratKetentuan ?? []).filter((_, i) => i !== idx));

  // DatePicker memakai "YYYY-MM-DD", sedangkan state tetap "YYYY-MM-DDTHH:mm"
  // (format yang dikirim ke API — konversi tetap lewat toDateTimeLocal).
  const pickDate = (key: "tanggalMulai" | "tanggalBerakhir", d: string) => {
    const time = value[key].includes("T") ? value[key].slice(11) : "00:00";
    set(key, d ? `${d}T${time}` : "");
    setDateErrors((e) => ({ ...e, [key]: "" }));
  };

  const handleSubmit = () => {
    const errors: Record<string, string> = {};
    if (!value.tanggalMulai) errors.tanggalMulai = "Tanggal mulai wajib diisi";
    if (!value.tanggalBerakhir) errors.tanggalBerakhir = "Tanggal berakhir wajib diisi";
    if (tanggalRangeError) errors.tanggalBerakhir = tanggalRangeError;
    setDateErrors(errors);
    if (Object.keys(errors).length === 0 && !maksDiskonError) onSubmit();
  };

  // Validasi live: tanggal mulai tidak boleh setelah tanggal berakhir,
  // dan Maksimal Diskon harus lebih besar dari Nilai Diskon (khusus tipe Diskon %).
  const tanggalRangeError =
    value.tanggalMulai && value.tanggalBerakhir && value.tanggalMulai > value.tanggalBerakhir
      ? "Tanggal berakhir tidak boleh sebelum tanggal mulai"
      : "";
  const maksDiskonError =
    value.tipe === "Diskon %" &&
    value.maksimalDiskon != null && value.maksimalDiskon > 0 &&
    value.nilaiDiskon > 0 && value.maksimalDiskon <= value.nilaiDiskon
      ? "Maksimal Diskon harus lebih besar dari Nilai Diskon"
      : "";

  // Cegah nilai input angka berubah tak sengaja saat scroll mouse (human error).
  const blockWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 bg-white";
  const selectClass = "w-full pl-3 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 bg-white appearance-none cursor-pointer";
  const inputStyle = { color: '#1a0408', '--tw-ring-color': '#27b446' } as React.CSSProperties;
  const labelStyle = { color: '#1a0408' };
  const errorStyle = { color: '#e40b18' };

  return (
    <Modal onClose={onClose} className="w-full max-w-3xl mx-4">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="bg-white rounded-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 style={{ color: '#000000' }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: isEdit ? '#27b446' : '#6b7280' }}>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
          {/* Row 1: Kode + Tipe */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Kode Promo <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={value.kode}
                onChange={(e) => set("kode", e.target.value)}
                className={inputClass}
                style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
                placeholder="Contoh: DISC10"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Tipe Promo <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <div className="relative">
                <select
                  value={value.tipe}
                  onChange={(e) => {
                    const tipe = e.target.value;
                    // Maksimal diskon hanya berlaku untuk tipe Diskon %
                    onChange({
                      ...value,
                      tipe,
                      maksimalDiskon: tipe === "Diskon %" ? value.maksimalDiskon : null,
                    } as CreatePromoInput);
                  }}
                  className={selectClass}
                  style={inputStyle}
                >
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
              </div>
            </div>
          </div>

          {/* Nama */}
          <div>
            <label className="block mb-2 text-sm" style={labelStyle}>
              Nama Promo <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={value.nama}
              onChange={(e) => set("nama", e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="Nama promo yang mudah dimengerti"
            />
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block mb-2 text-sm" style={labelStyle}>Deskripsi</label>
            <textarea
              value={value.deskripsi}
              onChange={(e) => set("deskripsi", e.target.value)}
              className={inputClass}
              style={inputStyle}
              rows={2}
              placeholder="Deskripsi singkat tentang promo ini"
            />
          </div>

          {/* Row: Nilai Diskon + Minimal Belanja */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Nilai Diskon {value.tipe === "Diskon %" ? "(%)" : "(Rp)"} <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="number"
                onWheel={blockWheel}
                min="1"
                value={value.nilaiDiskon || ""}
                onChange={(e) => set("nilaiDiskon", Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
                placeholder={value.tipe === "Diskon %" ? "cth: 10 (persen)" : "cth: 25000 (rupiah)"}
              />
            </div>
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>Minimal Belanja (Rp)</label>
              <input
                type="number"
                onWheel={blockWheel}
                min="0"
                value={value.minimalBelanja}
                onChange={(e) => set("minimalBelanja", Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
                placeholder="0 = tanpa minimal"
              />
            </div>
          </div>

          {/* Row: Maksimal Diskon (khusus Diskon %) + Batas Kuota */}
          <div className="grid grid-cols-2 gap-4">
            {value.tipe === "Diskon %" && (
              <div>
                <label className="block mb-2 text-sm" style={labelStyle}>Maksimal Diskon (Rp)</label>
                <input
                  type="number"
                  onWheel={blockWheel}
                  min="0"
                  value={value.maksimalDiskon ?? ""}
                  onChange={(e) => set("maksimalDiskon", e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Kosong = tidak ada batas"
                />
                {maksDiskonError && <p className="text-xs mt-1" style={errorStyle}>{maksDiskonError}</p>}
              </div>
            )}
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Batas Kuota <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <input
                type="number"
                onWheel={blockWheel}
                min="1"
                value={value.batasKuota}
                onChange={(e) => set("batasKuota", Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row: Tanggal Mulai + Berakhir */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Tanggal Mulai <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <DatePicker
                value={value.tanggalMulai.slice(0, 10)}
                onChange={(v) => pickDate("tanggalMulai", v)}
                max={value.tanggalBerakhir.slice(0, 10) || undefined}
                className={inputClass + " cursor-pointer"}
                style={inputStyle}
              />
              {dateErrors.tanggalMulai && <p className="text-xs mt-1" style={errorStyle}>{dateErrors.tanggalMulai}</p>}
            </div>
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>
                Tanggal Berakhir <span style={{ color: '#e40b18' }}>*</span>
              </label>
              <DatePicker
                value={value.tanggalBerakhir.slice(0, 10)}
                onChange={(v) => pickDate("tanggalBerakhir", v)}
                min={value.tanggalMulai.slice(0, 10) || undefined}
                className={inputClass + " cursor-pointer"}
                style={inputStyle}
              />
              {(dateErrors.tanggalBerakhir || tanggalRangeError) && (
                <p className="text-xs mt-1" style={errorStyle}>{dateErrors.tanggalBerakhir || tanggalRangeError}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm" style={labelStyle}>Status</label>
              <button
                type="button"
                onClick={() => set("isActive", !value.isActive)}
                className="w-full px-4 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-2"
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

          {/* Syarat & Ketentuan */}
          <div>
            <label className="block mb-2 text-sm" style={labelStyle}>Syarat & Ketentuan</label>
            <div className="space-y-2 mb-3">
              {(value.syaratKetentuan ?? []).map((s, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                  <span className="flex-1 text-sm whitespace-pre-wrap break-words" style={{ color: '#1a0408' }}>• {s}</span>
                  <button
                    type="button"
                    onClick={() => removeSyarat(idx)}
                    className="p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
                    style={{ color: '#e40b18' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-start">
              <textarea
                value={newSyarat}
                onChange={(e) => setNewSyarat(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addSyarat(); } }}
                rows={2}
                className={inputClass + " flex-1 resize-y"}
                style={inputStyle}
                placeholder="Tambah syarat ketentuan (Enter untuk baris baru; Ctrl+Enter atau tombol Tambah untuk menyimpan)..."
              />
              <button
                type="button"
                onClick={addSyarat}
                className="px-4 py-2 rounded-lg text-white flex items-center gap-1 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#27b446' }}
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#27b446' }}
          >
            {busy ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Promo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Promo Detail Modal — sesuai desain V3.1 + tombol Edit.
// ---------------------------------------------------------------------------

interface PromoDetailModalProps {
  promo: PromoDTO;
  onClose: () => void;
  onEdit: (promo: PromoDTO) => void;
  onToggleStatus: (promo: PromoDTO) => void;
}

function PromoDetailModal({ promo, onClose, onEdit, onToggleStatus }: PromoDetailModalProps) {
  const sisaKuota = promo.batasKuota - promo.jumlahDigunakan;
  const persentase = promo.batasKuota > 0 ? Math.round((promo.jumlahDigunakan / promo.batasKuota) * 100) : 0;

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Detail Promo</h2>
          <p style={{ color: '#27b446', fontFamily: 'monospace' }}>ID {promo.id}</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: '#1a0408' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(90vh-160px)] px-6 py-4">
        {/* Promo Info */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-4 py-2 rounded-lg text-lg" style={{ backgroundColor: '#f3f4f6', fontFamily: 'monospace', color: '#1a0408' }}>
                  {promo.kode}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={{
                  backgroundColor: getTipeColor(promo.tipe).bg,
                  color: getTipeColor(promo.tipe).color
                }}>
                  {getTipeIcon(promo.tipe, "w-4 h-4")}
                  {promo.tipe}
                </span>
                {promo.isActive ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                    <CheckCircle className="w-4 h-4" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                    Nonaktif
                  </span>
                )}
              </div>
              <h3 className="mb-2" style={{ color: '#000000' }}>{promo.nama}</h3>
              <p style={{ color: '#1a0408', opacity: 0.8 }}>{promo.deskripsi || "Tidak ada deskripsi"}</p>
            </div>
            <button
              type="button"
              onClick={() => onEdit(promo)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors hover:bg-green-50 flex-shrink-0"
              style={{ borderColor: '#27b446', color: '#27b446' }}
            >
              <Pencil className="w-4 h-4" />
              Edit Promo
            </button>
          </div>
        </div>

        {/* Nilai Diskon */}
        <div className="mb-6">
          <h3 className="mb-3" style={{ color: '#000000' }}>Nilai Diskon</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border-2" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
              <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Potongan</p>
              <p className="text-2xl" style={{ color: '#27b446' }}>{formatDiskon(promo)}</p>
            </div>
            {promo.tipe === "Diskon %" && promo.maksimalDiskon != null && (
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Maksimal Diskon</p>
                <p className="text-xl" style={{ color: '#1a0408' }}>Rp {promo.maksimalDiskon.toLocaleString('id-ID')}</p>
              </div>
            )}
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
              <p className="text-sm mb-1" style={{ color: '#1a0408', opacity: 0.6 }}>Minimal Belanja</p>
              <p className="text-xl" style={{ color: '#1a0408' }}>
                {promo.minimalBelanja === 0 ? 'Tanpa Minimal' : `Rp ${promo.minimalBelanja.toLocaleString('id-ID')}`}
              </p>
            </div>
          </div>
        </div>

        {/* Periode Berlaku */}
        <div className="mb-6">
          <h3 className="mb-3" style={{ color: '#000000' }}>Periode Berlaku</h3>
          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
            <Calendar className="w-5 h-5" style={{ color: '#27b446' }} />
            <div className="flex-1">
              <p style={{ color: '#1a0408' }}>
                {fmtWib(promo.tanggalMulai, "dd MMMM yyyy")} - {fmtWib(promo.tanggalBerakhir, "dd MMMM yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Kuota Penggunaan */}
        <div className="mb-6">
          <h3 className="mb-3" style={{ color: '#000000' }}>Kuota Penggunaan</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={{ color: '#1a0408' }}>Telah Digunakan</span>
              <span style={{ color: '#27b446' }}>{promo.jumlahDigunakan} / {promo.batasKuota}</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, persentase)}%`,
                  backgroundColor: persentase >= 90 ? '#e40b18' : persentase >= 70 ? '#f59e0b' : '#27b446'
                }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: '#1a0408', opacity: 0.6 }}>Sisa Kuota: {Math.max(0, sisaKuota)}</span>
              <span style={{ color: '#1a0408', opacity: 0.6 }}>{persentase}%</span>
            </div>
          </div>
        </div>

        {/* Syarat & Ketentuan */}
        <div>
          <h3 className="mb-3" style={{ color: '#000000' }}>Syarat & Ketentuan</h3>
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
            {promo.syaratKetentuan.length > 0 ? (
              <ul className="space-y-2">
                {promo.syaratKetentuan.map((syarat, idx) => (
                  <li key={idx} className="flex items-start gap-2" style={{ color: '#1a0408' }}>
                    <span style={{ color: '#27b446', marginTop: '4px' }}>•</span>
                    <span>{syarat}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#1a0408', opacity: 0.6 }}>Tidak ada syarat & ketentuan</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
          style={{ borderColor: '#e40b18', color: '#e40b18' }}
        >
          Tutup
        </button>
        {promo.isActive ? (
          <button
            type="button"
            onClick={() => onToggleStatus(promo)}
            className="flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors hover:bg-red-50"
            style={{ borderColor: '#e40b18', color: '#e40b18' }}
          >
            <X className="w-4 h-4" />
            Nonaktifkan Promo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleStatus(promo)}
            className="flex-1 py-3 rounded-lg text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}
          >
            <CheckCircle className="w-4 h-4" />
            Aktifkan Promo
          </button>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Promo main page
// ---------------------------------------------------------------------------

export default function Promo() {
  const [items, setItems] = useState<PromoDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [search, setSearch] = useState("");
  const [tipe, setTipe] = useState("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAddPromoMenu, setShowAddPromoMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PromoDTO | null>(null);
  const [viewing, setViewing] = useState<PromoDTO | null>(null);
  const [form, setForm] = useState<CreatePromoInput>(emptyForm);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sortBy = sortField ?? undefined;
      const sortOrder = sortDirection ?? undefined;
      const result = await listPromos({
        page, pageSize: itemsPerPage,
        search, tipe: tipe === "all" ? "" : tipe,
        sortBy, sortOrder,
      });
      setItems(result.items);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat data promo.");
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, search, tipe, sortField, sortDirection]);

  useEffect(() => { void load(); }, [load]);

  // Reset selection when the visible page changes.
  useEffect(() => { setSelected(new Set()); }, [items]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortField(null); setSortDirection(null); }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const handleSelectAll = () => {
    if (items.length > 0 && items.every((p) => selected.has(p.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((p) => p.id)));
    }
  };

  const handleSelectPromo = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const saveCreate = async () => {
    setFormError("");
    setBusy(true);
    try {
      await createPromo(form);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan promo.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setFormError("");
    setBusy(true);
    try {
      await updatePromo(editing.id, form);
      setEditing(null);
      setViewing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Gagal menyimpan perubahan promo.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (promo: PromoDTO) => {
    try {
      const updated = await updatePromo(promo.id, { isActive: !promo.isActive });
      setViewing((v) => (v && v.id === promo.id ? updated : v));
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status promo.");
    }
  };

  const bulkSetActive = async (active: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => updatePromo(id, { isActive: active })));
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah status promo terpilih.");
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    try {
      const result = await listPromos({ page: 1, pageSize: 100, search, tipe: tipe === "all" ? "" : tipe });
      downloadPromoCsv(result.items);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal export data promo.");
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
      <AdminSidebar activePage="promo" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ color: '#000000' }}>Promo</h1>
              <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola promo dan diskon produk
              </p>
            </div>

            {selected.size > 0 ? (
              <div className="flex items-center gap-3">
                <span style={{ color: '#1a0408' }}>{selected.size} promo dipilih</span>
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
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void exportData()}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
                  style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                  title="Export seluruh data promo (CSV)"
                >
                  <Download className="w-5 h-5" />
                  Export Data
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowAddPromoMenu(!showAddPromoMenu)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#27b446' }}
                  >
                    <Plus className="w-5 h-5" />
                    Tambah Promo
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {showAddPromoMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAddPromoMenu(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
                        <button
                          onClick={() => { setShowAddPromoMenu(false); setFormError(""); setShowCreate(true); }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          style={{ color: '#1a0408' }}
                        >
                          <Edit className="w-5 h-5" style={{ color: '#27b446' }} />
                          <div>
                            <p style={{ color: '#000000' }}>Manual</p>
                            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>Isi form satu per satu</p>
                          </div>
                        </button>
                        <button
                          onClick={() => { setShowAddPromoMenu(false); setShowBulkUpload(true); }}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-t border-gray-200"
                          style={{ color: '#1a0408' }}
                        >
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
            )}
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#1a0408', opacity: 0.4 }} />
              <input
                type="text"
                placeholder="Cari berdasarkan ID, kode, atau nama promo..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: '#1a0408', opacity: 0.6 }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={tipe}
                onChange={(e) => { setTipe(e.target.value); setPage(1); }}
                className="appearance-none pl-4 pr-10 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 cursor-pointer"
                style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
              >
                <option value="all">Semua Tipe</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-auto p-8">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center">
                <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat data promo...</p>
              </div>
            ) : items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#fcfaff', borderBottom: '2px solid #e5e7eb' }}>
                        <th className="px-6 py-4 text-center" style={{ width: '50px' }}>
                          <button onClick={handleSelectAll} className="flex items-center justify-center" style={{ color: '#27b446' }}>
                            {items.length > 0 && items.every((p) => selected.has(p.id)) ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("id")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            ID Promo
                            {getSortIcon("id")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("kode")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Kode Promo
                            {getSortIcon("kode")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("nama")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Nama Promo
                            {getSortIcon("nama")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <button onClick={() => handleSort("tipe")} className="flex items-center gap-2 hover:opacity-70 transition-opacity" style={{ color: '#000000' }}>
                            Tipe Promo
                            {getSortIcon("tipe")}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-center" style={{ color: '#000000' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((promo, index) => (
                        <tr
                          key={promo.id}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fcfaff' }}
                        >
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleSelectPromo(promo.id, !selected.has(promo.id))}
                              className="flex items-center justify-center"
                              style={{ color: '#27b446' }}
                            >
                              {selected.has(promo.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(promo)} style={{ color: '#27b446', fontFamily: 'monospace' }}>
                            {promo.id}
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(promo)} style={{ color: '#1a0408' }}>
                            <span className="px-3 py-1 rounded-lg text-sm" style={{ backgroundColor: '#f3f4f6', fontFamily: 'monospace' }}>
                              {promo.kode}
                            </span>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(promo)} style={{ color: '#1a0408' }}>
                            {promo.nama}
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => setViewing(promo)}>
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm" style={{
                              backgroundColor: getTipeColor(promo.tipe).bg,
                              color: getTipeColor(promo.tipe).color
                            }}>
                              {getTipeIcon(promo.tipe)}
                              {promo.tipe}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center cursor-pointer" onClick={() => setViewing(promo)}>
                            {promo.isActive ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                                <CheckCircle className="w-4 h-4" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                                Nonaktif
                              </span>
                            )}
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
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 cursor-pointer"
                        style={{ color: '#1a0408', '--tw-ring-color': '#27b446' } as any}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#1a0408', opacity: 0.6 }} />
                    </div>
                    <span style={{ color: '#1a0408', opacity: 0.7 }}>
                      Menampilkan {rangeStart} - {rangeEnd} dari {total} promo
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      style={{ color: '#1a0408' }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex gap-1">
                      {pageNumbers.map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className="w-10 h-10 rounded-lg transition-colors"
                          style={{
                            backgroundColor: page === pageNum ? '#27b446' : 'transparent',
                            color: page === pageNum ? 'white' : '#1a0408',
                            border: page === pageNum ? 'none' : '1px solid #e5e7eb'
                          }}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                      style={{ color: '#1a0408' }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)' }}>
                    <Tag className="w-8 h-8" style={{ color: '#27b446' }} />
                  </div>
                  <div>
                    <p className="text-lg mb-1" style={{ color: '#000000' }}>Promo tidak ditemukan</p>
                    <p style={{ color: '#1a0408', opacity: 0.6 }}>
                      Coba gunakan kata kunci pencarian yang berbeda
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {viewing && (
        <PromoDetailModal
          promo={viewing}
          onClose={() => setViewing(null)}
          onEdit={(promo) => {
            setViewing(null);
            setFormError("");
            setEditing(promo);
            setForm({
              kode: promo.kode, nama: promo.nama, tipe: promo.tipe, deskripsi: promo.deskripsi,
              nilaiDiskon: promo.nilaiDiskon, minimalBelanja: promo.minimalBelanja,
              maksimalDiskon: promo.tipe === "Diskon %" ? promo.maksimalDiskon : null, tanggalMulai: toDateTimeLocal(promo.tanggalMulai),
              tanggalBerakhir: toDateTimeLocal(promo.tanggalBerakhir), batasKuota: promo.batasKuota,
              syaratKetentuan: promo.syaratKetentuan, isActive: promo.isActive,
            });
          }}
          onToggleStatus={(promo) => void toggleStatus(promo)}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <PromoForm
          title="Tambah Promo Baru"
          subtitle="Isi data promo yang ingin ditambahkan"
          value={form}
          onChange={setForm}
          onSubmit={() => void saveCreate()}
          onClose={() => { setShowCreate(false); setForm(emptyForm); }}
          busy={busy}
          error={formError}
        />
      )}

      {/* Edit modal */}
      {editing && !viewing && (
        <PromoForm
          title="Edit Promo"
          subtitle={`ID ${editing.id}`}
          value={form}
          onChange={setForm}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy}
          error={formError}
        />
      )}

      {/* Bulk upload modal */}
      {showBulkUpload && (
        <BulkUploadPromoModal
          onClose={() => setShowBulkUpload(false)}
          onDone={() => void load()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Upload Promo Modal — mengikuti alur bulk produk: info format file +
// unduh sample file.
// ---------------------------------------------------------------------------

interface BulkUploadPromoModalProps {
  onClose: () => void;
  onDone: () => void | Promise<void>;
}

function BulkUploadPromoModal({ onClose, onDone }: BulkUploadPromoModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkPromoResult | null>(null);

  const handleDownloadSample = () => {
    // Satu contoh per tipe promo. Maksimal Diskon hanya diisi untuk Diskon %.
    const csvContent = [
      "Kode,Nama,Tipe,Deskripsi,Nilai Diskon,Minimal Belanja,Maksimal Diskon,Tanggal Mulai,Tanggal Berakhir,Batas Kuota",
      "DISC10,Diskon 10 Persen,Diskon %,Diskon 10% semua produk,10,100000,50000,2026-12-01,2026-12-31,100",
      "POTONG5RB,Potongan 5 Ribu,Diskon Nominal,Diskon Rp5.000,5000,50000,,2026-12-01,2026-12-31,100",
      "ONGKIR10RB,Potongan Ongkir 10 Ribu,Diskon Ongkir,Potongan ongkir Rp10.000,10000,100000,,2026-12-01,2026-12-31,50",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-promo.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || processing) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Ukuran file melebihi 10MB. Kurangi baris atau pecah menjadi beberapa file.");
      return;
    }
    setProcessing(true);
    setError("");
    setResult(null);
    try {
      const rows = parseCsv(await selectedFile.text());
      const header = rows[0].map((x) => x.trim().toLowerCase());
      const value = (row: string[], ...names: string[]) => {
        const index = names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
        return index >= 0 ? row[index] ?? "" : "";
      };
      const payload = rows.slice(1).map((row) => {
        const tipe = value(row, "tipe", "tipe promo") as PromoType;
        return {
          ...emptyForm,
          kode: value(row, "kode", "kode promo"),
          nama: value(row, "nama", "nama promo"),
          tipe,
          deskripsi: value(row, "deskripsi"),
          nilaiDiskon: Number(value(row, "nilai diskon", "nilai")),
          minimalBelanja: Number(value(row, "minimal belanja")) || 0,
          // Maksimal diskon hanya berlaku untuk tipe Diskon %
          maksimalDiskon: tipe === "Diskon %" && value(row, "maksimal diskon") ? Number(value(row, "maksimal diskon")) : null,
          tanggalMulai: value(row, "tanggal mulai"),
          tanggalBerakhir: value(row, "tanggal berakhir"),
          batasKuota: Number(value(row, "batas kuota")) || 1,
        } as CreatePromoInput;
      });
      const res = await bulkCreatePromos(payload);
      setResult(res);
      await onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Gagal membaca file. Pastikan file CSV valid.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: '#000000' }}>Upload Promo Bulk</h2>
          <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
            Upload file CSV (maksimal 10MB)
          </p>
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
      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: '#fee2e2' }}>
            <p style={{ color: '#991b1b' }}>⚠ {error}</p>
          </div>
        )}
        {/* Upload Area */}
        <div
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-opacity-100"
          style={{ borderColor: 'rgba(39,180,70,0.5)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setError(""); setResult(null); }}
            className="hidden"
          />
          <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: '#27b446', opacity: 0.6 }} />
          {selectedFile ? (
            <div>
              <p style={{ color: '#27b446' }}>
                ✓ {selectedFile.name}
              </p>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#000000' }}>
                Klik untuk memilih file atau drag & drop
              </p>
              <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                CSV, maksimal 10MB
              </p>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(39,180,70,0.08)', border: '1px solid rgba(39,180,70,0.25)' }}>
            <p style={{ color: '#166534', fontWeight: 600 }}>
              Berhasil: {result.success} promo
            </p>
            {result.failures.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                {result.failures.map((f, i) => (
                  <p key={i} className="text-sm mt-1" style={{ color: '#991b1b' }}>
                    Baris {f.row + 1}{f.kode ? ` (${f.kode})` : ""}: {f.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Template */}
        <div className="mt-6 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ color: '#000000' }}>Format File:</p>
            <button
              onClick={handleDownloadSample}
              className="text-sm px-3 py-1 rounded transition-colors"
              style={{
                color: '#27b446',
                textDecoration: 'underline'
              }}
            >
              Unduh Sample File
            </button>
          </div>
          <p className="text-sm mb-2" style={{ color: '#1a0408', opacity: 0.7 }}>
            File harus memiliki kolom berikut (sesuai urutan):
          </p>
          <div className="text-sm font-mono p-3 rounded border border-gray-300 bg-white" style={{ color: '#1a0408' }}>
            Kode, Nama, Tipe, Deskripsi, Nilai Diskon, Minimal Belanja, Maksimal Diskon, Tanggal Mulai, Tanggal Berakhir, Batas Kuota
          </div>
          <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
            Tipe promo: &ldquo;Diskon Ongkir&rdquo;, &ldquo;Diskon Nominal&rdquo;, atau &ldquo;Diskon %&rdquo;. Nilai Diskon dalam persen (%) untuk Diskon %, dan rupiah untuk Diskon Nominal / Diskon Ongkir.
          </p>
          <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
            Maksimal Diskon hanya untuk tipe Diskon % (kosongkan untuk tipe lain). Tanggal format YYYY-MM-DD, contoh 2026-12-01.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
          style={{
            borderColor: '#e40b18',
            color: '#e40b18'
          }}
        >
          Batal
        </button>
        <button
          onClick={() => void handleUpload()}
          disabled={!selectedFile || processing}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#27b446' }}
        >
          {processing ? "Memproses..." : "Upload & Proses"}
        </button>
      </div>
    </Modal>
  );
}
