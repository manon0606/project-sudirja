import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createRole, listRoles, validateRoleCreate } from "@/lib/user-service";

/** GET /roles — daftar semua role + permission. */
export async function GET(_request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await listRoles());
  } catch (e) {
    console.error("[roles/list]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

/** POST /roles — buat role baru (otomatis masuk komisi_settings via trigger). */
export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateRoleCreate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data role tidak valid.", parsed.details);
  }
  try {
    return ok(await createRole(parsed.data), { status: 201 });
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return fail(409, "VALIDATION_ERROR", "Kode role sudah digunakan.");
    }
    console.error("[roles/create]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
