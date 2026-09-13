"use client";

import { useState } from "react";
import { Target, Pencil, Plus, X, Eye, Tags, MessageCircleQuestion, ExternalLink } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import { RESEARCH_MODE_LABELS } from "@/lib/core/research/ResearchModeTaxonomy";

/**
 * Réponse directe au constat de ResearchConsistencyEngine quand la
 * question de recherche ou les objectifs manquent : au lieu d'un
 * simple message d'alerte, l'étudiant a ici, immédiatement, le champ
 * où écrire ce qui manque. Toujours une écriture de l'étudiant lui-
 * même — jamais un texte généré ou reformulé par ACADIA à cet
 * endroit.
 */
export default function ResearchGoalsSection({ project }: { project: ResearchProject }) {
  const { setResearchQuestion, setGeneralObjective, addSpecificObjective, removeObjective } = useResearch();
  const researchId = project.id;

  const question = project.researchQuestions.find((q) => q.type === "main");
  const generalObjective = project.objectives.find((o) => o.role === "general");
  const specificObjectives = project.objectives.filter((o) => o.role === "specific");

  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState(question?.text ?? "");

  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState(generalObjective?.text ?? "");

  const [addingSpecific, setAddingSpecific] = useState(false);
  const [specificDraft, setSpecificDraft] = useState("");

  function saveQuestion() {
    if (questionDraft.trim()) setResearchQuestion(researchId, questionDraft.trim());
    setEditingQuestion(false);
  }

  function saveObjective() {
    if (objectiveDraft.trim()) setGeneralObjective(researchId, objectiveDraft.trim());
    setEditingObjective(false);
  }

  function saveSpecific() {
    if (specificDraft.trim()) addSpecificObjective(researchId, specificDraft.trim());
    setSpecificDraft("");
    setAddingSpecific(false);
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <Target className="h-3.5 w-3.5" /> Question &amp; objectifs
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">Question de recherche et objectifs</h2>
      <p className="mt-1 text-sm text-slate-500">
        Le cœur de votre travail — écrit et validé par vous. ACADIA peut avoir suggéré une piste lors de l&apos;analyse ;
        c&apos;est ici que vous la confirmez ou l&apos;ajustez avec vos propres mots.
      </p>

      {/* ---------------------------------------------------- */}
      {/* PHÉNOMÈNE, MODE(S) DE RECHERCHE, TABLEAU DE DONNÉES     */}
      {/* (Research Intelligence V2) — expose ce qu'A1 a déjà     */}
      {/* calculé, jusqu'ici invisible dans le tableau de bord.   */}
      {/* ---------------------------------------------------- */}

      {project.understanding?.phenomenon && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
            <Eye className="h-3 w-3" /> Phénomène observé
          </p>
          <p className="mt-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 text-sm text-acadia-navy">
            {project.understanding.phenomenon}
          </p>
        </div>
      )}

      {(project.understanding?.researchModeTags?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
            <Tags className="h-3 w-3" /> Mode(s) de recherche identifié(s) par ACADIA
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {project.understanding!.researchModeTags!.map((tag) => (
              <span key={tag} className="rounded-full bg-acadia-blue-50 px-2.5 py-1 text-2xs font-semibold text-acadia-blue">
                {RESEARCH_MODE_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>
          <p className="mt-1 text-2xs text-slate-400">Proposition à confirmer — jamais une classification définitive.</p>
        </div>
      )}

      {(project.understanding?.phenomenonTable?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
            Ce qu&apos;il faudrait mesurer, et avec quelles données
          </p>
          <div className="mt-1.5 overflow-x-auto rounded-2xl border border-slate-200/90">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-3 py-2 font-semibold">Indicateur</th>
                  <th className="px-3 py-2 font-semibold">Donnée nécessaire</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 font-semibold">Période</th>
                </tr>
              </thead>
              <tbody>
                {project.understanding!.phenomenonTable!.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold text-acadia-navy">
                      {row.indicator}
                      {row.phenomenonElement && (
                        <span className="mt-0.5 block font-normal text-slate-400">{row.phenomenonElement}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.requiredData}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                          row.status === "SOURCED"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "MISSING"
                            ? "bg-red-50 text-red-600"
                            : row.status === "KNOWN"
                            ? "bg-acadia-blue-50 text-acadia-blue"
                            : "bg-amber-50 text-amber-700"
                        }`}
                        title={row.provenance || undefined}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {row.period || "—"}
                      {row.geographicScope && <span className="block text-slate-400">{row.geographicScope}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-2xs text-slate-400">
            Tableau de structuration du phénomène — jamais des chiffres réels. ACADIA n&apos;invente aucune donnée.
          </p>
        </div>
      )}

      {(project.sourcedContext?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Contexte trouvé par ACADIA (sources réelles)</p>
          <div className="mt-1.5 space-y-2 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
            {project.sourcedContext!.map((item) => (
              <div key={item.sourceUrl}>
                <p className="text-xs text-slate-600">{item.text}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-2xs font-semibold text-acadia-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> {item.sourceTitle}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {(project.understanding?.pointsToConfirm?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-amber-700">
            <MessageCircleQuestion className="h-3 w-3" /> Points à confirmer
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-800">
            {project.understanding!.pointsToConfirm!.map((item) => (
              <li key={item} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* QUESTION DE RECHERCHE */}
      {/* ---------------------------------------------------- */}

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Question de recherche</p>
          {!editingQuestion && question && (
            <button
              type="button"
              onClick={() => {
                setQuestionDraft(question.text);
                setEditingQuestion(true);
              }}
              aria-label="Modifier"
              className="shrink-0 rounded-lg p-1 text-acadia-blue hover:bg-acadia-blue-50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {editingQuestion || !question ? (
          <div className="mt-2 space-y-2">
            {!question && (
              <p className="text-sm text-amber-700">
                Aucune question de recherche n&apos;est encore rattachée au projet — écrivez-la ici pour avancer.
              </p>
            )}
            {!question && project.understanding?.researchQuestion && (
              <div className="rounded-xl bg-acadia-blue-50/60 p-2.5">
                <p className="text-2xs font-semibold uppercase tracking-wider text-acadia-blue">Proposition d&apos;ACADIA</p>
                <p className="mt-1 text-sm text-acadia-navy">{project.understanding.researchQuestion}</p>
                <button
                  type="button"
                  onClick={() => setQuestionDraft(project.understanding!.researchQuestion!)}
                  className="mt-1.5 text-2xs font-semibold text-acadia-blue hover:underline"
                >
                  Utiliser cette proposition
                </button>
              </div>
            )}
            <textarea
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              rows={2}
              placeholder="Dans quelle mesure... ? Quel est l'effet de... sur... ?"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveQuestion} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                Enregistrer
              </button>
              {question && (
                <button type="button" onClick={() => setEditingQuestion(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  Annuler
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 text-sm text-acadia-navy">
            {question.text}
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* OBJECTIF GÉNÉRAL */}
      {/* ---------------------------------------------------- */}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Objectif général</p>
          {!editingObjective && generalObjective && (
            <button
              type="button"
              onClick={() => {
                setObjectiveDraft(generalObjective.text);
                setEditingObjective(true);
              }}
              aria-label="Modifier"
              className="shrink-0 rounded-lg p-1 text-acadia-blue hover:bg-acadia-blue-50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {editingObjective || !generalObjective ? (
          <div className="mt-2 space-y-2">
            {!generalObjective && (
              <p className="text-sm text-rose-700">Aucun objectif général n&apos;est défini — écrivez-le ici pour clôturer cette étape.</p>
            )}
            {!generalObjective && project.understanding?.objective && (
              <div className="rounded-xl bg-acadia-blue-50/60 p-2.5">
                <p className="text-2xs font-semibold uppercase tracking-wider text-acadia-blue">Proposition d&apos;ACADIA</p>
                <p className="mt-1 text-sm text-acadia-navy">{project.understanding.objective}</p>
                <button
                  type="button"
                  onClick={() => setObjectiveDraft(project.understanding!.objective!)}
                  className="mt-1.5 text-2xs font-semibold text-acadia-blue hover:underline"
                >
                  Utiliser cette proposition
                </button>
              </div>
            )}
            <textarea
              value={objectiveDraft}
              onChange={(e) => setObjectiveDraft(e.target.value)}
              rows={2}
              placeholder="Analyser / évaluer / décrire..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveObjective} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                Enregistrer
              </button>
              {generalObjective && (
                <button type="button" onClick={() => setEditingObjective(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  Annuler
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 text-sm text-acadia-navy">
            {generalObjective.text}
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* OBJECTIFS SPÉCIFIQUES */}
      {/* ---------------------------------------------------- */}

      <div className="mt-5">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Objectifs spécifiques</p>

        {specificObjectives.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucun objectif spécifique pour le moment.</p>
        ) : null}

        {(() => {
          const existingTexts = new Set(specificObjectives.map((o) => o.text.trim().toLowerCase()));
          const proposed = (project.understanding?.objectives ?? []).filter(
            (text) => text.trim() && !existingTexts.has(text.trim().toLowerCase())
          );
          if (proposed.length === 0) return null;
          return (
            <div className="mt-2 space-y-1.5 rounded-xl bg-acadia-blue-50/60 p-2.5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-acadia-blue">Propositions d&apos;ACADIA</p>
              {proposed.map((text) => (
                <div key={text} className="flex items-start justify-between gap-2">
                  <p className="text-sm text-acadia-navy">{text}</p>
                  <button
                    type="button"
                    onClick={() => addSpecificObjective(researchId, text)}
                    className="shrink-0 text-2xs font-semibold text-acadia-blue hover:underline"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </div>
          );
        })()}

        {specificObjectives.length > 0 && (
          <div className="mt-2 space-y-2">
            {specificObjectives.map((o, i) => (
              <div key={o.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
                <div className="flex-1">
                  <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">OS{i + 1}</p>
                  <p className="mt-1 text-sm text-slate-700">{o.text}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeObjective(researchId, o.id)}
                  aria-label="Supprimer"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!addingSpecific ? (
          <button
            type="button"
            onClick={() => setAddingSpecific(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter un objectif spécifique
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 p-4">
            <textarea
              value={specificDraft}
              onChange={(e) => setSpecificDraft(e.target.value)}
              rows={2}
              placeholder="Décrire / mesurer / identifier..."
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={saveSpecific} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingSpecific(false);
                  setSpecificDraft("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
