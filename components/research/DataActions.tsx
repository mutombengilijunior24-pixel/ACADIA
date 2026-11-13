"use client";

// ============================================================
// ACADIA — LES DEUX CHEMINS : RÉCOLTER OU INTERPRÉTER MES DONNÉES
//
// Utilisé à la fin de « Nouvelle recherche », sur la page d'un projet et
// sur le tableau de bord. Chaque carte est soit un lien, soit une action
// (l'assistant crée d'abord le projet, puis ouvre le chemin choisi).
// ============================================================

import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, Loader2 } from "lucide-react";

type Target = { href: string } | { onClick: () => void };

const CARDS = {
  collect: {
    icon: ClipboardList,
    title: "Récolter mes données",
    text: "Créez votre questionnaire d'enquête avec ACADIA, ou importez celui que vous avez déjà (document Word, PDF, texte rédigé avec ChatGPT…), puis diffusez-le et recevez les réponses.",
    accent: "from-acadia-blue to-indigo-600",
  },
  interpret: {
    icon: BarChart3,
    title: "Interpréter mes données",
    text: "Vos données sont déjà récoltées : importez votre fichier (Excel, CSV) et ACADIA vous guide jusqu'aux résultats et à leur interprétation, selon votre spécialité.",
    accent: "from-emerald-600 to-teal-600",
  },
} as const;

function Card({ kind, target, busy }: { kind: keyof typeof CARDS; target: Target; busy?: boolean }) {
  const c = CARDS[kind];
  const Icon = c.icon;
  const body = (
    <>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-md`}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-lg font-bold text-acadia-navy">
          {c.title}
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-slate-600">{c.text}</span>
      </span>
    </>
  );
  const className =
    "group flex w-full items-start gap-4 rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-acadia-blue hover:shadow-lg disabled:cursor-wait disabled:opacity-70 sm:p-6";
  return "href" in target ? (
    <Link href={target.href} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={target.onClick} disabled={busy} className={className}>
      {body}
    </button>
  );
}

export default function DataActions({ collect, interpret, busy = null }: { collect: Target; interpret: Target; busy?: "collect" | "interpret" | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card kind="collect" target={collect} busy={busy === "collect"} />
      <Card kind="interpret" target={interpret} busy={busy === "interpret"} />
    </div>
  );
}
