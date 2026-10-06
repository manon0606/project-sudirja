import { apiFetch } from "@/lib/api-client";
import { fmtWib } from "@/lib/date-utils";
import type {
  CreatePembelianInput,
  PembelianDTO,
  PembelianListResponse,
} from "@/lib/pembelian-types";

export interface PembelianListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: PembelianListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listPembelian(p: PembelianListParams = {}): Promise<PembelianListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/pembelian${q ? `?${q}` : ""}`);
}

export function getPembelian(id: number): Promise<PembelianDTO> {
  return apiFetch(`/api/backoffice-sudirja/pembelian/${id}`);
}

export function createPembelian(input: CreatePembelianInput): Promise<PembelianDTO> {
  return apiFetch("/api/backoffice-sudirja/pembelian", { method: "POST", body: JSON.stringify(input) });
}

export function deletePembelian(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/pembelian/${id}`, { method: "DELETE" });
}

export interface BulkPembelianResult {
  success: number;
  failures: Array<{ row: number; noPembelian: string; message: string }>;
}

export function bulkCreatePembelian(rows: CreatePembelianInput[]): Promise<BulkPembelianResult> {
  return apiFetch("/api/backoffice-sudirja/pembelian/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadPembelianCsv(items: PembelianDTO[]): void {
  const headers = ["No. Pembelian", "Tanggal", "Supplier", "Produk", "Satuan", "Qty", "Harga Beli", "Diskon %", "Harga Jual", "PPN %", "Total Beli", "Estimasi Laba"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body: string[] = [];
  for (const p of items) {
    if (!p.items.length) {
      body.push([p.noPembelian, fmtWib(p.tanggal, "dd MMM yyyy, HH:mm"), p.supplier.nama, "", "", "", "", "", "", p.ppn, p.totalPembelian, p.estimasiLaba].map(esc).join(","));
      continue;
    }
    for (const it of p.items) {
      body.push([p.noPembelian, fmtWib(p.tanggal, "dd MMM yyyy, HH:mm"), p.supplier.nama, it.namaProduk, it.satuanNama ?? "", it.qty, it.hargaBeli, it.diskon, it.hargaJual, p.ppn, p.totalPembelian, p.estimasiLaba].map(esc).join(","));
    }
  }
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-pembelian-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
