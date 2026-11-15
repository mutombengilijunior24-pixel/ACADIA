"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Upload, UserPlus } from "lucide-react";

import { buttonClass, inputClass, Metric, Notice, Pill, Section, type Tone } from "@/components/data/ui";
import {
  DIRECTOR_LINE_FORMAT,
  DIRECTOR_LOGIC_STATUSES,
  LINK_STATUS_LABELS,
  LOGIC_STATUS_LABELS,
  directorLabel,
  type DirectorAdmin,
  type DirectorLogicStatus,
  type UnlistedDirectorName,
} from "@/lib/core/directors/directors";
import { INSTITUTIONS } from "@/lib/core/stages/institutions";

interface Payload {
  directors: DirectorAdmin[];
  unlisted: UnlistedDirectorName[];
}

interface Draft {
  id: string | null;
  fullName: string;
  academicTitle: string;
  institution: string;
  faculty: string;
  department: string;
  specialties: string;
  notes: string;
  logicStatus: DirectorLogicStatus;
  isActive: boolean;
}

const EMPTY: Draft = { id: null, fullName: "", academicTitle: "", institution: "", faculty: "", department: "", specialties: "", notes: "", logicStatus: "a_recueillir", isActive: true };
const STATUS_TONE: Record<DirectorLogicStatus, Tone> = { a_recueillir: "neutral", en_cours: "yellow", integre: "green" };

function errorText(status: number, body: { error?: string }) {
  if (status === 403) return "Accès réservé aux administrateurs.";
  if (status === 401) return "Connectez-vous avec un compte administrateur.";
  return body.error ?? `Erreur ${status}`;
}

/** Annuaire des directeurs de mémoire (administrateurs) : liste, fiche, import d'une liste, noms hors liste. */
export default function DirectorsAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [bulk, setBulk] = useState("");
  const [busy, setBusy] = useState<"save" | "import" | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/directors", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as Payload & { error?: string };
      if (!res.ok) {
        setError(errorText(res.status, body));
        return;
      }
      setError(null);
      setData(body);
    } catch {
      setError("Connexion au serveur impossible.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function edit(next: Draft) {
    setDraft(next);
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(patch?: Partial<Draft>) {
    const target = { ...draft, ...patch };
    if (target.fullName.trim().length < 3) {
      setError("Le nom complet du directeur est obligatoire.");
      return;
    }
    setBusy("save");
    setError(null);
    const fields = {
      fullName: target.fullName,
      academicTitle: target.academicTitle,
      institution: target.institution,
      faculty: target.faculty,
      department: target.department,
      specialties: target.specialties,
      notes: target.notes,
      logicStatus: target.logicStatus,
    };
    try {
      const res = target.id
        ? await fetch(`/api/admin/directors/${encodeURIComponent(target.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...fields, isActive: target.isActive }) })
        : await fetch("/api/admin/directors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; director?: DirectorAdmin };
      if (!res.ok || !body.director) {
        setError(errorText(res.status, body));
        return;
      }
      setMessage(target.id ? `Fiche de ${directorLabel(body.director)} enregistrée.` : `${directorLabel(body.director)} ajouté à l'annuaire.`);
      setDraft(EMPTY);
      await load();
    } catch {
      setError("Connexion au serveur impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function importList() {
    if (!bulk.trim()) return;
    setBusy("import");
    setError(null);
    try {
      const res = await fetch("/api/admin/directors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bulk }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; imported?: { created: number; existing: number; skipped: number } };
      if (!res.ok || !body.imported) {
        setError(errorText(res.status, body));
        return;
      }
      const { created, existing, skipped } = body.imported;
      setMessage(`${created} directeur(s) ajouté(s)${existing ? `, ${existing} déjà présent(s)` : ""}${skipped ? `, ${skipped} ligne(s) ignorée(s)` : ""}.`);
      setBulk("");
      await load();
    } catch {
      setError("Connexion au serveur impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function decideLink(director: DirectorAdmin, decision: "valider" | "refuser") {
    const who = director.account ? `${director.account.accountName} (${director.account.accountEmail})` : "ce compte";
    const question =
      decision === "valider"
        ? `Valider : ${who} est bien ${directorLabel(director)} ? Son canevas s'appliquera automatiquement à ses étudiants.`
        : `Retirer le rattachement de ${who} à ${directorLabel(director)} ? Ses étudiants reviendront à la logique générale d'ACADIA.`;
    if (!window.confirm(question)) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/directors/${encodeURIComponent(director.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ link: decision }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(errorText(res.status, body));
        return;
      }
      setMessage(decision === "valider" ? `Rattachement validé : ${directorLabel(director)}.` : `Rattachement retiré : ${directorLabel(director)}.`);
      await load();
    } catch {
      setError("Connexion au serveur impossible.");
    }
  }

  const directors = data?.directors ?? [];
  const active = directors.filter((d) => d.isActive);
  const pendingLinks = directors.filter((d) => d.account?.status === "demande");
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Administration</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Directeurs de mémoire</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Les étudiants choisissent leur directeur dans cette liste quand ils créent leur travail. Un directeur qui a un compte peut
          demander à y être rattaché ; une fois la demande validée ici, son canevas actif s&apos;applique automatiquement à ses étudiants.
          Sinon, ACADIA applique sa logique générale. Les notes ne sont visibles que par l&apos;administration.
        </p>
      </header>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      {pendingLinks.length > 0 ? (
        <Notice tone="warning" title={`${pendingLinks.length} rattachement(s) de compte directeur à valider`}>
          Vérifiez que la personne est bien le directeur avant de valider : son canevas s&apos;appliquera à tous les étudiants qui l&apos;ont choisi.
          Les demandes apparaissent dans la colonne « Compte directeur ».
        </Notice>
      ) : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-5">
          <Metric label="Directeurs actifs" value={active.length} />
          <Metric label="Projets rattachés" value={directors.reduce((sum, d) => sum + d.projects, 0)} />
          <Metric label="Canevas intégrés" value={directors.filter((d) => d.logicStatus === "integre").length} />
          <Metric label="Rattachements à valider" value={pendingLinks.length} tone={pendingLinks.length ? "warn" : undefined} />
          <Metric label="Noms saisis hors liste" value={data.unlisted.length} tone={data.unlisted.length ? "warn" : undefined} />
        </div>
      ) : null}

      <Section title="Annuaire" description="Un directeur n'est jamais supprimé : désactivé, il n'est plus proposé aux étudiants mais reste rattaché à leurs projets.">
        {!data && !error ? (
          <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Chargement…
          </p>
        ) : directors.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun directeur pour l&apos;instant : ajoutez-en un ou collez une liste ci-dessous.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {["Directeur", "Université / faculté", "Spécialités", "Projets", "Canevas", "Compte directeur", ""].map((h) => (
                    <th key={h || "actions"} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directors.map((d) => (
                  <tr key={d.id} className={`border-t border-slate-100 align-top ${d.isActive ? "" : "bg-slate-50 text-slate-400"}`}>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {directorLabel(d)}
                      {!d.isActive ? <span className="ml-1 text-xs font-normal text-rose-700">(désactivé)</span> : null}
                      {d.notes ? <span className="block text-xs font-normal text-slate-500">Notes : {d.notes.length > 80 ? `${d.notes.slice(0, 80)}…` : d.notes}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{[d.institution, d.faculty, d.department].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.specialties || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{d.projects}</td>
                    <td className="px-3 py-2">
                      <Pill tone={STATUS_TONE[d.logicStatus]}>{LOGIC_STATUS_LABELS[d.logicStatus]}</Pill>
                      {d.hasCanevas ? <span className="mt-1 block text-xs text-emerald-700">défini par le directeur</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {d.account ? (
                        <>
                          <span className="block font-semibold text-slate-900">{d.account.accountName}</span>
                          <span className="block text-slate-500">{d.account.accountEmail}</span>
                          {d.account.status === "demande" ? (
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              <button type="button" className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700" onClick={() => void decideLink(d, "valider")}>
                                Valider
                              </button>
                              <button type="button" className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50" onClick={() => void decideLink(d, "refuser")}>
                                Refuser
                              </button>
                            </span>
                          ) : (
                            <span className="mt-1 flex items-center gap-2">
                              <Pill tone="green">{LINK_STATUS_LABELS.valide}</Pill>
                              <button type="button" className="text-slate-400 hover:text-rose-700" onClick={() => void decideLink(d, "refuser")}>
                                Retirer
                              </button>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className={buttonClass.ghost}
                        onClick={() =>
                          edit({
                            id: d.id,
                            fullName: d.fullName,
                            academicTitle: d.academicTitle ?? "",
                            institution: d.institution ?? "",
                            faculty: d.faculty ?? "",
                            department: d.department ?? "",
                            specialties: d.specialties ?? "",
                            notes: d.notes ?? "",
                            logicStatus: d.logicStatus,
                            isActive: d.isActive,
                          })
                        }
                      >
                        <Pencil size={14} aria-hidden /> Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div ref={formRef}>
        <Section
          title={draft.id ? `Modifier la fiche — ${directorLabel(draft)}` : "Ajouter un directeur"}
          description="Seul le nom complet est obligatoire. L'université sert à proposer d'abord ce directeur aux étudiants de la même université."
          action={
            draft.id ? (
              <button type="button" className={buttonClass.ghost} onClick={() => setDraft(EMPTY)}>
                <Plus size={16} aria-hidden /> Nouveau directeur
              </button>
            ) : null
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">
              Nom complet *
              <input className={`${inputClass} mt-1`} value={draft.fullName} onChange={set("fullName")} maxLength={160} placeholder="KABAMBA Jean" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Titre académique
              <input className={`${inputClass} mt-1`} value={draft.academicTitle} onChange={set("academicTitle")} maxLength={80} placeholder="Prof, PO, Dr, CT…" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Université
              <input className={`${inputClass} mt-1`} value={draft.institution} onChange={set("institution")} maxLength={160} list="directors-institutions" placeholder="UNILU" />
              <datalist id="directors-institutions">
                {INSTITUTIONS.map((i) => (
                  <option key={i.id} value={i.acronym}>
                    {i.name ?? i.acronym}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Faculté
              <input className={`${inputClass} mt-1`} value={draft.faculty} onChange={set("faculty")} maxLength={160} placeholder="Sciences Économiques et de Gestion" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Département
              <input className={`${inputClass} mt-1`} value={draft.department} onChange={set("department")} maxLength={160} placeholder="Économie" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Spécialités <span className="font-normal text-slate-500">(séparées par des virgules)</span>
              <input className={`${inputClass} mt-1`} value={draft.specialties} onChange={set("specialties")} maxLength={400} placeholder="Économétrie, Finance publique" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              État du canevas
              <select className={`${inputClass} mt-1`} value={draft.logicStatus} onChange={set("logicStatus")}>
                {DIRECTOR_LOGIC_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LOGIC_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
              Notes internes <span className="font-normal text-slate-500">(sa façon de travailler, son canevas, ce qu&apos;il exige — jamais montré aux étudiants)</span>
              <textarea className={`${inputClass} mt-1 min-h-28`} value={draft.notes} onChange={set("notes")} maxLength={8000} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={buttonClass.primary} disabled={busy !== null} onClick={() => void save()}>
              {busy === "save" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <UserPlus size={16} aria-hidden />}
              {draft.id ? "Enregistrer la fiche" : "Ajouter à l'annuaire"}
            </button>
            {draft.id ? (
              <button type="button" className={buttonClass.secondary} disabled={busy !== null} onClick={() => void save({ isActive: !draft.isActive })}>
                {draft.isActive ? "Désactiver ce directeur" : "Réactiver ce directeur"}
              </button>
            ) : null}
          </div>
        </Section>
      </div>

      <Section
        title="Coller une liste"
        description={
          <>
            Une ligne par directeur : <code className="rounded bg-slate-100 px-1">{DIRECTOR_LINE_FORMAT}</code>. Seul le nom est obligatoire ; les
            noms déjà dans l&apos;annuaire ne sont pas recréés. Un copier-coller depuis Excel fonctionne aussi.
          </>
        }
      >
        <textarea
          className={`${inputClass} min-h-36 font-mono text-xs`}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder={"KABAMBA Jean ; Prof ; UNILU ; Sciences Économiques et de Gestion ; Économie ; Économétrie\nMUTOMBO Paul ; Dr ; UNILU"}
          aria-label="Liste de directeurs à importer"
        />
        <button type="button" className={`${buttonClass.secondary} mt-3`} disabled={busy !== null || !bulk.trim()} onClick={() => void importList()}>
          {busy === "import" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />} Importer la liste
        </button>
      </Section>

      {data && data.unlisted.length > 0 ? (
        <Section title="Noms saisis par les étudiants hors liste" description="Directeurs tapés à la main par des étudiants qui ne les ont pas trouvés dans l'annuaire. Ajoutez-les pour qu'ils soient proposés.">
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {data.unlisted.map((u) => (
              <li key={u.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-900">
                  {u.name} <span className="font-normal text-slate-500">— {u.projects} projet(s)</span>
                </span>
                <button type="button" className={buttonClass.ghost} onClick={() => edit({ ...EMPTY, fullName: u.name })}>
                  <Plus size={14} aria-hidden /> Ajouter à la liste
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
