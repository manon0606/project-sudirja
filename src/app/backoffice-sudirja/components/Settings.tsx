"use client";
import { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";

export default function Settings() {

  const [isOnline, setIsOnline] = useState(false);
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setIsOnline(settings.isOnline || false);
        setUrl(settings.url || "");
        setApiKey(settings.apiKey || "");
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
  }, []);

  const handleSave = () => {
    // Simpan settings
    const settings = {
      isOnline,
      url: isOnline ? url : "",
      apiKey: isOnline ? apiKey : ""
    };

    localStorage.setItem("appSettings", JSON.stringify(settings));

    // Tampilkan feedback
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

    

  
  return (
    <div className="flex h-screen" style={{ backgroundColor: '#fcfaff' }}>
      <AdminSidebar activePage="settings" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl mb-1" style={{ color: '#000000' }}>Pengaturan</h1>
              <p style={{ color: '#1a0408', opacity: 0.6 }}>
                Kelola konfigurasi sistem
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {/* Settings Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Section Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg" style={{ color: '#000000' }}>Konfigurasi Online</h2>
                <p className="text-sm mt-1" style={{ color: '#1a0408', opacity: 0.6 }}>
                  Atur koneksi sistem dengan server online
                </p>
              </div>

              {/* Settings Form */}
              <div className="p-6 space-y-6">
                {/* Online Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <label className="block mb-1" style={{ color: '#1a0408' }}>
                      Online
                    </label>
                    <p className="text-sm" style={{ color: '#1a0408', opacity: 0.6 }}>
                      Aktifkan untuk menghubungkan sistem dengan server online
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
                    style={{
                      backgroundColor: isOnline ? '#27b446' : 'rgba(26, 4, 8, 0.2)',
                      '--tw-ring-color': '#27b446'
                    } as any}
                  >
                    <span
                      className="inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-md"
                      style={{
                        transform: isOnline ? 'translateX(1.75rem)' : 'translateX(0.25rem)'
                      }}
                    />
                  </button>
                </div>

                {/* Conditional Fields */}
                {isOnline && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    {/* URL Field */}
                    <div>
                      <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                        URL Server
                      </label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://api.example.com"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2"
                        style={{
                          color: '#1a0408',
                          '--tw-ring-color': '#27b446'
                        } as any}
                      />
                      <p className="text-xs mt-1.5" style={{ color: '#1a0408', opacity: 0.5 }}>
                        Masukkan URL lengkap server API
                      </p>
                    </div>

                    {/* Key Field */}
                    <div>
                      <label className="block mb-2 text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Masukkan API key"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 font-mono"
                        style={{
                          color: '#1a0408',
                          '--tw-ring-color': '#27b446'
                        } as any}
                      />
                      <p className="text-xs mt-1.5" style={{ color: '#1a0408', opacity: 0.5 }}>
                        API key untuk autentikasi ke server
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                {/* Success Message */}
                {isSaved && (
                  <div className="flex items-center gap-2" style={{ color: '#27b446' }}>
                    <svg className="w-5 h-5" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Pengaturan berhasil disimpan</span>
                  </div>
                )}
                {!isSaved && <div />}

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  className="px-6 py-3 rounded-lg text-white font-medium transition-opacity hover:opacity-90 shadow-sm"
                  style={{ backgroundColor: '#27b446' }}
                >
                  Simpan Pengaturan
                </button>
              </div>
            </div>

          {/* Info Card */}
          <div className="mt-6 p-4 rounded-lg border-l-4" style={{
            backgroundColor: 'rgba(39, 180, 70, 0.05)',
            borderColor: '#27b446'
          }}>
            <h3 className="text-sm font-medium mb-1" style={{ color: '#27b446' }}>
              Informasi
            </h3>
            <p className="text-sm" style={{ color: '#1a0408', opacity: 0.7 }}>
              Mode online memungkinkan sistem untuk sinkronisasi data dengan server pusat.
              Pastikan URL dan API Key yang dimasukkan valid dan memiliki akses yang sesuai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
