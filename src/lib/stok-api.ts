/**
 * Typed client wrappers for the admin stock API (stok). Client-safe: no
 * server-only imports. Same envelope unwrapping as product-api.
 */

import { apiFetch } from "@/lib/api-client";
import type {
  BulkUpdateStokInput,
  BulkUpdateStokResult,
  StokDTO,
  StokHistoryDTO,
  StokListParams,
  StokPaginationMeta,
  UpdateStokInput,
} from "@/lib/stok-types";

export interface StokListResponse {
  items: StokDTO[];
  pagination: StokPaginationMeta;
}

export function listStok(params: StokListParams = {}): Promise<StokListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  if (params.kategoriKode) qs.set("kategoriKode", params.kategoriKode);
  if (params.merkKode) qs.set("merkKode", params.merkKode);
  if (params.status) qs.set("status", params.status);
  if (params.lowOnly) qs.set("lowOnly", "1");
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  const query = qs.toString();
  return apiFetch<StokListResponse>(`/api/backoffice-sudirja/stok${query ? `?${query}` : ""}`);
}

export function getStok(sku: string): Promise<StokDTO> {
  return apiFetch<StokDTO>(`/api/backoffice-sudirja/stok/${encodeURIComponent(sku)}`);
}

export function getStokHistory(sku: string, limit = 50): Promise<StokHistoryDTO[]> {
  return apiFetch<StokHistoryDTO[]>(
    `/api/backoffice-sudirja/stok/${encodeURIComponent(sku)}/history?limit=${limit}`,
  );
}

export function updateStok(sku: string, input: UpdateStokInput): Promise<StokDTO> {
  return apiFetch<StokDTO>(`/api/backoffice-sudirja/stok/${encodeURIComponent(sku)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteStok(sku: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/backoffice-sudirja/stok/${encodeURIComponent(sku)}`, {
    method: "DELETE",
  });
}

export function bulkUpdateStok(input: BulkUpdateStokInput): Promise<BulkUpdateStokResult> {
  return apiFetch<BulkUpdateStokResult>("/api/backoffice-sudirja/stok/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}