"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./useUser";

type SidebarPage =
  | "dashboard" | "pesanan" | "daftar-pesanan" | "pesanan-kredit" | "pengembalian"
  | "produk" | "daftar-produk" | "kelola-satuan" | "kelola-merk" | "kelola-kategori"
  | "stok" | "promo" | "user" | "pembelian" | "konsinyasi" | "laporan"
  | "pelanggan" | "commerce" | "pemetaan" | "settings";

type MenuItem = {
  id: SidebarPage;
  label: string;
  icon: IconName;
  path?: string;
  children?: { id: SidebarPage; label: string; icon: IconName; path: string }[];
};
type IconName = "dashboard" | "shopping-cart" | "package" | "warehouse" | "tag" | "users" | "bag" | "handshake" | "file" | "users-round" | "store" | "map" | "settings" | "user-circle" | "logout" | "chevron-down" | "chevron-left" | "chevron-right" | "credit-card" | "rotate" | "award";

const BASE = "/backoffice-sudirja";

const menu: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", path: `${BASE}/dashboard` },
  { id: "pesanan", label: "Pesanan", icon: "shopping-cart", path: `${BASE}/pesanan`, children: [{ id: "daftar-pesanan", label: "Daftar Pesanan", icon: "shopping-cart", path: `${BASE}/pesanan` }, { id: "pesanan-kredit", label: "Kredit", icon: "credit-card" as IconName, path: `${BASE}/pesanan-kredit` }, { id: "pengembalian", label: "Pengembalian", icon: "rotate" as IconName, path: `${BASE}/pengembalian` }] },
  { id: "produk", label: "Produk", icon: "package", path: `${BASE}/produk`, children: [{ id: "daftar-produk", label: "Daftar Produk", icon: "package", path: `${BASE}/produk` }, { id: "kelola-satuan", label: "Kelola Satuan", icon: "package", path: `${BASE}/kelola-satuan` }, { id: "kelola-merk", label: "Kelola Merk", icon: "award" as IconName, path: `${BASE}/kelola-merk` }, { id: "kelola-kategori", label: "Kelola Kategori", icon: "tag", path: `${BASE}/kelola-kategori` }] },
  { id: "stok", label: "Stok", icon: "warehouse", path: `${BASE}/stok` },
  { id: "promo", label: "Promo", icon: "tag", path: `${BASE}/promo` },
  { id: "user", label: "User", icon: "users", path: `${BASE}/user` },
  { id: "pembelian", label: "Pembelian", icon: "bag", path: `${BASE}/pembelian` },
  { id: "konsinyasi", label: "Konsinyasi", icon: "handshake", path: `${BASE}/konsinyasi` },
  { id: "laporan", label: "Laporan", icon: "file", path: `${BASE}/laporan` },
  { id: "pelanggan", label: "Pelanggan", icon: "users-round", path: `${BASE}/pelanggan` },
  { id: "commerce", label: "Commerce", icon: "store", path: `${BASE}/commerce` },
  { id: "pemetaan", label: "Pemetaan & Ongkir", icon: "map", path: `${BASE}/pemetaan` },
  { id: "settings", label: "Settings", icon: "settings", path: `${BASE}/settings` },
];

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Partial<Record<IconName, React.ReactNode>> = {
    dashboard: <><rect {...common} x="3" y="3" width="7" height="7" rx="1" /><rect {...common} x="14" y="3" width="7" height="7" rx="1" /><rect {...common} x="3" y="14" width="7" height="7" rx="1" /><rect {...common} x="14" y="14" width="7" height="7" rx="1" /></>,
    "shopping-cart": <><circle {...common} cx="9" cy="20" r="1" /><circle {...common} cx="19" cy="20" r="1" /><path {...common} d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" /></>,
    package: <><path {...common} d="m21 8-9 5-9-5 9-5 9 5Z" /><path {...common} d="M3 8v10l9 5 9-5V8M12 13v10" /></>,
    warehouse: <><path {...common} d="M3 21V9l9-5 9 5v12M3 21h18M7 21v-7h10v7M7 10h.01M12 10h.01M17 10h.01" /></>,
    tag: <><path {...common} d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3.4 13.4V4h9.4l7.8 7.8a2 2 0 0 1 0 1.6Z" /><circle {...common} cx="8" cy="8" r="1" /></>,
    users: <><path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    bag: <><path {...common} d="M5 8h14l1 13H4L5 8ZM9 8V6a3 3 0 0 1 6 0v2" /></>,
    handshake: <><path {...common} d="m3 12 4-4 4 1 2-2 4 1 4 4-3 3-3-2-3 3-3-2-3 2-3-3Z" /><path {...common} d="m7 8 3 3M14 7l-3 4M18 8l-3 3" /></>,
    file: <><path {...common} d="M6 3h9l4 4v14H6V3Z" /><path {...common} d="M14 3v5h5M9 13h6M9 17h6" /></>,
    "users-round": <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    store: <><path {...common} d="M4 10v11h16V10M3 10l2-6h14l2 6M3 10a3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5 0" /></>,
    map: <><path {...common} d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15" /></>,
    settings: <><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.6V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.6h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.6h-.1a1.7 1.7 0 0 0-1.6 1Z" /></>,
    "user-circle": <><circle {...common} cx="12" cy="12" r="9" /><circle {...common} cx="12" cy="9" r="3" /><path {...common} d="M6.5 19a6 6 0 0 1 11 0" /></>,
    logout: <><path {...common} d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5" /></>,
    "credit-card": <><rect {...common} x="3" y="5" width="18" height="14" rx="2" /><path {...common} d="M3 10h18M7 15h3" /></>,
    rotate: <><path {...common} d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6" /><path {...common} d="M12 8v4l3 2" /></>,
    award: <><circle {...common} cx="12" cy="8" r="4" /><path {...common} d="M9 12v9l3-2 3 2v-9" /></>,
    "chevron-down": <path {...common} d="m6 9 6 6 6-6" />,
    "chevron-left": <path {...common} d="m15 18-6-6 6-6" />,
    "chevron-right": <path {...common} d="m9 18 6-6-6-6" />,
  };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>;
}

export default function AdminSidebar({ activePage = "dashboard" }: { activePage?: SidebarPage }) {
  const router = useRouter();
  const currentUser = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<SidebarPage>(activePage);
  const [expanded, setExpanded] = useState<string[]>(["pesanan", "produk"]);

  /** ACL: superadmin selalu akses semua; selain itu hanya fitur yang ada di permissions role-nya. */
  function hasAccess(item: MenuItem): boolean {
    if (currentUser.isSuperadmin) return true;
    const perms = currentUser.permissions ?? [];
    if (item.children) {
      return item.children.some((c) => perms.includes(c.id));
    }
    return perms.includes(item.id);
  }

  const visibleMenu = menu.filter(hasAccess);

  function logout() {
    localStorage.removeItem("sudirja-user");
    router.push("/backoffice-sudirja/login");
  }

  function selectItem(item: MenuItem) {
    if (item.children) {
      setExpanded((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]);
    }
    setActive(item.id);
    if (item.path) router.push(item.path);
  }

  function selectChild(child: { id: SidebarPage; label: string; icon: IconName; path: string }) {
    setActive(child.id);
    router.push(child.path);
  }

  return <aside className={`${collapsed ? "w-20" : "w-64"} flex h-screen shrink-0 flex-col overflow-hidden border-r border-[#e5e2e3] bg-white transition-[width] duration-200`}>
    <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e5e2e3] px-4">
      {!collapsed && <div className="flex items-center gap-3"><LogoMark /><span className="text-lg font-semibold text-[#000]">Sudirja</span></div>}
      {collapsed && <LogoMark />}
      <button type="button" aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"} onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 text-[#1a0408]/65 hover:bg-[#f3f4f6]"><Icon name={collapsed ? "chevron-right" : "chevron-left"} /></button>
    </div>
    <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
      {visibleMenu.map((item) => <div key={item.id}>
        <button type="button" onClick={() => selectItem(item)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${active === item.id ? "bg-[#27b446] text-white" : "text-[#1a0408]/70 hover:bg-[#f3f4f6] hover:text-[#1a0408]"}`}>
          <span className="flex min-w-0 items-center gap-3"><Icon name={item.icon} /><span className={collapsed ? "sr-only" : "min-w-0 truncate"}>{item.label}</span></span>
          {!collapsed && item.children && <Icon name="chevron-down" className={`h-4 w-4 transition ${expanded.includes(item.id) ? "rotate-180" : ""}`} />}
        </button>
        {!collapsed && item.children && expanded.includes(item.id) && <div className="ml-8 mt-1 space-y-1">{item.children.map((child) => <button type="button" key={child.id} onClick={() => selectChild(child)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${active === child.id ? "bg-[#27b446] text-white" : "text-[#1a0408]/60 hover:bg-[#f3f4f6]"}`}><Icon name={child.icon} className="h-4 w-4" />{child.label}</button>)}</div>}
      </div>)}
    </nav>
    <div className={`shrink-0 border-t border-[#e5e2e3] bg-white ${collapsed ? "p-2" : "p-4"}`}>
      <button type="button" onClick={() => { if (currentUser.isSuperadmin || (currentUser.permissions ?? []).includes("user")) router.push(`${BASE}/user`); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[#1a0408]/70 hover:bg-[#f3f4f6] ${collapsed ? "justify-center" : ""}`}><Icon name="user-circle" /><span className={collapsed ? "sr-only" : "text-left"}><span className="block text-sm text-black">{currentUser.fullName || "Administrator"}</span><span className="block text-xs text-[#1a0408]/60">{currentUser.roleLabel || currentUser.role || "admin"}</span></span></button>
      <button type="button" onClick={logout} className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[#e40b18]/90 hover:bg-[#fff1f1] ${collapsed ? "justify-center" : ""}`}><Icon name="logout" />{!collapsed && <span className="text-sm">Keluar</span>}</button>
    </div>
  </aside>;
}

function LogoMark() {
  return <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#27b446]" aria-label="Sudirja"><svg width="25" height="25" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M27 9C27 8.5 26.5 7.5 25 7C23 6.5 20 6 18 6C14.5 6 11.5 7 9.5 8C8 8.8 7.5 9.5 7.5 10C7.5 11 9 12 12 12.5C13 12.7 14.5 13 16 13C18 13 20 12.5 22 12C24 11.5 26 10.5 27 9Z" fill="white"/><path d="M9 17C7 17 6 18 6 19.5C6 21 7.5 22.5 10 23C12 23.5 14.5 24 17 24C19.5 24 22.5 23.5 24.5 22.5C26.5 21.5 28 20 28 18.5C28 17 26.5 16 24 16C22.5 16 20 16.5 18 17C15.5 17.5 11.5 17 9 17Z" fill="white"/><path d="M25.5 26C27.5 25.5 29 24.5 29 23C29 22 27.5 21 25 21C23 21 20 21.5 17.5 22C15 22.5 12 23 10 23C8 23 6.5 23.5 6 24.5C5.5 25.5 6 27 7.5 28C9 29 11.5 29.5 14.5 29.5C17.5 29 20.5 29 22.5 28C24 27.5 25 27 25.5 26Z" fill="white"/></svg></div>;
}
