import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { pullDelta } from "@/lib/sync-service";

/**
 * GET /sync/pull?since=<ISO-8601>&limit=<n> — delta sinkronisasi POS.
 *
 * Mengembalikan baris `produk`, `produkSatuan`, `stok`, dan `promo` dengan
 * `updated_at >= since`. Tanpa `since` = tarik seluruh data (bootstrap).
 *
 * Simpan `data.next` sebagai `since` untuk pull berikutnya — `next` adalah
 * waktu server saat query mulai, jadi perubahan sesudahnya pasti ikut.
 * Bila `data.truncated` tidak kosong, ulangi dengan `since` yang lebih baru.
 */
export async function GET(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");

  const q = request.nextUrl.searchParams;
  const since = q.get("since")?.trim() || null;
  const limitRaw = Number(q.get("limit") ?? "");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  try {
    return ok(await pullDelta(since, limit));
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    if (pesan.includes("`since`")) return fail(422, "VALIDATION_ERROR", pesan);
    console.error("[sync/pull] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
