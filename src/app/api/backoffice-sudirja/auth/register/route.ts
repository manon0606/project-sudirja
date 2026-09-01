import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-helpers";
import {
  validateRegister,
  findAdminByUsername,
  findAdminByEmail,
  hashPassword,
  createAdmin,
  toProfile,
} from "@/lib/auth";

function isUniqueViolation(error: unknown): error is { code: "ER_DUP_ENTRY"; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "VALIDATION_ERROR", "Body request bukan JSON yang valid.");
  }

  const parsed = validateRegister(body);
  if (!parsed.ok || !parsed.data) {
    return fail(422, "VALIDATION_ERROR", "Data registrasi tidak valid.", parsed.details);
  }
  const input = parsed.data;

  try {
    // Friendly pre-checks; the DB unique constraints remain the real guard.
    const [byUsername, byEmail] = await Promise.all([
      findAdminByUsername(input.username),
      findAdminByEmail(input.email),
    ]);
    if (byUsername) {
      return fail(409, "USERNAME_TAKEN", "Username sudah digunakan.");
    }
    if (byEmail) {
      return fail(409, "EMAIL_TAKEN", "Email sudah terdaftar.");
    }

    const admin = await createAdmin({
      username: input.username,
      email: input.email,
      passwordHash: hashPassword(input.password),
      fullName: input.fullName,
    });
    return ok({ admin: toProfile(admin) }, { status: 201 });
  } catch (error) {
    // Race guard: two concurrent registers hit the unique key.
    if (isUniqueViolation(error)) {
      if (error.message.includes("uq_admins_username")) {
        return fail(409, "USERNAME_TAKEN", "Username sudah digunakan.");
      }
      if (error.message.includes("uq_admins_email")) {
        return fail(409, "EMAIL_TAKEN", "Email sudah terdaftar.");
      }
    }
    console.error("[auth/register] unexpected error:", error);
    return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan server. Coba lagi nanti.");
  }
}
