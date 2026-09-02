import type { NextRequest } from "next/server";
import { fail, ok, requireAdmin } from "@/lib/api-helpers";
import { createPembelian, validatePembelian } from "@/lib/pembelian-service";
import type { CreatePembelianInput } from "@/lib/pembelian-types";

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
  if (rows.length > 500) return fail(422, "VALIDATION_ERROR", "Maksimal 500 baris per unggahan.");
  const results = { success: 0, failures: [] as Array<{ row: number; noPembelian: string; message: string }> };
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as unknown;
    try {
      const parsed = validatePembelian(raw);
      if (!parsed.ok || !parsed.data) {
        results.failures.push({ row: i + 1, noPembelian: "", message: Object.values(parsed.details ?? {})[0] ?? "Data tidak valid." });
        continue;
      }
      const created = await createPembelian(parsed.data as CreatePembelianInput);
      results.success++;
      void created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      results.failures.push({ row: i + 1, noPembelian: "", message: msg === "SUPPLIER_NOT_FOUND" ? "Supplier tidak ditemukan." : msg === "SATUAN_REQUIRED" ? "Satuan wajib dipilih." : "Gagal membuat pembelian." });
    }
  }
  return ok(results, { status: 201 });
}
