"use client";

import "./stage-connect.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Briefcase, GraduationCap, Loader2, School, ShieldCheck, Sparkles, Users } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { STAGE_TYPE_LABELS, STAGE_TYPE_PITCH, STAGE_TYPES, type StageType } from "@/lib/core/stages/catalog";
import { facultyOf } from "@/lib/core/stages/report";

import { StageDossier, StatusPill } from "./StageDossier";
import { StageWizard } from "./StageWizard";
import type { ApplicationJson as Application } from "./types";

type View = { name: "home" } | { name: "wizard"; type: StageType } | { name: "dossier"; id: string; justCreated?: boolean };

function Hero() {
  return (
    <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 px-6 py-8 text-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.8)] sm:px-10 sm:py-10">
      <div className="sc-float pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/30 blur-3xl" aria-hidden />
      <div className="sc-float-slow pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" aria-hidden />
      <p className="sc-fade-up relative inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ring-1 ring-white/25">
        <Sparkles size={14} aria-hidden /> MNJ Stage Connect
      </p>
      <h1 className="sc-fade-up relative mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-5xl" style={{ animationDelay: "80ms" }}>
        Votre stage, trouvé, suivi et attesté.
      </h1>
      <p className="sc-fade-up relative mt-3 max-w-2xl text-base leading-relaxed text-indigo-50 sm:text-lg" style={{ animationDelay: "160ms" }}>
        Toutes facultés : économie, polytechnique, droit, santé, sciences… Dites-nous ce que vous voulez apprendre, nous vous orientons vers la bonne entreprise et nous vous accompagnons jusqu&apos;à la remise de vos cotes.
      </p>
      <div className="sc-fade-up relative mt-6 flex flex-wrap gap-3 text-sm" style={{ animationDelay: "240ms" }}>
        {[
          [Users, "Orientation selon votre faculté"],
          [ShieldCheck, "Micro-assurance incluse"],
          [School, "Lien direct avec votre faculté"],
        ].map(([Icon, label]) => {
          const I = Icon as typeof Users;
          return (
            <span key={label as string} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/20">
              <I size={16} aria-hidden /> {label as string}
            </span>
          );
        })}
      </div>
    </header>
  );
}

/** Accueil : choix du type de stage et dossiers en cours. */
function Home({ applications, onChoose, onOpen }: { applications: Application[]; onChoose: (type: StageType) => void; onOpen: (id: string) => void }) {
  const active = applications.filter((a) => a.status !== "annule");
  return (
    <div className="space-y-8">
      {active.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-slate-900">Mes dossiers</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map((a, i) => (
              <li key={a.id} className="sc-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                <button type="button" onClick={() => onOpen(a.id)} className="sc-lift flex w-full flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{STAGE_TYPE_LABELS[a.type]}</span>
                    <ArrowRight size={18} className="text-violet-600" aria-hidden />
                  </span>
                  <span className="text-sm text-slate-600">
                    {facultyOf(a)} · {a.department} · {a.level}
                  </span>
                  <StatusPill status={a.status} payment={a.paymentStatus} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">{active.length ? "Nouveau dossier" : "Quel stage cherchez-vous ?"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {STAGE_TYPES.map((type, i) => {
            const Icon = type === "academique" ? GraduationCap : Briefcase;
            const taken = active.some((a) => a.type === type);
            return (
              <button
                key={type}
                type="button"
                disabled={taken}
                onClick={() => onChoose(type)}
                className={`sc-fade-up sc-lift group relative overflow-hidden rounded-3xl border p-6 text-left disabled:cursor-not-allowed disabled:opacity-60 ${type === "academique" ? "border-violet-200 bg-gradient-to-br from-white to-violet-50" : "border-sky-200 bg-gradient-to-br from-white to-sky-50"}`}
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition group-hover:scale-110 ${type === "academique" ? "bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-violet-500/30" : "bg-gradient-to-br from-sky-600 to-indigo-500 shadow-sky-500/30"}`}>
                  <Icon size={28} aria-hidden />
                </span>
                <span className="mt-4 block text-xl font-extrabold text-slate-900">{STAGE_TYPE_LABELS[type]}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">{STAGE_TYPE_PITCH[type]}</span>
                <span className={`mt-5 inline-flex items-center gap-2 text-sm font-bold ${type === "academique" ? "text-violet-700" : "text-sky-700"}`}>
                  {taken ? "Dossier déjà en cours" : "Commencer"} {taken ? null : <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-1.5" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">Inscription en 3 minutes. Vos informations servent uniquement à vous orienter et à vous présenter aux entreprises partenaires.</p>
      </section>
    </div>
  );
}

/** MNJ Stage Connect : inscription au stage (académique ou professionnel), suivi et pack d'accompagnement. */
export default function StageConnect({ initialType }: { initialType?: StageType }) {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  // Arrivée depuis la page publique « Stages » (?type=…) : le formulaire du stage choisi s'ouvre directement,
  // sauf si un dossier de ce type est déjà en cours (on montre alors ce dossier).
  const intent = useRef(initialType);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stages", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { applications?: Application[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Service momentanément indisponible.");
        setApplications([]);
        return;
      }
      const list = data.applications ?? [];
      setApplications(list);
      if (intent.current) {
        const type = intent.current;
        intent.current = undefined;
        const active = list.find((a) => a.type === type && a.status !== "annule" && a.status !== "termine");
        setView(active ? { name: "dossier", id: active.id } : { name: "wizard", type });
      }
    } catch {
      setError("Connexion impossible.");
      setApplications([]);
    }
  }, []);

  useEffect(() => {
    // Chargement des dossiers (requête réseau) à l'ouverture.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {view.name !== "wizard" ? <Hero /> : null}
      {error ? <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : null}
      {applications === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 size={18} className="animate-spin text-violet-600" aria-hidden /> Chargement…
        </p>
      ) : view.name === "home" ? (
        <Home applications={applications} onChoose={(type) => setView({ name: "wizard", type })} onOpen={(id) => setView({ name: "dossier", id })} />
      ) : view.name === "wizard" ? (
        <StageWizard
          type={view.type}
          initial={{ firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", email: user?.email ?? "" }}
          onCancel={() => setView({ name: "home" })}
          onSubmitted={(a) => {
            void load();
            setView({ name: "dossier", id: a.id, justCreated: true });
          }}
        />
      ) : (
        <StageDossier
          key={view.id}
          id={view.id}
          justCreated={!!view.justCreated}
          onBack={() => {
            void load();
            setView({ name: "home" });
          }}
        />
      )}
    </div>
  );
}
