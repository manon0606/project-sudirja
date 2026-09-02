import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deleteKonsinyasi, getKonsinyasiById, updateKonsinyasiStatus } from "@/lib/konsinyasi-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID konsinyasi tidak valid.");
  const item = await getKonsinyasiById(id);
  return item ? ok(item) : fail(404, "NOT_FOUND", "Konsinyasi tidak ditemukan.");
}

/** PATCH /konsinyasi/[id] — ubah status (aktif/selesai). Body: { status } */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const status = typeof b.status === "string" ? b.status : "";
  if (status !== "aktif" && status !== "selesai") {
    return fail(422, "VALIDATION_ERROR", "Status harus aktif atau selesai.");
  }
  try {
    const item = await updateKonsinyasiStatus(id, status);
    return item ? ok(item) : fail(404, "NOT_FOUND", "Konsinyasi tidak ditemukan.");
  } catch (e) {
    console.error("[konsinyasi/update-status]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const deleted = await deleteKonsinyasi(Number((await ctx.params).id));
  return deleted ? ok({ message: "Konsinyasi berhasil dihapus." }) : fail(404, "NOT_FOUND", "Konsinyasi tidak ditemukan.");
}
