"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, Menu, Search, UserCircle2, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SaveIndicator from "@/components/dashboard/SaveIndicator";

export default function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 h-[72px] border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
            className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-slate-100 lg:hidden"
          >
            <Menu size={24} />
          </button>

          <div className="relative hidden w-[200px] md:block lg:w-[420px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un projet, un mémoire..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 outline-none transition-all duration-200 focus:border-acadia-blue focus:bg-white focus:shadow-lg"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 lg:gap-5">
          <SaveIndicator />

          <button type="button" className="relative flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-slate-100">
            <Bell size={21} />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
          </button>

          <div className="relative">
            <button type="button" onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-100">
              <UserCircle2 size={42} className="text-acadia-blue" />
              <div className="hidden max-w-[160px] text-left md:block">
                <p className="truncate font-semibold text-slate-900">{user?.firstName ?? "..."}</p>
                <p className="truncate text-xs text-slate-500">{user?.email ?? ""}</p>
              </div>
              <ChevronDown size={18} className="hidden text-slate-500 md:block" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <Link href="/dashboard/settings" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Settings size={16} /> Paramètres
                  </Link>
                  <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                    <LogOut size={16} /> Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
