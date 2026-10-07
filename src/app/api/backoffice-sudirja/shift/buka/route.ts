import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { bukaShift } from "@/lib/shift-service";
import type { BukaShiftInput } from "@/lib/shift-types";

/**
 * POST /shift/buka — buka shift kasir.
 *
 * Body: { kode?, deviceId, cashierId?, cashierUsername, cashierNama,
 *         openingBalance, clientRef?, openedAt? }
 *
 * Idempoten pada `clientRef` (push ulang offline tidak membuat shift kedua) dan
 * menolak bila kasir yang sama masih punya shift `Buka`. `openedAt` dipakai
 * sebagai awal jendela rekap supaya transaksi offline tetap terhitung benar.
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
  const b = (body ?? {}) as Partial<BukaShiftInput> & Record<string, unknown>;
  const deviceId = typeof b.deviceId === "string" ? b.deviceId.trim() : "";
  const cashierUsername = typeof b.cashierUsername === "string" ? b.cashierUsername.trim() : "";
  const cashierNama = typeof b.cashierNama === "string" ? b.cashierNama.trim() : "";
  const openingBalance = Number(b.openingBalance ?? NaN);

  if (!deviceId) return fail(422, "VALIDATION_ERROR", "deviceId wajib diisi.");
  if (!cashierUsername || !cashierNama) return fail(422, "VALIDATION_ERROR", "cashierUsername & cashierNama wajib diisi.");
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return fail(422, "VALIDATION_ERROR", "openingBalance harus angka ≥ 0.");
  }
  if (b.openedAt && Number.isNaN(Date.parse(String(b.openedAt)))) {
    return fail(422, "VALIDATION_ERROR", "openedAt harus waktu ISO-8601 yang valid.");
  }

  try {
    const hasil = await bukaShift({
      kode: typeof b.kode === "string" && b.kode.trim() ? b.kode.trim() : null,
      deviceId,
      cashierId: typeof b.cashierId === "number" ? b.cashierId : null,
      cashierUsername,
      cashierNama,
      openingBalance: String(openingBalance),
      clientRef: typeof b.clientRef === "string" && b.clientRef.trim() ? b.clientRef.trim() : null,
      openedAt: typeof b.openedAt === "string" && b.openedAt.trim() ? b.openedAt.trim() : null,
    });
    // Push ulang yang sukses → 200; shift baru → 201.
    return ok(hasil.shift, { status: hasil.created ? 201 : 200 });
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    if (pesan.includes("masih Buka") || pesan.includes("sudah dipakai")) {
      return fail(422, "VALIDATION_ERROR", pesan);
    }
    console.error("[shift/buka] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
