import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createPelanggan, listPelanggan, parseListParams, validatePelangganCreate } from "@/lib/pelanggan-service";
import type { CreatePelangganInput } from "@/lib/pelanggan-types";

export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listPelanggan(parseListParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[pelanggan/list]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

/** POST /pelanggan — buat pelanggan (dipakai admin & nanti API register toko online). */
export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validatePelangganCreate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data pelanggan tidak valid.", parsed.details);
  }
  try {
    return ok(await createPelanggan(parsed.data as CreatePelangganInput), { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_KODE", "Kode pelanggan sudah digunakan.");
    }
    console.error("[pelanggan/create]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
