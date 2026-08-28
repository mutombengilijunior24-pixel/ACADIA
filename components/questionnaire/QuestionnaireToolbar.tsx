"use client";

import { useState } from "react";

import type {
  GeneratedQuestionnaire,
} from "@/lib/core/questionnaire/QuestionnaireTypes";


type QuestionnaireToolbarProps = {
  questionnaire: GeneratedQuestionnaire;

  mode: "edit" | "preview";

  onModeChange: (
    mode: "edit" | "preview"
  ) => void;

  onPublish: () => void;

  onCloseCollection: () => void;
};


export default function QuestionnaireToolbar({
  questionnaire,
  mode,
  onModeChange,
  onPublish,
  onCloseCollection,
}: QuestionnaireToolbarProps) {

  const [copied, setCopied] =
    useState(false);


  const publication =
    questionnaire.publication;


  const status =
    publication?.status ?? "draft";


  const isPublished =
    status === "published";


  const isClosed =
    status === "closed";


  /* =====================================================
     COPIER LE LIEN
  ===================================================== */

  async function handleCopyLink() {

    if (!publication?.publicUrl) {
      return;
    }

    try {

      await navigator.clipboard.writeText(
        publication.publicUrl
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);

    } catch (error) {

      console.error(
        "Impossible de copier le lien :",
        error
      );

    }
  }


  /* =====================================================
     OUVRIR LE LIEN
  ===================================================== */

  function handleOpenLink() {

    if (!publication?.publicUrl) {
      return;
    }

    window.open(
      publication.publicUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }


  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">

      <div className="mx-auto max-w-7xl px-6 py-4">

        <div className="flex flex-wrap items-center justify-between gap-4">

          {/* =================================================
              IDENTITÉ DU QUESTIONNAIRE
          ================================================= */}

          <div className="min-w-0">

            <div className="flex items-center gap-3">

              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                ACADIA — Questionnaire Builder
              </p>


              {/* STATUT */}

              {status === "draft" && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                  Brouillon
                </span>
              )}


              {isPublished && (
                <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-bold text-green-700">
                  ● Publié
                </span>
              )}


              {isClosed && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-red-700">
                  ● Collecte fermée
                </span>
              )}

            </div>


            <h1 className="mt-1 truncate text-lg font-bold text-slate-900">
              {questionnaire.title}
            </h1>

          </div>


          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="flex flex-wrap items-center gap-3">


            {/* =================================================
                MODE ÉDITION / PRÉVISUALISATION
            ================================================= */}

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">

              <button
                type="button"
                onClick={() =>
                  onModeChange("edit")
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "edit"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Modifier
              </button>


              <button
                type="button"
                onClick={() =>
                  onModeChange("preview")
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  mode === "preview"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Prévisualiser
              </button>

            </div>


            {/* =================================================
                BROUILLON → PUBLIER
            ================================================= */}

            {status === "draft" && (
              <button
                type="button"
                onClick={onPublish}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
              >
                🚀 Publier
              </button>
            )}


            {/* =================================================
                PUBLIÉ → ACTIONS
            ================================================= */}

            {isPublished && publication && (
              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {copied
                    ? "✓ Lien copié"
                    : "🔗 Copier le lien"}
                </button>


                <button
                  type="button"
                  onClick={handleOpenLink}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  Ouvrir
                </button>


                <button
                  type="button"
                  onClick={onCloseCollection}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100"
                >
                  Fermer
                </button>

              </div>
            )}


            {/* =================================================
                FERMÉ → INFORMATIONS + ACTION
            ================================================= */}

            {isClosed && publication && (
              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {copied
                    ? "✓ Lien copié"
                    : "🔗 Copier le lien"}
                </button>


                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      publication.publicUrl,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Ouvrir
                </button>


                <button
                  type="button"
                  onClick={() => {
                    /*
                     * Pour l'instant, on réutilise
                     * la publication comme base.
                     *
                     * La fonction reopenQuestionnaire()
                     * sera branchée dans le Builder
                     * lors de l'étape suivante.
                     */
                    console.log(
                      "Rouvrir la collecte"
                    );
                  }}
                  className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-green-700"
                >
                  Rouvrir
                </button>

              </div>
            )}

          </div>

        </div>


        {/* =====================================================
            PANNEAU DE PUBLICATION
        ===================================================== */}

        {isPublished && publication && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">

            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>

                <p className="text-sm font-bold text-green-800">
                  ✓ Votre questionnaire est publié
                </p>

                <p className="mt-1 text-xs text-green-700">
                  Les répondants peuvent maintenant
                  accéder à votre questionnaire.
                </p>

              </div>


              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">

                <div className="max-w-xl min-w-0 truncate rounded-xl border border-green-200 bg-white px-4 py-2.5 font-mono text-xs text-slate-600">
                  {publication.publicUrl}
                </div>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-xl bg-green-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-green-700"
                >
                  {copied
                    ? "✓ Copié"
                    : "Copier"}
                </button>

              </div>

            </div>

          </div>
        )}


        {/* =====================================================
            PANNEAU COLLECTE FERMÉE
        ===================================================== */}

        {isClosed && publication && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">

            <p className="text-sm font-bold text-red-800">
              🔒 La collecte est actuellement fermée
            </p>

            <p className="mt-1 text-xs text-red-700">
              Les nouvelles réponses ne doivent plus
              être enregistrées pour ce questionnaire.
            </p>

          </div>
        )}

      </div>

    </header>
  );
}