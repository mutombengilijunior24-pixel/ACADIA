import ProductDemoVideo from "./ProductDemoVideo";

export default function Demo() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-50 py-32">

      <div className="mx-auto max-w-7xl px-6">

        <div className="grid items-center gap-20 lg:grid-cols-2">

          {/* Texte */}

          <div>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              Démonstration
            </span>

            <h2 className="mt-6 text-5xl font-black leading-tight text-slate-900">
              Découvrez ACADIA
              <br />
              en moins d'une minute
            </h2>

            <p className="mt-8 text-xl leading-9 text-slate-600">
              Regardez comment ACADIA transforme un simple sujet
              de mémoire en un travail scientifique complet,
              structuré et prêt à être soutenu.
            </p>

            <div className="mt-10 space-y-5">

              <div className="flex items-center gap-3">
                <span className="text-green-500">✔</span>
                Génération automatique du plan
              </div>

              <div className="flex items-center gap-3">
                <span className="text-green-500">✔</span>
                Création intelligente du questionnaire
              </div>

              <div className="flex items-center gap-3">
                <span className="text-green-500">✔</span>
                Analyse statistique instantanée
              </div>

              <div className="flex items-center gap-3">
                <span className="text-green-500">✔</span>
                Export du document scientifique en DOCX &amp; PDF
              </div>

            </div>

          </div>

          {/* Vidéo */}

          <ProductDemoVideo />

        </div>

      </div>

    </section>
  );
}