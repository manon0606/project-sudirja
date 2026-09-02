import { apiFetch } from "@/lib/api-client";
import type {
  BulkPelangganResult,
  CreatePelangganInput,
  PelangganDTO,
  PelangganListResponse,
  UpdatePelangganInput,
} from "@/lib/pelanggan-types";

export interface PelangganListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: PelangganListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listPelanggan(p: PelangganListParams = {}): Promise<PelangganListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/pelanggan${q ? `?${q}` : ""}`);
}

export function getPelanggan(id: number): Promise<PelangganDTO> {
  return apiFetch(`/api/backoffice-sudirja/pelanggan/${id}`);
}

/** Create pelanggan — dipakai admin & nanti API register toko online. */
export function createPelanggan(input: CreatePelangganInput): Promise<PelangganDTO> {
  return apiFetch("/api/backoffice-sudirja/pelanggan", { method: "POST", body: JSON.stringify(input) });
}

export function updatePelanggan(id: number, input: UpdatePelangganInput): Promise<PelangganDTO> {
  return apiFetch(`/api/backoffice-sudirja/pelanggan/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deletePelanggan(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/pelanggan/${id}`, { method: "DELETE" });
}

export function bulkCreatePelanggan(rows: CreatePelangganInput[]): Promise<BulkPelangganResult> {
  return apiFetch("/api/backoffice-sudirja/pelanggan/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadPelangganCsv(items: PelangganDTO[]): void {
  const headers = ["ID", "Kode", "Nama", "Email", "Telepon", "Alamat", "Kecamatan", "Member", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = items.map((p) =>
    [p.id, p.kode, p.nama, p.email ?? "", p.telepon ?? "", p.alamat ?? "", p.kecamatan ?? "", p.isMember ? "Member" : "Reguler", p.isActive ? "Aktif" : "Nonaktif"].map(esc).join(","),
  );
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-pelanggan-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
