import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { generateLaporan, parseLaporanParams } from "@/lib/laporan-service";

/**
 * GET /laporan?tipe=daily|monthly|yearly|custom&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 * Menghasilkan laporan keuangan real-time dari data transaksi.
 */
export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const params = parseLaporanParams(request.nextUrl.searchParams);
    const report = await generateLaporan(params);
    return ok(report);
  } catch (e) {
    console.error("[laporan/generate]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
