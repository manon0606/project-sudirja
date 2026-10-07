import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { tutupShift } from "@/lib/shift-service";
import type { TutupShiftInput } from "@/lib/shift-types";

/**
 * POST /shift/tutup — tutup shift + rekap setoran.
 *
 * Body: { kode, closingBalance, setoran?, catatan?, clientRef?, closedAt? }
 *
 * Menghitung rekap transaksi + kas pada jendela shift, lalu menyimpan
 * `closingBalance`, `setoran` (default = `rekap.harapanKas`), dan
 * `selisih = closingBalance − harapanKas`. Idempoten: shift yang sudah `Tutup`
 * mengembalikan keadaan akhir tanpa menghitung ulang.
 */
export async function POST(request: NextRequest) {
  const requester = await requireAdminOrPosKey(request);
  if (!requester) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau API key POS tidak sah.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Partial<TutupShiftInput> & Record<string, unknown>;
  const kode = typeof b.kode === "string" ? b.kode.trim() : "";
  const closingBalance = Number(b.closingBalance ?? NaN);

  if (!kode) return fail(422, "VALIDATION_ERROR", "kode shift wajib diisi.");
  if (!Number.isFinite(closingBalance) || closingBalance < 0) {
    return fail(422, "VALIDATION_ERROR", "closingBalance harus angka ≥ 0.");
  }
  if (b.closedAt && Number.isNaN(Date.parse(String(b.closedAt)))) {
    return fail(422, "VALIDATION_ERROR", "closedAt harus waktu ISO-8601 yang valid.");
  }

  try {
    const shift = await tutupShift({
      kode,
      closingBalance: String(closingBalance),
      setoran: typeof b.setoran === "string" && b.setoran.trim() ? b.setoran.trim() : null,
      catatan: typeof b.catatan === "string" && b.catatan.trim() ? b.catatan.trim() : null,
      clientRef: typeof b.clientRef === "string" && b.clientRef.trim() ? b.clientRef.trim() : null,
      closedAt: typeof b.closedAt === "string" && b.closedAt.trim() ? b.closedAt.trim() : null,
    });
    return ok(shift);
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    if (pesan.includes("tidak ditemukan")) return fail(404, "NOT_FOUND", pesan);
    console.error("[shift/tutup] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
