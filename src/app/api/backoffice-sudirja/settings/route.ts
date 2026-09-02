import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { getSettings, regenerateApiKey, setOnline } from "@/lib/settings-service";

/** GET /settings — baca status online + hint API key (tanpa key penuh). */
export async function GET(_request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  if (!admin.isSuperadmin) return fail(403, "UNAUTHORIZED", "Hanya superadmin yang dapat mengakses settings API key.");
  try {
    return ok(await getSettings());
  } catch (e) {
    console.error("[settings/get]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

/**
 * PATCH /settings
 * Body opsional: { isOnline?: boolean } → set mode online/offline.
 * Body: { regenerate?: true } → buat API key baru (key ditampilkan sekali).
 */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  if (!admin.isSuperadmin) return fail(403, "UNAUTHORIZED", "Hanya superadmin yang dapat mengubah settings API key.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  try {
    if (b.regenerate === true) {
      const result = await regenerateApiKey();
      return ok(result);
    }
    if (b.isOnline !== undefined) {
      if (typeof b.isOnline !== "boolean") {
        return fail(422, "VALIDATION_ERROR", "isOnline harus boolean.");
      }
      return ok(await setOnline(b.isOnline));
    }
    return fail(422, "VALIDATION_ERROR", "Tidak ada perubahan yang dikirim.");
  } catch (e) {
    console.error("[settings/patch]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
