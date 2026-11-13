"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useResearch } from "@/contexts/ResearchContext";
import DirectorPicker from "@/components/directors/DirectorPicker";
import DataActions from "@/components/research/DataActions";
import { collectHref, hasDirectorChoice, interpretHref } from "@/lib/core/research/workflow";
import ResearchStepHeader from "./brand/ResearchStepHeader";

/**
 * Dernière étape : l'étudiant choisit son directeur ; dès que c'est fait, les deux
 * chemins apparaissent — récolter ou interpréter ses données. Le projet est
 * enregistré au moment du choix, puis l'étudiant y est emmené directement.
 */
export default function StepDirector() {
  const router = useRouter();
  const { currentResearch, updateCurrentResearch, createCurrentResearch } = useResearch();
  const [noDirectorYet, setNoDirectorYet] = useState(false);
  const [busy, setBusy] = useState<"collect" | "interpret" | "project" | null>(null);
  const chosen = hasDirectorChoice(currentResearch);
  const showActions = chosen || noDirectorYet;

  function go(kind: "collect" | "interpret" | "project") {
    if (busy) return;
    setBusy(kind);
    try {
      const research = createCurrentResearch();
      router.push(kind === "collect" ? collectHref(research) : kind === "interpret" ? interpretHref(research) : `/dashboard/research/${research.id}`);
    } catch (error) {
      console.error("Création du projet impossible :", error);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={3}
        category="Mes données"
        title="Qui dirige votre travail ?"
        description="Choisissez votre directeur : votre travail lui est rattaché, et ACADIA s'ajustera à son canevas dès qu'il sera intégré. Ensuite, récoltez ou interprétez vos données."
      />

      <DirectorPicker
        university={currentResearch.university}
        value={{ directorId: currentResearch.directorId, directorName: currentResearch.directorName }}
        onChange={(next) => {
          updateCurrentResearch("directorId", next.directorId);
          updateCurrentResearch("directorName", next.directorName);
          if (next.directorName.trim()) setNoDirectorYet(false);
        }}
      />

      {showActions ? (
        <div className="space-y-4 border-t border-slate-100 pt-6">
          <p className="text-base font-bold text-acadia-navy">Et maintenant, que voulez-vous faire ?</p>
          <DataActions
            collect={{ onClick: () => go("collect") }}
            interpret={{ onClick: () => go("interpret") }}
            busy={busy === "collect" || busy === "interpret" ? busy : null}
          />
          <p className="text-center text-sm text-slate-500">
            Pas encore prêt ?{" "}
            <button type="button" onClick={() => go("project")} disabled={busy !== null} className="font-semibold text-acadia-blue hover:underline">
              Enregistrer mon projet et y revenir plus tard
            </button>
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Les deux chemins — récolter ou interpréter vos données — apparaissent dès que votre directeur est choisi.{" "}
          <button type="button" onClick={() => setNoDirectorYet(true)} className="font-semibold text-acadia-blue hover:underline">
            Je n&apos;ai pas encore de directeur
          </button>
        </p>
      )}
    </div>
  );
}
