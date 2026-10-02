import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { catatApproval } from "@/lib/pos-service";

/**
 * POST /pos/approval/log — catat persetujuan yang diperoleh aplikasi POS saat
 * OFFLINE (manajer menyetujui dengan PIN lokal di perangkat).
 *
 * Body: { username, fullName?, role?, roleLabel?, aksi, refNo?, catatan?,
 *         dimintaOleh?, clientRef? }
 *
 * Beda dengan `/pos/approval/verify` (yang memverifikasi password manajer di
 * server), endpoint ini HANYA mencatat: PIN sudah diverifikasi perangkat dan
 * baris ditulis dengan `metode = 'pin_offline'` supaya jejak audit bisa
 * membedakan tingkat pembuktian. Idempoten lewat `clientRef`.
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
  const username = typeof b.username === "string" ? b.username.trim() : "";
  const aksi = typeof b.aksi === "string" ? b.aksi.trim() : "";
  if (!username) {
    return fail(422, "VALIDATION_ERROR", "Username manajer penyetuju wajib diisi.");
  }
  if (!aksi) {
    return fail(422, "VALIDATION_ERROR", "Aksi yang disetujui wajib diisi.", {
      aksi: "Mis. tutup_shift, cash_in, cash_out, diskon.",
    });
  }

  try {
    const teks = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? v.trim() : null;
    const logId = await catatApproval({
      aksi,
      refNo: teks(b.refNo),
      catatan: teks(b.catatan),
      dimintaOleh: teks(b.dimintaOleh),
      disetujuiOleh: username,
      disetujuiNama: teks(b.fullName) ?? username,
      clientRef: teks(b.clientRef),
      metode: "pin_offline",
    });
    return ok({ logId, metode: "pin_offline" });
  } catch (error) {
    console.error("[pos/approval/log] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
