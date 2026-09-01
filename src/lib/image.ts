import "server-only";

import sharp from "sharp";

/**
 * WebP conversion for uploaded product images (feedback #2).
 *
 * Input is a base64 data URL (data:image/jpeg|png|webp;base64,...) as sent by
 * the admin form. Output is always a WebP data URL so `produk.gambar_url` stays
 * uniform: data:image/webp;base64,...
 *
 * - Re-encodes at quality 82 — typical product photos shrink 3-10x vs PNG/JPEG.
 * - Downscales to MAX_DIMENSION (fit inside, never enlarges) to bound memory
 *   and storage: a 4000px phone photo lands at ~1000px, still crisp for the
 *   backoffice thumbnail/detail views.
 * - EXIF orientation is respected automatically by sharp (rotate()).
 */

const MAX_DIMENSION = 1000;
const QUALITY = 82;

export async function toWebpDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error("Format gambar tidak didukung.");
  }

  const buffer = Buffer.from(match[2], "base64");
  const webp = await sharp(buffer)
    .rotate() // honor EXIF orientation before resizing
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();

  return `data:image/webp;base64,${webp.toString("base64")}`;
}
