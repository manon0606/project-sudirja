import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { resolveAdminAccess, toProfile } from "@/lib/auth";

export async function GET() {
  try {
    const current = await requireAdmin();
    if (!current) {
      return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
    }
    const access = await resolveAdminAccess(current.admin);
    return ok({ admin: toProfile(current.admin, access) });
  } catch (error) {
    console.error("[auth/me] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
