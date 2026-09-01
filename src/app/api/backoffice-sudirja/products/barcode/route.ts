import type { NextRequest } from "next/server";
import bwipjs from "bwip-js/node";
import { fail, requireAdmin } from "@/lib/api-helpers";
import type { BarcodeFormat } from "@/lib/product-types";

/**
 * POST { kodeItem, format?, includeText? } → { ok, data: { kodeItem, format, dataUrl } }
 * Returns a PNG data URL the client can drop into <img src> for on-screen
 * display and printing. Server-side rendering keeps the client bundle free
 * of the barcode engine.
 *
 * Format guidance: CODE128 for arbitrary alphanumeric kode item (default);
 * EAN13 requires exactly 12 digits (+auto check digit); QRCODE for 2D.
 * includeText=false renders bars only — used by the print label that sets
 * its own kodeItem/satuan/price typography.
 */
const VALID_FORMATS: BarcodeFormat[] = ["CODE128", "EAN13", "QRCODE"];

/** bwip-js v4 uses lowercase BWIPP encoder names. */
const BCID: Record<BarcodeFormat, string> = {
  CODE128: "code128",
  EAN13: "ean13",
  QRCODE: "qrcode",
};

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
  const kodeItem = typeof b.kodeItem === "string" ? b.kodeItem.trim() : "";
  const format = (typeof b.format === "string" ? b.format : "CODE128") as BarcodeFormat;
  const includeText = b.includeText !== false;

  if (!kodeItem || kodeItem.length > 64 || !/^[A-Za-z0-9._-]+$/.test(kodeItem)) {
    return fail(422, "VALIDATION_ERROR", "Kode item tidak valid (1-64 karakter alfanumerik, . _ -).");
  }
  if (!VALID_FORMATS.includes(format)) {
    return fail(422, "VALIDATION_ERROR", "Format barcode wajib CODE128, EAN13, atau QRCODE.");
  }
  if (format === "EAN13" && !/^\d{12}$/.test(kodeItem)) {
    return fail(422, "VALIDATION_ERROR", "EAN13 membutuhkan tepat 12 digit angka.");
  }

  try {
    const png = await bwipjs.toBuffer({
      bcid: BCID[format],
      text: kodeItem,
      scale: 3,
      height: 12,
      includetext: includeText,
      ...(includeText ? { textxalign: "center" as const } : {}),
    });
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    return Response.json({ ok: true, data: { kodeItem, format, dataUrl } });
  } catch (error) {
    console.error("[barcode] render error:", error);
    return fail(422, "VALIDATION_ERROR", "Kode item tidak dapat dirender sebagai barcode pada format ini.");
  }
}
