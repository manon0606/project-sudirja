import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { listStokHistory } from "@/lib/stok-service";

type Ctx = { params: Promise<{ sku: string }> };

/** GET /stok/[sku]/history?limit=50 — riwayat mutasi stok produk (terbaru dulu). */
export async function GET(request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params;
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 50;
    const history = await listStokHistory(sku, limit);
    return ok(history);
  } catch (error) {
    console.error("[stok/history] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
