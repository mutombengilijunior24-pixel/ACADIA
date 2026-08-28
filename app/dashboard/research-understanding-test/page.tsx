"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { isDevEnvironment } from "@/lib/api/devOnlyRoute";

type Understanding = {
  researchFocus: string;
  mainConcepts: string[];
  population?: string;
  location?: string;
  proposedRelationship?: {
    from: string;
    to: string;
    relation:
      | "influence"
      | "impact"
      | "effect"
      | "relationship"
      | "association"
      | "comparison"
      | "unknown";
  };
  assumptions: string[];
  pointsToConfirm: string[];
  confidence: "high" | "medium" | "low";
  status: "proposed" | "accepted" | "modified" | "rejected";
};

export default function ResearchUnderstandingPage() {
  if (!isDevEnvironment()) notFound();

  const [title, setTitle] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [understanding, setUnderstanding] =
    useState<Understanding | null>(null);

  const [error, setError] =
    useState("");

  const [validated, setValidated] =
    useState(false);

  async function analyzeSubject() {
    if (!title.trim()) {
      setError(
        "Veuillez entrer votre sujet de recherche."
      );
      return;
    }

    setLoading(true);
    setError("");
    setUnderstanding(null);
    setValidated(false);

    try {
      const response = await fetch(
        "/api/ai/understanding",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Impossible d'analyser le sujet."
        );
      }

      setUnderstanding(
        data.understanding
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

  function validateUnderstanding() {
    if (!understanding) return;

    setUnderstanding({
      ...understanding,
      status: "accepted",
    });

    setValidated(true);
  }

  return (
      <div className="mx-auto max-w-5xl space-y-8">

        {/* HEADER */}

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

          <div className="mb-4 flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-lg text-white">
              🧠
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                ACADIA — A1
              </p>

              <h1 className="text-2xl font-bold text-slate-900">
                Comprenons votre sujet
              </h1>
            </div>

          </div>

          <p className="max-w-3xl text-sm leading-6 text-slate-500">
            Avant de construire votre méthodologie,
            vos variables et vos instruments de recherche,
            ACADIA commence par comprendre précisément
            ce que vous souhaitez étudier.
          </p>

        </section>


        {/* SUJET */}

        {!understanding && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

            <div className="mb-6">

              <h2 className="text-lg font-bold text-slate-900">
                Quel est votre sujet de recherche ?
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Écrivez votre sujet tel qu'il a été
                défini dans votre travail.
              </p>

            </div>

            <textarea
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Exemple : Influence de l'évaluation du personnel sur la motivation des agents de la SNCC à Lubumbashi"
              rows={5}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            {error && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end">

              <button
                type="button"
                onClick={analyzeSubject}
                disabled={loading}
                className="rounded-2xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "🧠 ACADIA analyse..."
                  : "🧠 Comprendre mon sujet"}
              </button>

            </div>

          </section>
        )}


        {/* COMPRÉHENSION */}

        {understanding && (
          <div className="space-y-6">

            {/* INTRODUCTION */}

            <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-8">

              <div className="flex gap-4">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  🧠
                </div>

                <div>

                  <p className="text-sm font-bold text-blue-700">
                    Voici ce que j'ai compris
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Votre sujet porte principalement
                    sur :
                  </h2>

                  <p className="mt-3 text-base leading-7 text-slate-700">
                    {understanding.researchFocus}
                  </p>

                </div>

              </div>

            </section>


            {/* CONCEPTS */}

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

              <h3 className="text-base font-bold text-slate-900">
                Concepts principaux
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Les principaux éléments identifiés
                dans votre sujet.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">

                {understanding.mainConcepts.map(
                  (concept, index) => (
                    <span
                      key={`${concept}-${index}`}
                      className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
                    >
                      {concept}
                    </span>
                  )
                )}

              </div>

            </section>


            {/* RELATION */}

            {understanding.proposedRelationship &&
              understanding.proposedRelationship.relation !==
                "unknown" && (

              <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

                <h3 className="text-base font-bold text-slate-900">
                  Relation étudiée
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  ACADIA a identifié la relation
                  suivante entre les concepts.
                </p>

                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-center font-semibold text-slate-800">
                    {
                      understanding
                        .proposedRelationship
                        .from
                    }
                  </div>

                  <div className="flex flex-col items-center">

                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                      {
                        understanding
                          .proposedRelationship
                          .relation
                      }
                    </span>

                    <span className="text-2xl text-blue-500">
                      →
                    </span>

                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-center font-semibold text-slate-800">
                    {
                      understanding
                        .proposedRelationship
                        .to
                    }
                  </div>

                </div>

              </section>
            )}


            {/* CONTEXTE */}

            <section className="grid gap-6 md:grid-cols-2">

              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Population
                </p>

                <p className="mt-3 text-base font-semibold text-slate-900">
                  {understanding.population ||
                    "À préciser"}
                </p>

              </div>


              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">

                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Localisation
                </p>

                <p className="mt-3 text-base font-semibold text-slate-900">
                  {understanding.location ||
                    "À préciser"}
                </p>

              </div>

            </section>


            {/* POINTS À CONFIRMER */}

            {understanding.pointsToConfirm.length >
              0 && (

              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">

                <div className="flex gap-4">

                  <div className="text-xl">
                    💡
                  </div>

                  <div>

                    <h3 className="font-bold text-amber-900">
                      Quelques points à préciser
                    </h3>

                    <p className="mt-1 text-sm text-amber-800">
                      Avant de continuer, ACADIA
                      souhaite attirer votre attention
                      sur ces éléments.
                    </p>

                    <ul className="mt-4 space-y-2">

                      {understanding.pointsToConfirm.map(
                        (point, index) => (
                          <li
                            key={index}
                            className="text-sm text-amber-900"
                          >
                            • {point}
                          </li>
                        )
                      )}

                    </ul>

                  </div>

                </div>

              </section>

            )}


            {/* VALIDATION */}

            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">

              {!validated ? (
                <>

                  <h3 className="text-lg font-bold text-slate-900">
                    Est-ce bien ce que vous souhaitez
                    étudier ?
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Vous gardez toujours le contrôle.
                    Vous pouvez demander une modification
                    avant de poursuivre.
                  </p>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">

                    <button
                      type="button"
                      onClick={() => {
                        setUnderstanding(null);
                        setError("");
                      }}
                      className="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      ← Modifier
                    </button>

                    <button
                      type="button"
                      onClick={
                        validateUnderstanding
                      }
                      className="rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      ✓ Oui, continuer
                    </button>

                  </div>

                </>
              ) : (

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <div className="flex items-center gap-2">

                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                        ✓
                      </span>

                      <p className="font-bold text-slate-900">
                        Compréhension validée
                      </p>

                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Votre compréhension est validée.
                      L'étape suivante consiste à identifier
                      les variables de votre recherche.
                    </p>

                  </div>

                  <button
                    type="button"
                    className="rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                  >
                    Continuer vers les variables →
                  </button>

                </div>

              )}

            </section>

          </div>
        )}

      </div>
  );
}