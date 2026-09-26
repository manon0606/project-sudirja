import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { returKonsinyasi } from "@/lib/konsinyasi-service";
import type { ReturKonsinyasiItemInput } from "@/lib/konsinyasi-types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /konsinyasi/[id]/retur — pengembalian sisa konsinyasi (sebagian/penuh).
 * Body: { items: [{ id: <konsinyasi_item.id>, qtyReturn: <qty> }] }
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID konsinyasi tidak valid.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: ReturKonsinyasiItemInput[] = rawItems.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return { id: Number(r.id), qtyReturn: Number(r.qtyReturn) };
  });
  if (!items.length) return fail(422, "VALIDATION_ERROR", "Minimal 1 item pengembalian.");

  try {
    const item = await returKonsinyasi(id, items);
    return item ? ok(item) : fail(404, "NOT_FOUND", "Konsinyasi tidak ditemukan.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "QTY_MELEBIHI_SISA") return fail(422, "VALIDATION_ERROR", "Qty pengembalian melebihi sisa konsinyasi.");
    if (msg === "QTY_INVALID" || msg === "QTY_KOSONG") return fail(422, "VALIDATION_ERROR", "Qty pengembalian tidak valid.");
    if (msg === "ITEM_NOT_FOUND") return fail(422, "VALIDATION_ERROR", "Item konsinyasi tidak ditemukan.");
    if (msg === "SUDAH_SELESAI") return fail(422, "VALIDATION_ERROR", "Konsinyasi sudah selesai.");
    console.error("[konsinyasi/retur]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
