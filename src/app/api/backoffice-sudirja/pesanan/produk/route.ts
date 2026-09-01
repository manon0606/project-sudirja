import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { searchPesananProduk } from "@/lib/pesanan-service";

/** GET /pesanan/produk?search=&limit= — cari produk aktif utk form buat pesanan. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 10;
    const items = await searchPesananProduk(search, limit);
    return ok(items);
  } catch (error) {
    console.error("[pesanan/produk] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
