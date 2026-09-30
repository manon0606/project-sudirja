import { Plus_Jakarta_Sans } from "next/font/google";
import GetStartedButton from "@/components/GetStartedButton";
import ConstructionIllustration from "@/components/ConstructionIllustration";
import "./construction.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata = {
  title: "Website is Under Construction",
  description: "Sudirja sedang dalam pemeliharaan terjadwal. Kami segera kembali.",
};

/**
 * Homepage Under Construction (konversi Next.js dari desain HTML yang diberikan).
 * Backoffice tetap dapat diakses melalui /backoffice-sudirja/login.
 */
export default function Home() {
  return (
    <div
      className={`${plusJakarta.className} min-h-screen bg-slate-50/40 text-slate-800 flex flex-col selection:bg-[#0EA5E9] selection:text-white relative overflow-x-hidden`}
    >
      {/* SiteHeader */}
      <header className="w-full max-w-7xl mx-auto px-6 sm:px-8 py-5 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0EA5E9] to-[#0284C7] flex items-center justify-center text-white shadow-md shadow-sky-500/20 font-black text-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-800">SUDIRJA</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 text-xs font-semibold text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Maintenance Mode
          </div>
          <a className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#0284C7] transition-colors px-3 py-1.5" href="#notify">
            Need Support?
          </a>
        </div>
      </header>

      {/* MainContent */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-center py-6 sm:py-12 relative z-10">
        {/* Cloud Background Shapes */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <svg className="absolute top-12 left-1/4 w-32 h-16 text-sky-100/70" fill="currentColor" viewBox="0 0 100 50">
            <path d="M20,40 Q25,25 40,26 Q50,15 65,22 Q78,16 85,28 Q95,30 92,40 Z" />
          </svg>
          <svg className="absolute top-8 right-1/4 w-44 h-20 text-sky-100/75" fill="currentColor" viewBox="0 0 100 50">
            <path d="M15,40 Q20,20 38,22 Q48,10 65,18 Q80,12 88,25 Q98,28 95,40 Z" />
          </svg>
          <svg className="absolute top-28 right-16 w-28 h-14 text-sky-100/60" fill="currentColor" viewBox="0 0 100 50">
            <path d="M18,38 Q22,22 36,24 Q45,14 60,20 Q75,15 82,26 Q92,29 88,38 Z" />
          </svg>
        </div>

        {/* 2-Column Hero Grid */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* LeftHeroColumn */}
          <section className="lg:col-span-5 flex flex-col items-start text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 text-[#0284C7] text-xs font-bold tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-[#0284C7]" />
              Scheduled Upgrade In Progress
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0EA5E9] tracking-tight uppercase leading-none">
                WEBSITE IS
              </h2>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#9D8DF1] tracking-tight uppercase leading-none">
                UNDER
                <br />
                CONSTRUCTION
              </h1>
            </div>
            {/* Call To Action */}
            <div className="pt-2 w-full sm:w-auto" id="notify">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <GetStartedButton />
              </div>
            </div>
            {/* Estimated Completion Meta */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center gap-6 text-xs text-slate-500">
              <div>
                <span className="font-bold text-slate-700 block text-sm">94.8%</span>
                <span>Deployment progress</span>
              </div>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="font-bold text-slate-700 block text-sm">~ 2 Hours</span>
                <span>Estimated downtime</span>
              </div>
            </div>
          </section>

          {/* RightIllustrationColumn */}
          <section className="lg:col-span-7 flex items-center justify-center relative w-full">
            <ConstructionIllustration />
          </section>
        </div>
      </main>

      {/* SiteFooter */}
      <footer className="w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
        <p>© 2026 SUDIRJA. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a className="hover:text-slate-600 transition-colors" href="#">
            Privacy Policy
          </a>
          <a className="hover:text-slate-600 transition-colors" href="#">
            System Status
          </a>
          <a className="hover:text-slate-600 transition-colors" href="#">
            Contact Administrator
          </a>
        </div>
      </footer>
    </div>
  );
}
