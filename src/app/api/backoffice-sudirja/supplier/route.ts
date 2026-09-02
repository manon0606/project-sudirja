import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createSupplier, listSupplier, parseListParams, validateSupplierCreate } from "@/lib/supplier-service";
import type { CreateSupplierInput } from "@/lib/supplier-types";

export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listSupplier(parseListParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[supplier/list]", e);
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
  const parsed = validateSupplierCreate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data supplier tidak valid.", parsed.details);
  }
  try {
    return ok(await createSupplier(parsed.data as CreateSupplierInput), { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_KODE", "Kode supplier sudah digunakan.");
    }
    console.error("[supplier/create]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
