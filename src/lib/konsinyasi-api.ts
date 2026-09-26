import { apiFetch } from "@/lib/api-client";
import type {
  BulkKonsinyasiResult,
  CreateKonsinyasiInput,
  KonsinyasiDTO,
  KonsinyasiListResponse,
  KonsinyasiStatus,
} from "@/lib/konsinyasi-types";

export interface KonsinyasiListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: KonsinyasiListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listKonsinyasi(p: KonsinyasiListParams = {}): Promise<KonsinyasiListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/konsinyasi${q ? `?${q}` : ""}`);
}

export function getKonsinyasi(id: number): Promise<KonsinyasiDTO> {
  return apiFetch(`/api/backoffice-sudirja/konsinyasi/${id}`);
}

export function createKonsinyasi(input: CreateKonsinyasiInput): Promise<KonsinyasiDTO> {
  return apiFetch("/api/backoffice-sudirja/konsinyasi", { method: "POST", body: JSON.stringify(input) });
}

export function updateKonsinyasiStatus(id: number, status: KonsinyasiStatus): Promise<KonsinyasiDTO> {
  return apiFetch(`/api/backoffice-sudirja/konsinyasi/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function returKonsinyasi(id: number, items: Array<{ id: number; qtyReturn: number }>): Promise<KonsinyasiDTO> {
  return apiFetch(`/api/backoffice-sudirja/konsinyasi/${id}/retur`, { method: "POST", body: JSON.stringify({ items }) });
}

export function deleteKonsinyasi(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/konsinyasi/${id}`, { method: "DELETE" });
}

export function bulkCreateKonsinyasi(rows: CreateKonsinyasiInput[]): Promise<BulkKonsinyasiResult> {
  return apiFetch("/api/backoffice-sudirja/konsinyasi/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadKonsinyasiCsv(items: KonsinyasiDTO[]): void {
  const headers = ["No. Konsinyasi", "Tanggal", "Supplier", "Item", "Qty", "Terjual", "Dikembalikan", "Harga Beli", "Harga Jual", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body: string[] = [];
  for (const k of items) {
    if (k.items.length === 0) {
      body.push([k.noKonsinyasi, k.tanggal, k.supplier.nama, "", "", "", "", "", "", k.status].map(esc).join(","));
      continue;
    }
    for (const it of k.items) {
      body.push([k.noKonsinyasi, k.tanggal, k.supplier.nama, it.namaProduk, it.qtyKonsinyasi, it.qtyTerjual, it.qtyDikembalikan, it.hargaBeli, it.hargaJual, k.status].map(esc).join(","));
    }
  }
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-konsinyasi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
