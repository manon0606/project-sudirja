"use client";
import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { ApiClientError } from "@/lib/api-client";
import { getSettings, regenerateApiKey, setOnline } from "@/lib/settings-api";
import { CheckCircle, Copy, Eye, EyeOff, KeyRound, RefreshCw, X, AlertTriangle } from "lucide-react";

export default function Settings() {
  const [isOnline, setIsOnline] = useState(false);
  const [apiKeyHint, setApiKeyHint] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // API key yang baru digenerate — tampil sekali sampai halaman ditutup.
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      setIsOnline(s.isOnline);
      setApiKeyHint(s.apiKeyHint);
      setHasApiKey(s.hasApiKey);
      setError("");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal memuat pengaturan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggleOnline = async () => {
    setSaving(true);
    setError("");
    try {
      const s = await setOnline(!isOnline);
      setIsOnline(s.isOnline);
      flashSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal mengubah mode online.");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Generate API key baru? API key lama akan langsung tidak berlaku untuk aplikasi POS.")) return;
    setSaving(true);
    setError("");
    try {
      const result = await regenerateApiKey();
      setNewApiKey(result.apiKey);
      setApiKeyHint(result.hint);
      setHasApiKey(true);
      setShowNewKey(true);
      setCopied(false);
      flashSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Gagal generate API key.");
    } finally {
      setSaving(false);
    }
  };

  const copyKey = async () => {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Gagal menyalin API key.");
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="settings" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div>
            <h1 style={{ color: '#000000' }}>Pengaturan</h1>
            <p className="mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
              Kelola API key aplikasi POS
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="py-16 text-center">
              <p style={{ color: '#1a0408', opacity: 0.6 }}>Memuat pengaturan...</p>
            </div>
          ) : (
            <div className="max-w-3xl">
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg flex items-start gap-2"
                  style={{ backgroundColor: '#fee2e2' }}>
                  <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#991b1b' }} />
                  <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
                </div>
              )}

              {/* API Key Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <KeyRound className="w-5 h-5" style={{ color: '#27b446' }} />
                  <div>
                    <h2 className="text-lg" style={{ color: '#000000' }}>API Key Aplikasi POS</h2>
                    <p className="text-sm mt-0.5" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Key ini dipakai aplikasi POS untuk mengakses seluruh API (menambah pesanan, dll). Tanpa key, POS tidak mendapat akses.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Online Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="block mb-1 font-medium" style={{ color: '#000000' }}>
                        Mode Online
                      </label>
                      <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                        {isOnline
                          ? "Online aktif — aplikasi POS dapat mengakses API dengan API key yang valid."
                          : "Online nonaktif — API key tidak dapat digunakan oleh aplikasi POS."}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleToggleOnline()}
                      disabled={saving}
                      className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                      style={{
                        backgroundColor: isOnline ? '#27b446' : 'rgba(26, 4, 8, 0.2)',
                        '--tw-ring-color': '#27b446'
                      } as any}
                    >
                      <span
                        className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md"
                        style={{ transform: isOnline ? 'translateX(1.75rem)' : 'translateX(0.25rem)' }}
                      />
                    </button>
                  </div>

                  {/* Status API Key */}
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <label className="block text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                          Status API Key
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          {hasApiKey ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                              style={{ backgroundColor: 'rgba(39, 180, 70, 0.1)', color: '#27b446' }}>
                              <CheckCircle className="w-4 h-4" />
                              {isOnline ? "Aktif (online)" : "Tersimpan (offline)"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                              style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
                              <X className="w-4 h-4" />
                              Belum ada API key
                            </span>
                          )}
                        </div>
                      </div>
                      {apiKeyHint && (
                        <div className="text-right">
                          <p className="text-xs" style={{ color: '#1a0408', opacity: 0.5 }}>Key tersimpan</p>
                          <p className="font-mono text-sm" style={{ color: '#1a0408' }}>{apiKeyHint}</p>
                        </div>
                      )}
                    </div>

                    {/* API Key baru — tampil sekali setelah generate */}
                    {newApiKey && (
                      <div className="mt-3 p-4 rounded-lg border-2"
                        style={{ borderColor: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#27b446' }}>
                            <KeyRound className="w-4 h-4" />
                            API Key Baru — salin sekarang (hanya tampil sekali)
                          </p>
                          <button onClick={() => setShowNewKey(!showNewKey)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            style={{ color: '#1a0408' }}>
                            {showNewKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code
                            className="flex-1 px-4 py-3 rounded-lg font-mono text-sm break-all select-all"
                            style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#1a0408' }}
                          >
                            {showNewKey ? newApiKey : "•".repeat(Math.min(24, newApiKey.length))}
                          </code>
                          <button
                            onClick={() => void copyKey()}
                            className="flex items-center gap-2 px-4 py-3 rounded-lg text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: '#27b446' }}
                            title="Salin API key"
                          >
                            <Copy className="w-4 h-4" />
                            {copied ? "Tersalin" : "Salin"}
                          </button>
                        </div>
                        <p className="text-xs mt-2" style={{ color: '#1a0408', opacity: 0.6 }}>
                          Simpan di tempat aman. Key tidak akan ditampilkan lagi setelah halaman ditutup.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  {saved ? (
                    <div className="flex items-center gap-2" style={{ color: '#27b446' }}>
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Pengaturan berhasil disimpan</span>
                    </div>
                  ) : <div />}

                  <button
                    onClick={() => void handleRegenerate()}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg border-2 transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ borderColor: '#27b446', color: '#27b446', backgroundColor: 'rgba(39, 180, 70, 0.05)' }}
                  >
                    <RefreshCw className="w-5 h-5" />
                    Generate API Key
                  </button>
                </div>
              </div>

              {/* Info Card */}
              <div className="mt-6 p-4 rounded-lg border-l-4" style={{
                backgroundColor: 'rgba(39, 180, 70, 0.05)',
                borderColor: '#27b446'
              }}>
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#27b446' }}>
                  <KeyRound className="w-4 h-4" />
                  Cara kerja
                </h3>
                <ul className="text-sm space-y-1.5" style={{ color: '#1a0408', opacity: 0.7 }}>
                  <li>1. Generate API key lalu salin — key hanya tampil satu kali.</li>
                  <li>2. Aktifkan Mode Online agar key bisa dipakai.</li>
                  <li>3. Aplikasi POS mengirim key pada header <code className="font-mono">X-API-Key</code> di setiap request.</li>
                  <li>4. Tanpa key yang valid (atau saat offline), request POS ditolak 401.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
