import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  min?: string;
  max?: string;
}

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];
const DAY_LABELS = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplay(s: string): string {
  const d = parseDate(s);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const CAL_W = 288;
const CAL_H = 340;

export default function DatePicker({
  value, onChange, placeholder = "Pilih tanggal", className, style, min, max
}: DatePickerProps) {
  const today = new Date();
  const selected = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());
  const [calPos, setCalPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        calRef.current && !calRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const openPicker = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const top = spaceBelow >= CAL_H || spaceBelow >= spaceAbove
      ? rect.bottom + 6
      : rect.top - CAL_H - 6;
    let left = rect.left;
    if (left + CAL_W > window.innerWidth - 8) left = window.innerWidth - CAL_W - 8;
    if (left < 8) left = 8;
    setCalPos({ top, left });
    const ref = selected ?? today;
    setViewYear(ref.getFullYear());
    setViewMonth(ref.getMonth());
    setOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build 6-row grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: Date[] = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push(new Date(viewYear, viewMonth - 1, daysInPrev - i));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewYear, viewMonth, d));
  }
  while (cells.length < 42) {
    cells.push(new Date(viewYear, viewMonth + 1, cells.length - firstDow - daysInMonth + 1));
  }

  const todayStr = toDateStr(today);
  const selectedStr = value;

  const isDisabled = (d: Date) => {
    const s = toDateStr(d);
    if (min && s < min) return true;
    if (max && s > max) return true;
    return false;
  };

  const selectDate = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(toDateStr(d));
    setOpen(false);
  };

  const calendar = (
    <div
      ref={calRef}
      style={{
        position: "fixed",
        top: calPos.top,
        left: calPos.left,
        width: CAL_W,
        zIndex: 99999,
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Month/Year nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#fafafa"
      }}>
        <button
          onClick={prevMonth}
          style={{ padding: "5px", borderRadius: "7px", border: "none", background: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ fontWeight: 700, fontSize: "13px", color: "#1a0408", letterSpacing: "0.01em" }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{ padding: "5px", borderRadius: "7px", border: "none", background: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "8px 10px 2px" }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, color: "#9ca3af", padding: "3px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "2px 10px 10px", gap: "1px" }}>
        {cells.map((cell, i) => {
          const s = toDateStr(cell);
          const inMonth = cell.getMonth() === viewMonth;
          const isSel = s === selectedStr;
          const isTod = s === todayStr;
          const isDis = isDisabled(cell);
          return (
            <button
              key={i}
              onClick={() => selectDate(cell)}
              disabled={isDis}
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "7px",
                fontSize: "12px",
                border: "none",
                cursor: isDis ? "not-allowed" : "pointer",
                backgroundColor: isSel ? "#27b446" : "transparent",
                color: isDis
                  ? "#e5e7eb"
                  : isSel
                  ? "#ffffff"
                  : !inMonth
                  ? "#d1d5db"
                  : isTod
                  ? "#27b446"
                  : "#1a0408",
                fontWeight: isTod && !isSel ? 700 : 400,
                outline: isTod && !isSel ? "1.5px solid #27b446" : "none",
                outlineOffset: "-1.5px",
                transition: "background-color 0.1s",
              }}
              onMouseEnter={e => { if (!isSel && !isDis) e.currentTarget.style.backgroundColor = "#f0fdf4"; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <div style={{ padding: "0 10px 10px" }}>
        <button
          onClick={() => selectDate(today)}
          disabled={isDisabled(today)}
          style={{
            width: "100%",
            padding: "7px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            border: "1px solid #d1fae5",
            backgroundColor: "#f0fdf4",
            color: "#27b446",
            cursor: isDisabled(today) ? "not-allowed" : "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={e => { if (!isDisabled(today)) e.currentTarget.style.backgroundColor = "#dcfce7"; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f0fdf4"; }}
        >
          Hari Ini
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onClick={openPicker}
        style={{ position: "relative", cursor: "pointer", ...style }}
        className={className}
      >
        <span
          style={{
            display: "block",
            paddingRight: "32px",
            color: value ? "#1a0408" : "#9ca3af",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {value ? formatDisplay(value) : placeholder}
        </span>
        <CalendarDays
          size={15}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#9ca3af",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        />
      </div>
      {open && createPortal(calendar, document.body)}
    </>
  );
}
