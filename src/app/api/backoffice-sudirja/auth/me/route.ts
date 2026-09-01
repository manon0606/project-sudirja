import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { toProfile } from "@/lib/auth";

export async function GET() {
  try {
    const current = await requireAdmin();
    if (!current) {
      return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
    }
    return ok({ admin: toProfile(current.admin) });
  } catch (error) {
    console.error("[auth/me] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
