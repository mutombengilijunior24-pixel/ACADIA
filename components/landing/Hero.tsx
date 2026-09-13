"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import HeroFlowPreview from "./HeroFlowPreview";
import SubjectPreviewOverlay from "./SubjectPreviewOverlay";
import { trackClientEvent } from "@/lib/client/trackEvent";

export default function Hero() {
  const [subject, setSubject] = useState("");
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = subject.trim();
    if (trimmed.length < 8) return;
    trackClientEvent("SUBJECT_SUBMITTED", { metadata: { subjectLength: trimmed.length } });
    setPreviewSubject(trimmed);
  }

  return (
    <section className="relative overflow-hidden bg-slate-50">
      {/* Décor — mouvement d'ambiance discret, respecte prefers-reduced-motion via l'opacité fixe si besoin */}
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-40 motion-safe:animate-[pulse_8s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, #93A7EE 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full opacity-30 motion-safe:animate-[pulse_10s_ease-in-out_infinite]"
        style={{ background: "radial-gradient(circle, #6EE7B7 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-20 lg:grid-cols-2">
          <div
            className={`transition-all duration-700 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-acadia-blue-50 px-5 py-2 text-sm font-semibold text-acadia-blue">
              Academic Intelligence for Economics &amp; Management
            </span>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-acadia-navy lg:text-6xl">
              Votre sujet de mémoire.
              <br />
              <span className="text-acadia-blue">On commence ici.</span>
            </h1>

            <p className="mt-8 max-w-xl text-xl leading-9 text-slate-600">
              Entrez votre sujet et ACADIA vous montre comment commencer votre recherche.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 max-w-xl">
              <label htmlFor="hero-subject" className="mb-2 block text-sm font-semibold text-acadia-navy">
                Quel est votre sujet de recherche ?
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="hero-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex : Impact de la transformation digitale sur la performance des PME..."
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-4 text-base text-slate-900 shadow-sm transition focus:border-acadia-blue focus:outline-none focus:ring-2 focus:ring-acadia-blue/20"
                />
                <button
                  type="submit"
                  disabled={subject.trim().length < 8}
                  className="group bg-acadia-gradient flex shrink-0 items-center justify-center gap-2 rounded-xl px-7 py-4 font-semibold text-white shadow-lg shadow-acadia-blue/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-acadia-blue/30 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:active:scale-100"
                >
                  Analyser mon sujet
                  <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </div>
            </form>

            <div className="mt-8">
              <a
                href="#workflow"
                className="text-sm font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-700"
              >
                Découvrir comment ACADIA fonctionne
              </a>
            </div>

            <div className="mt-8 space-y-3 text-slate-600">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Gratuit pour commencer
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Sans carte bancaire, sans compte pour découvrir votre proposition
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Le chercheur reste décisionnaire à chaque étape
              </p>
            </div>
          </div>

          <div
            className={`transition-all delay-150 duration-700 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
          >
            <HeroFlowPreview />
          </div>
        </div>
      </div>

      {previewSubject && (
        <SubjectPreviewOverlay subject={previewSubject} onClose={() => setPreviewSubject(null)} />
      )}
    </section>
  );
}
