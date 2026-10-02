import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { loginPos } from "@/lib/pos-service";

/**
 * POST /pos/auth/login — login kasir untuk aplikasi POS.
 * Body: { username, password }. Hanya user ber-role `kasir` yang diterima.
 *
 * Tidak membuat session: identitas kasir dikirim POS pada tiap transaksi
 * (lihat `kasirNama`/`kasirUsername` di POST /pesanan), dan akses data memakai
 * API key dari halaman Settings (header `X-API-Key`).
 */
export async function POST(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!username || !password) {
    return fail(422, "VALIDATION_ERROR", "Username dan password wajib diisi.");
  }

  try {
    const hasil = await loginPos(username, password);
    if (!hasil.ok) {
      const status = hasil.code === "INVALID_CREDENTIALS" ? 401 : 403;
      return fail(status, hasil.code, hasil.message);
    }
    return ok({ user: hasil.user });
  } catch (error) {
    console.error("[pos/auth/login] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
