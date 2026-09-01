import "server-only";

import { NextResponse } from "next/server";
import type { AuthErrorCode } from "@/lib/auth-types";
import type { ProductErrorCode } from "@/lib/product-types";
import type { StokErrorCode } from "@/lib/stok-types";
import type { PromoErrorCode } from "@/lib/promo-types";
import type { PesananErrorCode } from "@/lib/pesanan-types";
import type { UserErrorCode } from "@/lib/user-types";
import type { KomisiErrorCode } from "@/lib/komisi-types";
import { getCurrentAdmin, type CurrentAdmin } from "@/lib/auth";

export type ApiErrorCode = AuthErrorCode | ProductErrorCode | StokErrorCode | PromoErrorCode | PesananErrorCode | UserErrorCode | KomisiErrorCode;

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
