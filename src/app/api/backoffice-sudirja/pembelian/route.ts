import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createPembelian, listPembelian, parseListParams, validatePembelian } from "@/lib/pembelian-service";
import type { CreatePembelianInput } from "@/lib/pembelian-types";

export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listPembelian(parseListParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[pembelian/list]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validatePembelian(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data pembelian tidak valid.", parsed.details);
  }
  try {
    return ok(await createPembelian(parsed.data as CreatePembelianInput), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SUPPLIER_NOT_FOUND") return fail(422, "SUPPLIER_NOT_FOUND", "Supplier tidak ditemukan.");
    if (msg === "SATUAN_REQUIRED") return fail(422, "VALIDATION_ERROR", "Satuan produk wajib dipilih.");
    if (msg === "SATUAN_INVALID") return fail(422, "VALIDATION_ERROR", "Satuan produk tidak sesuai dengan produk/sku.");
    console.error("[pembelian/create]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
