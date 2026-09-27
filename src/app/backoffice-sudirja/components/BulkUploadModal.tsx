"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import Modal from "./Modal";

// ---------------------------------------------------------------------------
// Bulk Upload Modal — pola tunggal "Upload X Bulk" (drag & drop + Format File +
// Unduh Sample File + hasil upload), konsisten dengan modal Upload Promo Bulk.
// Parser/proses per flow disuntikkan lewat props (onFile) — komponen ini murni UI.
// ---------------------------------------------------------------------------

export interface BulkUploadSample {
  headers: string[];
  rows: string[][];
}

export interface BulkUploadFailure {
  row: number;
  label?: string;
  message: string;
}

export interface BulkUploadOutcome {
  success: number;
  failures: BulkUploadFailure[];
}

interface BulkUploadModalProps {
  /** Judul modal, mis. "Upload Konsinyasi Bulk". */
  title: string;
  /** Label hasil, mis. "konsinyasi" → "Berhasil: 2 konsinyasi". */
  resultLabel: string;
  /** Daftar kolom wajib (kotak font-mono pada panel Format File). */
  columns: string[];
  /** Aturan tambahan (paragraf di bawah kotak kolom) — opsional. */
  formatNote?: string;
  /** Konten sample file yang bisa diunduh user. */
  sample: BulkUploadSample;
  sampleFilename: string;
  accept?: string;
  /** Proses file terpilih → hasil {success, failures}. */
  onFile: (file: File) => Promise<BulkUploadOutcome>;
  /** Dipanggil setelah upload selesai (reload list). */
  onDone: () => void | Promise<void>;
  onClose: () => void;
}

/** Unduh sample CSV (BOM + quoting, konsisten dgn export CSV lainnya). */
function downloadSampleCsv(sample: BulkUploadSample, filename: string): void {
  const esc = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = [sample.headers.map(esc).join(","), ...sample.rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export default function BulkUploadModal({
  title,
  resultLabel,
  columns,
  formatNote,
  sample,
  sampleFilename,
  accept = ".csv",
  onFile,
  onDone,
  onClose,
}: BulkUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkUploadOutcome | null>(null);

  const handleUpload = async () => {
    if (!selectedFile || processing) return;
    setProcessing(true);
    setError("");
    setResult(null);
    try {
      const res = await onFile(selectedFile);
      setResult(res);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file. Pastikan file CSV valid.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl w-full max-w-2xl mx-4 shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 style={{ color: "#000000" }}>{title}</h2>
          <p className="text-sm mt-1" style={{ color: "#1a0408", opacity: 0.6 }}>
            Upload file CSV (maksimal 10MB)
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "#1a0408" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg" style={{ backgroundColor: "#fee2e2" }}>
            <p style={{ color: "#991b1b" }}>⚠ {error}</p>
          </div>
        )}

        {/* Upload Area */}
        <div
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors hover:border-opacity-100"
          style={{ borderColor: "rgba(39,180,70,0.5)" }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) { setSelectedFile(f); setError(""); setResult(null); }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={(e) => { setSelectedFile(e.target.files?.[0] ?? null); setError(""); setResult(null); }}
            className="hidden"
          />
          <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: "#27b446", opacity: 0.6 }} />
          {selectedFile ? (
            <div>
              <p style={{ color: "#27b446" }}>✓ {selectedFile.name}</p>
              <p className="text-sm mt-1" style={{ color: "#1a0408", opacity: 0.6 }}>
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: "#000000" }}>Klik untuk memilih file atau drag & drop</p>
              <p className="text-sm mt-1" style={{ color: "#1a0408", opacity: 0.6 }}>CSV, maksimal 10MB</p>
            </div>
          )}
        </div>

        {/* Hasil upload */}
        {result && (
          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "rgba(39,180,70,0.08)", border: "1px solid rgba(39,180,70,0.25)" }}>
            <p style={{ color: "#166534", fontWeight: 600 }}>
              Berhasil: {result.success} {resultLabel}
            </p>
            {result.failures.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                {result.failures.map((f, i) => (
                  <p key={i} className="text-sm mt-1" style={{ color: "#991b1b" }}>
                    Baris {f.row}{f.label ? ` (${f.label})` : ""}: {f.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Template */}
        <div className="mt-6 p-4 rounded-lg border border-gray-200" style={{ backgroundColor: "#f9fafb" }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ color: "#000000" }}>Format File:</p>
            <button
              onClick={() => downloadSampleCsv(sample, sampleFilename)}
              className="text-sm px-3 py-1 rounded transition-colors"
              style={{ color: "#27b446", textDecoration: "underline" }}
            >
              Unduh Sample File
            </button>
          </div>
          <p className="text-sm mb-2" style={{ color: "#1a0408", opacity: 0.7 }}>
            File harus memiliki kolom berikut (sesuai urutan):
          </p>
          <div className="text-sm font-mono p-3 rounded border border-gray-300 bg-white" style={{ color: "#1a0408" }}>
            {columns.join(", ")}
          </div>
          {formatNote && (
            <p className="text-sm mt-2" style={{ color: "#1a0408", opacity: 0.6 }}>
              {formatNote}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
          style={{ borderColor: "#e40b18", color: "#e40b18" }}
        >
          Batal
        </button>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || processing}
          className="flex-1 py-3 rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#27b446" }}
        >
          {processing ? "Memproses..." : "Upload & Proses"}
        </button>
      </div>
    </Modal>
  );
}
