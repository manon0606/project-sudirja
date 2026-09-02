import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { getKomisiSettings, updateKomisiSetting } from "@/lib/komisi-service";
import { getRoleByName } from "@/lib/user-service";

export async function GET(_request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    return ok(await getKomisiSettings());
  } catch (e) {
    console.error("[komisi/settings]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}

export async function PATCH(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const role = typeof b.role === "string" ? b.role : "";
  if (!role || !(await getRoleByName(role))) {
    return fail(422, "VALIDATION_ERROR", "Role tidak valid.");
  }
  const persenKomisi = typeof b.persenKomisi === "number" ? b.persenKomisi : Number(b.persenKomisi);
  if (!Number.isFinite(persenKomisi) || persenKomisi < 0 || persenKomisi > 100) {
    return fail(422, "VALIDATION_ERROR", "Persen komisi harus 0-100.", { persenKomisi: "Persen komisi harus 0-100." });
  }
  const aktif = b.aktif !== false;
  try {
    return ok(await updateKomisiSetting(role, persenKomisi, aktif));
  } catch (e) {
    console.error("[komisi/settings]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
