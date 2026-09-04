/**
 * Utilitas format tanggal/waktu FRONTEND — selalu menampilkan dalam GMT+7 (WIB).
 *
 * Kontrak: API mengirim datetime sebagai ISO UTC (…Z / +00:00). Supaya semua
 * halaman menampilkan jam lokal Indonesia secara konsisten (apa pun timezone
 * browser), helper ini menggeser ke GMT+7 lalu memformat dengan date-fns.
 *
 * Client-safe: tidak mengimpor server-only.
 */
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Terima Date | ISO string (UTC) → Date yang sudah digeser ke GMT+7. */
export function toWibDate(value: Date | string | number | null | undefined): Date {
  if (value == null) return new Date(NaN);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  // Asumsikan input adalah UTC (ISO dari API). Geser +7 jam; date-fns lalu
  // memformat komponen lokal dari Date ini = jam WIB.
  return new Date(d.getTime() + WIB_OFFSET_MS);
}

/** Format datetime UTC → string WIB (mis. "12 Agu 2026, 14:05"). */
export function fmtWib(value: Date | string | number | null | undefined, pattern = "dd MMM yyyy, HH:mm"): string {
  const d = toWibDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, pattern, { locale: localeId });
}
