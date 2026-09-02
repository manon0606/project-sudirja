import { apiFetch } from "@/lib/api-client";
import type {
  BulkOngkirResult,
  CreateOngkirInput,
  OngkirDTO,
  OngkirListResponse,
  UpdateOngkirInput,
} from "@/lib/ongkir-types";

export interface OngkirListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: OngkirListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listOngkir(p: OngkirListParams = {}): Promise<OngkirListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/ongkir${q ? `?${q}` : ""}`);
}

export function createOngkir(input: CreateOngkirInput): Promise<OngkirDTO> {
  return apiFetch("/api/backoffice-sudirja/ongkir", { method: "POST", body: JSON.stringify(input) });
}

export function updateOngkir(kode: string, input: UpdateOngkirInput): Promise<OngkirDTO> {
  return apiFetch(`/api/backoffice-sudirja/ongkir/${encodeURIComponent(kode)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteOngkir(kode: string): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/ongkir/${encodeURIComponent(kode)}`, { method: "DELETE" });
}

export function bulkCreateOngkir(rows: CreateOngkirInput[]): Promise<BulkOngkirResult> {
  return apiFetch("/api/backoffice-sudirja/ongkir/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadOngkirCsv(items: OngkirDTO[]): void {
  const headers = ["ID", "Kode", "Kecamatan", "Ongkir", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = items.map((o) =>
    [o.id, o.kode, o.kecamatan, o.ongkir, o.isActive ? "Aktif" : "Nonaktif"].map(esc).join(","),
  );
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-ongkir-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
