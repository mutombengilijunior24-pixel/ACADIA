"use client";

import { BrainCircuit, ShieldCheck, UserCheck } from "lucide-react";

const POINTS = [
  {
    icon: BrainCircuit,
    title: "Ce qu'ACADIA génère",
    text:
      "Des propositions structurantes (problématique, variables, hypothèses, questionnaire, méthodologie) construites à partir de ce que vous renseignez — jamais à partir du seul titre du sujet.",
  },
  {
    icon: ShieldCheck,
    title: "Ce qu'ACADIA ne fait jamais",
    text:
      "Inventer une population, une théorie, une référence bibliographique, un résultat statistique ou une note de qualité scientifique. Une donnée manquante reste affichée comme « à préciser », jamais remplacée par une valeur plausible.",
  },
  {
    icon: UserCheck,
    title: "Votre rôle de chercheur",
    text:
      "Valider, corriger ou rejeter chaque proposition. Un statut « accepté » sur ACADIA signifie que vous l'avez validé — pas qu'elle est scientifiquement garantie.",
  },
];

export default function UnderstandAcadia() {
  return (
    <section className="mt-14 rounded-[32px] border border-acadia-blue-100 bg-acadia-blue-50/40 p-8">
      <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Comprendre ACADIA</p>
      <h2 className="mt-1 text-2xl font-black text-acadia-navy">Ce que fait réellement l&apos;assistant</h2>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <div key={point.title} className="rounded-2xl bg-white/70 p-5">
              <Icon className="h-6 w-6 text-acadia-blue" />
              <h3 className="mt-3 font-bold text-acadia-navy">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
