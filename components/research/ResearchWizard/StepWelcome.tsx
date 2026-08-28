"use client";

import { Compass, Target, Users, ClipboardCheck, ShieldCheck } from "lucide-react";
import ResearchBrand from "./brand/ResearchBrand";

export default function StepWelcome() {
  const stepsPreview = [
    {
      icon: Compass,
      title: "Cadrage initial",
      desc: "Sujet, discipline, niveau académique et université.",
    },
    {
      icon: Target,
      title: "Problématique & Objectifs",
      desc: "Question centrale et décomposition en objectifs opérationnels.",
    },
    {
      icon: Users,
      title: "Population & Terrain",
      desc: "Population cible et calcul automatique d'échantillonnage.",
    },
    {
      icon: ClipboardCheck,
      title: "Collecte & Analyse",
      desc: "Choix des techniques de données et orientation méthodologique.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Identité ACADIA */}
      <div className="flex flex-col items-center text-center">
        <ResearchBrand variant="full" className="w-20 sm:w-24" />

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-acadia-blue-100 bg-acadia-blue-50 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-acadia-blue uppercase">
          L&apos;assistant intelligent de la recherche académique
        </span>

        <h1 className="mt-5 max-w-xl text-2xl leading-snug font-extrabold tracking-tight text-acadia-navy sm:text-3xl">
          Construisons ensemble{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #2554EB, #0B1B3A)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            votre projet de recherche
          </span>
        </h1>

        <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500 sm:text-base">
          ACADIA vous guide pas à pas pour structurer une démarche
          scientifique rigoureuse, cohérente et adaptée aux standards
          académiques — vous restez maître de chaque décision.
        </p>
      </div>

      {/* Grille des étapes */}
      <div className="grid gap-3 sm:grid-cols-2">
        {stepsPreview.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="group flex items-start gap-3.5 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 transition-all duration-150 hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-acadia-navy text-acadia-blue-light transition-colors group-hover:bg-acadia-blue">
                <Icon className="h-4.5 w-4.5" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-acadia-navy">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {item.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note de contrôle chercheur */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-xs leading-relaxed text-emerald-800 sm:text-sm">
          <strong className="font-semibold">Contrôle chercheur :</strong> Vos
          informations sont sauvegardées en temps réel et peuvent être
          modifiées à tout moment.
        </p>
      </div>
    </div>
  );
}
