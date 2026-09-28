"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Settings from "../components/Settings";
import { useUser } from "../components/useUser";
import { firstAllowedPath } from "../components/AdminSidebar";

export default function SettingsPage() {
  const user = useUser();
  const router = useRouter();

  // Hanya superadmin yang boleh mengakses settings (API key).
  useEffect(() => {
    if (!user.isSuperadmin && user.username) {
      router.replace(firstAllowedPath(user.permissions, user.isSuperadmin));
    }
  }, [user.isSuperadmin, user.username, user.permissions, router]);

  if (!user.isSuperadmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fcfaff] px-4">
        <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl mb-3" style={{ color: '#e40b18' }}>🔒</p>
          <h1 className="text-xl font-semibold" style={{ color: '#000000' }}>Akses Ditolak</h1>
          <p className="mt-2 text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
            Halaman Settings (API key) hanya dapat diakses oleh Super Admin.
          </p>
          <button
            onClick={() => router.push(firstAllowedPath(user.permissions, user.isSuperadmin))}
            className="mt-6 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#27b446' }}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  return <Settings />;
}
