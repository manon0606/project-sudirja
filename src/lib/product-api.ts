/**
 * Typed client wrappers for the admin products API (satuan, merk, kategori,
 * produk, barcode). Client-safe: no server-only imports.
 *
 * Every helper unwraps the { ok, data } envelope via apiFetch and throws
 * ApiClientError (with the server's code/message/details) on failure.
 */

import { apiFetch } from "@/lib/api-client";
import type {
  BarcodeFormat,
  BarcodeResponse,
  CreateKategoriInput,
  CreateMerkInput,
  CreateProdukInput,
  CreateSatuanInput,
  KategoriDTO,
  ListResponse,
  MerkDTO,
  ProdukDTO,
  SatuanDTO,
  UpdateKategoriInput,
  UpdateMerkInput,
  UpdateProdukInput,
  UpdateSatuanInput,
} from "@/lib/product-types";

// ---------------------------------------------------------------------------
// Reference tables (satuan / merk / kategori)
// ---------------------------------------------------------------------------

export interface ReferenceListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /** "kode" | "nama" | "created_at" (+ "jumlah_unit" for satuan). */
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  activeOnly?: boolean;
}

function referenceQuery(params: ReferenceListParams): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  if (params.activeOnly) qs.set("activeOnly", "1");
  return qs.toString();
}

function listPath(resource: "satuan" | "merk" | "kategori", params: ReferenceListParams): string {
  const qs = referenceQuery(params);
  return `/api/backoffice-sudirja/products/${resource}${qs ? `?${qs}` : ""}`;
}

/** Fetch every active row of a reference table for dropdowns (pageSize=100 is the API max). */
function listAllActive<T>(resource: "satuan" | "merk" | "kategori", sortBy: string): Promise<ListResponse<T>> {
  return apiFetch<ListResponse<T>>(listPath(resource, { pageSize: 100, activeOnly: true, sortBy, sortOrder: "asc" }));
}

// Satuan --------------------------------------------------------------------

export function listSatuan(params: ReferenceListParams = {}): Promise<ListResponse<SatuanDTO>> {
  return apiFetch<ListResponse<SatuanDTO>>(listPath("satuan", params));
}

export function listAllActiveSatuan(): Promise<ListResponse<SatuanDTO>> {
  return listAllActive<SatuanDTO>("satuan", "kode");
}

export function createSatuan(input: CreateSatuanInput): Promise<SatuanDTO> {
  return apiFetch<SatuanDTO>("/api/backoffice-sudirja/products/satuan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSatuan(kode: string, input: UpdateSatuanInput): Promise<SatuanDTO> {
  return apiFetch<SatuanDTO>(`/api/backoffice-sudirja/products/satuan/${encodeURIComponent(kode)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSatuan(kode: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/backoffice-sudirja/products/satuan/${encodeURIComponent(kode)}`, {
    method: "DELETE",
  });
}

// Merk ----------------------------------------------------------------------

export function listMerk(params: ReferenceListParams = {}): Promise<ListResponse<MerkDTO>> {
  return apiFetch<ListResponse<MerkDTO>>(listPath("merk", params));
}

export function listAllActiveMerk(): Promise<ListResponse<MerkDTO>> {
  return listAllActive<MerkDTO>("merk", "nama");
}

export function createMerk(input: CreateMerkInput): Promise<MerkDTO> {
  return apiFetch<MerkDTO>("/api/backoffice-sudirja/products/merk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMerk(kode: string, input: UpdateMerkInput): Promise<MerkDTO> {
  return apiFetch<MerkDTO>(`/api/backoffice-sudirja/products/merk/${encodeURIComponent(kode)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteMerk(kode: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/backoffice-sudirja/products/merk/${encodeURIComponent(kode)}`, {
    method: "DELETE",
  });
}

// Kategori ------------------------------------------------------------------

export function listKategori(params: ReferenceListParams = {}): Promise<ListResponse<KategoriDTO>> {
  return apiFetch<ListResponse<KategoriDTO>>(listPath("kategori", params));
}

export function listAllActiveKategori(): Promise<ListResponse<KategoriDTO>> {
  return listAllActive<KategoriDTO>("kategori", "nama");
}

export function createKategori(input: CreateKategoriInput): Promise<KategoriDTO> {
  return apiFetch<KategoriDTO>("/api/backoffice-sudirja/products/kategori", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateKategori(kode: string, input: UpdateKategoriInput): Promise<KategoriDTO> {
  return apiFetch<KategoriDTO>(`/api/backoffice-sudirja/products/kategori/${encodeURIComponent(kode)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteKategori(kode: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/backoffice-sudirja/products/kategori/${encodeURIComponent(kode)}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Produk
// ---------------------------------------------------------------------------

export interface ProdukListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  kategoriKode?: string;
  merkKode?: string;
  status?: "active" | "inactive" | "";
  sortBy?: "sku" | "nama" | "status" | "created_at";
  sortOrder?: "asc" | "desc";
}

export function listProduk(params: ProdukListParams = {}): Promise<ListResponse<ProdukDTO>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  if (params.kategoriKode) qs.set("kategoriKode", params.kategoriKode);
  if (params.merkKode) qs.set("merkKode", params.merkKode);
  if (params.status) qs.set("status", params.status);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  const query = qs.toString();
  return apiFetch<ListResponse<ProdukDTO>>(
    `/api/backoffice-sudirja/products/produk${query ? `?${query}` : ""}`,
  );
}

export function createProduk(input: CreateProdukInput): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/backoffice-sudirja/products/produk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduk(sku: string, input: UpdateProdukInput): Promise<ProdukDTO> {
  return apiFetch<ProdukDTO>(`/api/backoffice-sudirja/products/produk/${encodeURIComponent(sku)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateProdukStatus(sku: string, status: "active" | "inactive"): Promise<ProdukDTO> {
  return updateProduk(sku, { status });
}

export function deleteProduk(sku: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/backoffice-sudirja/products/produk/${encodeURIComponent(sku)}`, {
    method: "DELETE",
  });
}

export interface BulkUpsertProdukResult {
  success: number;
  failures: Array<{ row: number; sku: string; message: string }>;
}

/**
 * Upsert produk massal — SKU sudah ada → update, belum ada → create.
 * Format tiap row sama dengan CreateProdukInput (konsisten manual create).
 */
export function bulkUpsertProduk(rows: CreateProdukInput[]): Promise<BulkUpsertProdukResult> {
  return apiFetch<BulkUpsertProdukResult>("/api/backoffice-sudirja/products/produk/bulk", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

// ---------------------------------------------------------------------------
// Barcode
// ---------------------------------------------------------------------------

export function renderBarcode(
  kodeItem: string,
  format: BarcodeFormat = "CODE128",
  includeText = false,
): Promise<BarcodeResponse> {
  return apiFetch<BarcodeResponse>("/api/backoffice-sudirja/products/barcode", {
    method: "POST",
    body: JSON.stringify({ kodeItem, format, includeText }),
  });
}

// ---------------------------------------------------------------------------
// Formatting helper (matches the reference label: "Rp. 6.000")
// ---------------------------------------------------------------------------

export function formatRupiah(value: number): string {
  return `Rp. ${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
}
