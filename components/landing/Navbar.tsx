"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "@/components/shared/Logo";

const NAV_LINKS = [
  { href: "#workflow", label: "Fonctionnement" },
  { href: "#features", label: "Analyses" },
  { href: "#pour-qui", label: "Pour les étudiants" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo variant="mark" className="h-11 w-11" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ACADIA</h1>
            <p className="text-xs text-slate-500">Academic Intelligence for Economics &amp; Management</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="font-medium text-slate-600 transition hover:text-acadia-blue">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden font-medium text-slate-700 transition hover:text-acadia-blue md:block">
            Se connecter
          </Link>

          <Link
            href="/register"
            className="hidden rounded-xl px-6 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:block"
            style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
          >
            Commencer
          </Link>

          <button
            type="button"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 lg:hidden"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-acadia-blue"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2.5 text-center font-semibold text-slate-700">
              Se connecter
            </Link>
            <Link
              href="/register"
              className="rounded-xl px-4 py-2.5 text-center font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
            >
              Commencer ma recherche
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
