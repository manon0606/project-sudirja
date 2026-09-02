import { apiFetch } from "@/lib/api-client";
import type {
  KomisiRekapDTO,
  KomisiSettingsList,
  KomisiTransaksiDTO,
} from "@/lib/komisi-types";

export interface KomisiListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
}

function qs(p: KomisiListParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export function getKomisiSettings(): Promise<KomisiSettingsList> {
  return apiFetch("/api/backoffice-sudirja/komisi/settings");
}

export function updateKomisiSetting(role: string, persenKomisi: number, aktif: boolean): Promise<{ role: string; roleLabel: string; persenKomisi: number; aktif: boolean }> {
  return apiFetch("/api/backoffice-sudirja/komisi/settings", {
    method: "PATCH",
    body: JSON.stringify({ role, persenKomisi, aktif }),
  });
}

export interface KomisiRekapResponse {
  items: KomisiRekapDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function listKomisiRekap(p: KomisiListParams = {}): Promise<KomisiRekapResponse> {
  const q = qs(p);
  return apiFetch(`/api/backoffice-sudirja/komisi${q ? `?${q}` : ""}`);
}

export interface KomisiTransaksiResponse {
  items: KomisiTransaksiDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function listKomisiTransaksi(userId: number, page = 1, pageSize = 20): Promise<KomisiTransaksiResponse> {
  const q = new URLSearchParams({ userId: String(userId), page: String(page), pageSize: String(pageSize) });
  return apiFetch(`/api/backoffice-sudirja/komisi?${q.toString()}`);
}
