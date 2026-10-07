import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { listDevices } from "@/lib/device-service";

/**
 * GET /pos/device — daftar perangkat POS terdaftar (hanya metadata).
 *
 * Tanpa token plaintext — yang tampil hanya hint (`dev_a1b2…`), status aktif,
 * dan "terakhir terlihat". Hanya admin backoffice yang boleh memanggil.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Hanya admin backoffice yang boleh melihat daftar perangkat.");
  try {
    return ok({ devices: await listDevices() });
  } catch (error) {
    console.error("[pos/device] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
