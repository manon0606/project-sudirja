"use client";

/**
 * Tombol "Get Started" halaman Under Construction.
 * Klik → teks berubah "Check back soon!" (hijau) selama 2,4 detik, lalu kembali.
 * (Konversi Next.js dari skrip DOMContentLoaded di desain HTML asli.)
 */
import { useEffect, useRef, useState } from "react";

const BASE_CLASS =
  "inline-flex items-center justify-center px-8 py-3.5 rounded-full text-white text-sm sm:text-base font-bold shadow-lg shadow-sky-400/25 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-sky-200";

export default function GetStartedButton() {
  const [clicked, setClicked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handleClick = () => {
    if (clicked) return;
    setClicked(true);
    timer.current = setTimeout(() => setClicked(false), 2400);
  };

  return (
    <button type="button" onClick={handleClick} className={`${BASE_CLASS} ${clicked ? "bg-emerald-500" : "bg-[#0EA5E9] hover:bg-[#0284C7]"}`}>
      {clicked ? "Check back soon!" : "Get Started"}
    </button>
  );
}
