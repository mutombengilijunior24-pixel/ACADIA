"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList } from "lucide-react";
import HeroPathsPreview from "./HeroPathsPreview";

// ============================================================
// ACCUEIL — recentré sur les deux besoins réels des étudiants en
// sciences économiques et de gestion : RÉCOLTER leurs données
// d'enquête et les INTERPRÉTER. Plus d'analyse de sujet par l'IA ici
// (elle consommait des crédits sans servir ces deux besoins).
// Les deux chemins passent par « Nouvelle recherche » (sujet, domaine,
// université, directeur), qui se termine par le choix du chemin.
// ============================================================

const START = "/register?next=/dashboard/research/new";

const PATHS = [
  {
    icon: ClipboardList,
    title: "Récolter mes données",
    text: "Créez votre questionnaire d'enquête avec ACADIA, ou importez celui que vous avez déjà rédigé, puis recevez les réponses.",
    accent: "from-acadia-blue to-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Interpréter mes données",
    text: "Importez votre fichier (Excel, CSV) : ACADIA vous guide jusqu'aux résultats et à leur interprétation, selon votre spécialité.",
    accent: "from-emerald-600 to-teal-600",
  },
];

export default function Hero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <section className="relative overflow-hidden bg-slate-50">
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-40 motion-safe:animate-[pulse_8s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, #93A7EE 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full opacity-30 motion-safe:animate-[pulse_10s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, #6EE7B7 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className={`transition-all duration-700 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
            <span className="inline-flex items-center gap-2 rounded-full bg-acadia-blue-50 px-5 py-2 text-sm font-semibold text-acadia-blue">
              Academic Intelligence for Economics &amp; Management
            </span>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-acadia-navy lg:text-6xl">
              Vos données de mémoire.
              <br />
              <span className="text-acadia-blue">Récoltées, puis interprétées.</span>
            </h1>

            <p className="mt-8 max-w-xl text-xl leading-9 text-slate-600">
              ACADIA accompagne les étudiants en sciences économiques et de gestion là où le mémoire se joue : la récolte des données et
              leur interprétation.
            </p>

            <div className="mt-10 grid max-w-xl gap-3">
              {PATHS.map(({ icon: Icon, title, text, accent }) => (
                <Link
                  key={title}
                  href={START}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-acadia-blue hover:shadow-lg"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-md`}>
                    <Icon size={22} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-lg font-bold text-acadia-navy">
                      {title}
                      <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-slate-600">{text}</span>
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-8 space-y-3 text-slate-600">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Gratuit pour commencer, sans carte bancaire
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Le canevas de votre directeur, quand il l&apos;a défini
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Le chercheur reste décisionnaire à chaque étape
              </p>
            </div>
          </div>

          <div className={`transition-all delay-150 duration-700 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
            <HeroPathsPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
