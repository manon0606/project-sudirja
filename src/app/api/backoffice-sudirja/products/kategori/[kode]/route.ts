import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  getReferenceByKode,
  updateReference,
  deleteReference,
  countReferenceUsage,
  validateRefUpdate,
  referenceNameExists,
  toKategoriDTO,
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
    const existing = await getReferenceByKode("kategori", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Kategori ${kode} tidak ditemukan.`);
    const parsed = validateRefUpdate(body, "kategori");
    if (!parsed.ok) return fail(422, "VALIDATION_ERROR", "Data kategori tidak valid.", parsed.details);
    if (parsed.nama !== undefined && (await referenceNameExists("kategori", parsed.nama, existing.id))) {
      return fail(409, "DUPLICATE_NAME", "Nama kategori sudah ada.");
    }
    const updated = await updateReference("kategori", existing.id, { nama: parsed.nama, isActive: parsed.isActive });
    if (!updated) return fail(404, "NOT_FOUND", `Kategori ${kode} tidak ditemukan.`);
    return ok(toKategoriDTO(updated));
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_NAME", "Nama kategori sudah ada.");
    }
    console.error("[kategori/update] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  try {
    const existing = await getReferenceByKode("kategori", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Kategori ${kode} tidak ditemukan.`);
    const usage = await countReferenceUsage("kategori", existing.id);
    if (usage > 0) {
      return fail(409, "IN_USE", `Kategori ${kode} dipakai oleh ${usage} produk dan tidak dapat dihapus.`, { count: usage });
    }
    await deleteReference("kategori", existing.id);
    return ok({ message: `Kategori ${kode} berhasil dihapus.` });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
      return fail(409, "IN_USE", "Kategori masih dipakai produk dan tidak dapat dihapus.");
    }
    console.error("[kategori/delete] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
