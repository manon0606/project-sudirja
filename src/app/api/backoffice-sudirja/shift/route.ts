import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { listShift } from "@/lib/shift-service";

/**
 * GET /shift?status=Buka|Tutup&cashier=<username>&limit=<n> — daftar shift.
 *
 * Terbaca untuk backoffice (cookie admin) dan aplikasi POS (`X-API-Key`).
 */
export async function GET(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");

  const q = request.nextUrl.searchParams;
  const status = q.get("status")?.trim();
  if (status && status !== "Buka" && status !== "Tutup") {
    return fail(422, "VALIDATION_ERROR", "Filter status harus 'Buka' atau 'Tutup'.");
  }
  const limitRaw = Number(q.get("limit") ?? "");

  try {
    return ok({
      shifts: await listShift({
        status: (status as "Buka" | "Tutup" | null) ?? null,
        cashierUsername: q.get("cashier")?.trim() || null,
        limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
      }),
    });
  } catch (error) {
    console.error("[shift] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
