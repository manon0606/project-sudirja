import type { NextRequest } from "next/server";
import { ok, fail, requireAdmin } from "@/lib/api-helpers";
import { getCurrentAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyPosApiKey } from "@/lib/settings-service";
import type { RowDataPacket } from "mysql2/promise";
import {
  listPesanan,
  parsePesananListParams,
  createPesananTx,
} from "@/lib/pesanan-service";

const VALID_METODE = ["Tunai", "QRIS", "Bank Transfer", "Kredit"];

/** GET /pesanan — list pesanan (pagination, search, filter status/tanggal, sort). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail(401, "UNAUTHORIZED", "Sesi tidak valid atau sudah berakhir.");
  try {
    const opts = parsePesananListParams(request.nextUrl.searchParams);
    const result = await listPesanan(opts);
    return ok(result);
  } catch (error) {
    console.error("[pesanan/list] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}

/**
 * POST /pesanan — buat pesanan manual. Body: { items, metodeBayar, ... }
 * Auth: session admin ATAU API key POS (header X-API-Key) saat mode online.
 * Saat via API key, identitas kasir diambil dari body { kasirNama, kasirUsername }.
 */
export async function POST(request: NextRequest) {
  const current = await requireAdmin();
  const apiKey = request.headers.get("x-api-key");
  let posAuth: { nama: string; username: string } | null = null;
  if (!current) {
    const keyResult = await verifyPosApiKey(apiKey);
    if (!keyResult.valid) {
      return fail(401, "UNAUTHORIZED", "API key tidak valid atau mode online nonaktif.");
    }
    posAuth = { nama: "", username: "pos" };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }
  const b = (body ?? {}) as Record<string, unknown>;

  if (!Array.isArray(b.items) || b.items.length === 0) {
    return fail(422, "VALIDATION_ERROR", "Minimal 1 produk harus ditambahkan.");
  }
  const metodeBayar = typeof b.metodeBayar === "string" ? b.metodeBayar.trim() : "";
  if (!metodeBayar) {
    return fail(422, "VALIDATION_ERROR", "Metode pembayaran wajib dipilih.");
  }
  const isKredit = metodeBayar.toLowerCase().startsWith("kredit") || VALID_METODE.includes(metodeBayar) && metodeBayar === "Kredit";
  const periodeKredit = isKredit && typeof b.periodeKredit === "string" && b.periodeKredit.trim()
    ? b.periodeKredit.trim()
    : null;

  const items: Array<{ produkId?: number | null; namaProduk: string; qty: number; harga: number }> = [];
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
      details[label] = "Qty wajib angka bulat >= 1.";
      return;
    }
    if (!Number.isFinite(harga) || harga < 0) {
      details[label] = "Harga wajib angka >= 0.";
      return;
    }
    items.push({
      produkId: typeof r.produkId === "number" ? r.produkId : null,
      namaProduk,
      qty,
      harga,
    });
  });
  if (Object.keys(details).length > 0) {
    return fail(422, "VALIDATION_ERROR", "Data pesanan tidak valid.", details);
  }

  let uangDiterima = 0;
  if (b.uangDiterima !== undefined) {
    uangDiterima = typeof b.uangDiterima === "number" ? b.uangDiterima : Number(b.uangDiterima);
    if (!Number.isFinite(uangDiterima) || uangDiterima < 0) {
      return fail(422, "VALIDATION_ERROR", "Uang diterima wajib angka >= 0.", { uangDiterima: "Uang diterima wajib angka >= 0." });
    }
  }

  // Cek stok: produk dengan stok 0 tidak boleh masuk pesanan.
  const produkIds = [...new Set(
    items
      .map((it) => it.produkId)
      .filter((id): id is number => typeof id === "number" && id > 0),
  )];
  if (produkIds.length > 0) {
    const stokMap = new Map<number, number>();
    const { rows: stokRows } = await query<RowDataPacket[]>(
      `SELECT p.id AS produk_id,
              COALESCE((SELECT SUM(st.qty) FROM stok st
                        JOIN produk_satuan ps ON ps.id = st.produk_satuan_id
                        WHERE ps.produk_id = p.id), 0) AS stok
       FROM produk p WHERE p.id IN (${produkIds.map(() => "?").join(",")})`,
      produkIds,
    );
    for (const r of stokRows as RowDataPacket[]) {
      stokMap.set(Number(r.produk_id), Number(r.stok));
    }
    for (const it of items) {
      if (typeof it.produkId === "number" && it.produkId > 0) {
        const stok = stokMap.get(it.produkId) ?? 0;
        if (stok <= 0) {
          return fail(422, "VALIDATION_ERROR", `Produk "${it.namaProduk}" stok habis (0) dan tidak dapat ditambahkan ke pesanan.`, {
            stok: `Stok ${it.namaProduk} = 0.`,
          });
        }
      }
    }
  }

  try {
    let kasir: { nama: string; username: string };
    if (current) {
      const admin = (await getCurrentAdmin())!.admin;
      kasir = { nama: admin.full_name, username: admin.username };
    } else {
      // POS via API key — identitas kasir dikirim body (jika ada).
      kasir = {
        nama: typeof b.kasirNama === "string" && b.kasirNama.trim() ? b.kasirNama.trim() : "POS",
        username: typeof b.kasirUsername === "string" && b.kasirUsername.trim() ? b.kasirUsername.trim() : "pos",
      };
    }
    const created = await createPesananTx(
      {
        items,
        metodeBayar,
        periodeKredit,
        voucher: typeof b.voucher === "string" && b.voucher.trim() ? b.voucher.trim() : null,
        uangDiterima,
        catatan: typeof b.catatan === "string" ? b.catatan.trim() : null,
      },
      kasir,
    );
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("VOUCHER_INVALID:")) {
      const message = error.message.slice("VOUCHER_INVALID:".length);
      return fail(422, "INVALID_VOUCHER", message);
    }
    console.error("[pesanan/create] error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
