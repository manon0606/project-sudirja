import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deleteSupplier, getSupplier, updateSupplier, validateSupplierUpdate } from "@/lib/supplier-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID supplier tidak valid.");
  const item = await getSupplier(id);
  return item ? ok(item) : fail(404, "NOT_FOUND", "Supplier tidak ditemukan.");
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
  const parsed = validateSupplierUpdate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data supplier tidak valid.", parsed.details);
  }
  try {
    const item = await updateSupplier(id, parsed.data);
    return item ? ok(item) : fail(404, "NOT_FOUND", "Supplier tidak ditemukan.");
  } catch (e) {
    console.error("[supplier/update]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const deleted = await deleteSupplier(Number((await ctx.params).id));
  return deleted ? ok({ message: "Supplier berhasil dihapus." }) : fail(404, "NOT_FOUND", "Supplier tidak ditemukan.");
}
