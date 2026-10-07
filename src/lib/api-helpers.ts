import "server-only";

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { AuthErrorCode } from "@/lib/auth-types";
import type { ProductErrorCode } from "@/lib/product-types";
import type { StokErrorCode } from "@/lib/stok-types";
import type { PromoErrorCode } from "@/lib/promo-types";
import type { PesananErrorCode } from "@/lib/pesanan-types";
import type { UserErrorCode } from "@/lib/user-types";
import type { KomisiErrorCode } from "@/lib/komisi-types";
import type { SettingsErrorCode } from "@/lib/settings-types";
import type { OngkirErrorCode } from "@/lib/ongkir-types";
import type { PelangganErrorCode } from "@/lib/pelanggan-types";
import type { SupplierErrorCode } from "@/lib/supplier-types";
import type { KonsinyasiErrorCode } from "@/lib/konsinyasi-types";
import type { PembelianErrorCode } from "@/lib/pembelian-types";
import type { LaporanErrorCode } from "@/lib/laporan-types";
import type { DashboardErrorCode } from "@/lib/dashboard-types";
import type { PosErrorCode } from "@/lib/pos-types";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";
import { verifyPosApiKey } from "@/lib/settings-service";
import { verifyDeviceToken } from "@/lib/device-service";

/** Cek header `X-API-Key`: key global lama (`sk_pos_…`) atau token perangkat (`dev_…`). */
async function posKeySah(request: Request): Promise<boolean> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return false;
  if ((await verifyPosApiKey(apiKey)).valid) return true;
  return verifyDeviceToken(apiKey);
}

export type ApiErrorCode = AuthErrorCode | ProductErrorCode | StokErrorCode | PromoErrorCode | PesananErrorCode | UserErrorCode | KomisiErrorCode | SettingsErrorCode | OngkirErrorCode | PelangganErrorCode | SupplierErrorCode | KonsinyasiErrorCode | PembelianErrorCode | LaporanErrorCode | DashboardErrorCode | PosErrorCode;

/** Success envelope: { ok: true, data }. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true as const, data }, init);
}

/** Single consistent error envelope: { ok: false, error: { code, message, details? } }. */
export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse<{ ok: false; error: { code: ApiErrorCode; message: string; details?: unknown } }> {
  return NextResponse.json(
    { ok: false as const, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

/** Resolve the authenticated admin for a route handler, or null. */
export async function requireAdmin(): Promise<CurrentAdmin | null> {
  try {
    return await getCurrentAdmin();
  } catch {
    // Database unreachable or session lookup failed — treat as unauthenticated
    // at this layer; the handler logs and maps real failures to 500.
    return null;
  }
}

/** Siapa pemanggil route: admin backoffice (cookie) atau aplikasi POS (API key). */
export type Requester =
  | { kind: "admin"; admin: CurrentAdmin }
  | { kind: "pos" };

/**
 * Guard ganda untuk route yang dipakai backoffice DAN aplikasi POS.
 * Cookie admin berlaku apa adanya; selain itu coba API key POS dari header
 * `X-API-Key` (sah hanya saat mode online di Settings aktif).
 */
export async function requireAdminOrPosKey(request: Request): Promise<Requester | null> {
  try {
    const admin = await getCurrentAdmin();
    if (admin) return { kind: "admin", admin };
    return (await posKeySah(request)) ? { kind: "pos" } : null;
  } catch {
    // Sama dengan requireAdmin: DB bermasalah → anggap belum terautentikasi.
    return null;
  }
}

/**
 * True bila pemanggil adalah aplikasi POS dengan API key sah (header `X-API-Key`).
 * Dipakai sebagai cadangan pada route yang guard-nya `requireAdmin()`, supaya
 * nilai `admin` yang dipakai handler tidak berubah bentuk.
 */
export async function isPosRequest(): Promise<boolean> {
  try {
    return posKeySah({ headers: await headers() } as Request);
  } catch {
    return false;
  }
}
