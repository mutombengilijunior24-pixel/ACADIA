export default function Testimonials() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
            TÉMOIGNAGES
          </p>

          <h2 className="mt-4 text-5xl font-bold text-slate-900">
            Ils font confiance à ACADIA
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-xl text-slate-600">
            Étudiants, chercheurs et enseignants utilisent déjà ACADIA
            pour accélérer leurs travaux scientifiques.
          </p>
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-3">

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex text-yellow-400 text-xl">
              ⭐⭐⭐⭐⭐
            </div>

            <p className="leading-8 text-slate-600">
              ACADIA m'a permis de terminer mon mémoire beaucoup plus vite.
              Les suggestions étaient très pertinentes.
            </p>

            <div className="mt-8">
              <h4 className="font-bold">Junior K.</h4>
              <p className="text-slate-500">
                Étudiant - Université de Lubumbashi
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex text-yellow-400 text-xl">
              ⭐⭐⭐⭐⭐
            </div>

            <p className="leading-8 text-slate-600">
              Générer automatiquement mes questionnaires m'a fait gagner
              plusieurs heures de travail.
            </p>

            <div className="mt-8">
              <h4 className="font-bold">Sarah M.</h4>
              <p className="text-slate-500">
                Chercheuse
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mb-6 flex text-yellow-400 text-xl">
              ⭐⭐⭐⭐⭐
            </div>

            <p className="leading-8 text-slate-600">
              Une plateforme moderne qui accompagne les étudiants du début
              jusqu'à la soutenance.
            </p>

            <div className="mt-8">
              <h4 className="font-bold">Pr. Patrick N.</h4>
              <p className="text-slate-500">
                Enseignant universitaire
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}