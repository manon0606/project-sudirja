import type { NextRequest } from "next/server";
import { ok, fail, requireAdminOrPosKey } from "@/lib/api-helpers";
import { catatKas } from "@/lib/shift-service";
import type { ShiftKasInput } from "@/lib/shift-types";

/**
 * POST /shift/kas — catat kas masuk / kas keluar pada shift yang sedang berjalan.
 *
 * Body: { kode, tipe: "masuk"|"keluar", jumlah, catatan?, dicatatOleh,
 *         clientRef, occurredAt? }
 *
 * Idempoten pada `clientRef`. Hanya bisa pada shift berstatus `Buka`.
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
  const b = (body ?? {}) as Partial<ShiftKasInput> & Record<string, unknown>;
  const kode = typeof b.kode === "string" ? b.kode.trim() : "";
  const tipe = typeof b.tipe === "string" ? b.tipe.trim() : "";
  const jumlah = Number(b.jumlah ?? NaN);
  const dicatatOleh = typeof b.dicatatOleh === "string" ? b.dicatatOleh.trim() : "";
  const clientRef = typeof b.clientRef === "string" ? b.clientRef.trim() : "";

  if (!kode) return fail(422, "VALIDATION_ERROR", "kode shift wajib diisi.");
  if (tipe !== "masuk" && tipe !== "keluar") {
    return fail(422, "VALIDATION_ERROR", "tipe harus 'masuk' atau 'keluar'.");
  }
  if (!Number.isFinite(jumlah) || jumlah <= 0) {
    return fail(422, "VALIDATION_ERROR", "jumlah harus angka lebih dari nol.");
  }
  if (!dicatatOleh) return fail(422, "VALIDATION_ERROR", "dicatatOleh wajib diisi.");
  if (!clientRef) return fail(422, "VALIDATION_ERROR", "clientRef wajib diisi (kunci idempotensi).");

  try {
    const kas = await catatKas({
      kode,
      tipe: tipe as "masuk" | "keluar",
      jumlah: String(jumlah),
      catatan: typeof b.catatan === "string" && b.catatan.trim() ? b.catatan.trim() : null,
      dicatatOleh,
      clientRef,
      occurredAt: typeof b.occurredAt === "string" && b.occurredAt.trim() ? b.occurredAt.trim() : null,
    });
    return ok(kas, { status: 201 });
  } catch (error) {
    const pesan = error instanceof Error ? error.message : "Terjadi kesalahan server.";
    if (pesan.includes("tidak ditemukan")) return fail(404, "NOT_FOUND", pesan);
    if (pesan.includes("sudah ditutup") || pesan.includes("wajib diisi") || pesan.includes("harus")) {
      return fail(422, "VALIDATION_ERROR", pesan);
    }
    console.error("[shift/kas] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
