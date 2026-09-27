"use client";
import { useRef, useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { createMerk, createSatuan, createKategori } from "@/lib/product-api";
import { Upload, X, FileSpreadsheet } from "lucide-react";
import Modal from "./Modal";

// ---------------------------------------------------------------------------
// Bulk upload bersama untuk satuan / merk / kategori — konsisten dengan bulk
// upload produk. Kolom CSV:
//   satuan   : Nama, Jumlah Unit
//   merk     : Nama
//   kategori : Nama
// Setiap baris = create satu record (duplikat nama ditolak server per baris).
// ---------------------------------------------------------------------------

export type ReferenceKind = "satuan" | "merk" | "kategori";

export interface ExportableReference {
  kode: string;
  nama: string;
  jumlahUnit?: number;
  isActive: boolean;
}

/** Unduh seluruh data reference (satuan/merk/kategori) sebagai CSV detail. */
export function downloadReferenceCsv(kind: ReferenceKind, items: ExportableReference[]): void {
  // Referensi (satuan/merk/kategori) tidak mengelola "status/aktif" di UI —
  // export hanya kolom identitas (Kode, Nama, + Jumlah Unit utk satuan).
  const headers =
    kind === "satuan"
      ? ["Kode", "Nama", "Jumlah Unit"]
      : ["Kode", "Nama"];
  const rows = items.map((r) =>
    kind === "satuan"
      ? [r.kode, r.nama, String(r.jumlahUnit ?? 1)]
      : [r.kode, r.nama],
  );

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `data-${kind}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

interface BulkUploadReferenceModalProps {
  kind: ReferenceKind;
  onClose: () => void;
  onDone: () => void;
}

interface FailureRow {
  row: number;
  message: string;
}

/** Minimal CSV parser — handles double-quoted fields. */
export function parseCsv(text: string): string[][] {
  // Buang BOM (\uFEFF) di awal — sering muncul dari file CSV (mis. Excel)
  // dan menyebabkan kolom header pertama tak cocok dgn nama kolom.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const KIND_LABEL: Record<ReferenceKind, string> = {
  satuan: "Satuan",
  merk: "Merk",
  kategori: "Kategori",
};

/**
 * Template CSV per jenis referensi. Merk & kategori WAJIB berbeda:
 * merk = nama merek/brand, kategori = kelompok/jenis produk.
 */
function sampleCsv(kind: ReferenceKind): string {
  if (kind === "satuan") {
    return [
      "Nama,Jumlah Unit",
      "Pcs,1",
      "Dus,12",
      "Lusin,12",
    ].join("\n");
  }
  if (kind === "merk") {
    return [
      "Nama",
      "Indomie",
      "Ultra",
      "ABC",
    ].join("\n");
  }
  // kategori
  return [
    "Nama",
    "Makanan & Minuman",
    "Elektronik",
    "Perawatan Tubuh",
  ].join("\n");
}

export default function BulkUploadReferenceModal({ kind, onClose, onDone }: BulkUploadReferenceModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; failures: FailureRow[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");
    setResult(null);
    if (!file) return;
    if (!file.name.match(/\.(csv)$/i)) {
      setError("Format file harus CSV");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }
    setSelectedFile(file);
  };

  const handleDownloadSample = () => {
    const csvContent = sampleCsv(kind);
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `template-bulk-${kind}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Pilih file terlebih dahulu");
      return;
    }

    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const text = await selectedFile.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        setError("File kosong atau tidak memiliki baris data.");
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idxNama = header.indexOf("nama");
      const idxJumlah = header.indexOf("jumlah unit");
      if (idxNama < 0) {
        setError("Kolom wajib 'Nama' tidak ditemukan di baris header.");
        return;
      }

      const failures: FailureRow[] = [];
      let success = 0;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const nama = (idxNama >= 0 ? (r[idxNama] ?? "").trim() : "");
        if (!nama) {
          failures.push({ row: i + 1, message: "Nama wajib diisi." });
          continue;
        }

        try {
          if (kind === "satuan") {
            const jumlahUnit = Number(idxJumlah >= 0 ? (r[idxJumlah] ?? "").trim() : "1");
            if (!Number.isInteger(jumlahUnit) || jumlahUnit < 1) {
              failures.push({ row: i + 1, message: "Jumlah Unit wajib angka bulat >= 1." });
              continue;
            }
            await createSatuan({ nama, jumlahUnit });
          } else if (kind === "merk") {
            await createMerk({ nama });
          } else {
            await createKategori({ nama });
          }
          success++;
        } catch (err) {
          failures.push({
            row: i + 1,
            message: err instanceof ApiClientError ? err.message : "Gagal menyimpan data.",
          });
        }
      }

      setResult({ success, failures });
      if (failures.length === 0) {
        onDone();
      }
    } catch {
      setError("Gagal membaca file. Pastikan file CSV valid.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 style={{ color: '#000000' }}>Bulk Upload {KIND_LABEL[kind]}</h2>
            <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Upload file CSV untuk menambah {KIND_LABEL[kind].toLowerCase()} secara massal
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
              <p className="text-sm" style={{ color: '#991b1b' }}>⚠ {error}</p>
            </div>
          )}
          {/* Download Template */}
          <div className="mb-6 p-4 rounded-lg border-2 border-dashed" style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: '#27b446' }} />
              <div className="flex-1">
                <p className="mb-1" style={{ color: '#000000' }}>Unduh Template</p>
                <p className="text-sm mb-3" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Gunakan template ini sebagai panduan format file upload
                </p>
                <button
                  onClick={handleDownloadSample}
                  className="px-4 py-2 rounded-lg border transition-all hover:opacity-90 text-sm"
                  style={{
                    borderColor: '#27b446',
                    color: '#27b446'
                  }}
                >
                  Unduh Template CSV
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-4">
            <label className="block mb-2 text-sm" style={{ color: '#1a0408' }}>
              Upload File <span style={{ color: '#e40b18' }}>*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-8 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3"
              style={{
                borderColor: selectedFile ? '#27b446' : '#e5e7eb',
                backgroundColor: selectedFile ? 'rgba(39, 180, 70, 0.05)' : 'transparent',
                color: selectedFile ? '#27b446' : '#1a0408'
              }}
            >
              <Upload className="w-8 h-8" />
              <div className="text-center">
                {selectedFile ? (
                  <>
                    <p className="mb-1" style={{ color: '#27b446' }}>✓ {selectedFile.name}</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Klik untuk mengganti file
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-1">Klik untuk upload file</p>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Format: CSV (Max 5MB)
                    </p>
                  </>
                )}
              </div>
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(39,180,70,0.08)', border: '1px solid rgba(39,180,70,0.25)' }}>
              <p style={{ color: '#166534', fontWeight: 600 }}>
                Berhasil: {result.success} data
              </p>
              {result.failures.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {result.failures.map((f, i) => (
                    <p key={i} className="text-sm mt-1" style={{ color: '#991b1b' }}>
                      Baris {f.row}: {f.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Info Format */}
          <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
            <p className="text-sm mb-2" style={{ color: '#000000' }}>Format File:</p>
            <div className="text-sm font-mono p-3 rounded border border-gray-300 bg-white" style={{ color: '#1a0408' }}>
              {kind === "satuan" ? "Nama, Jumlah Unit" : "Nama"}
            </div>
            <p className="text-sm mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
              {kind === "satuan"
                ? "Kolom 1: Nama (wajib). Kolom 2: Jumlah Unit (opsional, angka >= 1, default 1)."
                : "Kolom 1: Nama (wajib)."}
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
            onClick={handleUpload}
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
