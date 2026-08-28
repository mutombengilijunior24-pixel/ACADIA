"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { isDevEnvironment } from "@/lib/api/devOnlyRoute";

type QuestionnaireResult = {
  title?: string;
  researchType?: string;
  variables?: unknown[];
  sections?: unknown[];
  warnings?: string[];
};

export default function QuestionnaireLabPage() {
  if (!isDevEnvironment()) notFound();

  const [title, setTitle] = useState("");

  const [researchType, setResearchType] =
    useState("Quantitative");

  const [domain, setDomain] = useState(
    "Sciences de gestion"
  );

  const [level, setLevel] =
    useState("Master");

  const [university, setUniversity] =
    useState(
      "Université de Lubumbashi"
    );

  const [problem, setProblem] =
    useState("");

  const [objective, setObjective] =
    useState("");

  const [population, setPopulation] =
    useState("");

  const [location, setLocation] =
    useState("Lubumbashi");

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<QuestionnaireResult | null>(
      null
    );

  const [error, setError] =
    useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response =
        await fetch(
          "/api/ai/questionnaire",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title,
              researchType,
              domain,
              level,
              university,
              problem,
              objective,
              population,
              location,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Erreur lors de la génération."
        );
      }

      setResult(
        data.questionnaire
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-600">
            ACADIA LAB
          </p>

          <h1 className="mt-2 text-4xl font-bold text-slate-900">
            Générateur de questionnaire
          </h1>

          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Test indépendant du cerveau de génération
            des questionnaires ACADIA.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* FORMULAIRE */}

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">
              Informations de recherche
            </h2>

            <div className="mt-6 space-y-5">
              <Field
                label="Sujet"
                value={title}
                onChange={setTitle}
                placeholder="Exemple : Influence de l'évaluation du personnel sur la motivation des agents de la SNCC à Lubumbashi"
              />

              <Field
                label="Domaine"
                value={domain}
                onChange={setDomain}
              />

              <Field
                label="Niveau"
                value={level}
                onChange={setLevel}
              />

              <Field
                label="Université"
                value={university}
                onChange={setUniversity}
              />

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Type de recherche
                </label>

                <select
                  value={researchType}
                  onChange={(event) =>
                    setResearchType(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border p-4 outline-none focus:border-blue-600"
                >
                  <option>
                    Quantitative
                  </option>

                  <option>
                    Qualitative
                  </option>

                  <option>
                    Mixte
                  </option>
                </select>
              </div>

              <Textarea
                label="Problématique"
                value={problem}
                onChange={setProblem}
              />

              <Textarea
                label="Objectif général"
                value={objective}
                onChange={setObjective}
              />

              <Field
                label="Population"
                value={population}
                onChange={setPopulation}
                placeholder="Exemple : Agents de la SNCC à Lubumbashi"
              />

              <Field
                label="Localisation"
                value={location}
                onChange={setLocation}
              />

              <button
                type="button"
                onClick={handleGenerate}
                disabled={
                  loading ||
                  !title.trim()
                }
                className="w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "🧠 ACADIA analyse votre recherche..."
                  : "✨ Générer mon questionnaire"}
              </button>
            </div>
          </section>

          {/* RÉSULTAT */}

          <section className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">
              Résultat ACADIA
            </h2>

            {!result &&
              !loading &&
              !error && (
                <div className="mt-8 rounded-2xl bg-slate-50 p-8 text-center">
                  <p className="text-lg font-semibold text-slate-700">
                    Votre questionnaire apparaîtra ici.
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Entrez votre sujet puis cliquez
                    sur Générer.
                  </p>
                </div>
              )}

            {loading && (
              <div className="mt-8 rounded-2xl bg-blue-50 p-8 text-center">
                <p className="text-lg font-bold text-blue-700">
                  🧠 Analyse en cours...
                </p>

                <p className="mt-2 text-sm text-blue-600">
                  ACADIA construit la structure
                  méthodologique du questionnaire.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-8 rounded-2xl bg-red-50 p-6">
                <p className="font-bold text-red-700">
                  Erreur
                </p>

                <p className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {result && (
              <pre className="mt-6 max-h-[700px] overflow-auto rounded-2xl bg-slate-900 p-5 text-sm text-white">
                {JSON.stringify(
                  result,
                  null,
                  2
                )}
              </pre>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// ======================================================
// FIELD
// ======================================================

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border p-4 outline-none focus:border-blue-600"
      />
    </div>
  );
}

// ======================================================
// TEXTAREA
// ======================================================

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
      </label>

      <textarea
        rows={5}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full resize-none rounded-xl border p-4 outline-none focus:border-blue-600"
      />
    </div>
  );
}