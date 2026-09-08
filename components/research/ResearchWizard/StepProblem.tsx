"use client";

import { useResearch } from "@/contexts/ResearchContext";
import { HelpCircle } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchTextArea from "./brand/ResearchTextArea";

export default function StepProblem() {
  const { currentResearch, updateCurrentResearch } = useResearch();

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={6}
        category="Objectifs"
        title="Quelle est la situation ou le problème qui motive votre recherche ?"
        description="Décrivez avec vos propres mots le constat initial, l'écart observé entre la situation idéale et la réalité, ou la question fondamentale que pose votre étude."
      />

      {/* Zone de rédaction scientifique */}
      <ResearchTextArea
        id="problem-textarea"
        label="Exposé du problème ou question de départ"
        required
        rows={6}
        value={currentResearch.problem}
        onChange={(value) => updateCurrentResearch("problem", value)}
        placeholder="Décrivez le constat, puis terminez par votre question de recherche (ex: Malgré les investissements récents dans les outils numériques, le taux d'adoption par les équipes opérationnelles reste inférieur à 35%. Dans quelle mesure ces investissements expliquent-ils ce faible taux d'adoption ?)"
        savedLabel="Problématique enregistrée"
      />

      {currentResearch.problem.trim().length > 0 && (
        currentResearch.problem.trim().endsWith("?") ? (
          <p className="text-xs sm:text-sm text-emerald-700 flex items-center gap-2">
            <span className="font-bold">✓</span>
            <span>Votre texte se termine par une question — il sera retenu comme question de recherche principale.</span>
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-amber-700 flex items-center gap-2">
            <span className="font-bold">!</span>
            <span>ACADIA ne reformule jamais votre texte : pour qu&apos;une question de recherche soit reconnue, terminez votre exposé par une phrase interrogative se terminant par « ? ».</span>
          </p>
        )
      )}

      {/* Guide méthodologique d'aide */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <HelpCircle className="h-4 w-4 text-acadia-blue" />
          <span>Conseils pour une problématique percutante :</span>
        </div>
        <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
          <li className="flex items-start gap-2">
            <span className="font-bold text-acadia-blue">•</span>
            <span><strong>Le constat de départ :</strong> Quelle anomalie, tension ou difficulté observez-vous sur le terrain ?</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-acadia-blue">•</span>
            <span><strong>L&apos;intérêt scientifique :</strong> Pourquoi est-il crucial de chercher à comprendre ou résoudre ce phénomène ?</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-acadia-blue">•</span>
            <span><strong>La question centrale, à formuler explicitement :</strong> terminez votre texte par une vraie question (« Dans quelle mesure... ? », « Comment... ? », « Pourquoi... ? ») — c&apos;est cette phrase, telle quelle, qui devient votre question de recherche.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}