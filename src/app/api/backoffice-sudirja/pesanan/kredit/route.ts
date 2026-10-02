import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin, isPosRequest } from "@/lib/api-helpers";
import { listKredit, parseKreditListParams } from "@/lib/pesanan-service";

/** GET /pesanan/kredit — list pesanan kredit + agregat pembayaran angsuran. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin && !(await isPosRequest())) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  try {
    const opts = parseKreditListParams(request.nextUrl.searchParams);
    const result = await listKredit(opts);
    return ok(result);
  } catch (error) {
    console.error("[pesanan/kredit] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
