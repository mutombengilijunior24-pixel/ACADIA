"use client";

// ============================================================
// ACADIA — CHOIX DU DIRECTEUR DE MÉMOIRE
//
// Utilisé dans l'assistant « Nouvelle recherche » et sur la page d'un
// projet. Les directeurs de l'université saisie sont proposés en premier.
// Si le directeur n'est pas dans l'annuaire, l'étudiant tape son nom :
// ACADIA applique sa logique générale et l'administration voit ce nom.
// Le choix est toujours facultatif.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, Loader2, UserRound } from "lucide-react";

import { directorLabel, sortForUniversity, type DirectorPublic } from "@/lib/core/directors/directors";

export interface DirectorChoice {
  directorId: string;
  directorName: string;
}

const UNLISTED = "__hors_liste__";

let cache: DirectorPublic[] | null = null;

function useDirectors() {
  const [directors, setDirectors] = useState<DirectorPublic[] | null>(cache);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetch("/api/directors", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { directors: DirectorPublic[] };
        cache = body.directors;
        if (!cancelled) setDirectors(body.directors);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { directors, failed };
}

export default function DirectorPicker({
  university,
  value,
  onChange,
}: {
  university?: string;
  value: Partial<DirectorChoice>;
  onChange: (next: DirectorChoice) => void;
}) {
  const { directors, failed } = useDirectors();
  const directorId = value.directorId ?? "";
  const directorName = value.directorName ?? "";
  const [unlisted, setUnlisted] = useState(!directorId && directorName.trim().length > 0);

  const { matching, others } = useMemo(() => sortForUniversity(directors ?? [], university), [directors, university]);
  const selected = directors?.find((d) => d.id === directorId) ?? null;
  // Directeur choisi puis retiré de l'annuaire : il reste affiché, jamais remplacé en silence.
  const orphan = directorId && directors && !selected ? directorId : null;
  const listEmpty = directors !== null && directors.length === 0;
  const showTextInput = unlisted || failed || listEmpty;

  function handleSelect(next: string) {
    if (next === UNLISTED) {
      setUnlisted(true);
      onChange({ directorId: "", directorName: "" });
      return;
    }
    setUnlisted(false);
    const d = directors?.find((item) => item.id === next);
    onChange(d ? { directorId: d.id, directorName: directorLabel(d) } : { directorId: "", directorName: "" });
  }

  const selectValue = unlisted ? UNLISTED : directorId;
  const inputClass =
    "w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none focus:ring-3 focus:ring-acadia-blue/15 transition shadow-2xs";

  return (
    <div className="space-y-4">
      {directors === null && !failed ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la liste des directeurs…
        </p>
      ) : null}

      {directors && directors.length > 0 && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-acadia-navy">Votre directeur de mémoire</span>
          <select value={selectValue} onChange={(e) => handleSelect(e.target.value)} className={inputClass}>
            <option value="">Choisissez votre directeur</option>
            {orphan && <option value={orphan}>{directorName || "Directeur choisi"} (n&apos;est plus proposé)</option>}
            {matching.length > 0 && (
              <optgroup label={`Directeurs de votre université`}>
                {matching.map((d) => (
                  <option key={d.id} value={d.id}>
                    {directorLabel(d)}
                  </option>
                ))}
              </optgroup>
            )}
            {others.length > 0 && (
              <optgroup label={matching.length > 0 ? "Autres directeurs" : "Directeurs"}>
                {others.map((d) => (
                  <option key={d.id} value={d.id}>
                    {directorLabel(d)}
                    {d.institution ? ` — ${d.institution}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={UNLISTED}>Mon directeur n&apos;est pas dans la liste</option>
          </select>
        </label>
      )}

      {showTextInput && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-acadia-navy">
            {listEmpty || failed ? "Nom de votre directeur de mémoire" : "Nom complet de votre directeur"}
          </span>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <UserRound className="h-5 w-5" />
            </div>
            <input
              value={directorName}
              maxLength={160}
              onChange={(e) => onChange({ directorId: "", directorName: e.target.value })}
              placeholder="Exemple : Professeur Jean Kabamba"
              className={`${inputClass} pl-12`}
            />
          </div>
          {failed && <span className="mt-2 block text-xs text-amber-700">La liste des directeurs n&apos;a pas pu être chargée : indiquez son nom, vous pourrez le choisir dans la liste plus tard.</span>}
        </label>
      )}

      {selected ? (
        <div className="flex items-start gap-3 rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/60 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acadia-blue" />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-acadia-navy">{directorLabel(selected)}</p>
            {(selected.institution || selected.department || selected.faculty) && (
              <p className="text-xs text-slate-500">{[selected.institution, selected.faculty, selected.department].filter(Boolean).join(" · ")}</p>
            )}
            <p className="mt-2">
              {selected.hasCanevas
                ? `${directorLabel(selected)} a défini son canevas dans ACADIA : il s'appliquera à votre travail, et chacune de ses mises à jour aussi.`
                : selected.logicStatus === "integre"
                  ? "Son canevas est intégré : ACADIA ajuste votre travail à sa façon de travailler."
                  : `${directorLabel(selected)} n'a pas encore défini son canevas dans ACADIA : votre travail suit la logique générale d'ACADIA, et s'ajustera dès que son canevas sera disponible.`}
            </p>
          </div>
        </div>
      ) : showTextInput && directorName.trim() ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <p>
            ACADIA applique sa logique générale. L&apos;équipe ACADIA verra ce nom et pourra ajouter votre directeur à la liste ; vous
            pourrez alors le choisir depuis votre projet.
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Facultatif : vous pourrez l&apos;indiquer plus tard depuis la page de votre projet.</p>
      )}
    </div>
  );
}
