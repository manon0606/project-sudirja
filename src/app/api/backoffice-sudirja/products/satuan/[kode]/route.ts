import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  getReferenceByKode,
  updateReference,
  deleteReference,
  countReferenceUsage,
  validateRefUpdate,
  referenceNameExists,
  toSatuanDTO,
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
    const existing = await getReferenceByKode("satuan", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Satuan ${kode} tidak ditemukan.`);

    const parsed = validateRefUpdate(body, "satuan");
    if (!parsed.ok) {
      return fail(422, "VALIDATION_ERROR", "Data satuan tidak valid.", parsed.details);
    }
    if (parsed.nama !== undefined && (await referenceNameExists("satuan", parsed.nama, existing.id))) {
      return fail(409, "DUPLICATE_NAME", "Nama satuan sudah ada.");
    }
    const updated = await updateReference("satuan", existing.id, {
      nama: parsed.nama,
      jumlahUnit: parsed.jumlahUnit,
      isActive: parsed.isActive,
    });
    if (!updated) return fail(404, "NOT_FOUND", `Satuan ${kode} tidak ditemukan.`);
    return ok(toSatuanDTO(updated));
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_NAME", "Nama satuan sudah ada.");
    }
    console.error("[satuan/update] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { kode } = await ctx.params;
  try {
    const existing = await getReferenceByKode("satuan", kode);
    if (!existing) return fail(404, "NOT_FOUND", `Satuan ${kode} tidak ditemukan.`);
    const usage = await countReferenceUsage("satuan", existing.id);
    if (usage > 0) {
      return fail(409, "IN_USE", `Satuan ${kode} dipakai oleh ${usage} konfigurasi harga produk dan tidak dapat dihapus.`, { count: usage });
    }
    await deleteReference("satuan", existing.id);
    return ok({ message: `Satuan ${kode} berhasil dihapus.` });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_ROW_IS_REFERENCED_2") {
      return fail(409, "IN_USE", "Satuan masih dipakai produk dan tidak dapat dihapus.");
    }
    console.error("[satuan/delete] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
