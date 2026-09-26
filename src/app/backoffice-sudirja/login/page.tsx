"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminProfile } from "@/lib/auth-types";

function LogoMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#27b446] shadow-[0_8px_20px_rgba(39,180,70,0.18)]" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
        <path d="M27 9C27 8.5 26.5 7.5 25 7C23 6.5 20 6 18 6C14.5 6 11.5 7 9.5 8C8 8.8 7.5 9.5 7.5 10C7.5 11 9 12 12 12.5C13 12.7 14.5 13 16 13C18 13 20 12.5 22 12C24 11.5 26 10.5 27 9Z" fill="white" />
        <path d="M9 17C7 17 6 18 6 19.5C6 21 7.5 22.5 10 23C12 23.5 14.5 24 17 24C19.5 24 22.5 23.5 24.5 22.5C26.5 21.5 28 20 28 18.5C28 17 26.5 16 24 16C22.5 16 20 16.5 18 17C15.5 17.5 11.5 17 9 17Z" fill="white" />
        <path d="M25.5 26C27.5 25.5 29 24.5 29 23C29 22 27.5 21 25 21C23 21 20 21.5 17.5 22C15 22.5 12 23 10 23C8 23 6.5 23.5 6 24.5C5.5 25.5 6 27 7.5 28C9 29 11.5 29.5 14.5 29.5C17.5 29.5 20.5 29 22.5 28C24 27.5 25 27 25.5 26Z" fill="white" />
      </svg>
    </div>
  );
}

export default function BackofficeLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/backoffice-sudirja/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.ok && payload && typeof payload === "object" && "data" in payload) {
        const { admin } = payload.data as { admin: AdminProfile };
        // Non-sensitive profile mirror for existing UI consumers (useUser).
        // The real auth is the httpOnly session cookie set by the API.
        localStorage.setItem(
          "sudirja-user",
          JSON.stringify({
            username: admin.username,
            fullName: admin.fullName,
            role: admin.role,
            roleLabel: admin.roleLabel,
            permissions: admin.permissions,
            isSuperadmin: admin.isSuperadmin,
            adminId: admin.id,
          }),
        );
        router.push("/backoffice-sudirja/dashboard");
        return;
      }

      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error
      ) {
        setError(String(payload.error.message));
      } else {
        setError("Tidak dapat menghubungi server. Coba lagi.");
      }
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fcfaff] px-4 py-10 text-[#1a0408]">
      <div className="absolute left-0 top-0 h-64 w-64 -translate-x-1/3 -translate-y-1/3 rounded-full bg-[#27b446]/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/3 translate-y-1/3 rounded-full bg-[#27b446]/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-2xl border border-[#e6e1e5] bg-white p-8 shadow-[0_24px_70px_rgba(26,4,8,0.08)] sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark />
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[#15090b]">Sudirja</h1>
          <p className="mt-2 text-sm text-[#1a0408]/60">Portal manajemen toko</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium">Username</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" autoComplete="username" className="h-12 w-full rounded-xl border border-[#d9d3d7] bg-white px-4 text-sm outline-none transition placeholder:text-[#1a0408]/35 focus:border-[#27b446] focus:ring-4 focus:ring-[#27b446]/10" required />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" autoComplete="current-password" className="h-12 w-full rounded-xl border border-[#d9d3d7] bg-white px-4 text-sm outline-none transition placeholder:text-[#1a0408]/35 focus:border-[#27b446] focus:ring-4 focus:ring-[#27b446]/10" required />
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-[#27b446] text-sm font-semibold text-white transition hover:bg-[#219b3c] focus:outline-none focus:ring-4 focus:ring-[#27b446]/20 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Memproses…" : "Masuk ke Dashboard"}</button>
        </form>
        <p className="mt-7 text-center text-xs text-[#1a0408]/45">Akses khusus untuk tim manajemen Sudirja</p>
      </section>
    </main>
  );
}
