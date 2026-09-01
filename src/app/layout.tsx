import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sudirja Backoffice",
  description: "Portal manajemen toko Sudirja",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      {/* Browser extensions may inject attributes into body before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
