"use client";

/**
 * Komponen aksi header yang KONSISTEN di semua halaman admin:
 *  - <ExportButton /> : outline hijau (px-5 py-3) utk export/download.
 *  - <AddButton />    : solid hijau (px-6 py-3) utk tambah.
 *  - <AddDropdown />  : solid hijau + chevron utk Tambah dengan sub-aksi
 *                       (mis. Manual / Bulk Upload).
 *
 * Spesifikasi UI/UX seragam di seluruh fitur:
 *  Export → border-2 #27b446, teks #27b446, bg rgba(39,180,70,0.05), icon w-5 h-5.
 *  Tambah → bg #27b446 solid putih, icon w-5 h-5 (+ chevron bila ada sub-aksi).
 */
import { useState, type ReactNode } from "react";
import { Download, Plus, ChevronDown, Edit, Upload, type LucideIcon } from "lucide-react";

export interface DropdownItem {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
}

/** Tombol Export Data — outline hijau seragam. */
export function ExportButton({ onClick, label = "Export Data", icon: Icon = Download, title }: {
  onClick: () => void;
  label?: string;
  icon?: LucideIcon;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90"
      style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
      title={title ?? "Export seluruh data (CSV)"}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

/** Tombol aksi solid hijau (tanpa dropdown) — mis. "Bulk Upload Stok". */
export function AddButton({ onClick, label = "Tambah Data", icon: Icon = Plus, title }: {
  onClick?: () => void;
  label?: string;
  icon?: LucideIcon;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: '#27b446' }}
      title={title}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

/** Dropdown "Tambah Data" dengan sub-aksi (Manual / Bulk Upload). */
export function AddDropdown({ label = "Tambah Data", items }: { label?: string; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#27b446' }}
      >
        <Plus className="w-5 h-5" />
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-20">
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => { setOpen(false); item.onClick(); }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${idx > 0 ? "border-t border-gray-200" : ""}`}
                  style={{ color: '#1a0408' }}
                >
                  <Icon className="w-5 h-5" style={{ color: '#27b446' }} />
                  <div>
                    <p style={{ color: '#000000' }}>{item.label}</p>
                    {item.description && <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>{item.description}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Helper: pasangan item Manual + Bulk utk dropdown tambah standar. */
export function manualBulkItems(manual: () => void, bulk: () => void): DropdownItem[] {
  return [
    { key: "manual", label: "Manual", description: "Isi form satu per satu", icon: Edit, onClick: manual },
    { key: "bulk", label: "Bulk Upload", description: "CSV atau XLSX", icon: Upload, onClick: bulk },
  ];
}

/** Gabungan Export + Add di kanan header (konten ekstra via children). */
export function HeaderActions({ onExport, addLabel, addItems, children }: {
  onExport?: () => void;
  addLabel?: string;
  addItems?: DropdownItem[];
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {onExport && <ExportButton onClick={onExport} />}
      {children}
      {addItems && addItems.length > 0 && <AddDropdown label={addLabel} items={addItems} />}
    </div>
  );
}
