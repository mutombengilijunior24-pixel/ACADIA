"use client";

// ============================================================
// ACADIA SURVEY — Accueil "Bienvenue sur ACADIA Survey"
//
// Module additif indépendant de Research. Toujours le même parcours,
// qu'il existe ou non déjà des enquêtes : bienvenue + trois actions
// principales, puis "Mes enquêtes" (liste réelle ou état vide élégant
// — jamais un chiffre inventé).
// ============================================================

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, ArrowRight, FileUp, Sparkles } from "lucide-react";
import type { SurveyListItem } from "@/lib/core/survey/SurveyTypes";
import SurveyOnboardingModal from "@/components/dashboard/SurveyOnboardingModal";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: "BROUILLON", className: "bg-slate-100 text-slate-600" },
  active: { label: "ACTIVE", className: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "SUSPENDUE", className: "bg-amber-100 text-amber-700" },
  closed: { label: "CLÔTURÉE", className: "bg-slate-200 text-slate-600" },
};

function SurveyHome() {
  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/survey", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSurveys(data.surveys ?? []);
      } catch {
        setError("Impossible de charger vos enquêtes pour le moment.");
        setSurveys([]);
      }
    })();
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue sm:text-sm">ACADIA Survey</p>
        <h1 className="mt-2 text-2xl font-bold text-acadia-navy sm:text-3xl">Bienvenue sur ACADIA Survey</h1>

        <p className="mt-8 text-sm font-bold text-slate-600 sm:text-base">Que souhaitez-vous faire ?</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link
            href="/dashboard/survey/new"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-acadia-navy">Créer une enquête</span>
          </Link>
          <Link
            href="/dashboard/survey/new?mode=import"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
              <FileUp className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-acadia-navy">Importer un questionnaire</span>
          </Link>
          <Link
            href="/dashboard/survey/new?mode=guided"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-sm font-bold text-acadia-navy">Travailler avec ACADIA</span>
          </Link>
        </div>

        <div className="mt-12 flex items-center justify-between">
          <h2 className="text-lg font-bold text-acadia-navy">Mes enquêtes</h2>
          {surveys && surveys.length > 0 && (
            <Link href="/dashboard/survey/new" className="text-sm font-semibold text-acadia-blue hover:underline">
              Nouvelle enquête
            </Link>
          )}
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        {surveys === null ? (
          <p className="mt-4 text-sm text-slate-400">Chargement...</p>
        ) : surveys.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-acadia-blue-50 text-acadia-blue">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="mt-4 font-bold text-acadia-navy">Vous n&apos;avez encore aucune enquête.</p>
            <p className="mt-1 text-sm text-slate-500">Votre première enquête peut être créée en quelques étapes.</p>
            <Link
              href="/dashboard/survey/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark"
            >
              <Plus className="h-4 w-4" /> Créer ma première enquête
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {surveys.map((s) => {
              const status = STATUS_LABEL[s.status] ?? STATUS_LABEL.draft;
              const percent = s.targetResponses ? Math.round((s.responseCount / s.targetResponses) * 1000) / 10 : null;
              return (
                <div key={s.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className={`inline-flex rounded-full px-3 py-1 text-2xs font-bold tracking-wide ${status.className}`}>{status.label}</span>
                  <h3 className="mt-4 text-lg font-bold text-acadia-navy">{s.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">Créée le {new Date(s.createdAt).toLocaleDateString("fr-FR")}</p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-acadia-navy">{s.responseCount}</span>
                    <span className="text-xs text-slate-500">réponse{s.responseCount > 1 ? "s" : ""}</span>
                  </div>
                  {s.targetResponses ? (
                    <>
                      <p className="mt-1 text-2xs text-slate-400">Objectif : {s.targetResponses}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-acadia-blue" style={{ width: `${Math.min(100, percent ?? 0)}%` }} />
                      </div>
                      <p className="mt-1 text-2xs font-semibold text-acadia-blue">{percent}%</p>
                    </>
                  ) : null}

                  <Link
                    href={`/dashboard/survey/${s.id}`}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue"
                  >
                    Ouvrir <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SurveyOnboardingModal />
    </div>
  );
}

export default function SurveyHomePage() {
  return (
    <Suspense>
      <SurveyHome />
    </Suspense>
  );
}
