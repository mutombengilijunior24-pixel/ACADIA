"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "@/components/shared/Logo";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "#workflow", label: "Fonctionnement" },
  { href: "#features", label: "Analyses" },
  { href: "#pour-qui", label: "Pour les étudiants" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  // Déjà connecté : "Enquêtes" ouvre directement le tableau de bord
  // Survey plutôt que la page publique de présentation.
  const surveyHref = user ? "/dashboard/survey" : "/survey";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo variant="mark" className="h-11 w-11" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ACADIA</h1>
            <p className="text-xs text-slate-500">Academic Intelligence for Economics &amp; Management</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 whitespace-nowrap xl:flex 2xl:gap-10">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="font-medium text-slate-600 transition hover:text-acadia-blue">
              {link.label}
            </a>
          ))}
          <Link href={surveyHref} className="font-medium text-slate-600 transition hover:text-acadia-blue">
            Enquêtes
          </Link>
          <Link href="/stages" className="relative mr-2 font-semibold text-violet-700 transition hover:text-violet-900">
            Stages
            <span className="absolute -right-2.5 -top-1 flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500" />
            </span>
            <span className="sr-only"> (nouveau)</span>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden whitespace-nowrap font-medium text-slate-700 transition hover:text-acadia-blue md:block">
            Se connecter
          </Link>

          <Link
            href="/register"
            className="bg-acadia-gradient hidden rounded-xl px-6 py-3 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:block"
          >
            Commencer
          </Link>

          <button
            type="button"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 xl:hidden"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 xl:hidden">
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
            <Link
              href={surveyHref}
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50 hover:text-acadia-blue"
            >
              Enquêtes
            </Link>
            <Link
              href="/stages"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-violet-700 transition hover:bg-violet-50"
            >
              Stages
              <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">Nouveau</span>
            </Link>
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2.5 text-center font-semibold text-slate-700">
              Se connecter
            </Link>
            <Link
              href="/register"
              className="bg-acadia-gradient rounded-xl px-4 py-2.5 text-center font-semibold text-white"
            >
              Commencer ma recherche
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
