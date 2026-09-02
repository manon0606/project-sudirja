import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deletePembelian, getPembelianById } from "@/lib/pembelian-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID pembelian tidak valid.");
  const item = await getPembelianById(id);
  return item ? ok(item) : fail(404, "NOT_FOUND", "Pembelian tidak ditemukan.");
}

export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const deleted = await deletePembelian(Number((await ctx.params).id));
    return deleted ? ok({ message: "Pembelian berhasil dihapus (stok dikembalikan)." }) : fail(404, "NOT_FOUND", "Pembelian tidak ditemukan.");
  } catch (e) {
    console.error("[pembelian/delete]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
