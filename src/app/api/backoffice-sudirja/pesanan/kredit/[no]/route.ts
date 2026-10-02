import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { getCurrentAdmin } from "@/lib/auth";
import {
  getKreditByNo,
  addKreditPembayaranTx,
} from "@/lib/pesanan-service";

type Ctx = { params: Promise<{ no: string }> };

/** GET /pesanan/kredit/[no] — detail pesanan kredit + riwayat angsuran. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  const { no } = await ctx.params;
  try {
    const kredit = await getKreditByNo(no);
    if (!kredit) return fail(404, "NOT_FOUND", `Pesanan kredit ${no} tidak ditemukan.`);
    return ok(kredit);
  } catch (error) {
    console.error("[pesanan/kredit/get] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

/** POST /pesanan/kredit/[no] — catat pembayaran angsuran. Body: { jumlah, catatan? } */
export async function POST(request: NextRequest, ctx: Ctx) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  const { no } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const jumlah = typeof b.jumlah === "number" ? b.jumlah : Number(b.jumlah);
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return fail(422, "VALIDATION_ERROR", "Jumlah pembayaran wajib angka > 0.", { jumlah: "Jumlah pembayaran wajib angka > 0." });
  }

  try {
    const adminNow = await getCurrentAdmin();
    const dicatatOleh = adminNow
      ? adminNow.admin.full_name || adminNow.admin.username
      : typeof b.dicatatOleh === "string" && b.dicatatOleh.trim()
        ? b.dicatatOleh.trim().slice(0, 100)
        : "POS";
    const updated = await addKreditPembayaranTx(no, {
      jumlah,
      catatan: typeof b.catatan === "string" ? b.catatan.trim() : null,
      // Kunci idempotensi dari perangkat POS (opsional).
      clientRef: typeof b.clientRef === "string" && b.clientRef.trim() ? b.clientRef.trim() : null,
    }, dicatatOleh);
    if (!updated) return fail(404, "NOT_FOUND", `Pesanan kredit ${no} tidak ditemukan.`);
    return ok(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gagal mencatat pembayaran.";
    return fail(422, "VALIDATION_ERROR", msg);
  }
}
