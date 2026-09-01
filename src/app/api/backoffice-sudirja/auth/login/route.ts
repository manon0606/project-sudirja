import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-helpers";
import {
  validateLogin,
  findAdminByUsername,
  verifyPassword,
  createSession,
  setSessionCookie,
  purgeExpiredSessions,
} from "@/lib/auth";

// Dummy hash of "invalid" — used to equalize timing when the username does not
// exist, so response time does not leak which usernames are registered.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.WT8FiFbBoZg0d/8mFeXkZoERvSnPd9W";

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

    return ok({
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        createdAt: admin.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error("[auth/login] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
