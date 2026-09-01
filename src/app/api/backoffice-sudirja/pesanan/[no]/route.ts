import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { getPesananByNo } from "@/lib/pesanan-service";

type Ctx = { params: Promise<{ no: string }> };

/** GET /pesanan/[no] — detail pesanan + items. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { no } = await ctx.params;
  try {
    const pesanan = await getPesananByNo(no);
    if (!pesanan) return fail(404, "NOT_FOUND", `Pesanan ${no} tidak ditemukan.`);
    return ok(pesanan);
  } catch (error) {
    console.error("[pesanan/get] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
