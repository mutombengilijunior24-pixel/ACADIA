import { GraduationCap, Award, Microscope, Users2 } from "lucide-react";
import Reveal from "./Reveal";

// ============================================================
// P13 — Section "Pour qui ?". Ne jamais prétendre couvrir toutes
// les disciplines : ACADIA est aujourd'hui spécialisé en Sciences
// Économiques et de Gestion (SEG) uniquement.
// ============================================================

const AUDIENCES = [
  { icon: GraduationCap, title: "Licence", description: "Travail de fin de cycle (TFC) en économie ou gestion." },
  { icon: Award, title: "Master", description: "Mémoire structuré, de la problématique à l'économétrie." },
  { icon: Microscope, title: "Doctorat / chercheur", description: "Production scientifique rigoureuse, formulations prudentes." },
  { icon: Users2, title: "Encadreur", description: "Suivi de la cohérence méthodologique du travail encadré." },
];

const SEG_FIELDS = ["Économie", "Gestion", "Finance", "Marketing", "Ressources humaines", "Entrepreneuriat", "Comptabilité"];

export default function ForWhom() {
  return (
    <section id="pour-qui" className="bg-white py-28">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-acadia-blue">Pour qui ?</p>
          <h2 className="mt-4 text-4xl font-bold text-acadia-navy lg:text-5xl">Spécialisé en Sciences Économiques et de Gestion.</h2>
          <p className="mt-6 text-lg text-slate-600">
            ACADIA ne couvre pas encore toutes les disciplines — il est conçu et validé pour la recherche en SEG.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a, index) => (
            <Reveal key={a.title} delayMs={(index % 4) * 100}>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acadia-blue-50 text-acadia-blue">
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold text-acadia-navy">{a.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{a.description}</p>
            </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-wrap justify-center gap-2.5">
          {SEG_FIELDS.map((field) => (
            <span key={field} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
              {field}
            </span>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
