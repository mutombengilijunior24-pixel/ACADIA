"use client";

// ============================================================
// ACADIA — TABLEAU DE BORD PRODUIT (admin) — Bloc 2, 08/09/2026
//
// Vue minimale unique (pas un second système d'administration) :
// utilisateurs/parcours, funnel (comptages réels, jamais de cause
// déduite — mission §13/§23), erreurs, problèmes, suggestions,
// feedback. Protégée côté API par requireAdmin() sur chaque route
// (voir app/api/admin/product/*) — cette page se contente d'afficher
// un message clair si l'accès est refusé.
// ============================================================

import { useCallback, useEffect, useState } from "react";

type Overview = {
  usersRegistered: number;
  usersActive7d: number;
  usersNew7d: number;
  projectsCreated: number;
  questionnairesPublished: number;
  responsesCollected: number;
};

type FunnelStep = { key: string; label: string; userCount: number };

type ErrorRow = { id: string; entityId: string | null; metadata: string | null; timestamp: string };

type BugRow = {
  id: string;
  description: string;
  severity: string;
  status: string;
  page: string;
  step: string | null;
  category: string | null;
  createdAt: string;
  user: { firstName: string; email: string };
};

type FeatureRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  page: string | null;
  category: string | null;
  createdAt: string;
  user: { firstName: string; email: string };
};

type FeedbackRow = {
  id: string;
  type: string;
  message: string;
  page: string | null;
  category: string | null;
  createdAt: string;
  user: { firstName: string; email: string };
};

const BUG_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;
const FEATURE_STATUSES = ["SUBMITTED", "REVIEWING", "PLANNED", "IN_PROGRESS", "DONE", "DECLINED"] as const;

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "errors", label: "Erreurs" },
  { key: "bugs", label: "Problèmes" },
  { key: "features", label: "Suggestions" },
  { key: "feedback", label: "Feedback" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

export default function AdminProductDashboardPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [forbidden, setForbidden] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [bugs, setBugs] = useState<BugRow[] | null>(null);
  const [features, setFeatures] = useState<FeatureRow[] | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [bugStatusFilter, setBugStatusFilter] = useState("");
  const [featureStatusFilter, setFeatureStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    const res = await fetchJson<{ overview: Overview; funnel: FunnelStep[] }>("/api/admin/product/overview");
    if (!res.ok) return res.status === 403 ? setForbidden(true) : undefined;
    setOverview(res.data.overview);
    setFunnel(res.data.funnel);
  }, []);

  const loadErrors = useCallback(async () => {
    const res = await fetchJson<{ errors: ErrorRow[] }>("/api/admin/product/events");
    if (res.ok) setErrors(res.data.errors);
  }, []);

  const loadBugs = useCallback(async () => {
    const qs = bugStatusFilter ? `?status=${bugStatusFilter}` : "";
    const res = await fetchJson<{ bugs: BugRow[] }>(`/api/admin/product/bugs${qs}`);
    if (res.ok) setBugs(res.data.bugs);
  }, [bugStatusFilter]);

  const loadFeatures = useCallback(async () => {
    const qs = featureStatusFilter ? `?status=${featureStatusFilter}` : "";
    const res = await fetchJson<{ features: FeatureRow[] }>(`/api/admin/product/features${qs}`);
    if (res.ok) setFeatures(res.data.features);
  }, [featureStatusFilter]);

  const loadFeedback = useCallback(async () => {
    const res = await fetchJson<{ feedback: FeedbackRow[] }>("/api/admin/product/feedback");
    if (res.ok) setFeedback(res.data.feedback);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "errors") loadErrors();
    if (tab === "bugs") loadBugs();
    if (tab === "features") loadFeatures();
    if (tab === "feedback") loadFeedback();
  }, [tab, loadErrors, loadBugs, loadFeatures, loadFeedback]);

  async function updateBugStatus(id: string, status: string) {
    await fetch("/api/admin/product/bugs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    loadBugs();
  }

  async function updateFeatureStatus(id: string, status: string) {
    await fetch("/api/admin/product/features", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    loadFeatures();
  }

  if (forbidden) {
    return (
      <div className="p-8">
        <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Accès réservé aux administrateurs.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Tableau de bord produit</h1>
      <p className="mt-1 text-sm text-slate-500">
        Comportement réel mesuré + feedback utilisateur. Aucun chiffre inventé.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t.key ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="space-y-8">
            {loading && <p className="text-sm text-slate-500">Chargement...</p>}
            {overview && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Utilisateurs inscrits" value={overview.usersRegistered} />
                <Metric label="Actifs (7j)" value={overview.usersActive7d} />
                <Metric label="Nouveaux (7j)" value={overview.usersNew7d} />
                <Metric label="Projets créés" value={overview.projectsCreated} />
                <Metric label="Questionnaires publiés" value={overview.questionnairesPublished} />
                <Metric label="Réponses collectées" value={overview.responsesCollected} />
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-slate-800">Parcours (funnel)</h2>
              <p className="mt-1 text-xs text-slate-400">
                Abandon observé entre deux étapes — aucune cause n&apos;est déduite ici.
              </p>
              <div className="mt-3 space-y-2">
                {funnel.map((step, i) => {
                  const prev = i > 0 ? funnel[i - 1].userCount : step.userCount;
                  const abandoned = i > 0 ? Math.max(prev - step.userCount, 0) : 0;
                  const width = funnel[0]?.userCount ? Math.round((step.userCount / funnel[0].userCount) * 100) : 0;
                  return (
                    <div key={step.key} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{step.label}</span>
                        <span className="font-mono text-slate-500">{step.userCount} utilisateurs</span>
                      </div>
                      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                      </div>
                      {i > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          Abandon observé depuis l&apos;étape précédente : {abandoned} utilisateur(s).
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "errors" && (
          <Table
            columns={["Date", "Route/step", "Détail"]}
            rows={errors.map((e) => [
              new Date(e.timestamp).toLocaleString("fr-FR"),
              e.entityId ?? "—",
              e.metadata ?? "—",
            ])}
            empty="Aucune erreur signalée."
          />
        )}

        {tab === "bugs" && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-slate-500">Filtrer :</span>
              <select
                value={bugStatusFilter}
                onChange={(e) => setBugStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                <option value="">Tous les statuts</option>
                {BUG_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {(bugs ?? []).map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={b.severity} />
                      <span className="text-xs text-slate-400">{b.page}{b.step ? ` · ${b.step}` : ""}</span>
                    </div>
                    <select
                      value={b.status}
                      onChange={(e) => updateBugStatus(b.id, e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      {BUG_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{b.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {b.user?.firstName ?? "Utilisateur"} · {new Date(b.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
              {bugs && bugs.length === 0 && <p className="text-sm text-slate-500">Aucun problème signalé.</p>}
            </div>
          </div>
        )}

        {tab === "features" && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm text-slate-500">Filtrer :</span>
              <select
                value={featureStatusFilter}
                onChange={(e) => setFeatureStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              >
                <option value="">Tous les statuts</option>
                {FEATURE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {(features ?? []).map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{f.title}</span>
                    <select
                      value={f.status}
                      onChange={(e) => updateFeatureStatus(f.id, e.target.value)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    >
                      {FEATURE_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{f.description}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {f.user?.firstName ?? "Utilisateur"} · {new Date(f.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
              {features && features.length === 0 && <p className="text-sm text-slate-500">Aucune suggestion.</p>}
            </div>
          </div>
        )}

        {tab === "feedback" && (
          <Table
            columns={["Type", "Message", "Page", "Utilisateur", "Date"]}
            rows={(feedback ?? []).map((f) => [
              f.type,
              f.message,
              f.page ?? "—",
              f.user?.firstName ?? "—",
              new Date(f.createdAt).toLocaleString("fr-FR"),
            ])}
            empty="Aucun feedback."
          />
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const color =
    severity === "BLOCKER" ? "bg-red-100 text-red-700" :
    severity === "HIGH" ? "bg-orange-100 text-orange-700" :
    severity === "MEDIUM" ? "bg-amber-100 text-amber-700" :
    "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{severity}</span>;
}

function Table({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {row.map((cell, j) => (
                <td key={j} className="max-w-xs truncate px-3 py-2 text-slate-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
