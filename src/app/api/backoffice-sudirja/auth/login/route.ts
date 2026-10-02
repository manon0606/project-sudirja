import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-helpers";
import {
  validateLogin,
  findAdminByUsername,
  verifyPassword,
  createSession,
  setSessionCookie,
  purgeExpiredSessions,
  resolveAdminAccess,
  toProfile,
  DUMMY_PASSWORD_HASH,
} from "@/lib/auth";

// Dipakai menyamakan waktu respons saat username tidak ada — lihat komentar di
// DUMMY_PASSWORD_HASH.
const DUMMY_HASH = DUMMY_PASSWORD_HASH;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }

  const parsed = validateLogin(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Username dan password wajib diisi.", parsed.details);
  }
  const { username, password } = parsed.data;

  try {
    // Opportunistic cleanup; never blocks or fails the login itself.
    await purgeExpiredSessions().catch((error) =>
      console.warn("[auth/login] session purge skipped:", error),
    );

    const admin = await findAdminByUsername(username);
    const passwordOk = verifyPassword(password, admin ? admin.password_hash : DUMMY_HASH);

    if (!admin || !passwordOk) {
      // Single generic message: no user enumeration, no password hints.
      return fail(401, "INVALID_CREDENTIALS", "Username atau password salah.");
    }
    if (admin.is_active !== 1) {
      return fail(403, "ACCOUNT_DISABLED", "Akun ini dinonaktifkan. Hubungi superadmin.");
    }

    const { token, expiresAt } = await createSession({
      adminId: admin.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });
    await setSessionCookie(token, expiresAt);

    // Akses (role + permissions) dari user profil terkait.
    const access = await resolveAdminAccess(admin);
    return ok({
      admin: toProfile(admin, access),
    });
  } catch (error) {
    console.error("[auth/login] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
