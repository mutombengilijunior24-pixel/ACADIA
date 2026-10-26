"use client";

import { useState } from "react";
import { Building2, FileUp, PencilLine } from "lucide-react";

import { buttonClass, Notice, Section } from "@/components/data/ui";

export type FinanceSource = "demo" | "manual" | "file";

/** Étape « Source des états » : comment l'étudiant fournit ses états financiers. */
export function SourceStep({ source, hasValues, onChoose }: { source: FinanceSource | null; hasValues: boolean; onChoose: (source: FinanceSource) => void }) {
  const [confirmDemo, setConfirmDemo] = useState(false);
  const card = "flex h-full flex-col gap-2 rounded-2xl p-4 text-left text-sm ring-1 transition";
  return (
    <Section title="2. Mes états financiers" description="Le bilan, le compte de résultat et, si vous l'avez, le tableau des flux de trésorerie, pour un ou plusieurs exercices. Vous vérifierez chaque chiffre à l'étape suivante.">
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" className={`${card} ${source === "manual" ? "bg-emerald-50 ring-2 ring-emerald-400" : "bg-white ring-slate-200 hover:ring-slate-300"}`} onClick={() => onChoose("manual")}>
          <PencilLine size={22} className="text-emerald-600" aria-hidden />
          <span className="font-semibold text-slate-900">Saisir mes chiffres</span>
          <span className="text-slate-600">Une grille au format SYSCOHADA révisé : bilan, compte de résultat, flux de trésorerie. Les totaux sont calculés et contrôlés au fil de la saisie.</span>
        </button>
        <div className={`${card} bg-slate-50 ring-slate-200`} aria-disabled>
          <FileUp size={22} className="text-slate-400" aria-hidden />
          <span className="font-semibold text-slate-700">Importer un fichier (Excel, PDF, photo)</span>
          <span className="text-slate-600">Lecture de vos états à partir d&apos;un fichier ou d&apos;une photo, puis vérification dans la même grille.</span>
          <span className="mt-auto text-xs font-semibold text-slate-500">Disponible prochainement</span>
        </div>
        <button
          type="button"
          className={`${card} ${source === "demo" ? "bg-emerald-50 ring-2 ring-emerald-400" : "bg-white ring-slate-200 hover:ring-slate-300"}`}
          onClick={() => {
            if (hasValues && source !== "demo") setConfirmDemo(true);
            else onChoose("demo");
          }}
        >
          <Building2 size={22} className="text-emerald-600" aria-hidden />
          <span className="font-semibold text-slate-900">Entreprise fictive de démonstration</span>
          <span className="text-slate-600">« SOKAMA SARL », commerce de gros imaginaire, trois exercices (2021–2023). Pour découvrir le moteur : ces chiffres ne sont pas réels.</span>
        </button>
      </div>
      {confirmDemo ? (
        <div className="mt-4">
          <Notice
            tone="warning"
            title="Remplacer vos chiffres par la démonstration ?"
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass.secondary}
                  onClick={() => {
                    setConfirmDemo(false);
                    onChoose("demo");
                  }}
                >
                  Remplacer
                </button>
                <button type="button" className={buttonClass.ghost} onClick={() => setConfirmDemo(false)}>
                  Annuler
                </button>
              </div>
            }
          >
            Les montants déjà saisis seront remplacés par ceux de l&apos;entreprise fictive.
          </Notice>
        </div>
      ) : null}
    </Section>
  );
}
