import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { createReturTx } from "@/lib/pesanan-service";

type Ctx = { params: Promise<{ no: string }> };

/** POST /pesanan/[no]/retur — buat retur (sebagian/semua) untuk pesanan. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");
  const { no } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const tipe = b.tipe === "semua" || b.tipe === "sebagian" ? b.tipe : "";
  const alasan = typeof b.alasan === "string" ? b.alasan.trim() : "";
  if (!tipe) {
    return fail(422, "VALIDATION_ERROR", "Tipe retur wajib 'semua' atau 'sebagian'.");
  }
  if (!alasan) {
    return fail(422, "VALIDATION_ERROR", "Alasan retur wajib diisi.");
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return fail(422, "VALIDATION_ERROR", "Minimal 1 item retur harus diisi.");
  }

  const items: Array<{ pesananItemId?: number | null; namaProduk: string; qty: number; harga: number }> = [];
  const details: Record<string, string> = {};
  b.items.forEach((raw, index) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const label = `items[${index}]`;
    const namaProduk = typeof r.namaProduk === "string" ? r.namaProduk.trim() : "";
    const qty = typeof r.qty === "number" ? r.qty : Number(r.qty);
    const harga = typeof r.harga === "number" ? r.harga : Number(r.harga);
    if (!namaProduk) {
      details[label] = "Nama produk wajib diisi.";
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      details[label] = "Qty retur wajib angka bulat >= 1.";
      return;
    }
    if (!Number.isFinite(harga) || harga < 0) {
      details[label] = "Harga wajib angka >= 0.";
      return;
    }
    items.push({
      pesananItemId: typeof r.pesananItemId === "number" ? r.pesananItemId : null,
      namaProduk,
      qty,
      harga,
    });
  });
  if (Object.keys(details).length > 0) {
    return fail(422, "VALIDATION_ERROR", "Data retur tidak valid.", details);
  }

  try {
    const hasilRetur = await createReturTx(no, {
      tipe,
      alasan,
      catatan: typeof b.catatan === "string" ? b.catatan.trim() : null,
      items,
      // Kunci idempotensi dari perangkat POS (opsional).
      noRetur: typeof b.noRetur === "string" && b.noRetur.trim() ? b.noRetur.trim() : null,
    });
    if (!hasilRetur) return fail(404, "NOT_FOUND", `Pesanan ${no} tidak ditemukan.`);
    // Push ulang yang sukses (noRetur sudah tercatat) → 200; retur baru → 201.
    return ok(hasilRetur.retur, { status: hasilRetur.created ? 201 : 200 });
  } catch (error) {
    console.error("[pesanan/retur] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
