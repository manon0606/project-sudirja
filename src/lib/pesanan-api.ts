/**
 * Typed client wrappers for the admin order API (pesanan). Client-safe: no
 * server-only imports. Same envelope unwrapping as product-api/stok-api.
 */

import { apiFetch } from "@/lib/api-client";
import type {
  CreatePesananInput,
  CreateReturInput,
  KreditDTO,
  KreditListParams,
  KurirDTO,
  PesananDTO,
  PesananListParams,
  PesananPaginationMeta,
  PesananProdukOption,
  ReturDTO,
  ReturListParams,
  UpdatePengirimanInput,
} from "@/lib/pesanan-types";

export interface PesananListResponse {
  items: PesananDTO[];
  pagination: PesananPaginationMeta;
}

export interface KreditListResponse {
  items: KreditDTO[];
  pagination: PesananPaginationMeta;
}

export interface ReturListResponse {
  items: ReturDTO[];
  pagination: PesananPaginationMeta;
}

function buildQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return qs.toString();
}

export function listPesanan(params: PesananListParams = {}): Promise<PesananListResponse> {
  const query = buildQuery(params);
  return apiFetch<PesananListResponse>(`/api/backoffice-sudirja/pesanan${query ? `?${query}` : ""}`);
}

export function getPesanan(noPesanan: string): Promise<PesananDTO> {
  return apiFetch<PesananDTO>(`/api/backoffice-sudirja/pesanan/${encodeURIComponent(noPesanan)}`);
}

export function createPesanan(input: CreatePesananInput): Promise<PesananDTO> {
  return apiFetch<PesananDTO>("/api/backoffice-sudirja/pesanan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Commerce --------------------------------------------------------------------

export function listKurir(): Promise<KurirDTO[]> {
  return apiFetch<KurirDTO[]>("/api/backoffice-sudirja/kurir");
}

export function updatePengiriman(noPesanan: string, input: UpdatePengirimanInput): Promise<PesananDTO> {
  return apiFetch<PesananDTO>(`/api/backoffice-sudirja/pesanan/${encodeURIComponent(noPesanan)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function createRetur(noPesanan: string, input: CreateReturInput): Promise<ReturDTO> {
  return apiFetch<ReturDTO>(`/api/backoffice-sudirja/pesanan/${encodeURIComponent(noPesanan)}/retur`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function searchPesananProduk(search: string, limit = 10): Promise<PesananProdukOption[]> {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  qs.set("limit", String(limit));
  return apiFetch<PesananProdukOption[]>(`/api/backoffice-sudirja/pesanan/produk?${qs.toString()}`);
}

// Kredit ---------------------------------------------------------------------

export function listKredit(params: KreditListParams = {}): Promise<KreditListResponse> {
  const query = buildQuery(params);
  return apiFetch<KreditListResponse>(`/api/backoffice-sudirja/pesanan/kredit${query ? `?${query}` : ""}`);
}

export function getKredit(noPesanan: string): Promise<KreditDTO> {
  return apiFetch<KreditDTO>(`/api/backoffice-sudirja/pesanan/kredit/${encodeURIComponent(noPesanan)}`);
}

export function addKreditPembayaran(noPesanan: string, input: { jumlah: number; catatan?: string | null }): Promise<KreditDTO> {
  return apiFetch<KreditDTO>(`/api/backoffice-sudirja/pesanan/kredit/${encodeURIComponent(noPesanan)}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Pengembalian (retur) ---------------------------------------------------------

export function listRetur(params: ReturListParams = {}): Promise<ReturListResponse> {
  const query = buildQuery(params);
  return apiFetch<ReturListResponse>(`/api/backoffice-sudirja/pesanan/retur${query ? `?${query}` : ""}`);
}
