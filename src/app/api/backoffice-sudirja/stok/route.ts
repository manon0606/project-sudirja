import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { listStok, parseStokListParams } from "@/lib/stok-service";

/** GET /stok?page=&pageSize=&search=&kategoriKode=&merkKode=&status=&lowOnly=&sortBy=&sortOrder= */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parseStokListParams(request.nextUrl.searchParams);
    const result = await listStok(opts);
    return ok(result);
  } catch (error) {
    console.error("[stok/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
