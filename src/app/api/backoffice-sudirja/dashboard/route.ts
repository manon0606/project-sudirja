import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { getDashboard, parseDashboardParams } from "@/lib/dashboard-service";

/** GET /dashboard?range=7|30|year — ringkasan aktivitas toko (data real). */
export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await getDashboard(parseDashboardParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[dashboard]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
