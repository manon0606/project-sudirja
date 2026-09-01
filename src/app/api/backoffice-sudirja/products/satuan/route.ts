import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  listReference,
  createReference,
  parseListParams,
  validateRefCreate,
  referenceNameExists,
  toSatuanDTO,
} from "@/lib/products-service";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parseListParams(request.nextUrl.searchParams, ["kode", "nama", "created_at"], "kode");
    const result = await listReference("satuan", opts);
    return ok({ items: result.items.map(toSatuanDTO), pagination: result.pagination });
  } catch (error) {
    console.error("[satuan/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateRefCreate(body, "satuan");
  if (!parsed.ok || parsed.nama === undefined) {
    return fail(422, "VALIDATION_ERROR", "Data satuan tidak valid.", parsed.details);
  }
  try {
    if (await referenceNameExists("satuan", parsed.nama)) {
      return fail(409, "DUPLICATE_NAME", "Nama satuan sudah ada.");
    }
    const created = await createReference("satuan", "SAT", {
      nama: parsed.nama,
      jumlahUnit: parsed.jumlahUnit,
    });
    return ok(toSatuanDTO(created), { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_NAME", "Nama satuan sudah ada.");
    }
    console.error("[satuan/create] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
