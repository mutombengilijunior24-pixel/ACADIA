"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";

// P13 — liste corrigée pour ne décrire que des capacités réellement
// construites (l'ancienne liste annonçait "questionnaires IA illimités"
// et "préparation à la soutenance", inexistants).
const features = [
  "Analyse statistique déterministe",
  "Instrument de collecte adapté",
  "Bibliographie structurée",
  "Interprétation & discussion prudentes",
  "Export DOCX & PDF",
  "Production scientifique complète",
];

export default function PremiumCard() {
  return (
    <section
      id="pricing"
      className="
      relative
      overflow-hidden
      rounded-[42px]
      border
      border-blue-200/60
      bg-gradient-to-br
      from-blue-600
      via-indigo-700
      to-slate-950
      p-12
      shadow-2xl
    "
    >
      {/* Halo */}
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative z-10">

        {/* Badge */}

        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 backdrop-blur">
          <Sparkles className="h-4 w-4 text-yellow-300" />

          <span className="text-sm font-semibold text-white">
            Continuez votre recherche
          </span>
        </div>

        {/* Titre */}

        <h2 className="mt-8 max-w-3xl text-5xl font-black leading-tight text-white">
          Votre recherche mérite
          <br />
          une expérience complète.
        </h2>

        {/* Texte */}

        <p className="mt-6 max-w-2xl text-xl leading-9 text-blue-100">
          Débloquez uniquement les fonctionnalités dont vous avez
          besoin, au moment où votre recherche progresse.
          Aucune formule compliquée.
          Aucun abonnement obligatoire.
        </p>

        {/* Fonctionnalités */}

        <div className="mt-12 grid gap-5 md:grid-cols-2">

          {features.map((feature) => (

            <div
              key={feature}
              className="
                flex
                items-center
                gap-4
                rounded-2xl
                border
                border-white/10
                bg-white/10
                px-5
                py-4
                backdrop-blur
                transition-all
                duration-300
                hover:bg-white/15
              "
            >
              <Lock className="h-5 w-5 text-yellow-300" />

              <span className="text-white">
                {feature}
              </span>

            </div>

          ))}

        </div>

        {/* CTA */}

        <div className="mt-14 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <p className="text-lg font-semibold text-white">
              Commencez gratuitement.
            </p>

            <p className="mt-2 text-blue-100">
              Débloquez uniquement l'étape suivante lorsque
              vous êtes prêt.
            </p>

          </div>

          <Link
            href="/register"
            className="
              group
              inline-flex
              items-center
              gap-3
              rounded-2xl
              bg-white
              px-8
              py-5
              text-lg
              font-bold
              text-slate-900
              transition-all
              duration-300
              hover:scale-105
            "
          >
            Continuer ma recherche

            <ArrowRight className="transition group-hover:translate-x-2" />
          </Link>

        </div>

        {/* Garantie */}

        <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/5 p-5">

          <CheckCircle2 className="h-6 w-6 text-emerald-400" />

          <p className="text-blue-100">
            Vous gardez toujours le contrôle.
            Débloquez uniquement ce qui apporte de la valeur à votre mémoire.
          </p>

        </div>

      </div>
    </section>
  );
}