"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import CopyPublicLinkButton from "./CopyPublicLinkButton";
import type { SportType } from "@/lib/sport";

const SPORT_LABELS: Record<SportType, string> = {
  football: "Fotbal",
  basketball: "Baschet",
};

const SPORT_ICONS: Record<SportType, string> = {
  football: "⚽",
  basketball: "🏀",
};

export default function AdminSidebar({ sport, userEmail }: { sport: SportType; userEmail?: string }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [pending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/admin",                   label: "Dashboard",        icon: "📊" },
    { href: "/admin/echipe",            label: "Echipe",           icon: "🛡️" },
    { href: "/admin/jucatori",          label: "Jucători",         icon: "👤" },
    { href: "/admin/tragere-la-sorti",  label: "Tragere la Sorți", icon: "🎲" },
    { href: "/admin/clasament",         label: "Clasament",        icon: "🏆" },
    { href: "/admin/meciuri",           label: "Programare",       icon: "📅" },
    { href: "/admin/program",           label: "Program & Scorul", icon: SPORT_ICONS[sport] },
    { href: "/admin/faze-eliminatorii", label: "Faze Eliminatorii",icon: "🔥" },
  ];

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    });
  }

  const renderNav = (closeMobile?: () => void) => (
    <nav className="flex-1 py-2 px-3 space-y-1">
      <div className="px-3 pt-1 pb-2">
        <span className="text-green-500 text-xs font-bold uppercase tracking-widest">Management</span>
      </div>
      {navItems.map(({ href, label, icon }) => {
        const isActive = href === "/admin"
          ? pathname === "/admin"
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            onClick={closeMobile}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
              ${isActive
                ? "bg-green-600 text-white shadow-lg shadow-green-900/30"
                : "text-green-300 hover:bg-green-800/60 hover:text-white"
              }
            `}
          >
            <span className="text-base w-5 text-center">{icon}</span>
            {label}
            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-300" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-green-900 text-white sticky top-0 z-40 border-b border-green-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center font-black text-sm shadow">P</div>
          <div>
            <div className="font-bold text-sm leading-none">PoliSport</div>
            <div className="text-green-400 text-[10px] mt-0.5">{SPORT_ICONS[sport]} {SPORT_LABELS[sport]}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userEmail && <span className="text-green-300 text-xs hidden sm:inline">{userEmail}</span>}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg bg-green-800 text-green-200 hover:text-white focus:outline-none"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex">
          <div className="w-72 bg-green-900 text-white h-full flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-green-800">
              <div className="font-black text-lg">Meniu Admin</div>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-green-300 hover:bg-green-800"
              >
                ✕
              </button>
            </div>

            {/* Sport Indicator */}
            <div className="px-3 pt-4 pb-2">
              <div className="flex items-center justify-between bg-green-800/50 rounded-xl px-3 py-2.5 border border-green-700/40">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{SPORT_ICONS[sport]}</span>
                  <span className="text-sm font-bold text-white">{SPORT_LABELS[sport]}</span>
                </div>
                <Link
                  href="/select-sport"
                  onClick={() => setMobileOpen(false)}
                  className="text-xs text-green-400 hover:text-white font-semibold transition-colors"
                >
                  Schimbă
                </Link>
              </div>
            </div>

            {renderNav(() => setMobileOpen(false))}

            <div className="p-3 border-t border-green-800 space-y-3 mt-auto">
              <CopyPublicLinkButton sport={sport} />
              <button
                onClick={handleSignOut}
                disabled={pending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600/20 border border-red-500/40 hover:bg-red-600 transition-all disabled:opacity-50"
              >
                <span>🚪</span>
                {pending ? "Se deconectează..." : "Deconectare"}
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-green-900 min-h-screen text-white shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-green-700/60">
          <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center font-black text-white text-lg shadow">
            P
          </div>
          <div>
            <div className="font-black text-white text-base leading-none">PoliSport</div>
            <div className="text-green-400 text-xs font-medium mt-0.5">Admin Panel</div>
          </div>
        </div>

        {/* Sport Indicator */}
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center justify-between bg-green-800/50 rounded-xl px-3 py-2.5 border border-green-700/40">
            <div className="flex items-center gap-2">
              <span className="text-lg">{SPORT_ICONS[sport]}</span>
              <span className="text-sm font-bold text-white">{SPORT_LABELS[sport]}</span>
            </div>
            <Link
              href="/select-sport"
              className="text-xs text-green-400 hover:text-white font-semibold transition-colors"
            >
              Schimbă
            </Link>
          </div>
        </div>

        {renderNav()}

        {/* Bottom section */}
        <div className="p-3 border-t border-green-700/60 space-y-3">
          <CopyPublicLinkButton sport={sport} />
          
          <button
            id="admin-signout-btn"
            onClick={handleSignOut}
            disabled={pending}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600/20 border border-red-500/40 hover:bg-red-600 hover:border-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🚪</span>
            {pending ? "Se deconectează..." : "Deconectare"}
          </button>
        </div>
      </aside>
    </>
  );
}
