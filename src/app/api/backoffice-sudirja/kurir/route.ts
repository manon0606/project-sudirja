import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { listKurir } from "@/lib/pesanan-service";

/** GET /kurir — daftar user ber-role kurir (aktif) utk dipilih di commerce. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listKurir());
  } catch (error) {
    console.error("[kurir/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
