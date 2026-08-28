import { notFound } from "next/navigation";
import { isDevEnvironment } from "@/lib/api/devOnlyRoute";
import {
  project,
  warnings,
} from "@/lib/core/research/ResearchCoreTest";

export default function ResearchCoreTestPage() {
  if (!isDevEnvironment()) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
            ACADIA — Research Core A0
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Test du modèle central
          </h1>

          <p className="mt-2 text-slate-500">
            Vérification de la transformation de ResearchData en ResearchProject.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Projet généré
          </h2>

          <pre className="mt-5 overflow-auto rounded-2xl bg-slate-950 p-6 text-sm text-white">
            {JSON.stringify(project, null, 2)}
          </pre>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Avertissements
          </h2>

          {warnings.length === 0 ? (
            <p className="mt-4 font-semibold text-green-600">
              ✓ Aucun avertissement
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
                >
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}