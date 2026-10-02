import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { authenticatePos, catatApproval, POS_MANAGER_ROLES } from "@/lib/pos-service";

/**
 * POST /pos/approval/verify — persetujuan manajer di aplikasi POS
 * (tutup shift, cash in/out, diskon, harga di bawah, retur, dll.).
 *
 * Body: { username, password, aksi, refNo?, catatan?, dimintaOleh?, clientRef? }
 * Kredensial harus user ber-role manajer; setiap persetujuan dicatat ke tabel
 * `approval_log` sebagai jejak audit (siapa menyetujui, aksi apa, kapan).
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
  const aksi = typeof b.aksi === "string" ? b.aksi.trim() : "";
  if (!username || !password) {
    return fail(422, "VALIDATION_ERROR", "Username dan password manajer wajib diisi.");
  }
  if (!aksi) {
    return fail(422, "VALIDATION_ERROR", "Aksi yang disetujui wajib diisi.", {
      aksi: "Mis. tutup_shift, cash_in, cash_out, diskon.",
    });
  }

  try {
    const hasil = await authenticatePos(username, password, POS_MANAGER_ROLES);
    if (!hasil.ok) {
      const status = hasil.code === "INVALID_CREDENTIALS" ? 401 : 403;
      return fail(status, hasil.code, hasil.message);
    }
    const logId = await catatApproval({
      aksi,
      refNo: typeof b.refNo === "string" && b.refNo.trim() ? b.refNo.trim() : null,
      catatan: typeof b.catatan === "string" && b.catatan.trim() ? b.catatan.trim() : null,
      dimintaOleh: typeof b.dimintaOleh === "string" && b.dimintaOleh.trim() ? b.dimintaOleh.trim() : null,
      disetujuiOleh: hasil.user.username,
      disetujuiNama: hasil.user.fullName,
      clientRef: typeof b.clientRef === "string" && b.clientRef.trim() ? b.clientRef.trim() : null,
      metode: "password",
    });
    const { user } = hasil;
    return ok({
      disetujui: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        roleLabel: user.roleLabel,
      },
      logId,
      metode: "password",
    });
  } catch (error) {
    console.error("[pos/approval/verify] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
