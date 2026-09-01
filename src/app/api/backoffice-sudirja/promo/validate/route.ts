import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { validatePromoVoucher } from "@/lib/promo-service";

/**
 * GET /api/backoffice-sudirja/promo/validate?kode=DISC10&subtotal=500000
 *
 * Validasi kode promo aktif terhadap subtotal — dipakai form buat pesanan
 * untuk menampilkan preview diskon sebelum transaksi dibuat.
 * Selalu mengembalikan 200 dengan { valid: boolean, message, promo? }.
 */
export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const kode = request.nextUrl.searchParams.get("kode") ?? "";
  const subtotal = Number(request.nextUrl.searchParams.get("subtotal") ?? "0");
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return fail(422, "VALIDATION_ERROR", "Subtotal tidak valid.");
  }
  try {
    const result = await validatePromoVoucher(kode, subtotal);
    return ok(result);
  } catch (e) {
    console.error("[promo/validate]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
