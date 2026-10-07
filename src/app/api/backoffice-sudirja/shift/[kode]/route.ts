import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { getShiftDetail } from "@/lib/shift-service";

/**
 * GET /shift/[kode] — detail satu shift: rekap setoran + seluruh pergerakan kas.
 *
 * Terbaca untuk backoffice (cookie admin) dan aplikasi POS (`X-API-Key`).
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ kode: string }> }) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");

  const { kode } = await ctx.params;
  try {
    const detail = await getShiftDetail(kode);
    if (!detail) return fail(404, "NOT_FOUND", `Shift ${kode} tidak ditemukan.`);
    return ok(detail);
  } catch (error) {
    console.error("[shift/detail] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
