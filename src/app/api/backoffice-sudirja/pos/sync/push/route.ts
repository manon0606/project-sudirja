import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { pushBatch } from "@/lib/sync-service";
import type { SyncPushInput } from "@/lib/sync-types";

/**
 * POST /pos/sync/push — kirim batch transaksi + persetujuan dari satu perangkat.
 *
 * Body: { deviceId?, pesanan?, retur?, kreditPembayaran?, approval? }
 *
 * Tiap item diproses independen dan hasilnya dilaporkan per item
 * (`ok` / `failed` + `duplicate`), jadi satu baris bermasalah tidak
 * membatalkan seluruh batch. Idempotensi memakai `noPesanan` / `noRetur` /
 * `clientRef` — push ulang yang sama tidak menulis dua kali.
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
  const b = (body ?? {}) as SyncPushInput;
  const total =
    (b.pesanan?.length ?? 0) +
    (b.retur?.length ?? 0) +
    (b.kreditPembayaran?.length ?? 0) +
    (b.approval?.length ?? 0);
  if (total === 0) {
    return fail(422, "VALIDATION_ERROR", "Tidak ada isi batch yang bisa dikirim.", {
      isi: "pesanan / retur / kreditPembayaran / approval",
    });
  }

  try {
    return ok(await pushBatch(b));
  } catch (error) {
    console.error("[pos/sync/push] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
