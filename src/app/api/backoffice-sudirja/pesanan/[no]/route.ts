import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { getPesananByNo, updatePengirimanPesanan } from "@/lib/pesanan-service";
import type { StatusPengiriman } from "@/lib/pesanan-types";

type Ctx = { params: Promise<{ no: string }> };

const VALID_STATUS_PENGIRIMAN: StatusPengiriman[] = ["Menunggu Kurir", "Diantar", "Selesai"];

/** GET /pesanan/[no] — detail pesanan + items. */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { no } = await ctx.params;
  try {
    const pesanan = await getPesananByNo(no);
    if (!pesanan) return fail(404, "NOT_FOUND", `Pesanan ${no} tidak ditemukan.`);
    return ok(pesanan);
  } catch (error) {
    console.error("[pesanan/get] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

/**
 * PATCH /pesanan/[no] — update pengiriman commerce.
 * Body: { kurirId?: number|null, statusPengiriman?: "Menunggu Kurir"|"Diantar"|"Selesai" }
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { no } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const input: { kurirId?: number | null; statusPengiriman?: StatusPengiriman } = {};
  if (b.kurirId !== undefined && b.kurirId !== null) {
    const id = Number(b.kurirId);
    if (!Number.isInteger(id) || id <= 0) {
      return fail(422, "VALIDATION_ERROR", "kurirId tidak valid.");
    }
    input.kurirId = id;
  } else if (b.kurirId === null) {
    input.kurirId = null;
  }
  if (b.statusPengiriman !== undefined) {
    const st = String(b.statusPengiriman);
    if (!VALID_STATUS_PENGIRIMAN.includes(st as StatusPengiriman)) {
      return fail(422, "VALIDATION_ERROR", "statusPengiriman tidak valid.");
    }
    input.statusPengiriman = st as StatusPengiriman;
  }
  if (Object.keys(input).length === 0) {
    return fail(422, "VALIDATION_ERROR", "Tidak ada perubahan yang dikirim.");
  }
  try {
    const updated = await updatePengirimanPesanan(no, input);
    if (!updated) return fail(404, "NOT_FOUND", `Pesanan ${no} tidak ditemukan.`);
    return ok(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_COMMERCE") return fail(422, "VALIDATION_ERROR", "Pesanan bukan dari commerce.");
    if (msg === "INVALID_KURIR") return fail(422, "VALIDATION_ERROR", "Kurir tidak valid atau bukan role kurir.");
    console.error("[pesanan/update-pengiriman] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
