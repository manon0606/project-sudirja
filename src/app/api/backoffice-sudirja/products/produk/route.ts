import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  listProduk,
  getProdukSatuanByProdukIds,
  getSatuanMapByKode,
  createProdukTx,
  parseProdukListParams,
  validateProdukBody,
  getProdukBySku,
  kodeItemExists,
  toProdukDTO,
} from "@/lib/products-service";
import { query } from "@/lib/db";
import { toWebpDataUrl } from "@/lib/image";
import type { RowDataPacket } from "mysql2/promise";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parseProdukListParams(request.nextUrl.searchParams);
    const result = await listProduk(opts);
    const satuanMap = await getProdukSatuanByProdukIds(result.items.map((r) => r.id));
    const items = result.items.map((row) => toProdukDTO(row, satuanMap.get(row.id) ?? []));
    return ok({ items, pagination: result.pagination });
  } catch (error) {
    console.error("[produk/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const parsed = validateProdukBody(body, false);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data produk tidak valid.", parsed.details);
  }
  const input = parsed.data;

  try {
    if (await getProdukBySku(input.sku)) {
      return fail(409, "SKU_TAKEN", `SKU ${input.sku} sudah digunakan produk lain.`);
    }
    for (const row of input.satuan) {
      if (await kodeItemExists(row.kodeItem)) {
        return fail(409, "KODE_ITEM_TAKEN", `Kode item ${row.kodeItem} sudah digunakan.`);
      }
    }

    const [kategoriResult, merkResult] = await Promise.all([
      query<RowDataPacket[]>(`SELECT id FROM kategori WHERE kode = ? LIMIT 1`, [input.kategoriKode]),
      query<RowDataPacket[]>(`SELECT id FROM merk WHERE kode = ? LIMIT 1`, [input.merkKode]),
    ]);
    const kategoriId = kategoriResult.rows[0]?.id;
    const merkId = merkResult.rows[0]?.id;
    if (!kategoriId) return fail(422, "VALIDATION_ERROR", "Kategori tidak ditemukan.", { kategoriKode: "Kategori tidak ditemukan." });
    if (!merkId) return fail(422, "VALIDATION_ERROR", "Merk tidak ditemukan.", { merkKode: "Merk tidak ditemukan." });

    const satuanMap = await getSatuanMapByKode(input.satuan.map((s) => s.satuanKode));
    for (const row of input.satuan) {
      if (!satuanMap.has(row.satuanKode)) {
        return fail(422, "VALIDATION_ERROR", `Satuan ${row.satuanKode} tidak ditemukan.`, { [row.satuanKode]: "Satuan tidak ditemukan." });
      }
    }

    const satuanRows = input.satuan.map((row) => ({
      satuanId: satuanMap.get(row.satuanKode)!.id,
      kodeItem: row.kodeItem,
      harga: row.harga,
    }));

    // Feedback #2 — gambar upload dikonversi otomatis ke WebP saat disimpan.
    let gambarUrl = input.gambarUrl;
    if (gambarUrl && gambarUrl.startsWith("data:image/")) {
      try {
        gambarUrl = await toWebpDataUrl(gambarUrl);
      } catch (error) {
        console.error("[produk/create] webp conversion failed:", error);
        return fail(422, "VALIDATION_ERROR", "Gambar tidak dapat diproses. Gunakan JPEG, PNG, atau WebP.", {
          gambarUrl: "Gambar tidak dapat diproses.",
        });
      }
    }

    await createProdukTx({
      sku: input.sku,
      nama: input.nama,
      deskripsi: input.deskripsi,
      gambarUrl,
      kategoriId,
      merkId,
      status: input.status,
      satuan: satuanRows,
    });
    return ok({ message: `Produk ${input.sku} berhasil dibuat.` }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const code = (error as { code?: string }).code;
      if (code === "ER_DUP_ENTRY") {
        const msg = (error as { message?: string }).message ?? "";
        if (msg.includes("uq_produk_sku")) return fail(409, "SKU_TAKEN", `SKU ${input.sku} sudah digunakan produk lain.`);
        if (msg.includes("uq_kode_item")) return fail(409, "KODE_ITEM_TAKEN", "Kode item sudah digunakan.");
      }
    }
    console.error("[produk/create] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
