"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";

import { buttonClass, inputClass, Metric, Notice, Pill, Section, type Tone } from "@/components/data/ui";

interface Row {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: string;
  status: string;
  domain: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  institution: string | null;
  faculty: string | null;
  program: string | null;
  studyLevel: string | null;
  city: string | null;
  projects: number;
  interpretations: number;
  stageApplications: number;
}

interface Payload {
  users: Row[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; byRole: Record<string, number>; newLast7Days: number; newLast30Days: number; activeLast30Days: number };
}

const ROLES: Array<{ id: "all" | "student" | "supervisor" | "admin"; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "student", label: "Étudiants" },
  { id: "supervisor", label: "Directeurs" },
  { id: "admin", label: "Administrateurs" },
];
const ROLE_LABEL: Record<string, { label: string; tone: Tone }> = { student: { label: "Étudiant", tone: "blue" }, supervisor: { label: "Directeur", tone: "green" }, admin: { label: "Admin", tone: "yellow" } };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { timeZone: "Africa/Lubumbashi", dateStyle: "short", timeStyle: "short" }) : "—");

/** Comptes inscrits (administrateurs) : lecture seule, recherche, filtre par rôle, export CSV. */
export default function UsersAdmin() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]["id"]>("all");
  const [page, setPage] = useState(1);
  // Réponse de la dernière requête, avec la requête qui l'a produite (chargement = requête différente).
  const [result, setResult] = useState<{ key: string; data: Payload | null; error: string | null } | null>(null);

  const params = useCallback((extra: Record<string, string> = {}) => new URLSearchParams({ q: search, role, page: String(page), ...extra }).toString(), [search, role, page]);
  const key = params();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let res = await fetch(`/api/admin/users?${key}`, { cache: "no-store" });
        // Anti-rafale du serveur (deux clics rapprochés) : une seconde tentative, après une courte pause.
        if (res.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (cancelled) return;
          res = await fetch(`/api/admin/users?${key}`, { cache: "no-store" });
        }
        const body = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (cancelled) return;
        if (!res.ok) setResult({ key, data: null, error: res.status === 403 ? "Accès réservé aux administrateurs." : res.status === 401 ? "Connectez-vous avec un compte administrateur." : (body.error ?? `Erreur ${res.status}`) });
        else setResult({ key, data: body, error: null });
      } catch {
        if (!cancelled) setResult({ key, data: null, error: "Connexion au serveur impossible." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const loading = result?.key !== key;
  const data = result?.data ?? null;
  const error = result?.error ?? null;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Administration</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Comptes inscrits</h1>
        <p className="mt-1 text-sm text-slate-600">Lecture seule. Les mots de passe ne sont jamais affichés ; les contenus des projets non plus.</p>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Comptes" value={data.stats.total} />
          <Metric label="Étudiants" value={data.stats.byRole.student ?? 0} />
          <Metric label="Directeurs" value={data.stats.byRole.supervisor ?? 0} />
          <Metric label="Nouveaux (7 jours)" value={data.stats.newLast7Days} />
          <Metric label="Nouveaux (30 jours)" value={data.stats.newLast30Days} />
          <Metric label="Connectés (30 jours)" value={data.stats.activeLast30Days} />
        </div>
      ) : null}

      <Section
        title="Liste des comptes"
        description="Du plus récent au plus ancien. Recherche par nom, e-mail ou établissement."
        action={
          <a className={buttonClass.secondary} href={`/api/admin/users?${params({ format: "csv" })}`}>
            <Download size={16} aria-hidden /> Exporter (Excel / CSV)
          </a>
        }
      >
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q);
          }}
        >
          <label className="min-w-56 flex-1 text-sm font-semibold text-slate-800">
            Rechercher
            <input className={`${inputClass} mt-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, établissement…" aria-label="Rechercher un compte" />
          </label>
          <button type="submit" className={buttonClass.primary}>
            <Search size={16} aria-hidden /> Rechercher
          </button>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrer par rôle">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={role === r.id}
                className={role === r.id ? buttonClass.secondary : buttonClass.ghost}
                onClick={() => {
                  setPage(1);
                  setRole(r.id);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </form>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Chargement…
          </p>
        ) : data ? (
          <>
            <p className="mb-2 text-sm text-slate-600">
              {data.total} compte(s){search ? ` pour « ${search} »` : ""}
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    {["Nom", "E-mail", "Rôle", "Établissement / filière", "Inscrit le", "Dernière connexion", "Activité"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {u.firstName} {u.lastName ?? ""}
                        {u.status !== "active" ? <span className="ml-1 text-xs font-normal text-rose-700">(désactivé)</span> : null}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <a className="text-indigo-700 hover:underline" href={`mailto:${u.email}`}>
                          {u.email}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <Pill tone={ROLE_LABEL[u.role]?.tone ?? "neutral"}>{ROLE_LABEL[u.role]?.label ?? u.role}</Pill>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {[u.institution, u.faculty, u.program].filter(Boolean).join(" · ") || "—"}
                        {u.studyLevel || u.city ? <span className="block text-xs text-slate-500">{[u.studyLevel, u.city].filter(Boolean).join(" · ")}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">{when(u.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-700">{when(u.lastLoginAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                        {u.projects} projet(s) · {u.interpretations} interprétation(s)
                        {u.stageApplications ? ` · ${u.stageApplications} stage` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 ? (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <button type="button" className={buttonClass.ghost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </button>
                <span className="text-slate-600">
                  Page {page} / {pages}
                </span>
                <button type="button" className={buttonClass.ghost} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Suivant
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </Section>
    </div>
  );
}
