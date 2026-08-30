"use client";

// ============================================================
// ACADIA SURVEY — Centre de pilotage des résultats
//
// DONNÉES / ANALYSE / INTERPRÉTATION restent distinctes : cette page
// affiche uniquement des statistiques calculées à partir des réponses
// réelles (SurveyAnalyticsEngine côté serveur), jamais une valeur
// inventée. Filtres combinables recalculés côté serveur — jamais
// toutes les réponses chargées en mémoire côté client. Le pont vers
// une lecture méthodologique ACADIA n'est pas construit dans cette
// itération (chaque question conserve déjà variable/indicator/section
// pour l'alimenter plus tard).
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users2, ExternalLink, Share2, Download, Search, X, ChevronDown, ChevronUp, Sparkles, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { SurveyQuestionFrequency, SurveyStats } from "@/lib/core/survey/SurveyTypes";

interface Breakdown {
  label: string;
  count: number;
  percent: number;
}

interface FilterValues {
  institutions: string[];
  faculties: string[];
  levels: string[];
  hasAge: boolean;
  categories: { id: string; label: string }[];
}

interface FrequencyWithMeta extends SurveyQuestionFrequency {
  variable?: string;
  indicator?: string;
  section?: string;
}

interface StatsResponse {
  stats: SurveyStats;
  frequencies: FrequencyWithMeta[];
  breakdowns: {
    institution: Breakdown[];
    faculty: Breakdown[];
    level: Breakdown[];
    category: Breakdown[];
    ageBucket: Breakdown[];
  };
  timeline: { date: string; count: number }[];
  filterValues: FilterValues;
}

interface OpenAnswer {
  id: string;
  text: string;
  createdAt: string;
  institution?: string;
  faculty?: string;
  category?: string;
}

const AGE_BUCKET_OPTIONS = [
  { key: "18-20", label: "18–20" },
  { key: "21-24", label: "21–24" },
  { key: "25-29", label: "25–29" },
  { key: "30+", label: "30+" },
];

const OPEN_TYPES = new Set(["short_text", "long_text"]);
const MULTI_SELECT_TYPES = new Set(["multiple_choice"]);

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD} j`;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function BarList({ items, emptyLabel }: { items: Breakdown[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="min-w-0 truncate pr-2">{d.label}</span>
            <span className="shrink-0 font-semibold">{d.count} ({d.percent}%)</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-acadia-blue" style={{ width: `${Math.min(100, d.percent)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OpenQuestionAnswers({ surveyId, questionId }: { surveyId: string; questionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; answers: OpenAnswer[] } | null>(null);

  const load = useCallback(
    async (p: number, s: string) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(p) });
        if (s) qs.set("search", s);
        const res = await fetch(`/api/survey/${surveyId}/questions/${questionId}/answers?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    },
    [surveyId, questionId]
  );

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data) load(1, "");
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} className="inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? "Masquer les réponses" : "Voir les réponses"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === "Enter" && load(1, search)}
              placeholder="Rechercher dans les réponses..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs focus:border-acadia-blue focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => load(1, search)} className="mt-2 text-2xs font-semibold text-acadia-blue">
            Rechercher
          </button>

          {loading ? (
            <p className="mt-3 text-xs text-slate-400">Chargement...</p>
          ) : !data || data.answers.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Aucune réponse.</p>
          ) : (
            <>
              <p className="mt-3 text-2xs text-slate-400">{data.total} réponse{data.total > 1 ? "s" : ""}</p>
              <div className="mt-2 space-y-2">
                {data.answers.map((a) => (
                  <div key={a.id} className="rounded-lg bg-white p-2.5 text-xs text-slate-700">
                    <p>{a.text}</p>
                    {(a.institution || a.faculty || a.category) && (
                      <p className="mt-1 text-2xs text-slate-400">{[a.category, a.institution, a.faculty].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                ))}
              </div>
              {data.total > data.pageSize && (
                <div className="mt-3 flex items-center justify-between text-2xs text-slate-500">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      const p = page - 1;
                      setPage(p);
                      load(p, search);
                    }}
                    className="font-semibold text-acadia-blue disabled:text-slate-300"
                  >
                    Précédent
                  </button>
                  <span>Page {page}</span>
                  <button
                    type="button"
                    disabled={page * data.pageSize >= data.total}
                    onClick={() => {
                      const p = page + 1;
                      setPage(p);
                      load(p, search);
                    }}
                    className="font-semibold text-acadia-blue disabled:text-slate-300"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type CompareByValue = "institution" | "faculty" | "level" | "ageBucket" | "category";

const CROSSTAB_TYPES = new Set(["single_choice", "multiple_choice", "scale", "boolean", "category"]);

const COMPARE_BY_LABELS: Record<CompareByValue, string> = {
  institution: "Institution",
  faculty: "Faculté / École",
  level: "Niveau d'étude",
  ageBucket: "Tranche d'âge",
  category: "Catégorie",
};

const INTERPRET_LOADING_CAPTIONS = [
  "ACADIA examine vos résultats...",
  "ACADIA identifie les principales tendances...",
  "ACADIA prépare votre synthèse...",
];

interface CrosstabResult {
  rowLabels: string[];
  colLabels: string[];
  matrix: number[][];
  percents: number[][];
  colTotals: Record<string, number>;
  sampleSize: number;
  smallSampleColumns: string[];
  isMultiSelect: boolean;
  variable?: string;
  indicator?: string;
  section?: string;
  questionText: string;
}

interface InterpretationResult {
  summary: string;
  findings: string[];
  trends: string[];
  comparisons: string[];
  attentionPoints: string[];
  interpretation: string[];
  recommendations: string[];
  limitations: string[];
}

interface InterpretPayload {
  questionId?: string;
  compareBy?: CompareByValue;
  filters: {
    institution?: string;
    faculty?: string;
    level?: string;
    ageBucket?: string;
    categoryId?: string;
  };
}

const INTERPRETATION_SECTIONS: { key: keyof InterpretationResult; title: string }[] = [
  { key: "findings", title: "Principaux constats" },
  { key: "trends", title: "Tendances observées" },
  { key: "comparisons", title: "Comparaisons" },
  { key: "attentionPoints", title: "Points d'attention" },
  { key: "interpretation", title: "Interprétation" },
  { key: "recommendations", title: "Recommandations" },
  { key: "limitations", title: "Limites" },
];

function InterpretPanel({
  surveyId,
  payload,
  sampleSize,
  filtersDescription,
  contextLabel,
  onInterpreted,
}: {
  surveyId: string;
  payload: InterpretPayload;
  sampleSize: number;
  filtersDescription: string;
  contextLabel?: string;
  onInterpreted?: (result: { interpretation: InterpretationResult; contextLabel?: string; filtersDescription: string }) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<{ interpretation: InterpretationResult; smallSample: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const captionInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    captionInterval.current = setInterval(() => {
      setCaptionIndex((i) => (i + 1) % INTERPRET_LOADING_CAPTIONS.length);
    }, 2200);
    return () => {
      if (captionInterval.current) clearInterval(captionInterval.current);
    };
  }, [status]);

  async function trigger() {
    setCaptionIndex(0);
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/survey/${surveyId}/interpret`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(json?.error || "ACADIA n'a pas pu terminer l'analyse.");
        setStatus("error");
        return;
      }
      setResult({ interpretation: json.interpretation, smallSample: Boolean(json.smallSample) });
      setStatus("success");
      onInterpreted?.({ interpretation: json.interpretation, contextLabel, filtersDescription });
    } catch {
      setErrorMsg("ACADIA n'a pas pu terminer l'analyse.");
      setStatus("error");
    }
  }

  const notEnoughData = errorMsg === "Votre enquête ne contient pas encore suffisamment de réponses pour produire une interprétation.";

  return (
    <div className="rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/40 p-5">
      {status !== "success" && (
        <>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-acadia-blue" />
            <p className="text-sm font-bold text-acadia-navy">Interpréter avec ACADIA</p>
          </div>
          {contextLabel && <p className="mt-1 text-xs font-semibold text-slate-600">{contextLabel}</p>}
          <p className="mt-1 text-2xs text-slate-500">
            {sampleSize > 0 ? `Analyse basée sur ${sampleSize} répondant${sampleSize > 1 ? "s" : ""}.` : "Analyse basée sur l'ensemble des réponses."}
            {" "}
            {filtersDescription.startsWith("Aucun filtre") ? filtersDescription : `Filtres actifs : ${filtersDescription}`}
          </p>
        </>
      )}

      {status === "idle" && (
        <button
          type="button"
          onClick={trigger}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-4 py-2 text-xs font-semibold text-white hover:bg-acadia-blue-dark"
        >
          <Sparkles className="h-3.5 w-3.5" /> Interpréter avec ACADIA →
        </button>
      )}

      {status === "loading" && (
        <div className="mt-3">
          <button type="button" disabled className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-4 py-2 text-xs font-semibold text-white opacity-80">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse en cours...
          </button>
          <p className="mt-2 text-2xs italic text-slate-500">{INTERPRET_LOADING_CAPTIONS[captionIndex]}</p>
        </div>
      )}

      {status === "error" && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {notEnoughData ? errorMsg : "ACADIA n'a pas pu terminer l'analyse."}
          </p>
          {notEnoughData ? (
            <Link href={`/dashboard/survey/${surveyId}#diffusion`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue hover:underline">
              <Share2 className="h-3.5 w-3.5" /> Partager l&apos;enquête
            </Link>
          ) : (
            <button type="button" onClick={trigger} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">
              <RefreshCw className="h-3.5 w-3.5" /> Réessayer
            </button>
          )}
        </div>
      )}

      {status === "success" && result && (
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-acadia-blue" />
            <p className="text-sm font-bold text-acadia-navy">ACADIA a analysé les résultats.</p>
          </div>
          {contextLabel && <p className="mt-1 text-xs font-semibold text-slate-600">{contextLabel}</p>}
          {result.smallSample && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-2xs font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Cette interprétation repose sur un nombre limité de réponses.
            </p>
          )}

          <div className="mt-4 rounded-xl bg-white p-4">
            <p className="text-2xs font-bold uppercase tracking-wide text-acadia-blue">Synthèse</p>
            <p className="mt-1.5 text-xs text-slate-700">{result.interpretation.summary}</p>
          </div>

          {INTERPRETATION_SECTIONS.map(({ key, title }) => {
            const items = result.interpretation[key] as string[];
            if (!items || items.length === 0) return null;
            return (
              <div key={key} className="mt-3 rounded-xl bg-white p-4">
                <p className="text-2xs font-bold uppercase tracking-wide text-acadia-blue">{title}</p>
                <ul className="mt-1.5 space-y-1.5 text-xs text-slate-700">
                  {items.map((item, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-acadia-blue">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <button type="button" onClick={() => { setStatus("idle"); setResult(null); }} className="mt-3 text-2xs font-semibold text-slate-400 hover:text-acadia-blue">
            Nouvelle interprétation
          </button>
        </div>
      )}
    </div>
  );
}

export default function SurveyAnalyticsPage() {
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;

  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const [institution, setInstitution] = useState("");
  const [faculty, setFaculty] = useState("");
  const [level, setLevel] = useState("");
  const [ageBucket, setAgeBucket] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [analyzeQuestionId, setAnalyzeQuestionId] = useState("");
  const [analyzeCompareBy, setAnalyzeCompareBy] = useState<CompareByValue | "">("");
  const [crosstab, setCrosstab] = useState<CrosstabResult | null>(null);
  const [crosstabLoading, setCrosstabLoading] = useState(false);
  const [crosstabError, setCrosstabError] = useState<string | null>(null);

  // Dernière interprétation ACADIA obtenue sur cette page (vue d'ensemble ou
  // croisement), utilisée par le rapport PDF (P22) si l'utilisateur en a
  // généré une — jamais persistée, jamais inventée si aucune n'existe.
  const [lastInterpretation, setLastInterpretation] = useState<{ interpretation: InterpretationResult; contextLabel?: string; filtersDescription: string } | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (institution) qs.set("institution", institution);
      if (faculty) qs.set("faculty", faculty);
      if (level) qs.set("level", level);
      if (ageBucket) qs.set("ageBucket", ageBucket);
      if (categoryId) qs.set("categoryId", categoryId);
      const res = await fetch(`/api/survey/${surveyId}/stats?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "Cette enquête ne vous appartient pas." : "Impossible de charger les statistiques.");
        return;
      }
      const json = await res.json();
      setData(json);
      setLastLoadedAt(Date.now());
    } catch {
      setError("Impossible de contacter le serveur.");
    }
  }, [surveyId, institution, faculty, level, ageBucket, categoryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (institution) chips.push({ key: "institution", label: institution, clear: () => setInstitution("") });
    if (faculty) chips.push({ key: "faculty", label: faculty, clear: () => setFaculty("") });
    if (level) chips.push({ key: "level", label: level, clear: () => setLevel("") });
    if (ageBucket) chips.push({ key: "age", label: AGE_BUCKET_OPTIONS.find((b) => b.key === ageBucket)?.label ?? ageBucket, clear: () => setAgeBucket("") });
    if (categoryId) chips.push({ key: "category", label: data?.filterValues.categories.find((c) => c.id === categoryId)?.label ?? "Catégorie", clear: () => setCategoryId("") });
    return chips;
  }, [institution, faculty, level, ageBucket, categoryId, data]);

  function resetFilters() {
    setInstitution("");
    setFaculty("");
    setLevel("");
    setAgeBucket("");
    setCategoryId("");
  }

  const maxTimelineCount = data ? Math.max(1, ...data.timeline.map((t) => t.count)) : 1;

  const compareByOptions = useMemo(() => {
    if (!data) return [] as { value: CompareByValue; label: string }[];
    const opts: { value: CompareByValue; label: string }[] = [];
    if (data.filterValues.institutions.length > 0) opts.push({ value: "institution", label: COMPARE_BY_LABELS.institution });
    if (data.filterValues.faculties.length > 0) opts.push({ value: "faculty", label: COMPARE_BY_LABELS.faculty });
    if (data.filterValues.levels.length > 0) opts.push({ value: "level", label: COMPARE_BY_LABELS.level });
    if (data.filterValues.hasAge) opts.push({ value: "ageBucket", label: COMPARE_BY_LABELS.ageBucket });
    if (data.filterValues.categories.length > 0) opts.push({ value: "category", label: COMPARE_BY_LABELS.category });
    return opts;
  }, [data]);

  const analyzableQuestions = useMemo(
    () => (data ? data.frequencies.filter((f) => CROSSTAB_TYPES.has(f.type) && f.respondentCount > 0) : []),
    [data]
  );

  const filtersDescription = useMemo(() => {
    const parts: string[] = [];
    if (institution) parts.push(`Institution = ${institution}`);
    if (faculty) parts.push(`Faculté = ${faculty}`);
    if (level) parts.push(`Niveau = ${level}`);
    if (ageBucket) parts.push(`Tranche d'âge = ${AGE_BUCKET_OPTIONS.find((b) => b.key === ageBucket)?.label ?? ageBucket}`);
    if (categoryId) parts.push(`Catégorie = ${data?.filterValues.categories.find((c) => c.id === categoryId)?.label ?? "Catégorie"}`);
    return parts.length > 0 ? parts.join(", ") : "Aucun filtre — analyse basée sur l'ensemble des réponses.";
  }, [institution, faculty, level, ageBucket, categoryId, data]);

  const activeFiltersPayload = useMemo(
    () => ({
      institution: institution || undefined,
      faculty: faculty || undefined,
      level: level || undefined,
      ageBucket: ageBucket || undefined,
      categoryId: categoryId || undefined,
    }),
    [institution, faculty, level, ageBucket, categoryId]
  );

  async function runCrosstab() {
    if (!analyzeQuestionId || !analyzeCompareBy) return;
    setCrosstabLoading(true);
    setCrosstabError(null);
    setCrosstab(null);
    try {
      const qs = new URLSearchParams({ questionId: analyzeQuestionId, compareBy: analyzeCompareBy });
      if (institution) qs.set("institution", institution);
      if (faculty) qs.set("faculty", faculty);
      if (level) qs.set("level", level);
      if (ageBucket) qs.set("ageBucket", ageBucket);
      if (categoryId) qs.set("categoryId", categoryId);
      const res = await fetch(`/api/survey/${surveyId}/crosstab?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setCrosstabError(json?.error || "Impossible de calculer ce croisement.");
        return;
      }
      setCrosstab(json);
    } catch {
      setCrosstabError("Impossible de contacter le serveur.");
    } finally {
      setCrosstabLoading(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportCsvOrExcel(kind: "csv" | "excel") {
    setExportBusy(kind);
    setExportError(null);
    setExportMenuOpen(false);
    try {
      const qs = new URLSearchParams();
      if (institution) qs.set("institution", institution);
      if (faculty) qs.set("faculty", faculty);
      if (level) qs.set("level", level);
      if (ageBucket) qs.set("ageBucket", ageBucket);
      if (categoryId) qs.set("categoryId", categoryId);
      // Feuille "Croisements" incluse dans l'Excel uniquement si un tableau
      // croisé a réellement été calculé sur cette page (P21.3 — jamais de
      // données fictives).
      if (kind === "excel" && crosstab && analyzeQuestionId && analyzeCompareBy) {
        qs.set("questionId", analyzeQuestionId);
        qs.set("compareBy", analyzeCompareBy);
      }
      const res = await fetch(`/api/survey/${surveyId}/export/${kind}?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setExportError("Votre export n'a pas pu être préparé. Veuillez réessayer.");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, `export.${kind === "csv" ? "csv" : "xlsx"}`);
    } catch {
      setExportError("Votre export n'a pas pu être préparé. Veuillez réessayer.");
    } finally {
      setExportBusy(null);
    }
  }

  async function exportPdf(mode: "export" | "report") {
    const busyKey = mode === "report" ? "report" : "pdf";
    setExportBusy(busyKey);
    setExportError(null);
    setExportMenuOpen(false);
    try {
      const res = await fetch(`/api/survey/${surveyId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          filters: activeFiltersPayload,
          questionId: crosstab ? analyzeQuestionId : undefined,
          compareBy: crosstab ? analyzeCompareBy : undefined,
          interpretation: lastInterpretation?.interpretation,
          interpretationContextLabel: lastInterpretation?.contextLabel,
        }),
      });
      if (!res.ok) {
        setExportError(mode === "report" ? "Nous n'avons pas pu générer le rapport. Veuillez réessayer." : "Votre export n'a pas pu être préparé. Veuillez réessayer.");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, mode === "report" ? "rapport.pdf" : "export.pdf");
    } catch {
      setExportError(mode === "report" ? "Nous n'avons pas pu générer le rapport. Veuillez réessayer." : "Votre export n'a pas pu être préparé. Veuillez réessayer.");
    } finally {
      setExportBusy(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/dashboard/survey/${surveyId}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à l&apos;enquête
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-acadia-navy sm:text-3xl">Centre de pilotage</h1>
            {lastLoadedAt && <p className="mt-1 text-2xs text-slate-400">Actualisé automatiquement · dernière mise à jour {relativeTime(new Date(lastLoadedAt).toISOString())}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard/survey/${surveyId}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <ExternalLink className="h-3.5 w-3.5" /> Voir l&apos;enquête
            </Link>
            <Link href={`/dashboard/survey/${surveyId}#diffusion`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Share2 className="h-3.5 w-3.5" /> Partager
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={Boolean(exportBusy)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {exportBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {exportBusy === "report" ? "Génération du rapport..." : exportBusy ? "Préparation du fichier..." : "Exporter"}
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 z-10 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <p className="px-3 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-wide text-slate-400">Exporter les résultats</p>
                  <button type="button" onClick={() => exportCsvOrExcel("excel")} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Excel (.xlsx) — Résumé / Réponses / Statistiques
                  </button>
                  <button type="button" onClick={() => exportCsvOrExcel("csv")} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
                    CSV (.csv) — réponses filtrées
                  </button>
                  <button type="button" onClick={() => exportPdf("export")} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
                    PDF (.pdf) — export rapide
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => exportPdf("report")} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-acadia-blue hover:bg-acadia-blue-50">
                    Rapport d&apos;enquête complet (PDF)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-1.5 text-2xs text-slate-400">
          {activeFilterChips.length > 0 ? `Export basé sur ${data?.stats.totalResponses ?? 0} répondant${(data?.stats.totalResponses ?? 0) > 1 ? "s" : ""} — filtres actifs.` : "Export basé sur l'ensemble des réponses."}
        </p>
        {exportError && <p className="mt-1 text-2xs font-semibold text-red-600">{exportError}</p>}

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        {!data ? (
          <p className="mt-8 text-sm text-slate-400">Chargement...</p>
        ) : data.stats.totalResponses === 0 && activeFilterChips.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Users2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Les réponses apparaîtront ici dès que votre enquête commencera à être diffusée.</p>
            <Link href={`/dashboard/survey/${surveyId}#diffusion`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-acadia-blue-dark">
              <Share2 className="h-4 w-4" /> Partager l&apos;enquête
            </Link>
          </div>
        ) : (
          <>
            {/* KPI */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Réponses", value: data.stats.totalResponses },
                { label: "Taux de complétion", value: data.stats.completionRate !== undefined ? `${data.stats.completionRate}%` : "—" },
                { label: "Aujourd'hui", value: data.stats.todayResponses },
                { label: "Dernière réponse", value: relativeTime(data.stats.lastResponseAt) },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                  <p className="mt-1.5 text-2xl font-black text-acadia-navy">{c.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-2xs text-slate-400">
              Taux de complétion : part moyenne des réponses ayant renseigné chaque question obligatoire actuelle de l&apos;enquête.
            </p>

            {data.stats.totalResponses > 0 && (
              <div className="mt-4">
                <InterpretPanel
                  surveyId={surveyId}
                  payload={{ filters: activeFiltersPayload }}
                  sampleSize={data.stats.totalResponses}
                  filtersDescription={filtersDescription}
                  contextLabel="Vue d'ensemble de l'enquête"
                  onInterpreted={setLastInterpretation}
                />
              </div>
            )}

            {/* Filtres */}
            {(data.filterValues.institutions.length > 0 ||
              data.filterValues.faculties.length > 0 ||
              data.filterValues.levels.length > 0 ||
              data.filterValues.hasAge ||
              data.filterValues.categories.length > 0) && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {data.filterValues.institutions.length > 0 && (
                    <select value={institution} onChange={(e) => setInstitution(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <option value="">Institution</option>
                      {data.filterValues.institutions.map((i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  )}
                  {data.filterValues.faculties.length > 0 && (
                    <select value={faculty} onChange={(e) => setFaculty(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <option value="">Faculté / École</option>
                      {data.filterValues.faculties.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  )}
                  {data.filterValues.levels.length > 0 && (
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <option value="">Niveau d&apos;étude</option>
                      {data.filterValues.levels.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  )}
                  {data.filterValues.hasAge && (
                    <select value={ageBucket} onChange={(e) => setAgeBucket(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <option value="">Tranche d&apos;âge</option>
                      {AGE_BUCKET_OPTIONS.map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </select>
                  )}
                  {data.filterValues.categories.length > 0 && (
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <option value="">Catégorie</option>
                      {data.filterValues.categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {activeFilterChips.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {activeFilterChips.map((chip) => (
                      <span key={chip.key} className="inline-flex items-center gap-1 rounded-full bg-acadia-blue-50 px-2.5 py-1 text-2xs font-semibold text-acadia-blue">
                        {chip.label}
                        <button type="button" onClick={chip.clear} aria-label={`Retirer le filtre ${chip.label}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <button type="button" onClick={resetFilters} className="text-2xs font-semibold text-slate-400 hover:text-red-500">
                      Réinitialiser les filtres
                    </button>
                  </div>
                )}
              </div>
            )}

            {data.stats.totalResponses === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
                Aucune réponse ne correspond à ces filtres.
              </p>
            ) : (
              <>
                {/* Évolution */}
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-bold text-acadia-navy">Évolution des réponses (30 derniers jours)</p>
                  <div className="mt-4 flex h-32 items-end gap-1 overflow-x-auto">
                    {data.timeline.map((t) => (
                      <div key={t.date} className="flex min-w-[8px] flex-1 flex-col items-center justify-end" title={`${formatDay(t.date)} : ${t.count}`}>
                        <div className="w-full rounded-t bg-acadia-blue" style={{ height: `${(t.count / maxTimelineCount) * 100}%`, minHeight: t.count > 0 ? "3px" : "0" }} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-2xs text-slate-400">
                    <span>{formatDay(data.timeline[0]?.date)}</span>
                    <span>{formatDay(data.timeline[data.timeline.length - 1]?.date)}</span>
                  </div>
                </div>

                {/* Répartitions */}
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {data.breakdowns.institution.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-acadia-navy">Répartition par institution</p>
                      <div className="mt-3">
                        <BarList items={data.breakdowns.institution} emptyLabel="Aucune donnée." />
                      </div>
                    </div>
                  )}
                  {data.breakdowns.faculty.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-acadia-navy">Répartition par faculté / école</p>
                      <div className="mt-3">
                        <BarList items={data.breakdowns.faculty} emptyLabel="Aucune donnée." />
                      </div>
                    </div>
                  )}
                  {data.breakdowns.level.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-acadia-navy">Répartition par niveau d&apos;étude</p>
                      <div className="mt-3">
                        <BarList items={data.breakdowns.level} emptyLabel="Aucune donnée." />
                      </div>
                    </div>
                  )}
                  {data.breakdowns.ageBucket.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-acadia-navy">Répartition par tranche d&apos;âge</p>
                      <div className="mt-3">
                        <BarList items={data.breakdowns.ageBucket} emptyLabel="Aucune donnée." />
                      </div>
                    </div>
                  )}
                  {data.breakdowns.category.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-sm font-bold text-acadia-navy">Répartition par catégorie de répondant</p>
                      <div className="mt-3">
                        <BarList items={data.breakdowns.category} emptyLabel="Aucune donnée." />
                      </div>
                    </div>
                  )}
                </div>

                {/* Analyser les résultats (P20-A) */}
                {analyzableQuestions.length > 0 && compareByOptions.length > 0 && (
                  <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-acadia-navy">Analyser les résultats</p>
                        <p className="mt-1 text-xs text-slate-500">Explorez vos données, comparez les groupes et identifiez les principales tendances.</p>
                      </div>
                      {!analyzeOpen && (
                        <button
                          type="button"
                          onClick={() => setAnalyzeOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-4 py-2 text-xs font-semibold text-white hover:bg-acadia-blue-dark"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Nouvelle analyse
                        </button>
                      )}
                    </div>

                    {analyzeOpen && (
                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-2xs font-semibold text-slate-500">Variable</label>
                            <select
                              value={analyzeQuestionId}
                              onChange={(e) => {
                                setAnalyzeQuestionId(e.target.value);
                                setCrosstab(null);
                                setCrosstabError(null);
                              }}
                              className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              <option value="">Sélectionner...</option>
                              {analyzableQuestions.map((q) => (
                                <option key={q.questionId} value={q.questionId}>{q.variable || q.questionText}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-2xs font-semibold text-slate-500">Comparer par</label>
                            <select
                              value={analyzeCompareBy}
                              onChange={(e) => {
                                setAnalyzeCompareBy(e.target.value as CompareByValue);
                                setCrosstab(null);
                                setCrosstabError(null);
                              }}
                              className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              <option value="">Sélectionner...</option>
                              {compareByOptions.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            disabled={!analyzeQuestionId || !analyzeCompareBy || crosstabLoading}
                            onClick={runCrosstab}
                            className="rounded-xl bg-acadia-blue px-4 py-2 text-xs font-semibold text-white hover:bg-acadia-blue-dark disabled:opacity-50"
                          >
                            {crosstabLoading ? "Calcul..." : "Lancer l'analyse"}
                          </button>
                        </div>

                        {crosstabError && <p className="mt-3 text-xs font-semibold text-red-600">{crosstabError}</p>}

                        {crosstab && crosstab.rowLabels.length > 0 && (
                          <div className="mt-5">
                            <p className="text-xs font-semibold text-slate-600">
                              {(crosstab.variable || crosstab.questionText)} × {COMPARE_BY_LABELS[analyzeCompareBy as CompareByValue]}
                            </p>
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[480px] border-collapse text-xs">
                                <thead>
                                  <tr>
                                    <th className="border-b border-slate-200 p-2 text-left font-semibold text-slate-500"> </th>
                                    {crosstab.colLabels.map((c) => (
                                      <th key={c} className="border-b border-slate-200 p-2 text-left font-semibold text-slate-500">
                                        {c}
                                        <span className="block text-2xs font-normal text-slate-400">n={crosstab.colTotals[c]}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {crosstab.rowLabels.map((r, ri) => (
                                    <tr key={r} className="border-b border-slate-100">
                                      <td className="p-2 font-medium text-slate-700">{r}</td>
                                      {crosstab.colLabels.map((c, ci) => (
                                        <td key={c} className="p-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-acadia-navy">{crosstab.percents[ri][ci]}%</span>
                                            <span className="text-2xs text-slate-400">({crosstab.matrix[ri][ci]})</span>
                                          </div>
                                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-acadia-blue" style={{ width: `${Math.min(100, crosstab.percents[ri][ci])}%` }} />
                                          </div>
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {crosstab.isMultiSelect && (
                              <p className="mt-2 text-2xs italic text-slate-400">Plusieurs réponses possibles — les pourcentages de chaque colonne ne totalisent pas nécessairement 100 %.</p>
                            )}
                            {crosstab.smallSampleColumns.length > 0 && (
                              <p className="mt-2 flex items-center gap-1.5 text-2xs font-medium text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Échantillon faible pour : {crosstab.smallSampleColumns.join(", ")} — à interpréter avec prudence.
                              </p>
                            )}

                            <div className="mt-5 border-t border-slate-100 pt-5">
                              <InterpretPanel
                                surveyId={surveyId}
                                payload={{ questionId: analyzeQuestionId, compareBy: analyzeCompareBy as CompareByValue, filters: activeFiltersPayload }}
                                sampleSize={crosstab.sampleSize}
                                filtersDescription={filtersDescription}
                                contextLabel={`${crosstab.variable || crosstab.questionText} × ${COMPARE_BY_LABELS[analyzeCompareBy as CompareByValue]}`}
                                onInterpreted={setLastInterpretation}
                              />
                            </div>
                          </div>
                        )}

                        {crosstab && crosstab.rowLabels.length === 0 && (
                          <p className="mt-4 text-xs text-slate-400">Aucune donnée ne correspond à ce croisement pour la sélection actuelle.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Résultats par question */}
                <div className="mt-8 space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-acadia-navy">Résultats par question</p>
                    <Link href={`/dashboard/survey/${surveyId}/responses`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue hover:underline">
                      <Users2 className="h-3.5 w-3.5" /> Voir toutes les réponses
                    </Link>
                  </div>

                  {data.frequencies
                    .filter((f) => f.respondentCount > 0)
                    .map((f) => (
                      <div key={f.questionId} className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-acadia-navy">{f.questionText}</p>
                          <span className="text-2xs text-slate-400">{f.respondentCount} réponse{f.respondentCount > 1 ? "s" : ""}</span>
                        </div>
                        {MULTI_SELECT_TYPES.has(f.type) && (
                          <p className="mt-1 text-2xs italic text-slate-400">Plusieurs réponses possibles — les pourcentages ne totalisent pas nécessairement 100 %.</p>
                        )}
                        {(f.average !== undefined || f.median !== undefined) && (
                          <p className="mt-1 text-xs text-slate-400">
                            {f.average !== undefined && `Moyenne : ${f.average}`}
                            {f.average !== undefined && f.median !== undefined && " · "}
                            {f.median !== undefined && `Médiane : ${f.median}`}
                          </p>
                        )}

                        {OPEN_TYPES.has(f.type) ? (
                          <OpenQuestionAnswers surveyId={surveyId} questionId={f.questionId} />
                        ) : (
                          <div className="mt-3">
                            <BarList items={f.distribution} emptyLabel="Aucune donnée." />
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
