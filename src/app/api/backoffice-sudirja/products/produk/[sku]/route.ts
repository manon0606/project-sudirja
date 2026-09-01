import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import {
  getProdukBySku,
  getProdukSatuanByProdukId,
  getSatuanMapByKode,
  updateProdukTx,
  deleteProduk,
  validateProdukBody,
  kodeItemExists,
  toProdukDTO,
} from "@/lib/products-service";
import { query } from "@/lib/db";
import { toWebpDataUrl } from "@/lib/image";
import type { RowDataPacket } from "mysql2/promise";

type Ctx = { params: Promise<{ sku: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params; // Next 16: params is async
  try {
    const row = await getProdukBySku(sku);
    if (!row) return fail(404, "NOT_FOUND", `Produk ${sku} tidak ditemukan.`);
    const satuanRows = await getProdukSatuanByProdukId(row.id);
    return ok(toProdukDTO(row, satuanRows));
  } catch (error) {
    console.error("[produk/get] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

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
  const parsed = validateProdukBody(body, true);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data produk tidak valid.", parsed.details);
  }
  const input = parsed.data;

  try {
    const existing = await getProdukBySku(sku);
    if (!existing) return fail(404, "NOT_FOUND", `Produk ${sku} tidak ditemukan.`);

    // SKU conflict check (case: renaming SKU)
    if (input.sku && input.sku !== existing.sku) {
      const clash = await getProdukBySku(input.sku);
      if (clash) return fail(409, "SKU_TAKEN", `SKU ${input.sku} sudah digunakan produk lain.`);
    }
    // kode_item conflicts exclude this product itself
    if (input.satuan) {
      for (const row of input.satuan) {
        if (await kodeItemExists(row.kodeItem, existing.id)) {
          return fail(409, "KODE_ITEM_TAKEN", `Kode item ${row.kodeItem} sudah digunakan produk lain.`);
        }
      }
    }

    let kategoriId: number | undefined;
    let merkId: number | undefined;
    if (input.kategoriKode) {
      const { rows } = await query<RowDataPacket[]>(`SELECT id FROM kategori WHERE kode = ? LIMIT 1`, [input.kategoriKode]);
      kategoriId = rows[0]?.id;
      if (!kategoriId) return fail(422, "VALIDATION_ERROR", "Kategori tidak ditemukan.", { kategoriKode: "Kategori tidak ditemukan." });
    }
    if (input.merkKode) {
      const { rows } = await query<RowDataPacket[]>(`SELECT id FROM merk WHERE kode = ? LIMIT 1`, [input.merkKode]);
      merkId = rows[0]?.id;
      if (!merkId) return fail(422, "VALIDATION_ERROR", "Merk tidak ditemukan.", { merkKode: "Merk tidak ditemukan." });
    }

    let satuanRows: Array<{ satuanId: number; kodeItem: string; harga: number }> | undefined;
    if (input.satuan) {
      const satuanMap = await getSatuanMapByKode(input.satuan.map((s) => s.satuanKode));
      for (const row of input.satuan) {
        if (!satuanMap.has(row.satuanKode)) {
          return fail(422, "VALIDATION_ERROR", `Satuan ${row.satuanKode} tidak ditemukan.`, { [row.satuanKode]: "Satuan tidak ditemukan." });
        }
      }
      satuanRows = input.satuan.map((row) => ({
        satuanId: satuanMap.get(row.satuanKode)!.id,
        kodeItem: row.kodeItem,
        harga: row.harga,
      }));
    }

    let gambarUrl = input.gambarUrl;
    if (gambarUrl && gambarUrl.startsWith("data:image/") && !gambarUrl.startsWith("data:image/webp")) {
      // Feedback #2 — konversi otomatis ke WebP saat disimpan (webp dilewati).
      try {
        gambarUrl = await toWebpDataUrl(gambarUrl);
      } catch (error) {
        console.error("[produk/update] webp conversion failed:", error);
        return fail(422, "VALIDATION_ERROR", "Gambar tidak dapat diproses. Gunakan JPEG, PNG, atau WebP.", {
          gambarUrl: "Gambar tidak dapat diproses.",
        });
      }
    }

    await updateProdukTx(existing.id, {
      sku: input.sku,
      nama: input.nama,
      deskripsi: input.deskripsi,
      gambarUrl,
      kategoriId,
      merkId,
      status: input.status,
      satuan: satuanRows,
    });

    const updated = await getProdukBySku(input.sku ?? existing.sku);
    if (!updated) return fail(404, "NOT_FOUND", `Produk tidak ditemukan setelah update.`);
    const updatedSatuan = await getProdukSatuanByProdukId(updated.id);
    return ok(toProdukDTO(updated, updatedSatuan));
  } catch (error) {
    if (typeof error === "object" && error !== null) {
      const code = (error as { code?: string }).code;
      if (code === "ER_DUP_ENTRY") {
        const msg = (error as { message?: string }).message ?? "";
        if (msg.includes("uq_produk_sku")) return fail(409, "SKU_TAKEN", `SKU sudah digunakan produk lain.`);
        if (msg.includes("uq_kode_item")) return fail(409, "KODE_ITEM_TAKEN", "Kode item sudah digunakan.");
      }
    }
    console.error("[produk/update] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  const { sku } = await ctx.params;
  try {
    const existing = await getProdukBySku(sku);
    if (!existing) return fail(404, "NOT_FOUND", `Produk ${sku} tidak ditemukan.`);
    await deleteProduk(existing.id); // produk_satuan rows cascade
    return ok({ message: `Produk ${sku} berhasil dihapus.` });
  } catch (error) {
    console.error("[produk/delete] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
