/**
 * Utilitas format tanggal/waktu FRONTEND — selalu menampilkan dalam GMT+7 (WIB).
 *
 * Kontrak: API mengirim datetime sebagai ISO UTC (…Z / +00:00). date-fns
 * `format()` membaca komponen waktu LOKAL (timezone browser), sehingga:
 *  - di browser WIB  → sudah benar tanpa pergeseran;
 *  - di browser lain → perlu digeser agar menampilkan WIB.
 * Karena itu pergeseran dihitung RELATIF terhadap offset browser
 * (bukan selalu +7 jam, yang menyebabkan jam tampil +7 berlebih di WIB).
 *
 * Client-safe: tidak mengimpor server-only.
 */
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Terima Date | ISO string (UTC) → Date yang komponen lokalnya = waktu GMT+7. */
export function toWibDate(value: Date | string | number | null | undefined): Date {
  if (value == null) return new Date(NaN);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  // Offset lokal browser dalam ms (mis. WIB = +7h → 25200000).
  const localOffsetMs = -d.getTimezoneOffset() * 60 * 1000;
  // Geser agar komponen lokal yang dibaca date-fns = UTC + 7 jam.
  return new Date(d.getTime() + (WIB_OFFSET_MS - localOffsetMs));
}

/** Format datetime UTC → string WIB (mis. "12 Agu 2026, 14:05"). */
export function fmtWib(value: Date | string | number | null | undefined, pattern = "dd MMM yyyy, HH:mm"): string {
  const d = toWibDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, pattern, { locale: localeId });
}
