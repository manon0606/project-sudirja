import "server-only";

import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2/promise";
import {
  SYNC_ENTITIES,
  SYNC_SCHEMA_VERSION,
  type SyncEntity,
  type SyncMetaDTO,
  type SyncProdukDTO,
  type SyncProdukSatuanDTO,
  type SyncPromoDTO,
  type SyncPullResponse,
  type SyncPushInput,
  type SyncPushItemResult,
  type SyncPushKreditPembayaran,
  type SyncPushPesanan,
  type SyncPushResponse,
  type SyncPushRetur,
  type SyncStokDTO,
} from "@/lib/sync-types";
import {
  addKreditPembayaranTx,
  createPesananTx,
  createReturTx,
  getPesananByNo,
} from "@/lib/pesanan-service";
import { catatApproval } from "@/lib/pos-service";

/** Batas baris per entitas per pull — cegah satu respons membengkak tanpa batas. */
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;

function iso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

/** Ambil `id` dari hasil service apa pun bentuknya (DTO selalu punya `id`). */
function idDari(x: unknown): number | null {
  const id = (x as { id?: unknown } | null)?.id;
  return typeof id === "number" ? id : null;
}

export async function getSyncMeta(): Promise<SyncMetaDTO> {
  return {
    serverTime: new Date().toISOString(),
    entities: [...SYNC_ENTITIES],
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
}

interface ProdukRow extends RowDataPacket {
  id: number; sku: string; nama: string; deskripsi: string | null; gambar_url: string | null;
  kategori_id: number; merk_id: number; status: "active" | "inactive"; updated_at: Date | string;
}
interface ProdukSatuanRow extends RowDataPacket {
  id: number; produk_id: number; satuan_id: number; kode_item: string; harga: string; updated_at: Date | string;
}
interface StokRow extends RowDataPacket {
  id: number; produk_satuan_id: number; qty: number; buffer_stok: number; batas_bawah: number | null;
  updated_at: Date | string;
}
interface PromoRow extends RowDataPacket {
  id: number; kode: string; nama: string; tipe: string; deskripsi: string | null;
  nilai_diskon: string; minimal_belanja: string; maksimal_diskon: string | null;
  tanggal_mulai: Date | string; tanggal_berakhir: Date | string;
  batas_kuota: number; jumlah_digunakan: number; is_active: number; updated_at: Date | string;
}

/**
 * Delta pull: baris dengan `updated_at >= since` (inklusif, supaya update dalam
 * detik yang sama tidak lolos). `since` kosong = tarik seluruh data (bootstrap).
 *
 * `next` = waktu server saat query MULAI. Simpan sebagai `since` berikutnya —
 * perubahan sesudahnya pasti ikut pull berikutnya.
 */
export async function pullDelta(since: string | null, limit = DEFAULT_LIMIT): Promise<SyncPullResponse> {
  const batas = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const next = new Date().toISOString();
  const sejak = since ? new Date(since) : null;
  if (since && Number.isNaN(sejak!.getTime())) {
    throw new Error("Parameter `since` bukan waktu ISO-8601 yang valid.");
  }
  const where = sejak ? "WHERE updated_at >= ?" : "";
  const params: unknown[] = sejak ? [sejak, batas] : [batas];

  const [p, ps, s, pr] = await Promise.all([
    query<ProdukRow[]>(
      `SELECT id, sku, nama, deskripsi, gambar_url, kategori_id, merk_id, status, updated_at
       FROM produk ${where} ORDER BY updated_at ASC LIMIT ?`,
      params,
    ),
    query<ProdukSatuanRow[]>(
      `SELECT id, produk_id, satuan_id, kode_item, harga, updated_at
       FROM produk_satuan ${where} ORDER BY updated_at ASC LIMIT ?`,
      params,
    ),
    query<StokRow[]>(
      `SELECT id, produk_satuan_id, qty, buffer_stok, batas_bawah, updated_at
       FROM stok ${where} ORDER BY updated_at ASC LIMIT ?`,
      params,
    ),
    query<PromoRow[]>(
      `SELECT id, kode, nama, tipe, deskripsi, nilai_diskon, minimal_belanja, maksimal_diskon,
              tanggal_mulai, tanggal_berakhir, batas_kuota, jumlah_digunakan, is_active, updated_at
       FROM promo ${where} ORDER BY updated_at ASC LIMIT ?`,
      params,
    ),
  ]);

  const produk: SyncProdukDTO[] = p.rows.map((r) => ({
    id: r.id, sku: r.sku, nama: r.nama, deskripsi: r.deskripsi, gambarUrl: r.gambar_url,
    kategoriId: r.kategori_id, merkId: r.merk_id, status: r.status, updatedAt: iso(r.updated_at),
  }));
  const produkSatuan: SyncProdukSatuanDTO[] = ps.rows.map((r) => ({
    id: r.id, produkId: r.produk_id, satuanId: r.satuan_id, kodeItem: r.kode_item,
    harga: r.harga, updatedAt: iso(r.updated_at),
  }));
  const stok: SyncStokDTO[] = s.rows.map((r) => ({
    id: r.id, produkSatuanId: r.produk_satuan_id, qty: r.qty, bufferStok: r.buffer_stok,
    batasBawah: r.batas_bawah, updatedAt: iso(r.updated_at),
  }));
  const promo: SyncPromoDTO[] = pr.rows.map((r) => ({
    id: r.id, kode: r.kode, nama: r.nama, tipe: r.tipe, deskripsi: r.deskripsi,
    nilaiDiskon: r.nilai_diskon, minimalBelanja: r.minimal_belanja, maksimalDiskon: r.maksimal_diskon,
    tanggalMulai: iso(r.tanggal_mulai), tanggalBerakhir: iso(r.tanggal_berakhir),
    batasKuota: r.batas_kuota, jumlahDigunakan: r.jumlah_digunakan,
    isActive: r.is_active === 1, updatedAt: iso(r.updated_at),
  }));

  const counts: Record<SyncEntity, number> = {
    produk: produk.length,
    produkSatuan: produkSatuan.length,
    stok: stok.length,
    promo: promo.length,
  };
  const truncated = (Object.keys(counts) as SyncEntity[]).filter((k) => counts[k] >= batas);

  return { next, since, counts, truncated, produk, produkSatuan, stok, promo };
}

function gagal(key: string, e: unknown): SyncPushItemResult {
  return {
    key,
    status: "failed",
    duplicate: false,
    id: null,
    message: e instanceof Error ? e.message : String(e),
  };
}

/**
 * Push batch transaksi + persetujuan dari satu perangkat.
 *
 * Tiap item diproses independen — satu item gagal tidak membatalkan sisanya,
 * dan tiap idempotensi key (`noPesanan` / `noRetur` / `clientRef`) yang sudah
 * tercatat dilaporkan `duplicate: true` tanpa menulis ulang.
 */
export async function pushBatch(input: SyncPushInput): Promise<SyncPushResponse> {
  const serverTime = new Date().toISOString();
  const hasilPesanan: SyncPushItemResult[] = [];
  const hasilRetur: SyncPushItemResult[] = [];
  const hasilKredit: SyncPushItemResult[] = [];
  const hasilApproval: SyncPushItemResult[] = [];

  for (const p of (input.pesanan ?? []) as SyncPushPesanan[]) {
    const key = (p.noPesanan ?? "").trim();
    if (!key) {
      hasilPesanan.push({ key: "", status: "failed", duplicate: false, id: null, message: "noPesanan wajib diisi." });
      continue;
    }
    try {
      const ada = await getPesananByNo(key);
      if (ada) {
        hasilPesanan.push({ key, status: "ok", duplicate: true, id: ada.id, message: null });
        continue;
      }
      const dibuat = await createPesananTx(p, {
        nama: (p.kasirNama ?? "").trim(),
        username: (p.kasirUsername ?? "").trim(),
      });
      if (!dibuat) throw new Error("Transaksi gagal dicatat.");
      hasilPesanan.push({ key, status: "ok", duplicate: false, id: idDari(dibuat), message: null });
    } catch (e) {
      hasilPesanan.push(gagal(key, e));
    }
  }

  for (const r of (input.retur ?? []) as SyncPushRetur[]) {
    const key = (r.noRetur ?? "").trim();
    const induk = (r.noPesanan ?? "").trim();
    if (!key || !induk) {
      hasilRetur.push({ key, status: "failed", duplicate: false, id: null, message: "noPesanan & noRetur wajib diisi." });
      continue;
    }
    try {
      const hasil = await createReturTx(induk, r);
      if (!hasil) throw new Error(`Pesanan ${induk} tidak ditemukan.`);
      hasilRetur.push({
        key,
        status: "ok",
        duplicate: !hasil.created,
        id: idDari(hasil.retur),
        message: null,
      });
    } catch (e) {
      hasilRetur.push(gagal(key, e));
    }
  }

  for (const k of (input.kreditPembayaran ?? []) as SyncPushKreditPembayaran[]) {
    const key = (k.clientRef ?? "").trim();
    const induk = (k.noPesanan ?? "").trim();
    if (!key || !induk) {
      hasilKredit.push({ key, status: "failed", duplicate: false, id: null, message: "noPesanan & clientRef wajib diisi." });
      continue;
    }
    try {
      const dicatatOleh =
        String((k as { dicatatOleh?: unknown }).dicatatOleh ?? "").trim() || "pos";
      const hasil = await addKreditPembayaranTx(induk, k, dicatatOleh);
      if (!hasil) throw new Error(`Pesanan ${induk} tidak ditemukan atau bukan kredit.`);
      // addKreditPembayaranTx sudah idempoten pada client_ref — tidak ada tulis ganda.
      hasilKredit.push({ key, status: "ok", duplicate: false, id: idDari(hasil), message: null });
    } catch (e) {
      hasilKredit.push(gagal(key, e));
    }
  }

  for (const a of input.approval ?? []) {
    const key = (a.clientRef ?? "").trim();
    if (!key || !(a.aksi ?? "").trim() || !(a.username ?? "").trim()) {
      hasilApproval.push({ key, status: "failed", duplicate: false, id: null, message: "username, aksi, dan clientRef wajib diisi." });
      continue;
    }
    try {
      const logId = await catatApproval({
        aksi: a.aksi,
        refNo: a.refNo ?? null,
        catatan: a.catatan ?? null,
        dimintaOleh: a.dimintaOleh ?? null,
        disetujuiOleh: a.username,
        disetujuiNama: a.fullName ?? a.username,
        clientRef: key,
        metode: "pin_offline",
      });
      hasilApproval.push({ key, status: "ok", duplicate: false, id: logId, message: null });
    } catch (e) {
      hasilApproval.push(gagal(key, e));
    }
  }

  return {
    serverTime,
    pesanan: hasilPesanan,
    retur: hasilRetur,
    kreditPembayaran: hasilKredit,
    approval: hasilApproval,
  };
}
