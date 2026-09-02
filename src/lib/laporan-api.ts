import { apiFetch } from "@/lib/api-client";
import type { LaporanDTO, LaporanTipe } from "@/lib/laporan-types";

export interface LaporanParams {
  tipe: LaporanTipe;
  dateFrom?: string;
  dateTo?: string;
}

function qs(p: LaporanParams): string {
  const q = new URLSearchParams({ tipe: p.tipe });
  if (p.dateFrom) q.set("dateFrom", p.dateFrom);
  if (p.dateTo) q.set("dateTo", p.dateTo);
  return q.toString();
}

export function generateLaporan(p: LaporanParams): Promise<LaporanDTO> {
  return apiFetch(`/api/backoffice-sudirja/laporan?${qs(p)}`);
}
