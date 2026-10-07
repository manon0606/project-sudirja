import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { getSyncMeta } from "@/lib/sync-service";

/**
 * GET /sync/meta — waktu server, entitas yang tersedia utk delta pull, dan
 * versi kontrak payload. Dipakai POS saat pertama tersambung supaya tahu
 * apakah kontraknya cocok sebelum pull.
 */
export async function GET(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  try {
    return ok(await getSyncMeta());
  } catch (error) {
    console.error("[sync/meta] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
