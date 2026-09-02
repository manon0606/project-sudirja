import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deletePelanggan, getPelanggan, updatePelanggan, validatePelangganUpdate } from "@/lib/pelanggan-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID pelanggan tidak valid.");
  const item = await getPelanggan(id);
  return item ? ok(item) : fail(404, "NOT_FOUND", "Pelanggan tidak ditemukan.");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validatePelangganUpdate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data pelanggan tidak valid.", parsed.details);
  }
  try {
    const item = await updatePelanggan(id, parsed.data);
    return item ? ok(item) : fail(404, "NOT_FOUND", "Pelanggan tidak ditemukan.");
  } catch (e) {
    console.error("[pelanggan/update]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const deleted = await deletePelanggan(Number((await ctx.params).id));
  return deleted ? ok({ message: "Pelanggan berhasil dihapus." }) : fail(404, "NOT_FOUND", "Pelanggan tidak ditemukan.");
}
