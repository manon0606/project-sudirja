import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deleteOngkir, getOngkirByKode, kecamatanExists, updateOngkir, validateUpdate } from "@/lib/ongkir-service";

type Ctx = { params: Promise<{ kode: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  const item = await getOngkirByKode(kode);
  return item ? ok(item) : fail(404, "NOT_FOUND", "Data ongkir tidak ditemukan.");
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateUpdate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data ongkir tidak valid.", parsed.details);
  }
  try {
    if (parsed.data.kecamatan && await kecamatanExists(parsed.data.kecamatan, kode)) {
      return fail(409, "DUPLICATE_KECAMATAN", "Kecamatan sudah terdaftar.");
    }
    const item = await updateOngkir(kode, parsed.data);
    return item ? ok(item) : fail(404, "NOT_FOUND", "Data ongkir tidak ditemukan.");
  } catch (e) {
    console.error("[ongkir/update]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  const deleted = await deleteOngkir(kode);
  return deleted ? ok({ message: "Data ongkir berhasil dihapus." }) : fail(404, "NOT_FOUND", "Data ongkir tidak ditemukan.");
}
