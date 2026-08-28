import { Calculator, FlaskConical, LineChart, ShieldCheck } from "lucide-react";

// ============================================================
// P13 — Section "Le cerveau ACADIA" : montrer qu'ACADIA n'est pas
// un chatbot, sans jamais le présenter comme une intelligence
// autonome capable de remplacer le chercheur. Positionnement
// "AI-assisted research environment" — le chercheur reste
// décisionnaire.
// ============================================================

const PILLARS = [
  {
    icon: FlaskConical,
    title: "Intelligence méthodologique",
    description: "Cohérence entre question de recherche, objectifs, variables et hypothèses — vérifiée à chaque étape.",
  },
  {
    icon: Calculator,
    title: "Intelligence économétrique",
    description: "Statistiques descriptives, bivariées et modèles économétriques calculés de façon déterministe.",
  },
  {
    icon: LineChart,
    title: "Intelligence scientifique",
    description: "Interprétation prudente des résultats — jamais une causalité affirmée à partir d'une simple association.",
  },
  {
    icon: ShieldCheck,
    title: "Validation humaine",
    description: "Chaque interprétation reste modifiable et doit être acceptée par le chercheur avant d'être considérée acquise.",
  },
];

export default function AcadiaBrain() {
  return (
    <section className="bg-acadia-navy py-28 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-acadia-blue-light">Le cerveau ACADIA</p>
          <h2 className="mt-4 text-4xl font-bold lg:text-5xl">ACADIA ne se contente pas de générer du texte.</h2>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Certaines opérations sont déterministes et exécutées directement par ACADIA — calculs, validations,
            cohérence structurelle. L&apos;IA intervient uniquement lorsque son apport est utile : comprendre,
            reformuler, analyser un texte. Jamais pour inventer un résultat.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acadia-blue/20 text-acadia-blue-light">
                <pillar.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-bold">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{pillar.description}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-center text-sm font-semibold text-acadia-blue-light">
          Positionnement ACADIA : un environnement de recherche assisté par IA — jamais une intelligence autonome
          qui remplace le chercheur. Le chercheur reste décisionnaire.
        </p>
      </div>
    </section>
  );
}
