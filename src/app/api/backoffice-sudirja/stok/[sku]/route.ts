import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { getStokBySku, updateStokBySku, deleteStokBySku, StokValidationError } from "@/lib/stok-service";
import type { StokErrorCode } from "@/lib/stok-types";

const STOK_ERRORS: Record<string, StokErrorCode> = {
  NEGATIVE_STOCK: "NEGATIVE_STOCK",
  VALIDATION_ERROR: "VALIDATION_ERROR",
};

type Ctx = { params: Promise<{ sku: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params;
  try {
    const stok = await getStokBySku(sku);
    if (!stok) return fail(404, "NOT_FOUND", `Stok untuk produk ${sku} tidak ditemukan.`);
    return ok(stok);
  } catch (error) {
    console.error("[stok/get] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

/** PATCH /stok/[sku] — body: { catatan?, satuan: [{ satuanKode, qty?, bufferStok?, batasBawah? }] } */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.satuan) || b.satuan.length === 0) {
    return fail(422, "VALIDATION_ERROR", "Minimal satu satuan harus dikirim.");
  }

  const satuan: Array<{ satuanKode: string; qty?: number; bufferStok?: number; batasBawah?: number | null }> = [];
  const details: Record<string, string> = {};
  b.satuan.forEach((raw, index) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const satuanKode = typeof r.satuanKode === "string" ? r.satuanKode.trim() : "";
    const label = `satuan[${index}]`;
    if (!satuanKode) {
      details[label] = "Satuan wajib dipilih.";
      return;
    }
    const row: { satuanKode: string; qty?: number; bufferStok?: number; batasBawah?: number | null } = { satuanKode };
    if (r.qty !== undefined) {
      const qty = typeof r.qty === "number" ? r.qty : Number(r.qty);
      if (!Number.isInteger(qty) || qty < 0) {
        details[`${label}.qty`] = "Stok wajib angka bulat >= 0.";
        return;
      }
      row.qty = qty;
    }
    if (r.bufferStok !== undefined) {
      const bufferStok = typeof r.bufferStok === "number" ? r.bufferStok : Number(r.bufferStok);
      if (!Number.isInteger(bufferStok) || bufferStok < 0) {
        details[`${label}.bufferStok`] = "Stok cadangan wajib angka bulat >= 0.";
        return;
      }
      row.bufferStok = bufferStok;
    }
    if (r.batasBawah !== undefined && r.batasBawah !== null) {
      const batasBawah = typeof r.batasBawah === "number" ? r.batasBawah : Number(r.batasBawah);
      if (!Number.isInteger(batasBawah) || batasBawah < 0) {
        details[`${label}.batasBawah`] = "Batas bawah wajib angka bulat >= 0.";
        return;
      }
      row.batasBawah = batasBawah;
    } else if (r.batasBawah === null) {
      row.batasBawah = null;
    }
    satuan.push(row);
  });
  if (Object.keys(details).length > 0) {
    return fail(422, "VALIDATION_ERROR", "Data stok tidak valid.", details);
  }

  try {
    const catatan = typeof b.catatan === "string" ? b.catatan.trim() : undefined;
    const updated = await updateStokBySku(sku, { catatan, satuan });
    if (!updated) return fail(404, "NOT_FOUND", `Stok untuk produk ${sku} tidak ditemukan.`);
    return ok(updated);
  } catch (error) {
    if (error instanceof StokValidationError) {
      return fail(422, STOK_ERRORS[error.code] ?? "VALIDATION_ERROR", error.message);
    }
    console.error("[stok/update] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

/** DELETE /stok/[sku] — hapus data stok produk (semua satuan + riwayatnya). */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params;
  try {
    const deleted = await deleteStokBySku(sku);
    if (!deleted) return fail(404, "NOT_FOUND", `Produk ${sku} tidak ditemukan.`);
    return ok({ deleted: true });
  } catch (error) {
    console.error("[stok/delete] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
