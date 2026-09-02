import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { bulkCreateKonsinyasi } from "@/lib/konsinyasi-service";

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const rows = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows) || !rows.length) return fail(422, "VALIDATION_ERROR", "Tidak ada baris untuk diproses.");
  if (rows.length > 1000) return fail(422, "VALIDATION_ERROR", "Maksimal 1000 baris per unggahan.");
  try {
    return ok(await bulkCreateKonsinyasi(rows as never[]));
  } catch (e) {
    console.error("[konsinyasi/bulk]", e);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server.");
  }
}
