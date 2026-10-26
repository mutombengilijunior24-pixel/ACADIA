"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2, Plus } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";

interface Item {
  id: string;
  title: string;
  status: string;
  stage: string;
  summary: string | null;
  fileName: string | null;
  fileStored: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  stageLabel: string;
  progress: number;
  verdicts: Array<{ label: string; verdict: string }>;
  dataFile?: string | null;
}

const parseSummary = (raw: string | null): Summary | null => {
  try {
    return raw ? (JSON.parse(raw) as Summary) : null;
  } catch {
    return null;
  }
};

/** « Mes interprétations » : reprendre, renommer, archiver ou supprimer une interprétation enregistrée. */
export default function InterpretationsList() {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Seule la dernière requête de liste est affichée (changement d'onglet pendant un chargement).
  const request = useRef(0);

  const load = useCallback(async (status: "active" | "archived") => {
    const current = ++request.current;
    setItems(null);
    setError(null);
    try {
      let res = await fetch(`/api/journey/sessions?status=${status}`, { cache: "no-store" });
      // Anti-rafale du serveur (deux appels à moins d'une seconde) : un seul nouvel essai, un peu plus tard.
      if (res.status === 429) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        if (current !== request.current) return;
        res = await fetch(`/api/journey/sessions?status=${status}`, { cache: "no-store" });
      }
      const data = (await res.json().catch(() => ({}))) as { sessions?: Item[]; error?: string };
      if (current !== request.current) return;
      if (!res.ok) {
        setError(data.error ?? "Liste indisponible.");
        setItems([]);
        return;
      }
      setItems(data.sessions ?? []);
    } catch {
      if (current !== request.current) return;
      setError("Connexion au serveur impossible.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // Chargement de la liste à l'ouverture et à chaque changement d'onglet (requête réseau).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(tab);
  }, [tab, load]);

  // Action puis mise à jour locale de la liste (sans la recharger).
  const act = async (id: string, init: RequestInit, apply: (list: Item[]) => Item[]) => {
    setError(null);
    const res = await fetch(`/api/journey/sessions/${id}`, init).catch(() => null);
    if (!res) {
      setError("Connexion au serveur impossible.");
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Action impossible.");
      return;
    }
    setItems((list) => (list ? apply(list) : list));
  };
  const without = (id: string) => (list: Item[]) => list.filter((i) => i.id !== id);

  return (
    <div className="space-y-5">
      <Section
        title="Mes interprétations"
        description="Vos interprétations de données sont enregistrées dans votre compte : reprenez-les là où vous les aviez laissées, avec les mêmes données, la même chaîne de cohérence et les mêmes décisions."
        action={
          <Link href="/dashboard/journey" className={buttonClass.primary}>
            <Plus size={16} aria-hidden /> Nouvelle interprétation
          </Link>
        }
      >
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Filtrer les interprétations">
          {(["active", "archived"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? buttonClass.secondary : buttonClass.ghost}>
              {t === "active" ? "En cours" : "Archivées"}
            </button>
          ))}
        </div>
        {error ? (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
        {items === null ? (
          <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
            <Loader2 size={18} className="animate-spin text-indigo-600" aria-hidden /> Chargement…
          </p>
        ) : items.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((item) => {
              const summary = parseSummary(item.summary);
              const fileName = item.fileName ?? summary?.dataFile ?? null;
              return (
                <li key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4">
                  {renaming?.id === item.id ? (
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const title = renaming.title.trim();
                        if (title) void act(item.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }, (list) => list.map((i) => (i.id === item.id ? { ...i, title } : i)));
                        setRenaming(null);
                      }}
                    >
                      <input className={`${inputClass} flex-1`} value={renaming.title} maxLength={200} onChange={(e) => setRenaming({ id: item.id, title: e.target.value })} aria-label="Nouveau titre" />
                      <button type="submit" className={buttonClass.secondary}>
                        Enregistrer
                      </button>
                    </form>
                  ) : (
                    <h3 className="break-words font-bold text-slate-900">{item.title}</h3>
                  )}
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Pill tone="blue">{summary ? `${summary.progress}/6 étapes · ${summary.stageLabel}` : item.stage}</Pill>
                    <span className="inline-flex items-center gap-1">
                      <FileSpreadsheet size={14} aria-hidden /> {fileName ?? "aucun fichier"} {fileName ? (item.fileStored ? "(conservé)" : "(à réimporter)") : ""}
                    </span>
                    <span>Modifiée le {new Date(item.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </p>
                  {summary?.verdicts.length ? (
                    <ul className="space-y-1 text-xs text-slate-700">
                      {summary.verdicts.map((v) => (
                        <li key={v.label}>
                          <span className="font-semibold">{v.label} :</span> {v.verdict}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {item.status === "active" ? (
                      <Link href={`/dashboard/journey?s=${item.id}`} className={buttonClass.primary}>
                        Reprendre
                      </Link>
                    ) : null}
                    <button type="button" className={buttonClass.ghost} onClick={() => setRenaming({ id: item.id, title: item.title })}>
                      Renommer
                    </button>
                    <button type="button" className={buttonClass.ghost} onClick={() => void act(item.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "active" ? "archived" : "active" }) }, without(item.id))}>
                      {item.status === "active" ? "Archiver" : "Restaurer"}
                    </button>
                    {confirmDelete === item.id ? (
                      <span className="flex flex-wrap items-center gap-2 text-sm text-rose-800">
                        Supprimer définitivement (données et fichier) ?
                        <button type="button" className={buttonClass.secondary} onClick={() => void act(item.id, { method: "DELETE" }, without(item.id))}>
                          Oui, supprimer
                        </button>
                        <button type="button" className={buttonClass.ghost} onClick={() => setConfirmDelete(null)}>
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button type="button" className={buttonClass.ghost} onClick={() => setConfirmDelete(item.id)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Notice tone="info" title={tab === "active" ? "Aucune interprétation en cours" : "Aucune interprétation archivée"}>
            {tab === "active" ? "Commencez une nouvelle interprétation : elle sera enregistrée automatiquement dans votre compte." : "Les interprétations archivées apparaissent ici."}
          </Notice>
        )}
      </Section>
    </div>
  );
}
