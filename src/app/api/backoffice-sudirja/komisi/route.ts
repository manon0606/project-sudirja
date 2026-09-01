import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { listKomisiRekap, listKomisiTransaksi, parseKomisiListParams } from "@/lib/komisi-service";

export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const userId = Number(request.nextUrl.searchParams.get("userId") ?? "0");
    if (Number.isInteger(userId) && userId > 0) {
      const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize")) || 20));
      const result = await listKomisiTransaksi(userId, page, pageSize);
      return ok({ items: result.items, pagination: { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) } });
    }
    return ok(await listKomisiRekap(parseKomisiListParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[komisi/list]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
