import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { deleteUser, getUser, updateUser, validateUpdate } from "@/lib/user-service";

export async function GET(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return fail(422, "VALIDATION_ERROR", "ID user tidak valid.");
  const item = await getUser(id);
  return item ? ok(item) : fail(404, "NOT_FOUND", "User tidak ditemukan.");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const id = Number((await params).id);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateUpdate(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data user tidak valid.", parsed.details);
  }
  try {
    const item = await updateUser(id, parsed.data);
    return item ? ok(item) : fail(404, "NOT_FOUND", "User tidak ditemukan.");
  } catch (e) {
    if ((e as { code?: string })?.code === "ER_DUP_ENTRY") {
      return fail(409, "USERNAME_TAKEN", "Username sudah digunakan.");
    }
    console.error("[users/update]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function DELETE(_r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const deleted = await deleteUser(Number((await params).id));
  return deleted ? ok({ message: "User berhasil dihapus." }) : fail(404, "NOT_FOUND", "User tidak ditemukan.");
}
