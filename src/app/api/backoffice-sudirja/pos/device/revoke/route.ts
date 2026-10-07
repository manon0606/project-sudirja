import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { revokeDevice } from "@/lib/device-service";

/**
 * POST /pos/device/revoke — cabut token satu perangkat POS.
 *
 * Body: { deviceId }
 *
 * Idempoten: mencabut perangkat yang sudah dicabut tetap 200. Perangkat yang
 * dicabut langsung ditolak di semua endpoint POS (termasuk yang sedang berjalan
 * berikutnya). Hanya admin backoffice yang boleh memanggil.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Hanya admin backoffice yang boleh mencabut perangkat.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const deviceId = typeof b.deviceId === "string" ? b.deviceId.trim() : "";
  if (!deviceId) return fail(422, "VALIDATION_ERROR", "deviceId wajib diisi.");

  try {
    const device = await revokeDevice(deviceId);
    if (!device) return fail(404, "VALIDATION_ERROR", `Perangkat ${deviceId} tidak terdaftar.`);
    return ok({ device });
  } catch (error) {
    console.error("[pos/device/revoke] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
