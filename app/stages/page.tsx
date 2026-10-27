import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, CalendarCheck2, CheckCircle2, ClipboardCheck, FileText, GraduationCap, LogIn, NotebookPen, ShieldCheck, Sparkles } from "lucide-react";

import "@/components/stages/stage-connect.css";
import Footer from "@/components/landing/footer/Footer";
import Navbar from "@/components/landing/Navbar";
import { StageStartLink } from "@/components/stages/StageStartLink";
import { optionsTotal, STAGE_OPTION_IDS, STAGE_OPTIONS, STAGE_STATUS_LABELS, STAGE_TYPE_LABELS, STAGE_TYPE_PITCH, STAGE_TYPES } from "@/lib/core/stages/catalog";
import { INSTITUTIONS } from "@/lib/core/stages/institutions";
import { STEP_HOW } from "@/lib/core/stages/workflow";

export const metadata: Metadata = {
  title: "Stages — MNJ Stage Connect | ACADIA",
  description: "Stage académique ou professionnel : inscription, orientation vers l'entreprise, présences et journal de stage, rapport de stage et lien direct avec votre faculté.",
};

const STEPS = ["en_attente", "dossier_complet", "oriente", "place", "en_stage", "termine"] as const;

/** Page publique « Stages » : point d'entrée depuis le menu du site. */
export default function StagesLandingPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-hidden bg-slate-50">
        <section className="relative bg-gradient-to-br from-violet-800 via-indigo-800 to-sky-700 px-6 pb-20 pt-16 text-white sm:pt-20">
          <div className="sc-float pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl" aria-hidden />
          <div className="sc-float-slow pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" aria-hidden />
          <div className="relative mx-auto max-w-6xl">
            <p className="sc-fade-up inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ring-1 ring-white/25">
              <Sparkles size={14} aria-hidden /> MNJ Stage Connect
            </p>
            <h1 className="sc-fade-up mt-5 max-w-4xl text-4xl font-black leading-[1.05] sm:text-6xl" style={{ animationDelay: "80ms" }}>
              Votre stage commence ici.
              <span className="block bg-gradient-to-r from-fuchsia-200 via-white to-sky-200 bg-clip-text text-transparent">Trouvé, suivi, attesté.</span>
            </h1>
            <p className="sc-fade-up mt-5 max-w-2xl text-lg leading-relaxed text-indigo-50" style={{ animationDelay: "160ms" }}>
              Toutes facultés. Vous créez votre compte, vous complétez votre dossier, MNJ vous oriente vers l&apos;entreprise adaptée et vous accompagne jusqu&apos;à la remise de vos cotes à la faculté.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {STAGE_TYPES.map((type, i) => {
                const Icon = type === "academique" ? GraduationCap : Briefcase;
                return (
                  <StageStartLink key={type} type={type} style={{ animationDelay: `${240 + i * 90}ms` }} className="sc-fade-up sc-lift group relative block overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-2xl shadow-indigo-950/30">
                    <span className="flex items-start gap-4">
                      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition group-hover:scale-110 ${type === "academique" ? "bg-gradient-to-br from-violet-600 to-fuchsia-500" : "bg-gradient-to-br from-sky-600 to-indigo-500"}`}>
                        <Icon size={28} aria-hidden />
                      </span>
                      <span>
                        <span className="block text-xl font-extrabold">{STAGE_TYPE_LABELS[type]}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-slate-600">{STAGE_TYPE_PITCH[type]}</span>
                        <span className={`mt-4 inline-flex items-center gap-2 text-sm font-black ${type === "academique" ? "text-violet-700" : "text-sky-700"}`}>
                          Je m&apos;inscris <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-1.5" />
                        </span>
                      </span>
                    </span>
                  </StageStartLink>
                );
              })}
            </div>
            <p className="mt-5 text-sm text-indigo-100">
              Déjà inscrit ?{" "}
              <Link href="/login?next=/dashboard/stages" className="font-bold text-white underline-offset-4 hover:underline">
                Se connecter et suivre mon dossier
              </Link>
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="sc-etapes">
          <h2 id="sc-etapes" className="text-3xl font-black text-slate-900">Six étapes, suivies en temps réel</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Chaque étape s&apos;affiche dans votre espace dès que le fait qui la déclenche est enregistré : personne ne « coche » un statut au hasard.</p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="sc-fade-up rounded-3xl border border-slate-200 bg-white p-5" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-black text-white">{i + 1}</span>
                <p className="mt-3 font-extrabold text-slate-900">{STAGE_STATUS_LABELS[s]}</p>
                <p className="mt-1 text-sm text-slate-600">{STEP_HOW[s]}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-white py-16" aria-labelledby="sc-pendant">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2">
            <div>
              <h2 id="sc-pendant" className="text-3xl font-black text-slate-900">Pendant le stage, tout se fait dans ACADIA</h2>
              <ul className="mt-6 space-y-4">
                {[
                  [LogIn, "Je signe ma présence", "À l'arrivée sur le lieu de stage, puis au départ : l'heure est enregistrée par ACADIA, pas par le téléphone."],
                  [NotebookPen, "Je décris ma journée", "En fin de journée, quelques lignes sur ce que vous avez fait. Elles forment votre journal de stage."],
                  [FileText, "Mon rapport se construit tout seul", "Votre journal est repris jour par jour dans un projet de rapport de stage (Word) à compléter et à faire valider."],
                  [ClipboardCheck, "L'entreprise confirme", "Votre maître de stage confirme vos journées depuis son lien personnel, sans compte à créer."],
                ].map(([Icon, title, text], i) => {
                  const I = Icon as typeof LogIn;
                  return (
                    <li key={title as string} className="sc-fade-up flex gap-4" style={{ animationDelay: `${i * 80}ms` }}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                        <I size={20} aria-hidden />
                      </span>
                      <span>
                        <span className="block font-extrabold text-slate-900">{title as string}</span>
                        <span className="block text-sm text-slate-600">{text as string}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-7 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">Pour les facultés</p>
              <h3 className="mt-2 text-2xl font-black">Qui a vraiment fait son stage ?</h3>
              <p className="mt-3 text-sm leading-relaxed text-violet-100">
                Chaque faculté reçoit un accès sécurisé à ses étudiants en stage académique : entreprise, maître de stage, dates, présences signées jour par jour, journées confirmées par l&apos;entreprise et comptes rendus. En cas de contestation, le registre horodaté montre ce que l&apos;étudiant a déclaré et ce que l&apos;entreprise a confirmé.
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Registre de présences exportable (Excel)", "Étudiants « en ordre » repérés d'un coup d'œil", "Chaque consultation est tracée"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-300" aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16" aria-labelledby="sc-pack">
          <h2 id="sc-pack" className="text-3xl font-black text-slate-900">Votre accompagnement, à la carte</h2>
          <p className="mt-2 max-w-2xl text-slate-600">Vous choisissez ce qu&apos;il vous faut : la recommandation, l&apos;assurance, ou les deux pour {optionsTotal(STAGE_OPTION_IDS)}&nbsp;$.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {STAGE_OPTIONS.map((o, i) => (
              <div key={o.id} className={`sc-fade-up sc-lift rounded-3xl border p-6 ${o.preselected ? "border-violet-300 bg-gradient-to-br from-white to-violet-50" : "border-slate-200 bg-white"}`} style={{ animationDelay: `${i * 90}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xl font-extrabold text-slate-900">{o.title}</p>
                  <p className="text-4xl font-black tracking-tight text-slate-900">{o.priceUsd} $</p>
                </div>
                <ul className="mt-4 space-y-2">
                  {o.items.map((item) => (
                    <li key={item.title} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
                      <span>
                        <span className="font-bold text-slate-900">{item.title}</span>
                        <span className="block text-xs leading-relaxed text-slate-600">{item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/30">
            <Sparkles size={16} aria-hidden /> Les deux : {optionsTotal(STAGE_OPTION_IDS)}&nbsp;$
          </p>
        </section>

        <section className="bg-white py-14" aria-labelledby="sc-etablissements">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="sc-etablissements" className="text-2xl font-black text-slate-900">Votre établissement, vos filières</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Quand vous choisissez votre université ou votre institut, ACADIA vous propose les facultés et filières qu&apos;il organise, d&apos;après son site officiel. Votre établissement n&apos;y est pas ? Vous l&apos;écrivez simplement.</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {INSTITUTIONS.map((i) => (
                <li key={i.id} className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-700">
                  {i.acronym} <span className="font-normal text-slate-500">· {i.city}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 p-10 text-center text-white">
            <div className="sc-float pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-3xl" aria-hidden />
            <CalendarCheck2 size={36} className="relative mx-auto" aria-hidden />
            <h2 className="relative mt-3 text-3xl font-black">Prêt à commencer votre stage ?</h2>
            <p className="relative mt-2 text-fuchsia-50">Inscription en 3 minutes. Votre dossier est suivi dès son envoi.</p>
            <div className="relative mt-6 flex flex-wrap justify-center gap-3">
              {STAGE_TYPES.map((type) => (
                <StageStartLink key={type} type={type} className="sc-glow inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-6 font-black text-violet-700 transition hover:-translate-y-0.5">
                  <ShieldCheck size={18} aria-hidden /> {STAGE_TYPE_LABELS[type]}
                </StageStartLink>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
