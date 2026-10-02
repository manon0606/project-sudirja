import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { listPosUsers } from "@/lib/pos-service";

/**
 * GET /pos/users — daftar user POS aktif (role kasir + manajer).
 *
 * Dipakai aplikasi POS untuk mengisi `users_cache` di SQLite lokal supaya
 * pemilihan kasir tetap jalan saat internet mati (FR-01). Verifikasi login
 * offline memakai PIN lokal per perangkat — password asli tidak pernah disimpan.
 * Sengaja tanpa email/HP/hash password.
 */
export async function GET(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  try {
    return ok({ users: await listPosUsers() });
  } catch (error) {
    console.error("[pos/users] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
