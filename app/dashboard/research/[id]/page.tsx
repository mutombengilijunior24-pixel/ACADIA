"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { useResearch } from "@/contexts/ResearchContext";
import PageContainer from "@/components/layout/PageContainer";
import ProjectDirectorCard from "@/components/directors/ProjectDirectorCard";
import DataActions from "@/components/research/DataActions";
import { trackClientEvent } from "@/lib/client/trackEvent";
import { collectHref, fieldLabel, interpretHref } from "@/lib/core/research/workflow";

// ------------------------------------------------------------
// PAGE D'UN PROJET — recentrée sur les deux besoins réels des étudiants
// en sciences économiques et de gestion : récolter leurs données et les
// interpréter. Les anciennes sections (méthodologie, questionnaire
// intégré, jeu de données, analyses, rédaction, export) ne sont plus
// affichées ici ; elles restent dans l'historique Git.
// `params` est lu avec useParams() (Client Component, Next.js 15+).
// ------------------------------------------------------------

export default function ResearchProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { researches } = useResearch();
  const research = researches.find((item) => item.id === id);

  useEffect(() => {
    if (id) trackClientEvent("PROJECT_OPENED", { projectId: id });
  }, [id]);

  if (!research) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Projet introuvable</h1>
          <p className="mt-3 text-slate-500">Cette recherche n&apos;existe pas ou n&apos;est plus disponible.</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="bg-acadia-gradient mt-6 rounded-xl px-6 py-3 font-semibold text-white hover:brightness-110"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-8">
        <div>
          <Link href="/dashboard/research" className="mb-5 inline-block text-sm font-semibold text-slate-500 hover:text-blue-600">
            ← Mes recherches
          </Link>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Projet de recherche</p>
          <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">{research.title}</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard label="Domaine" value={fieldLabel(research) || "—"} />
          <InfoCard label="Niveau" value={research.level || "—"} />
          <InfoCard label="Université" value={research.university || "—"} />
        </div>

        <ProjectDirectorCard research={research} />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-acadia-navy">Mes données</h2>
            <p className="mt-1 text-sm text-slate-500">Où en êtes-vous ? Récoltez vos données avec un questionnaire d&apos;enquête, ou interprétez celles que vous avez déjà.</p>
          </div>
          <DataActions collect={{ href: collectHref(research) }} interpret={{ href: interpretHref(research) }} />
          <p className="text-sm text-slate-500">
            Vos interprétations déjà commencées sont dans{" "}
            <Link href="/dashboard/interpretations" className="font-semibold text-acadia-blue hover:underline">
              Mes interprétations
            </Link>{" "}
            ; vos questionnaires dans{" "}
            <Link href="/dashboard/survey" className="font-semibold text-acadia-blue hover:underline">
              Survey
            </Link>
            .
          </p>
        </section>
      </div>
    </PageContainer>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 truncate font-semibold text-acadia-navy" title={value}>
        {value}
      </p>
    </div>
  );
}
