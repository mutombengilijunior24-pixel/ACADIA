import Link from "next/link";
import { BarChart3, ClipboardList, FileText, UserRound } from "lucide-react";
import Reveal from "./Reveal";

// ============================================================
// « Fonctionnement » — remplace l'ancien carrousel d'étapes (sujet,
// variables, hypothèses, méthodologie…) : ACADIA se concentre sur la
// récolte et l'interprétation des données.
// ============================================================

const STEPS = [
  {
    icon: FileText,
    title: "1. Votre projet en 4 étapes",
    text: "Votre sujet, votre domaine et votre spécialité, votre université, puis votre directeur de mémoire.",
  },
  {
    icon: UserRound,
    title: "2. Le canevas de votre directeur",
    text: "Si votre directeur a défini son canevas dans ACADIA, il s'applique à votre travail. Sinon, ACADIA suit sa logique générale.",
  },
  {
    icon: ClipboardList,
    title: "3. Récolter vos données",
    text: "Un questionnaire d'enquête créé avec ACADIA, ou le vôtre importé ; un lien à diffuser ; les réponses centralisées.",
  },
  {
    icon: BarChart3,
    title: "4. Interpréter vos données",
    text: "Votre fichier importé, les analyses adaptées à votre spécialité, et des interprétations que vous validez.",
  },
];

export default function HowItWorks() {
  return (
    <section id="workflow" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-acadia-blue">Fonctionnement</p>
          <h2 className="mt-4 text-4xl font-bold text-acadia-navy lg:text-5xl">Ce qui compte : vos données.</h2>
          <p className="mt-6 text-xl leading-9 text-slate-600">
            La problématique et les objectifs, vous les avez avec votre directeur. ACADIA vous aide là où c&apos;est le plus exigeant :
            récolter des données fiables, puis les interpréter avec rigueur.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delayMs={(index % 4) * 100}>
              <div className="h-full rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
                  <Icon size={22} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-bold text-acadia-navy">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/register?next=/dashboard/research/new" className="bg-acadia-gradient inline-flex items-center rounded-xl px-7 py-4 font-semibold text-white shadow-lg shadow-acadia-blue/20 transition hover:-translate-y-0.5">
            Commencer
          </Link>
        </div>
      </div>
    </section>
  );
}
