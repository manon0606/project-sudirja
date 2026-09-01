import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  listReference,
  createReference,
  parseListParams,
  validateRefCreate,
  referenceNameExists,
  toMerkDTO,
} from "@/lib/products-service";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parseListParams(request.nextUrl.searchParams, ["kode", "nama", "created_at"], "kode");
    const result = await listReference("merk", opts);
    return ok({ items: result.items.map(toMerkDTO), pagination: result.pagination });
  } catch (error) {
    console.error("[merk/list] error:", error);
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
  const parsed = validateRefCreate(body, "merk");
  if (!parsed.ok || parsed.nama === undefined) {
    return fail(422, "VALIDATION_ERROR", "Data merk tidak valid.", parsed.details);
  }
  try {
    if (await referenceNameExists("merk", parsed.nama)) {
      return fail(409, "DUPLICATE_NAME", "Nama merk sudah ada.");
    }
    const created = await createReference("merk", "MRK", { nama: parsed.nama });
    return ok(toMerkDTO(created), { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ER_DUP_ENTRY") {
      return fail(409, "DUPLICATE_NAME", "Nama merk sudah ada.");
    }
    console.error("[merk/create] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
