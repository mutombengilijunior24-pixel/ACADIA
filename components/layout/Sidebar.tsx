"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  LayoutDashboard,
  FileSearch,
  Settings,
  LogOut,
  UserCircle2,
  X,
  GraduationCap,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Mes recherches", href: "/dashboard/research", icon: FileSearch },
  { title: "Paramètres", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const items =
    user?.role === "supervisor"
      ? [...menuItems, { title: "Espace directeur", href: "/dashboard/supervisor", icon: GraduationCap }]
      : menuItems;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const content = (
    <>
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-6">
          <div className="flex items-center gap-3">
            <Logo variant="mark" className="h-9 w-9" />
            <div>
              <h2
                className="text-lg font-bold tracking-tight"
                style={{ background: "linear-gradient(135deg, #2554EB, #0B1B3A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                ACADIA
              </h2>
              <p className="mt-0.5 text-xs leading-none text-slate-400">Academic Intelligence</p>
            </div>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Fermer le menu" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive ? "bg-acadia-blue text-white shadow-sm shadow-acadia-blue/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="mb-1 flex items-center gap-3 px-2 py-2">
          <UserCircle2 size={34} className="shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-800">{user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "..."}</h3>
            <p className="truncate text-xs text-slate-400">{user?.email ?? ""}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50"
        >
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden min-h-screen w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">{content}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-acadia-navy/40" onClick={onClose} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}
