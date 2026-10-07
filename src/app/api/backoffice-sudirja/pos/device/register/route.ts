import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { registerDevice } from "@/lib/device-service";

/**
 * POST /pos/device/register — daftarkan (atau daftarkan ulang) satu perangkat POS.
 *
 * Body: { deviceId, nama }
 *
 * Hanya admin backoffice (cookie) yang boleh memanggil — token perangkat TIDAK
 * boleh bisa mendaftarkan perangkat lain. Token plaintext dikembalikan SEKALI
 * di sini; memanggil ulang dengan `deviceId` sama mengeluarkan token baru dan
 * menonaktifkan yang lama (cara mengganti token yang hilang).
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Hanya admin backoffice yang boleh mendaftarkan perangkat.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const deviceId = typeof b.deviceId === "string" ? b.deviceId.trim() : "";
  const nama = typeof b.nama === "string" ? b.nama.trim() : "";

  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(deviceId)) {
    return fail(422, "VALIDATION_ERROR", "deviceId wajib 1–32 karakter (huruf kecil, angka, - atau _).", {
      deviceId: "mis. kasir-01",
    });
  }
  if (!nama || nama.length > 100) {
    return fail(422, "VALIDATION_ERROR", "Nama perangkat wajib diisi (maks. 100 karakter).");
  }

  try {
    return ok(await registerDevice(deviceId, nama), { status: 201 });
  } catch (error) {
    console.error("[pos/device/register] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
