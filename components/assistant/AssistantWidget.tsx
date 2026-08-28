"use client";

import Link from "next/link";
import { Bot, Sparkles, ArrowRight } from "lucide-react";

/**
 * P14 — l'ancien widget affichait un chat non fonctionnel qui
 * prétendait pouvoir « analyser vos données SPSS » (capacité
 * inexistante, déjà retirée du marketing en P13) et « préparer la
 * soutenance » par simple message — aucune de ces actions n'était
 * réellement câblée. Remplacé par un état honnête : la génération
 * réelle passe par l'assistant de structuration (Wizard), pas par
 * un chat libre qui n'existe pas encore.
 */
export default function AssistantWidget() {
  return (
    <section className="mt-16">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-8 text-white">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/15 backdrop-blur">
            <Bot className="h-9 w-9" />
          </div>

          <div>
            <p className="flex items-center gap-2 text-blue-100">
              <Sparkles className="h-4 w-4" />
              Assistant de structuration
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Un assistant conversationnel libre n&apos;existe pas encore</h2>
            <p className="mt-3 max-w-2xl text-blue-100">
              Aujourd&apos;hui, ACADIA vous accompagne étape par étape via l&apos;assistant de structuration
              (problématique, objectifs, variables, hypothèses, questionnaire, méthodologie) — pas via un
              chat libre.
            </p>
            <Link
              href="/dashboard/research/new"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition hover:scale-105"
            >
              Démarrer une recherche
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
