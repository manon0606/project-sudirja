/**
 * Kontrak sinkronisasi POS ↔ sudirja-next (Fase 3: delta pull + push batch +
 * token per perangkat).
 *
 * Tiga endpoint:
 *   GET  /api/backoffice-sudirja/sync/meta   → waktu server + entitas yang ada
 *   GET  /api/backoffice-sudirja/sync/pull   → delta `updated_at >= since`
 *   POST /api/backoffice-sudirja/pos/sync/push → batch transaksi + approval
 *
 * Semua endpoint diakses dengan `X-API-Key` (token per perangkat `dev_…` atau
 * API key global lama `sk_pos_…`).
 *
 * Catatan desain:
 * * Delta memakai `updated_at` (semua entitas cache sudah punya kolom ini).
 *   Filter `>= since` (inklusif) supaya update dalam detik yang sama tidak
 *   lolos; baris kembar di sisi POS tidak masalah karena di-upsert per kunci.
 * * `next` = waktu server saat query MULAI. Simpan itu sebagai `since` berikutnya
 *   — perubahan sesudahnya pasti ikut pull berikutnya.
 * * Nilai uang dikirim sebagai string desimal ("10000.00") mengikuti pola
 *   `decimal(12,2)` MySQL.
 *
 * Client-safe: type-only, tanpa server imports.
 */
import type { AddKreditPembayaranInput, CreatePesananInput, CreateReturInput } from "@/lib/pesanan-types";
import type { PosApprovalLogInput } from "@/lib/pos-types";

export type SyncErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

/** Entitas cache yang tersedia lewat delta pull. */
export const SYNC_ENTITIES = ["produk", "produkSatuan", "stok", "promo"] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

/** Versi kontrak payload pull — naikkan bila bentuk field berubah. */
export const SYNC_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// GET /sync/meta
// ---------------------------------------------------------------------------

export interface SyncMetaDTO {
  /** Waktu server (ISO-8601 UTC) saat permintaan diproses. */
  serverTime: string;
  entities: SyncEntity[];
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// GET /sync/pull
// ---------------------------------------------------------------------------

export interface SyncProdukDTO {
  id: number;
  sku: string;
  nama: string;
  deskripsi: string | null;
  gambarUrl: string | null;
  kategoriId: number;
  merkId: number;
  status: "active" | "inactive";
  updatedAt: string;
}

export interface SyncProdukSatuanDTO {
  id: number;
  produkId: number;
  satuanId: number;
  kodeItem: string;
  harga: string;
  updatedAt: string;
}

export interface SyncStokDTO {
  id: number;
  produkSatuanId: number;
  qty: number;
  bufferStok: number;
  batasBawah: number | null;
  updatedAt: string;
}

export interface SyncPromoDTO {
  id: number;
  kode: string;
  nama: string;
  tipe: string;
  deskripsi: string | null;
  nilaiDiskon: string;
  minimalBelanja: string;
  maksimalDiskon: string | null;
  tanggalMulai: string;
  tanggalBerakhir: string;
  batasKuota: number;
  jumlahDigunakan: number;
  isActive: boolean;
  updatedAt: string;
}

export interface SyncPullResponse {
  /** Waktu server saat query mulai — pakai ini sebagai `since` berikutnya. */
  next: string;
  since: string | null;
  counts: Record<SyncEntity, number>;
  /** Entitas yang kena batas `limit` — pull lagi dengan `since` lebih baru. */
  truncated: SyncEntity[];
  produk: SyncProdukDTO[];
  produkSatuan: SyncProdukSatuanDTO[];
  stok: SyncStokDTO[];
  promo: SyncPromoDTO[];
}

// ---------------------------------------------------------------------------
// POST /pos/sync/push
// ---------------------------------------------------------------------------

/** Satu item di batch push. */
export interface SyncPushItemResult {
  /** Kunci dari perangkat (noPesanan / noRetur / clientRef). */
  key: string;
  status: "ok" | "failed";
  /** `true` bila ternyata sudah tercatat sebelumnya (retry offline). */
  duplicate: boolean;
  id: number | null;
  message: string | null;
}

/** Retur dalam batch — perlu `noPesanan` untuk menemukan pesanan induknya. */
export type SyncPushRetur = CreateReturInput & { noPesanan: string };

/** Angsuran kredit dalam batch — perlu `noPesanan` + `clientRef` idempotensi. */
export type SyncPushKreditPembayaran = AddKreditPembayaranInput & { noPesanan: string };

/** Transaksi dalam batch + identitas kasir yang melayani di perangkat itu. */
export type SyncPushPesanan = CreatePesananInput & {
  kasirNama?: string | null;
  kasirUsername?: string | null;
};

export interface SyncPushInput {
  /** Id perangkat pengirim (FR-02), opsional. */
  deviceId?: string | null;
  pesanan?: SyncPushPesanan[] | null;
  retur?: SyncPushRetur[] | null;
  kreditPembayaran?: SyncPushKreditPembayaran[] | null;
  approval?: PosApprovalLogInput[] | null;
}

export interface SyncPushResponse {
  serverTime: string;
  pesanan: SyncPushItemResult[];
  retur: SyncPushItemResult[];
  kreditPembayaran: SyncPushItemResult[];
  approval: SyncPushItemResult[];
}

// ---------------------------------------------------------------------------
// Perangkat POS (token per device_id)
// ---------------------------------------------------------------------------

export interface PosDeviceDTO {
  id: number;
  deviceId: string;
  nama: string;
  /** 4 karakter pertama token — untuk mengenali tanpa menampilkan token. */
  tokenHint: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface PosDeviceRegisteredDTO {
  device: PosDeviceDTO;
  /** Token plaintext — hanya dikembalikan SEKALI saat registrasi. */
  token: string;
}

// ---------------------------------------------------------------------------
// Endpoint map (implementasi kontrak ini)
// ---------------------------------------------------------------------------

// GET  /api/backoffice-sudirja/sync/meta          → 200 { ok, data: SyncMetaDTO }
// GET  /api/backoffice-sudirja/sync/pull?since=…  → 200 { ok, data: SyncPullResponse }
// POST /api/backoffice-sudirja/pos/sync/push      → 200 { ok, data: SyncPushResponse }
// POST /api/backoffice-sudirja/pos/device/register → 201 { ok, data: PosDeviceRegisteredDTO }  (admin)
// POST /api/backoffice-sudirja/pos/device/revoke   → 200 { ok, data: { device } }              (admin)
// GET  /api/backoffice-sudirja/pos/device          → 200 { ok, data: { devices } }             (admin)
