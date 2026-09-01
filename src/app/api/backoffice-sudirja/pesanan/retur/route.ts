import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { listRetur, parseReturListParams } from "@/lib/pesanan-service";

/** GET /pesanan/retur — list pengembalian (retur) pesanan. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parseReturListParams(request.nextUrl.searchParams);
    const result = await listRetur(opts);
    return ok(result);
  } catch (error) {
    console.error("[pesanan/retur/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
