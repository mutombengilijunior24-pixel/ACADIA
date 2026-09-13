import ProductDemoVideo from "./ProductDemoVideo";
import Reveal from "./Reveal";

export default function Demo() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-32">

      <div className="mx-auto max-w-7xl px-6">

        <div className="grid items-center gap-20 lg:grid-cols-2">

          {/* Texte */}

          <Reveal>

            <span className="rounded-full bg-acadia-blue-50 px-4 py-2 text-sm font-semibold text-acadia-blue">
              Démonstration
            </span>

            <h2 className="mt-6 text-5xl font-black leading-tight text-acadia-navy">
              Découvrez ACADIA
              <br />
              en moins d&apos;une minute
            </h2>

            <p className="mt-8 text-xl leading-9 text-slate-600">
              Regardez comment ACADIA transforme un simple sujet
              de mémoire en un travail scientifique complet,
              structuré et prêt à être soutenu.
            </p>

            <div className="mt-10 space-y-5">

              <div className="flex items-center gap-3">
                <span className="text-emerald-500">✔</span>
                Génération automatique du plan
              </div>

              <div className="flex items-center gap-3">
                <span className="text-emerald-500">✔</span>
                Création intelligente du questionnaire
              </div>

              <div className="flex items-center gap-3">
                <span className="text-emerald-500">✔</span>
                Analyse statistique instantanée
              </div>

              <div className="flex items-center gap-3">
                <span className="text-emerald-500">✔</span>
                Export du document scientifique en DOCX &amp; PDF
              </div>

            </div>

          </Reveal>

          {/* Vidéo */}

          <Reveal delayMs={150}>
            <ProductDemoVideo />
          </Reveal>

        </div>

      </div>

    </section>
  );
}