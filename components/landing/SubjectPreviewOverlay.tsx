"use client";

// ============================================================
// ACADIA — PREVIEW EN SURIMPRESSION (10/09/2026, révision 3 ;
// unifiée sur Research Intelligence V3/A1 — mission Preview WOW)
//
// Reste sur la même landing page — le reste du site apparaît flouté
// derrière. UN SEUL CERVEAU : le texte affiché ici vient du même
// moteur A1 (understandResearchWithAI, lib/ai/openai/SubjectUnderstandingAI.ts)
// que le parcours authentifié complet — appelé ici avec depth="preview"
// (modèle économique, raisonnement réduit, voir app/api/preview/route.ts)
// plutôt qu'un moteur "narratif" séparé. Différence Preview/Deep
// Analysis : la PROFONDEUR (pas de variables/A2, pas d'orientations
// théoriques ici), jamais un second contrat de données.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Loader2,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MessageCircleQuestion,
  CheckCircle2,
  Tags,
  Users,
  MapPin,
  Eye,
  Puzzle,
  HelpCircle,
  Target,
  ListChecks,
  Compass,
  ClipboardList,
  Search,
  ExternalLink,
} from "lucide-react";
import { trackClientEvent } from "@/lib/client/trackEvent";
import { PENDING_PREVIEW_KEY } from "@/lib/client/previewStorage";
import { RESEARCH_MODE_LABELS } from "@/lib/core/research/ResearchModeTaxonomy";
import { recommendInstrumentFromModeTags } from "@/lib/core/methodology/MethodologyRecommendationEngine";
import type { AIResearchUnderstanding } from "@/lib/ai/openai/SubjectUnderstandingAI";
import type { PhenomenonContextItem } from "@/lib/ai/openai/PhenomenonContextAI";

type Status = "loading" | "ready" | "error";

// Message cyclique pendant l'appel IA — la preview reste rapide
// (modèle économique + raisonnement réduit, voir SubjectUnderstandingAI.ts
// depth="preview") mais quelques secondes restent inévitables ; la
// rendre lisible en étapes la fait paraître plus courte qu'un simple
// spinner muet.
const LOADING_STAGES = [
  "ACADIA lit votre sujet...",
  "Il identifie le phénomène et les concepts clés...",
  "Il structure la problématique et les objectifs...",
  "Presque prêt...",
];

// Mêmes 6 grandes étapes que components/research/ResearchStageProgress.tsx
// (page projet) — un seul vocabulaire de parcours dans tout ACADIA.
const NEXT_STEPS = [
  { label: "Comprendre ma recherche", detail: "Préciser ensemble votre problématique, vos objectifs et vos variables." },
  { label: "Construire ma méthodologie", detail: "Choisir l'approche et l'échantillonnage adaptés à votre sujet." },
  { label: "Collecter mes données", detail: "Préparer votre questionnaire ou votre guide d'entretien, puis recueillir vos réponses." },
  { label: "Analyser mes données", detail: "Lancer les analyses statistiques sur ce que vous avez collecté." },
  { label: "Interpréter mes résultats", detail: "Comprendre ce que vos résultats signifient réellement." },
  { label: "Finaliser mon travail", detail: "Produire votre document scientifique, prêt à être révisé." },
];

export default function SubjectPreviewOverlay({
  subject,
  onClose,
}: {
  subject: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [understanding, setUnderstanding] = useState<AIResearchUnderstanding | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  // Contexte réel du phénomène (Bloc B, 11/09/2026) — affichage
  // différé : lancé une fois l'aperçu principal déjà affiché, jamais
  // avant, pour ne pas allonger sa latence.
  const [contextItems, setContextItems] = useState<PhenomenonContextItem[] | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    void runPreview();
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingStage(0);
    const timer = setInterval(() => {
      setLoadingStage((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 3500);
    return () => clearInterval(timer);
  }, [status]);

  async function runPreview() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error ?? "ACADIA n'a pas pu analyser ce sujet pour le moment.");
        setStatus("error");
        return;
      }
      const ready = data.understanding as AIResearchUnderstanding;
      setUnderstanding(ready);
      setStatus("ready");
      if (ready.phenomenon) void runPhenomenonContext(ready);
    } catch {
      setErrorMessage("Impossible de contacter ACADIA. Vérifiez votre connexion et réessayez.");
      setStatus("error");
    }
  }

  async function runPhenomenonContext(ready: AIResearchUnderstanding) {
    setContextLoading(true);
    try {
      const res = await fetch("/api/preview/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phenomenon: ready.phenomenon, location: ready.location }),
      });
      const data = await res.json().catch(() => ({}));
      setContextItems(res.ok ? (data.context?.items ?? null) : null);
    } catch {
      // Best-effort : l'aperçu principal reste complet sans cette
      // section — jamais une erreur visible pour cet enrichissement.
      setContextItems(null);
    } finally {
      setContextLoading(false);
    }
  }

  function handleUse() {
    if (!understanding) return;
    trackClientEvent("PREVIEW_ACCEPTED");
    try {
      // Research Intelligence V2 — contextItems (sources réelles
      // trouvées par PhenomenonContextAI) est reporté ici pour ne pas
      // être perdu à l'inscription (voir createResearchFromPreview).
      sessionStorage.setItem(
        PENDING_PREVIEW_KEY,
        JSON.stringify({ subject, understanding, contextItems })
      );
    } catch {
      // Navigation privée stricte : l'inscription se fera sans reprise
      // automatique — dégradation propre, jamais un blocage.
    }
    router.push("/register");
  }

  function handleModify() {
    trackClientEvent("PREVIEW_EDITED");
    onClose();
  }

  const recommendedInstrument = understanding?.researchModeTags?.length
    ? recommendInstrumentFromModeTags(understanding.researchModeTags)
    : null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-acadia-navy/40 px-4 py-8 backdrop-blur-md transition-opacity duration-300 sm:items-center sm:py-10 ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleModify();
      }}
    >
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[0.98] opacity-0"
        }`}
      >
        {/* Bandeau décoratif */}
        <div
          className="relative overflow-hidden px-4 pb-14 pt-6 sm:px-8"
          style={{ background: "linear-gradient(135deg, #0B1B3A 0%, #2554EB 140%)" }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #93A7EE 0%, transparent 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #6EE7B7 0%, transparent 70%)" }}
          />
          <button
            type="button"
            onClick={handleModify}
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
            <Sparkles className="h-3.5 w-3.5" /> ACADIA analyse votre sujet
          </span>
          <p className="mt-4 max-w-md text-base font-semibold text-white sm:text-lg">{subject}</p>
        </div>

        {/* Contenu, chevauche le bandeau */}
        <div className="relative -mt-8 max-h-[75vh] overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white px-4 pb-6 pt-6 sm:px-8">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-acadia-blue/20" />
                <Loader2 className="h-8 w-8 animate-spin text-acadia-blue" />
              </div>
              <p className="text-sm font-semibold text-acadia-navy transition-all duration-300">
                {LOADING_STAGES[loadingStage]}
              </p>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-acadia-blue transition-all duration-[3500ms] ease-linear"
                  style={{ width: `${Math.min(((loadingStage + 1) / LOADING_STAGES.length) * 100, 92)}%` }}
                />
              </div>
              <p className="max-w-xs text-xs text-slate-400">
                Aucune information n&apos;est inventée — uniquement ce qui ressort de votre texte.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-red-700">{errorMessage}</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={runPreview}
                  className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" /> Réessayer
                </button>
                <button
                  type="button"
                  onClick={handleModify}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Modifier mon sujet
                </button>
              </div>
            </div>
          )}

          {status === "ready" && understanding && (
            <>
              <p className="text-base font-bold leading-snug text-acadia-navy sm:text-lg">{understanding.researchFocus}</p>

              <div className="mt-4 space-y-4">
                {understanding.phenomenon && (
                  <PreviewRow icon={Eye} label="Phénomène observé">
                    <p className="text-sm leading-relaxed text-slate-700">{understanding.phenomenon}</p>

                    {contextLoading && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                        <Search className="h-3 w-3 animate-pulse" /> ACADIA recherche un contexte réel et récent...
                      </p>
                    )}

                    {!contextLoading && contextItems && contextItems.length > 0 && (
                      <div className="mt-2.5 space-y-2 rounded-xl bg-slate-50 p-3">
                        {contextItems.map((item) => (
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
                    )}
                  </PreviewRow>
                )}

                {(understanding.researchModeTags?.length ?? 0) > 0 && (
                  <PreviewRow icon={Compass} label="Orientation de recherche">
                    <div className="flex flex-wrap gap-1.5">
                      {understanding.researchModeTags!.map((tag) => (
                        <span key={tag} className="rounded-full bg-acadia-blue-50 px-2.5 py-1 text-2xs font-semibold text-acadia-blue">
                          {RESEARCH_MODE_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-2xs text-slate-400">Proposition à confirmer — jamais une classification définitive.</p>
                  </PreviewRow>
                )}

                {understanding.problem && (
                  <PreviewRow icon={Puzzle} label="Problème proposé">
                    <p className="text-sm leading-relaxed text-slate-700">{understanding.problem}</p>
                  </PreviewRow>
                )}

                {understanding.researchQuestion && (
                  <PreviewRow icon={HelpCircle} label="Question de recherche">
                    <p className="text-sm font-medium italic leading-relaxed text-acadia-navy">{understanding.researchQuestion}</p>
                  </PreviewRow>
                )}

                {understanding.generalObjective && (
                  <PreviewRow icon={Target} label="Objectif général">
                    <p className="text-sm leading-relaxed text-slate-700">{understanding.generalObjective}</p>
                  </PreviewRow>
                )}

                {(understanding.specificObjectives?.length ?? 0) > 0 && (
                  <PreviewRow icon={ListChecks} label="Objectifs spécifiques">
                    <ol className="space-y-1 text-sm text-slate-700">
                      {understanding.specificObjectives!.map((item, i) => (
                        <li key={item} className="flex gap-2">
                          <span className="font-mono text-xs text-slate-400">{i + 1}.</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                  </PreviewRow>
                )}

                {recommendedInstrument?.value && (
                  <PreviewRow icon={ClipboardList} label="Méthodologie et instrument probables">
                    <p className="text-sm leading-relaxed text-slate-700">{recommendedInstrument.value}</p>
                    {recommendedInstrument.justification && (
                      <p className="mt-1 text-xs text-slate-400">{recommendedInstrument.justification}</p>
                    )}
                  </PreviewRow>
                )}
              </div>

              {(understanding.phenomenonTable?.length ?? 0) > 0 && (
                <div className="mt-5">
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
                        </tr>
                      </thead>
                      <tbody>
                        {understanding.phenomenonTable!.map((row, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-semibold text-acadia-navy">{row.indicator}</td>
                            <td className="px-3 py-2 text-slate-600">{row.requiredData}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                                  row.status === "SOURCED"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : row.status === "MISSING"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-amber-50 text-amber-700"
                                }`}
                                title={row.provenance || undefined}
                              >
                                {row.status === "MISSING" ? "Donnée à rechercher" : row.status}
                              </span>
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

              {(() => {
                const norm = (s: string) => s.trim().toLowerCase();
                const taken = new Set([understanding.population, understanding.location].filter(Boolean).map((s) => norm(s!)));
                const concepts = (understanding.mainConcepts ?? []).filter((c) => !taken.has(norm(c)));

                return (
                  <>
                    {concepts.length > 0 && (
                      <div className="mt-5">
                        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-acadia-blue">
                          <Tags className="h-3.5 w-3.5" /> Variables / concepts principaux
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {concepts.map((concept) => (
                            <span key={concept} className="rounded-full bg-acadia-blue-50 px-3 py-1 text-xs font-semibold text-acadia-blue">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(understanding.population || understanding.location) && (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {understanding.population && (
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
                              <Users className="h-3 w-3" /> Population
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-acadia-navy">{understanding.population}</p>
                          </div>
                        )}
                        {understanding.location && (
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
                              <MapPin className="h-3 w-3" /> Terrain
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-acadia-navy">{understanding.location}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="mt-7">
                <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Comment nous allons nous organiser</p>
                <ol className="mt-3 space-y-3">
                  {NEXT_STEPS.map((step, i) => (
                    <li key={step.label} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acadia-blue-50 font-mono text-xs font-bold text-acadia-blue">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-acadia-navy">{step.label}</p>
                        <p className="text-xs text-slate-500">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {(understanding.pointsToConfirm?.length ?? 0) > 0 && (
                <div className="mt-7 rounded-2xl bg-amber-50/60 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <MessageCircleQuestion className="h-3.5 w-3.5" /> Ce qui reste à vérifier
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-800">
                    {understanding.pointsToConfirm!.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-7 flex items-start gap-2.5 rounded-2xl bg-emerald-50/70 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  En créant votre compte, ACADIA garde cette base intacte et vous guide directement vers la suite —
                  sans jamais repartir de zéro.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 border-t border-slate-100 pt-6 sm:flex-row">
                <button
                  type="button"
                  onClick={handleUse}
                  className="bg-acadia-gradient flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-acadia-blue/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  Utiliser cette proposition
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleModify}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  Modifier mon sujet
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Sparkles;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
