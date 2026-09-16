"use client";

import { useEffect, useState } from "react";
import { PenLine, Sparkles, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { WritingBlock, WritingCoherenceReport, WritingSection, WritingSectionType } from "@/lib/core/writing/WritingTypes";
import { WRITING_SECTION_LABELS } from "@/lib/core/writing/WritingTypes";

// ============================================================
// ACADIA — RÉDACTION SCIENTIFIQUE (Mission 9)
//
// « L'IA propose, le chercheur valide » appliqué à la prose
// académique : chaque section (introduction, problématique,
// méthodologie, cadre théorique, discussion, conclusion,
// recommandations) est générée puis doit être explicitement modifiée,
// validée ou rejetée par le chercheur — jamais silencieusement
// considérée comme définitive.
// ============================================================

const SECTION_ORDER: WritingSectionType[] = ["INTRODUCTION", "PROBLEMATIC", "LITERATURE_REVIEW", "METHODOLOGY", "DISCUSSION", "CONCLUSION", "RECOMMENDATIONS"];

const STATUS_LABELS: Record<WritingSection["status"], string> = {
  DRAFT: "Brouillon",
  AI_PROPOSED: "Proposition IA — à vérifier",
  USER_EDITED: "Modifié par vous",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
};

const STATUS_COLORS: Record<WritingSection["status"], string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  AI_PROPOSED: "bg-amber-100 text-amber-700",
  USER_EDITED: "bg-blue-100 text-blue-700",
  VALIDATED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function BlockView({ block }: { block: WritingBlock }) {
  if (block.type === "HEADING") {
    const Tag = block.level === 3 ? "h4" : "h3";
    return <Tag className="font-bold text-acadia-navy">{block.text}</Tag>;
  }
  if (block.type === "LIST") {
    return (
      <div>
        {block.text ? <p className="mb-1 font-medium text-acadia-navy">{block.text}</p> : null}
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.type === "QUOTE") {
    return <blockquote className="border-l-4 border-acadia-blue-200 pl-3 italic text-gray-700">{block.text}</blockquote>;
  }
  if (block.type === "NOTE") {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{block.text}</span>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed text-gray-700">{block.text}</p>;
}

function EditableBlockRow({ block, onChange }: { block: WritingBlock; onChange: (b: WritingBlock) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-gray-400">{block.type}</p>
      <textarea
        className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        rows={block.type === "LIST" ? 1 : 3}
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
      />
      {block.type === "LIST" ? (
        <textarea
          className="mt-2 w-full rounded-lg border border-gray-200 p-2 text-sm"
          rows={3}
          placeholder="Un élément par ligne"
          value={(block.items ?? []).join("\n")}
          onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })}
        />
      ) : null}
    </div>
  );
}

export default function WritingOverview({ project }: { project: ResearchProject }) {
  const [sections, setSections] = useState<WritingSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<WritingSectionType>("INTRODUCTION");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBlocks, setEditBlocks] = useState<WritingBlock[]>([]);
  const [coherence, setCoherence] = useState<WritingCoherenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/research/${project.id}/writing`);
    if (res.ok) setSections((await res.json()).sections);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/research/${project.id}/writing`);
        if (res.ok && !cancelled) setSections((await res.json()).sections);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const activeSection = sections.find((s) => s.type === activeType) ?? null;

  async function handleGenerate(regenerate: boolean) {
    setBusy(true);
    setError(null);
    try {
      const url = regenerate && activeSection ? `/api/research/${project.id}/writing/${activeSection.id}/regenerate` : `/api/research/${project.id}/writing/generate`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: regenerate ? undefined : JSON.stringify({ type: activeType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Échec de la génération.");
      }
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la génération.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(action: "validate" | "reject") {
    if (!activeSection) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/${project.id}/writing/${activeSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Échec de l'action.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'action.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit() {
    if (!activeSection) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/${project.id}/writing/${activeSection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", blocks: editBlocks }),
      });
      if (!res.ok) throw new Error("Échec de l'enregistrement.");
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCoherence() {
    setBusy(true);
    try {
      const res = await fetch(`/api/research/${project.id}/writing/coherence`);
      if (res.ok) setCoherence((await res.json()).report);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Chargement de la rédaction…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SECTION_ORDER.map((type) => {
          const section = sections.find((s) => s.type === type);
          const active = type === activeType;
          return (
            <button
              key={type}
              onClick={() => {
                setActiveType(type);
                setEditing(false);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-acadia-blue text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {WRITING_SECTION_LABELS[type]}
              {section ? <span className={`ml-2 rounded-full px-2 py-0.5 text-2xs ${STATUS_COLORS[section.status]}`}>{STATUS_LABELS[section.status]}</span> : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-acadia-navy">{WRITING_SECTION_LABELS[activeType]}</h3>
          <div className="flex gap-2">
            {!activeSection ? (
              <button disabled={busy} onClick={() => handleGenerate(false)} className="flex items-center gap-1 rounded-xl bg-acadia-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> Générer
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={() => handleGenerate(true)} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50">
                  <RefreshCw className="h-4 w-4" /> Régénérer
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing((v) => !v);
                    setEditBlocks(activeSection.blocks);
                  }}
                  className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
                >
                  <PenLine className="h-4 w-4" /> Modifier
                </button>
                <button disabled={busy} onClick={() => handleStatus("validate")} className="flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  <CheckCircle2 className="h-4 w-4" /> Valider
                </button>
                <button disabled={busy} onClick={() => handleStatus("reject")} className="flex items-center gap-1 rounded-xl bg-red-100 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50">
                  <XCircle className="h-4 w-4" /> Rejeter
                </button>
              </>
            )}
          </div>
        </div>

        {!activeSection ? (
          <p className="text-sm text-gray-500">Aucune version générée pour cette section.</p>
        ) : editing ? (
          <div className="space-y-3">
            {editBlocks.map((b, i) => (
              <EditableBlockRow
                key={b.id}
                block={b}
                onChange={(updated) =>
                  setEditBlocks((prev) => prev.map((p, j) => (j === i ? updated : p)))
                }
              />
            ))}
            <button disabled={busy} onClick={handleSaveEdit} className="rounded-xl bg-acadia-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Enregistrer mes modifications
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSection.guardWarnings && activeSection.guardWarnings.length > 0 ? (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Garde-fou anti-hallucination — {activeSection.guardWarnings.length} alerte(s) :</p>
                <ul className="mt-1 list-disc pl-5">
                  {activeSection.guardWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {activeSection.blocks.map((b) => (
              <BlockView key={b.id} block={b} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-acadia-navy">Cohérence verticale</h3>
          <button disabled={busy} onClick={handleCoherence} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 disabled:opacity-50">
            Vérifier la cohérence
          </button>
        </div>
        {coherence ? (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              Objectifs couverts par la conclusion : {coherence.objectivesCovered}/{coherence.objectivesTotal} — Question(s) de recherche couverte(s) : {coherence.questionsCovered}/{coherence.questionsTotal}
            </p>
            {coherence.issues.length === 0 ? (
              <p className="text-green-700">Aucune incohérence détectée.</p>
            ) : (
              <ul className="space-y-1">
                {coherence.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`rounded-lg p-2 ${issue.severity === "blocking" ? "bg-red-50 text-red-700" : issue.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-600"}`}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Non vérifiée pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
