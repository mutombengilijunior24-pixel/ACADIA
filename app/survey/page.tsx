"use client";

// ============================================================
// ACADIA SURVEY — Page publique de présentation
//
// Point d'entrée public du module Survey, accessible depuis la
// navigation principale ("Enquêtes"). Réutilise le Navbar/Footer de
// la landing pour une identité visuelle unique — jamais une seconde
// application. Le CTA s'adapte à l'état de connexion réel de
// l'utilisateur (jamais un dashboard vide affiché avant identification).
// ============================================================

import Link from "next/link";
import { ArrowRight, ClipboardList, FileEdit, LineChart, Send, Sparkles, Users2 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/footer/Footer";
import { useAuth } from "@/contexts/AuthContext";

const WORKFLOW = [
  { icon: FileEdit, label: "Créer" },
  { icon: Send, label: "Publier" },
  { icon: Users2, label: "Collecter" },
  { icon: LineChart, label: "Analyser" },
  { icon: Sparkles, label: "Interpréter" },
];

export default function SurveyLandingPage() {
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  const primaryHref = isAuthed ? "/dashboard/survey" : "/register?next=/dashboard/survey";
  const secondaryHref = isAuthed ? "/dashboard/survey" : "/login?next=/dashboard/survey";
  const secondaryLabel = isAuthed ? "Aller à mon tableau de bord" : "Se connecter";

  return (
    <>
      <Navbar />

      <section className="bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-acadia-blue-50 px-4 py-2 text-xs font-semibold text-acadia-blue sm:text-sm">
            <ClipboardList className="h-4 w-4" /> ACADIA Survey
          </span>

          <h1 className="mx-auto mt-8 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-acadia-navy sm:text-5xl">
            Créez et pilotez vos enquêtes avec ACADIA.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-xl sm:leading-9">
            Du questionnaire à la diffusion, de la collecte à la lecture méthodologique — un espace de pilotage
            institutionnel pour vos enquêtes.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 font-semibold text-white transition hover:brightness-110 sm:w-auto"
              style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
            >
              Créer une enquête
              <ArrowRight size={18} />
            </Link>
            <Link
              href={secondaryHref}
              className="w-full rounded-xl border border-slate-300 bg-white px-8 py-4 text-center font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-acadia-blue sm:text-sm">Le parcours</p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5 sm:gap-6">
            {WORKFLOW.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-acadia-blue-50 text-acadia-blue">
                  <step.icon className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-bold text-acadia-navy">
                  {i + 1}. {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
