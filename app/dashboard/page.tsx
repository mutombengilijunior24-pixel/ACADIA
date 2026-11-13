"use client";

import { Suspense } from "react";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";

import OnboardingModal from "@/components/dashboard/OnboardingModal";
import RoleFocusWidget from "@/components/dashboard/RoleFocusWidget";
import DataActions from "@/components/research/DataActions";
import { useAuth } from "@/contexts/AuthContext";
import { useResearch } from "@/contexts/ResearchContext";
import { collectHref, fieldLabel, interpretHref } from "@/lib/core/research/workflow";

// ------------------------------------------------------------
// TABLEAU DE BORD — recentré sur ce qui fait la force d'ACADIA pour les
// étudiants en sciences économiques et de gestion : récolter leurs
// données et les interpréter. Les autres blocs (statistiques, assistant,
// calendrier, objectifs, crédits…) ne sont plus affichés ici.
// ------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth();
  const { researches } = useResearch();
  const works = researches
    .filter((r) => r.status !== "archived")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <Suspense fallback={null}>
        <OnboardingModal />
      </Suspense>

      <section className="flex flex-col gap-5 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-acadia-blue">Tableau de bord</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Bonjour {user?.firstName ?? ""} 👋</h1>
          <p className="mt-2 max-w-2xl text-base text-slate-500">
            {works.length > 0 ? "Récoltez vos données ou interprétez-les : reprenez là où vous en êtes." : "Indiquez votre sujet et votre directeur, puis récoltez ou interprétez vos données."}
          </p>
        </div>
        <Link
          href="/dashboard/research/new"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold text-white transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
        >
          <Plus className="h-5 w-5" /> Nouvelle recherche
        </Link>
      </section>

      <RoleFocusWidget />

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-acadia-navy">Que voulez-vous faire ?</h2>
        <DataActions collect={{ href: collectHref(works[0]) }} interpret={{ href: interpretHref(works[0]) }} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold text-acadia-navy">Mes travaux</h2>
          {researches.length > works.length ? (
            <Link href="/dashboard/research" className="text-sm font-semibold text-acadia-blue hover:underline">
              Voir toutes mes recherches
            </Link>
          ) : null}
        </div>

        {works.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <FolderKanban className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">Aucun travail pour l&apos;instant</p>
            <p className="mt-1 text-sm text-slate-500">Cliquez sur « Nouvelle recherche » : sujet, domaine, directeur, et c&apos;est parti.</p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {works.map((r) => (
              <li key={r.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <Link href={`/dashboard/research/${r.id}`} className="block font-bold text-acadia-navy hover:text-acadia-blue">
                  {r.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  {[fieldLabel(r), r.directorName?.trim() ? `Directeur : ${r.directorName.trim()}` : null].filter(Boolean).join(" · ") || "Domaine et directeur à préciser"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                  <Link href={collectHref(r)} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:border-acadia-blue hover:text-acadia-blue">
                    Récolter mes données
                  </Link>
                  <Link href={interpretHref(r)} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-700 hover:border-emerald-600 hover:text-emerald-700">
                    Interpréter mes données
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
