import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  getReferenceByKode,
  updateReference,
  deleteReference,
  countReferenceUsage,
  validateRefUpdate,
  referenceNameExists,
  toMerkDTO,
} from "@/lib/products-service";

type Ctx = { params: Promise<{ kode: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params; // Next 16: params is async
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  try {
    const existing = await getReferenceByKode("merk", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Merk ${kode} tidak ditemukan.`);
    const parsed = validateRefUpdate(body, "merk");
    if (!parsed.ok) return fail(422, "VALIDATION_ERROR", "Data merk tidak valid.", parsed.details);
    if (parsed.nama !== undefined && (await referenceNameExists("merk", parsed.nama, existing.id))) {
      return fail(409, "DUPLICATE_NAME", "Nama merk sudah ada.");
    }
    const updated = await updateReference("merk", existing.id, { nama: parsed.nama, isActive: parsed.isActive });
    if (!updated) return fail(404, "NOT_FOUND", `Merk ${kode} tidak ditemukan.`);
    return ok(toMerkDTO(updated));
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_NAME", "Nama merk sudah ada.");
    }
    console.error("[merk/update] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  try {
    const existing = await getReferenceByKode("merk", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Merk ${kode} tidak ditemukan.`);
    const usage = await countReferenceUsage("merk", existing.id);
    if (usage > 0) {
      return fail(409, "IN_USE", `Merk ${kode} dipakai oleh ${usage} produk dan tidak dapat dihapus.`, { count: usage });
    }
    await deleteReference("merk", existing.id);
    return ok({ message: `Merk ${kode} berhasil dihapus.` });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
      return fail(409, "IN_USE", "Merk masih dipakai produk dan tidak dapat dihapus.");
    }
    console.error("[merk/delete] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
