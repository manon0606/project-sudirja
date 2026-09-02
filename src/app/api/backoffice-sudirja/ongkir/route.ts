import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createOngkir, kecamatanExists, listOngkir, parseListParams, validateCreate } from "@/lib/ongkir-service";

export async function GET(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listOngkir(parseListParams(request.nextUrl.searchParams)));
  } catch (e) {
    console.error("[ongkir/list]", e);
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
  const parsed = validateCreate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data ongkir tidak valid.", parsed.details);
  }
  try {
    if (await kecamatanExists(parsed.data.kecamatan)) {
      return fail(409, "DUPLICATE_KECAMATAN", "Kecamatan sudah terdaftar.");
    }
    return ok(await createOngkir(parsed.data), { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_CODE", "Kode atau kecamatan sudah digunakan.");
    }
    console.error("[ongkir/create]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
