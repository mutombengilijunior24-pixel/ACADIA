"use client";

// ============================================================
// ACADIA SURVEY — Détail / éditeur d'une enquête
//
// Brouillon : édition du questionnaire avant publication.
// Publiée : lien public + QR code + actions de partage + statut.
// Le frontend ne décide jamais qu'une modification est enregistrée —
// chaque action attend la confirmation du serveur avant de mettre à
// jour l'affichage.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Send,
  Copy,
  Check,
  Download,
  Users2,
  LineChart,
  PauseCircle,
  PlayCircle,
  XCircle,
  Loader2,
  ImagePlus,
} from "lucide-react";
import type { Survey, SurveyQuestion, SurveyQuestionType } from "@/lib/core/survey/SurveyTypes";

const QUESTION_TYPES: { value: SurveyQuestionType; label: string; hasOptions: boolean }[] = [
  { value: "short_text", label: "Texte court", hasOptions: false },
  { value: "long_text", label: "Texte long", hasOptions: false },
  { value: "single_choice", label: "Choix unique", hasOptions: true },
  { value: "multiple_choice", label: "Choix multiple", hasOptions: true },
  { value: "scale", label: "Échelle", hasOptions: true },
  { value: "boolean", label: "Oui / Non", hasOptions: false },
  { value: "number", label: "Nombre", hasOptions: false },
  { value: "age", label: "Âge", hasOptions: false },
  { value: "date", label: "Date", hasOptions: false },
  { value: "institution", label: "Institution", hasOptions: false },
  { value: "faculty", label: "Faculté / École", hasOptions: false },
  { value: "level", label: "Niveau d'étude", hasOptions: false },
  { value: "category", label: "Catégorie du répondant", hasOptions: true },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: "BROUILLON", className: "bg-slate-100 text-slate-600" },
  active: { label: "ACTIVE", className: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "SUSPENDUE", className: "bg-amber-100 text-amber-700" },
  closed: { label: "CLÔTURÉE", className: "bg-slate-200 text-slate-600" },
};

type EditableQuestion = SurveyQuestion & { _key: string };

let keySeed = 0;
function nextKey() {
  keySeed += 1;
  return `q_${keySeed}`;
}

export default function SurveyEditorPage() {
  const params = useParams<{ surveyId: string }>();
  const router = useRouter();
  const surveyId = params.surveyId;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/survey/${surveyId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(res.status === 403 ? "Cette enquête ne vous appartient pas." : "Enquête introuvable.");
        return;
      }
      const data = await res.json();
      setSurvey(data.survey);
      setQuestions((data.survey.questions as SurveyQuestion[]).map((q) => ({ ...q, _key: nextKey() })));
    } catch {
      setError("Impossible de charger l'enquête pour le moment.");
    }
  }, [surveyId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!survey?.publicId) {
      const t = setTimeout(() => setQrDataUrl(null), 0);
      return () => clearTimeout(t);
    }
    const url = `${window.location.origin}/s/${survey.publicId}`;
    QRCode.toDataURL(url, { margin: 1, width: 320 })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(null));
  }, [survey?.publicId]);

  function updateQuestion(key: string, patch: Partial<EditableQuestion>) {
    setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, ...patch } : q)));
  }

  function moveQuestion(key: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const idx = qs.findIndex((q) => q._key === key);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= qs.length) return qs;
      const next = [...qs];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((q, i) => ({ ...q, order: i }));
    });
  }

  function removeQuestion(key: string) {
    setQuestions((qs) => qs.filter((q) => q._key !== key).map((q, i) => ({ ...q, order: i })));
  }

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      {
        _key: nextKey(),
        id: "",
        order: qs.length,
        type: "short_text",
        text: "",
        required: false,
        options: [],
      },
    ]);
  }

  function addOption(key: string) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q._key !== key) return q;
        const order = q.options.length;
        return { ...q, options: [...q.options, { id: `tmp_${order}_${Date.now()}`, label: "", value: `option_${order}`, order }] };
      })
    );
  }

  function updateOption(key: string, optionId: string, label: string) {
    setQuestions((qs) =>
      qs.map((q) => (q._key === key ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, label } : o)) } : q))
    );
  }

  function removeOption(key: string, optionId: string) {
    setQuestions((qs) =>
      qs.map((q) => (q._key === key ? { ...q, options: q.options.filter((o) => o.id !== optionId) } : q))
    );
  }

  async function saveQuestions() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setWarnings([]);
    try {
      const payload = questions.map((q, i) => ({
        section: q.section,
        order: i,
        type: q.type,
        text: q.text,
        required: q.required,
        visibleForCategoryIds: q.visibleForCategoryIds,
        options: q.options.map((o, oi) => ({ label: o.label, value: o.value || `option_${oi}`, order: oi })),
      }));
      const res = await fetch(`/api/survey/${surveyId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible d'enregistrer le questionnaire.");
        return;
      }
      setSurvey(data.survey);
      setQuestions((data.survey.questions as SurveyQuestion[]).map((q) => ({ ...q, _key: nextKey() })));
      setWarnings(data.warnings ?? []);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${surveyId}/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de publier l'enquête.");
        return;
      }
      setSurvey(data.survey);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setPublishing(false);
    }
  }

  async function changeStatus(status: "active" | "suspended" | "closed") {
    if (statusChanging) return;
    setStatusChanging(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${surveyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de changer le statut.");
        return;
      }
      setSurvey(data.survey);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setStatusChanging(false);
    }
  }

  async function uploadLogo(file: File) {
    if (logoUploading) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch(`/api/survey/${surveyId}/logo`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogoError(data.error ?? "Impossible d'enregistrer le logo.");
        return;
      }
      setSurvey(data.survey);
    } catch {
      setLogoError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function removeLogo() {
    if (logoUploading) return;
    setLogoUploading(true);
    setLogoError(null);
    try {
      const res = await fetch(`/api/survey/${surveyId}/logo`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogoError(data.error ?? "Impossible de retirer le logo.");
        return;
      }
      setSurvey(data.survey);
    } catch {
      setLogoError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier le lien. Copiez-le manuellement.");
    }
  }

  if (error && !survey) {
    return (
      <div className="p-6 lg:p-8">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>
        <button type="button" onClick={() => router.push("/dashboard/survey")} className="mt-4 text-sm font-semibold text-acadia-blue">
          Retour à mes enquêtes
        </button>
      </div>
    );
  }

  if (!survey) {
    return <div className="p-6 lg:p-8 text-sm text-slate-400">Chargement...</div>;
  }

  const status = STATUS_LABEL[survey.status] ?? STATUS_LABEL.draft;
  const publicUrl = survey.publicId ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${survey.publicId}` : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/survey" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> Mes enquêtes
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-2xs font-bold tracking-wide ${status.className}`}>{status.label}</span>
            <h1 className="mt-2 text-2xl font-bold text-acadia-navy sm:text-3xl">{survey.title}</h1>
          </div>
          {survey.publicId && (
            <div className="flex gap-2">
              <Link href={`/dashboard/survey/${survey.id}/responses`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Users2 className="h-4 w-4" /> Réponses
              </Link>
              <Link href={`/dashboard/survey/${survey.id}/analytics`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <LineChart className="h-4 w-4" /> Analyses
              </Link>
            </div>
          )}
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-bold text-acadia-navy">Identité de l&apos;enquête</p>
          <p className="mt-1 text-xs text-slate-500">
            Le logo de l&apos;institution apparaît sur la page publique, l&apos;en-tête du questionnaire et l&apos;écran de confirmation.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {survey.institutionLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image d'institution servie dynamiquement par /api/survey/logo/[documentId]
              <img src={survey.institutionLogoUrl} alt="Logo de l'institution" className="h-16 w-auto max-w-[180px] rounded-xl border border-slate-100 object-contain p-1" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-200 text-2xs text-slate-400">
                Aucun logo
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {logoUploading ? "Envoi en cours..." : survey.institutionLogoUrl ? "Remplacer" : "Ajouter un logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={logoUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                    e.target.value = "";
                  }}
                />
              </label>
              {survey.institutionLogoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={logoUploading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Retirer
                </button>
              )}
            </div>
          </div>
          {logoError && <p className="mt-3 text-xs font-semibold text-red-600">{logoError}</p>}
          <p className="mt-3 text-2xs text-slate-400">PNG, JPG ou WEBP — 2 Mo maximum.</p>
        </div>

        {survey.publicId ? (
          <div id="diffusion" className="mt-6 scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-bold text-acadia-navy">Diffusion</p>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI généré à la volée, non optimisable par next/image
                <img src={qrDataUrl} alt="QR code de l'enquête" className="h-40 w-40 rounded-2xl border border-slate-200 sm:h-44 sm:w-44" />
              )}
              <div className="min-w-0 flex-1">
                <p className="break-all rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">{publicUrl}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => publicUrl && copyLink(publicUrl)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Lien copié" : "Copier le lien"}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(publicUrl ?? "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Partager sur WhatsApp
                  </a>
                  {qrDataUrl && (
                    <a
                      href={qrDataUrl}
                      download={`qr-${survey.publicId}.png`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" /> Télécharger le QR
                    </a>
                  )}
                  <Link
                    href={`/s/${survey.publicId}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Voir l&apos;enquête
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              {survey.status === "active" && (
                <button type="button" disabled={statusChanging} onClick={() => changeStatus("suspended")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                  {statusChanging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />} Suspendre
                </button>
              )}
              {survey.status === "suspended" && (
                <button type="button" disabled={statusChanging} onClick={() => changeStatus("active")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  {statusChanging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />} Réactiver
                </button>
              )}
              {survey.status !== "closed" && (
                <button type="button" disabled={statusChanging} onClick={() => changeStatus("closed")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  {statusChanging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Clôturer
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={publishing || questions.length === 0}
              onClick={publish}
              className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white hover:bg-acadia-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishing ? "Publication en cours..." : "Publier l'enquête"}
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-acadia-navy">Questionnaire ({questions.length} question{questions.length > 1 ? "s" : ""})</p>
            <button type="button" onClick={saveQuestions} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-acadia-blue disabled:opacity-50">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Enregistrement en cours..." : "Enregistrer les modifications"}
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              <p className="font-bold">Points signalés par le contrôle qualité :</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 space-y-4">
            {questions.map((q, i) => {
              const typeDef = QUESTION_TYPES.find((t) => t.value === q.type);
              return (
                <div key={q._key} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-2.5 shrink-0 text-2xs font-bold text-slate-300">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <input
                        value={q.text}
                        onChange={(e) => updateQuestion(q._key, { text: e.target.value })}
                        placeholder="Intitulé de la question"
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium focus:border-acadia-blue focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={q.type}
                          onChange={(e) => updateQuestion(q._key, { type: e.target.value as SurveyQuestionType })}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 focus:border-acadia-blue focus:outline-none"
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q._key, { required: e.target.checked })} className="h-3.5 w-3.5 rounded border-slate-300 text-acadia-blue" />
                          Obligatoire
                        </label>
                      </div>

                      {typeDef?.hasOptions && (
                        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                          {q.options.map((o) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <input
                                value={o.label}
                                onChange={(e) => updateOption(q._key, o.id, e.target.value)}
                                placeholder="Libellé de l'option"
                                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-acadia-blue focus:outline-none"
                              />
                              <button type="button" onClick={() => removeOption(q._key, o.id)} aria-label="Retirer l'option" className="text-slate-400 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addOption(q._key)} className="inline-flex items-center gap-1 text-xs font-semibold text-acadia-blue">
                            <Plus className="h-3 w-3" /> Ajouter une option
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button type="button" onClick={() => moveQuestion(q._key, -1)} disabled={i === 0} aria-label="Monter" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => moveQuestion(q._key, 1)} disabled={i === questions.length - 1} aria-label="Descendre" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => removeQuestion(q._key)} aria-label="Supprimer la question" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addQuestion}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-4 text-sm font-semibold text-slate-500 hover:border-acadia-blue hover:text-acadia-blue"
          >
            <Plus className="h-4 w-4" /> Ajouter une question
          </button>
        </div>
      </div>
    </div>
  );
}
