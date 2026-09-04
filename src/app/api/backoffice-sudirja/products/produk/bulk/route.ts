import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  upsertProdukBySku,
  validateProdukBody,
  type UpsertProdukInput,
} from "@/lib/products-service";
import { toWebpDataUrl } from "@/lib/image";

/**
 * POST /products/produk/bulk — upsert produk massal.
 * Body: { rows: [ProdukInput...] } — tiap row format SAMA dengan create manual
 * (SKU, nama, deskripsi, gambarUrl, kategoriKode, merkKode, status, satuan[]).
 *
 * Baris dengan SKU yang sama DIGABUNG: satuan dari semua baris tersebut
 * dikumpulkan menjadi satu produk (mendukung multi-satuan via CSV), lalu
 * di-upsert sekali per SKU: SKU sudah ada → update (full replace satuan),
 * belum ada → create. Gambar data URL otomatis dikonversi ke WebP.
 *
 * Hasil: { success (jumlah produk unik), failures: [{row, sku, message}] }.
 */
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

  const rows = b.rows as unknown[];

  // 1) Validasi tiap baris (sama dengan manual create) & kelompokkan per SKU.
  const bySku = new Map<string, { row: number; input: UpsertProdukInput }>();
  const failures: Array<{ row: number; sku: string; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rawSku = ((raw ?? {}) as Record<string, unknown>).sku as string | undefined;
    const parsed = validateProdukBody(raw, false);
    if (!parsed.ok || !parsed.data) {
      const firstDetail = parsed.details ? Object.values(parsed.details)[0] : "Data produk tidak valid.";
      failures.push({ row: i + 1, sku: String(rawSku ?? ""), message: firstDetail });
      continue;
    }
    const input = parsed.data as import("@/lib/products-service").ProdukDataFull;

    const existing = bySku.get(input.sku);
    if (existing) {
      // Gabungkan satuan dari baris berikutnya dengan SKU yang sama.
      const seenSatuan = new Set(existing.input.satuan.map((s) => s.satuanKode));
      for (const s of input.satuan) {
        if (!seenSatuan.has(s.satuanKode)) {
          existing.input.satuan.push(s);
          seenSatuan.add(s.satuanKode);
        }
      }
    } else {
      bySku.set(input.sku, { row: i + 1, input });
    }
  }

  if (bySku.size === 0) {
    return ok({ success: 0, failures });
  }

  // 2) Upsert per produk unik.
  let success = 0;
  for (const { row, input } of bySku.values()) {
    try {
      // Konversi gambar → WebP bila berupa data URL (sama seperti POST/PATCH manual).
      let gambarUrl = input.gambarUrl;
      if (gambarUrl && gambarUrl.startsWith("data:image/")) {
        gambarUrl = await toWebpDataUrl(gambarUrl);
      }

      const upsertInput: UpsertProdukInput = {
        sku: input.sku,
        nama: input.nama,
        deskripsi: input.deskripsi,
        gambarUrl,
        kategoriKode: input.kategoriKode,
        merkKode: input.merkKode,
        status: input.status,
        satuan: input.satuan.map((s) => ({
          satuanKode: s.satuanKode,
          kodeItem: s.kodeItem,
          harga: s.harga,
        })),
      };
      const result = await upsertProdukBySku(upsertInput);
      success++;
      console.log(`[produk/bulk] row ${row}: ${result.action} SKU=${input.sku}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Gagal menyimpan produk.";
      failures.push({ row, sku: input.sku, message: msg });
    }
  }

  return ok({ success, failures });
}
