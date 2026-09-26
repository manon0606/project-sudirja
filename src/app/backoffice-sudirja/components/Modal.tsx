"use client";

import { useEffect } from "react";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Overlay popup standar desain V3.1: blur + darken, tertutup saat klik di luar
 * (overlay) atau tekan Escape. Klik di dalam panel tidak menutup (stopPropagation).
 */
export default function Modal({ onClose, children, className }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.1)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
