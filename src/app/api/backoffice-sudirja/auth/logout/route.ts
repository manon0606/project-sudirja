import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { deleteSession, clearSessionCookie } from "@/lib/auth";

/** Idempotent: succeeds and clears the cookie even without a valid session. */
export async function POST() {
  try {
    const current = await requireAdmin();
    if (current) {
      await deleteSession(current.token);
    }
    await clearSessionCookie();
    return ok({ message: "Logout berhasil." });
  } catch (error) {
    console.error("[auth/logout] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
