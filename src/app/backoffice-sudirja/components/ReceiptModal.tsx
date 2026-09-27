"use client";
import { Printer, CheckCircle } from "lucide-react";
import Modal from "./Modal";

interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  discountLabel?: string;
  total: number;
  paymentMethod: string;
  kreditPeriod?: string;
  cashPaid?: number;
  transactionId?: string;
  cashierName?: string;
  storeName?: string;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  items,
  subtotal,
  discountAmount,
  discountLabel,
  total,
  paymentMethod,
  kreditPeriod,
  cashPaid,
  transactionId,
  cashierName,
  storeName = "Supermarket Segar",
}: ReceiptModalProps) {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const change = cashPaid != null ? cashPaid - total : null;

  const paymentLabel =
    paymentMethod === "cash" || paymentMethod === "Tunai"
      ? "Tunai"
      : paymentMethod === "qris" || paymentMethod === "QRIS"
      ? "QRIS"
      : paymentMethod === "transfer" || paymentMethod === "Bank Transfer"
      ? "Transfer Bank"
      : paymentMethod === "kredit" || paymentMethod === "Kredit"
      ? `Kredit${kreditPeriod ? ` — ${kreditPeriod}` : ""}`
      : paymentMethod;

  return (
    <Modal onClose={onClose} className="bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden flex flex-col max-w-[480px] max-h-[90vh]">
        {/* Header strip */}
        <div className="px-6 pt-6 pb-5 text-center" style={{ backgroundColor: "#27b446" }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <CheckCircle className="w-6 h-6 text-white" />
            <span className="text-white" style={{ fontSize: "18px", fontWeight: 600 }}>
              Transaksi Berhasil
            </span>
          </div>
          <p className="text-white" style={{ opacity: 0.85, fontSize: "13px" }}>
            {storeName}
          </p>
        </div>

        {/* Nota body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Transaction meta */}
          <div
            className="flex justify-between items-start mb-4 pb-4"
            style={{ borderBottom: "1px dashed #d1d5db" }}
          >
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#1a0408", opacity: 0.5 }}>
                No. Transaksi
              </p>
              <p style={{ color: "#000000", fontSize: "13px", fontWeight: 600 }}>
                {transactionId || `TRX-${now.getTime().toString().slice(-8)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "#1a0408", opacity: 0.5 }}>
                {dateStr}
              </p>
              <p className="text-xs" style={{ color: "#1a0408", opacity: 0.5 }}>
                {timeStr}
              </p>
              {cashierName && (
                <p className="text-xs mt-0.5" style={{ color: "#1a0408", opacity: 0.5 }}>
                  Kasir: {cashierName}
                </p>
              )}
            </div>
          </div>

          {/* Items list */}
          <div className="mb-4" style={{ borderBottom: "1px dashed #d1d5db", paddingBottom: "16px" }}>
            <p className="text-xs mb-3" style={{ color: "#1a0408", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Daftar Belanja
            </p>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p
                      className="truncate"
                      style={{ color: "#1a0408", fontSize: "14px" }}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#1a0408", opacity: 0.5 }}>
                      {item.quantity} × Rp {item.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <p
                    className="flex-shrink-0"
                    style={{ color: "#000000", fontSize: "14px", fontWeight: 500 }}
                  >
                    Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 mb-4" style={{ borderBottom: "1px dashed #d1d5db", paddingBottom: "16px" }}>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#1a0408", opacity: 0.7 }}>
                Subtotal ({items.length} produk)
              </span>
              <span className="text-sm" style={{ color: "#1a0408" }}>
                Rp {subtotal.toLocaleString("id-ID")}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "#1a0408", opacity: 0.7 }}>
                  {discountLabel || "Diskon"}
                </span>
                <span className="text-sm" style={{ color: "#e40b18" }}>
                  − Rp {discountAmount.toLocaleString("id-ID")}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2" style={{ borderTop: "1px solid #e5e7eb" }}>
              <span style={{ color: "#000000", fontWeight: 600 }}>Total</span>
              <span style={{ color: "#27b446", fontSize: "20px", fontWeight: 700 }}>
                Rp {total.toLocaleString("id-ID")}
              </span>
            </div>
          </div>

          {/* Payment info */}
          <div className="space-y-2 mb-1">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#1a0408", opacity: 0.7 }}>
                Metode Pembayaran
              </span>
              <span className="text-sm" style={{ color: "#000000", fontWeight: 500 }}>
                {paymentLabel}
              </span>
            </div>

            {cashPaid != null && cashPaid > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: "#1a0408", opacity: 0.7 }}>
                  Uang Diterima
                </span>
                <span className="text-sm" style={{ color: "#1a0408" }}>
                  Rp {cashPaid.toLocaleString("id-ID")}
                </span>
              </div>
            )}

            {change != null && change > 0 && (
              <div
                className="flex justify-between items-center px-4 py-3 rounded-lg mt-2"
                style={{ backgroundColor: "rgba(39,180,70,0.08)", border: "1px solid rgba(39,180,70,0.2)" }}
              >
                <span style={{ color: "#1a0408", fontWeight: 500 }}>Kembalian</span>
                <span style={{ color: "#27b446", fontSize: "18px", fontWeight: 700 }}>
                  Rp {change.toLocaleString("id-ID")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid #e5e7eb" }}>
          <button
            onClick={() => alert("Mencetak nota...")}
            className="flex-1 py-3 rounded-lg text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#27b446" }}
          >
            <Printer className="w-4 h-4" />
            Cetak Nota
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: "#e40b18", color: "#e40b18" }}
          >
            Selesai
          </button>
        </div>
    </Modal>
  );
}
