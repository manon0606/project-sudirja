import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deleteRole, getRoleByName, updateRole, validateRoleUpdate } from "@/lib/user-service";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { name } = await ctx.params;
  const role = await getRoleByName(name);
  return role ? ok(role) : fail(404, "NOT_FOUND", "Role tidak ditemukan.");
}

/** PATCH /roles/[name] — ubah label & permissions role. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { name } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateRoleUpdate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data role tidak valid.", parsed.details);
  }
  try {
    const role = await updateRole(name, parsed.data);
    return role ? ok(role) : fail(404, "NOT_FOUND", "Role tidak ditemukan.");
  } catch (e) {
    console.error("[roles/update]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

/** DELETE /roles/[name] — hapus role (non-system). */
export async function DELETE(_r: NextRequest, ctx: Ctx) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { name } = await ctx.params;
  try {
    const deleted = await deleteRole(name);
    return deleted ? ok({ message: "Role berhasil dihapus." }) : fail(404, "NOT_FOUND", "Role tidak ditemukan.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SYSTEM_ROLE") return fail(422, "VALIDATION_ERROR", "Role sistem tidak dapat dihapus.");
    if (msg === "ROLE_IN_USE") return fail(422, "VALIDATION_ERROR", "Role masih dipakai user, tidak dapat dihapus.");
    console.error("[roles/delete]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
