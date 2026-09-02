import { apiFetch } from "@/lib/api-client";
import type {
  BulkSupplierResult,
  CreateSupplierInput,
  SupplierDTO,
  SupplierListResponse,
  UpdateSupplierInput,
} from "@/lib/supplier-types";

export interface SupplierListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function qs(p: SupplierListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function listSupplier(p: SupplierListParams = {}): Promise<SupplierListResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/supplier${q ? `?${q}` : ""}`);
}

export function getSupplier(id: number): Promise<SupplierDTO> {
  return apiFetch(`/api/backoffice-sudirja/supplier/${id}`);
}

export function createSupplier(input: CreateSupplierInput): Promise<SupplierDTO> {
  return apiFetch("/api/backoffice-sudirja/supplier", { method: "POST", body: JSON.stringify(input) });
}

export function updateSupplier(id: number, input: UpdateSupplierInput): Promise<SupplierDTO> {
  return apiFetch(`/api/backoffice-sudirja/supplier/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteSupplier(id: number): Promise<{ message: string }> {
  return apiFetch(`/api/backoffice-sudirja/supplier/${id}`, { method: "DELETE" });
}

export function bulkCreateSupplier(rows: CreateSupplierInput[]): Promise<BulkSupplierResult> {
  return apiFetch("/api/backoffice-sudirja/supplier/bulk", { method: "POST", body: JSON.stringify({ rows }) });
}

export function downloadSupplierCsv(items: SupplierDTO[]): void {
  const headers = ["ID", "Kode", "NAMA", "ALAMAT", "KOTA", "PROVINSI", "NEGARA", "KODEPOS", "TELEPON", "FAX", "BANK", "NOREK", "ATASNAMA", "KONTAK", "EMAIL", "KETERANGAN", "Status"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = items.map((s) =>
    [s.id, s.kode, s.nama, s.alamat ?? "", s.kota ?? "", s.provinsi ?? "", s.negara ?? "", s.kodepos ?? "", s.telepon ?? "", s.fax ?? "", s.bank ?? "", s.norek ?? "", s.atasnama ?? "", s.kontak ?? "", s.email ?? "", s.keterangan ?? "", s.isActive ? "Aktif" : "Nonaktif"].map(esc).join(","),
  );
  const blob = new Blob(["\uFEFF", [headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `data-supplier-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
