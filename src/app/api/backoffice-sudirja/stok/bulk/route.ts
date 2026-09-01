import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { bulkUpdateStok, StokValidationError } from "@/lib/stok-service";
import type { StokErrorCode } from "@/lib/stok-types";

const STOK_ERRORS: Record<string, StokErrorCode> = {
  NEGATIVE_STOCK: "NEGATIVE_STOCK",
  VALIDATION_ERROR: "VALIDATION_ERROR",
};

/** POST /stok/bulk — body: { rows: [{ sku, qty, satuan?, catatan? }] } */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.rows) || b.rows.length === 0) {
    return fail(422, "VALIDATION_ERROR", "Tidak ada baris untuk diproses.");
  }

  const rows: Array<{ sku: string; qty: number; satuan?: string; catatan?: string }> = [];
  const details: Record<string, string> = {};
  b.rows.forEach((raw, index) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const sku = typeof r.sku === "string" ? r.sku.trim() : "";
    const qty = typeof r.qty === "number" ? r.qty : Number(r.qty);
    const label = `rows[${index}]`;
    if (!sku) {
      details[label] = "SKU wajib diisi.";
      return;
    }
    if (!Number.isInteger(qty) || qty < 0) {
      details[label] = "Stok baru wajib angka bulat >= 0.";
      return;
    }
    rows.push({
      sku,
      qty,
      satuan: typeof r.satuan === "string" && r.satuan.trim() ? r.satuan.trim() : undefined,
      catatan: typeof r.catatan === "string" ? r.catatan.trim() : undefined,
    });
  });
  if (Object.keys(details).length > 0) {
    return fail(422, "VALIDATION_ERROR", "Data bulk stok tidak valid.", details);
  }

  try {
    const result = await bulkUpdateStok(rows);
    return ok(result);
  } catch (error) {
    if (error instanceof StokValidationError) {
      return fail(422, STOK_ERRORS[error.code] ?? "VALIDATION_ERROR", error.message);
    }
    console.error("[stok/bulk] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
