"use client";

import { useResearch } from "@/contexts/ResearchContext";
import type { ScientificWork, WorkContentBlock } from "@/lib/core/scientific-work/ScientificWorkTypes";

/**
 * P11.27 — Aperçu scientifique : lecture continue du document dans
 * l'ordre IRMRD, respectant toute édition humaine déjà persistée
 * (même logique de résolution que AnnotatedBlock — jamais le texte
 * généré n'écrase une édition existante).
 */
export default function ScientificWorkPreview({ researchId, work }: { researchId: string; work: ScientificWork }) {
  const { annotations } = useResearch();
  const forResearch = annotations[researchId];

  function text(b: WorkContentBlock): string {
    return forResearch?.[b.id]?.editedContent ?? b.statements.join(" ");
  }

  const methodologyBlocks = [
    work.methodology.approach,
    work.methodology.methods,
    work.methodology.fieldOfStudy,
    work.methodology.population,
    work.methodology.sampling,
    work.methodology.collectionTechniques,
    work.methodology.instruments,
    work.methodology.dataPreparation,
    work.methodology.analysisMethods,
    ...(work.methodology.validityReliability ? [work.methodology.validityReliability] : []),
  ];

  const literatureBlocks = [
    work.literatureReview.conceptualFramework,
    work.literatureReview.theoreticalFramework,
    work.literatureReview.theoreticalStudies,
    work.literatureReview.empiricalStudies,
    work.literatureReview.positioning,
  ];

  const conclusionBlocks = [
    work.conclusion.researchObjectRecall,
    work.conclusion.problemRecall,
    work.conclusion.mainQuestions,
    work.conclusion.methodologySynthesis,
    work.conclusion.mainResults,
    work.conclusion.theoreticalContribution,
    work.conclusion.methodologicalContribution,
    work.conclusion.practicalContribution,
    work.conclusion.limitations,
    work.conclusion.perspectives,
  ];

  return (
    <div className="max-w-none space-y-8 rounded-2xl border border-slate-200 bg-white p-6">
      <section>
        <h3 className="text-base font-bold text-acadia-navy">1. Introduction</h3>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.context)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.researchProblem)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.justification)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.researchQuestion)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.objectives)}</p>
        {work.introduction.hypotheses && <p className="mt-2 text-sm text-slate-700">{text(work.introduction.hypotheses)}</p>}
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.methodologySummary)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.delimitation)}</p>
        <p className="mt-2 text-sm text-slate-700">{text(work.introduction.workStructure)}</p>
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">2. Revue de littérature</h3>
        {literatureBlocks.map((b) => (
          <p key={b.id} className="mt-2 text-sm text-slate-700">
            <strong>{b.label} — </strong>
            {text(b)}
          </p>
        ))}
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">3. Méthodologie</h3>
        {methodologyBlocks.map((b) => (
          <p key={b.id} className="mt-2 text-sm text-slate-700">
            <strong>{b.label} — </strong>
            {text(b)}
          </p>
        ))}
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">4. Résultats</h3>
        <p className="mt-2 text-sm text-slate-700">{text(work.results.fieldPresentation)}</p>
        {work.results.descriptive.map((d) => (
          <p key={d.columnId} className="mt-2 text-sm text-slate-700">
            <strong>{d.label} — </strong>
            {text(d.block)}
          </p>
        ))}
        {work.results.bivariate.map((b) => (
          <p key={b.blockId} className="mt-2 text-sm text-slate-700">
            {text(b.block)}
          </p>
        ))}
        {work.results.econometric.map((e) => (
          <p key={e.blockId} className="mt-2 text-sm text-slate-700">
            {text(e.block)}
          </p>
        ))}
        {work.results.qualitative.map((q) => (
          <p key={q.themeId} className="mt-2 text-sm text-slate-700">
            <strong>{q.theme} — </strong>
            {text(q.block)}
          </p>
        ))}
        <p className="mt-2 text-sm text-slate-700">{text(work.results.synthesis)}</p>
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">5. Discussion</h3>
        <p className="mt-2 text-xs text-slate-400">
          Voir la section « Discussion scientifique » (P10) ci-dessus pour le détail complet — réutilisée telle
          quelle, jamais dupliquée ici.
        </p>
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">6. Conclusion</h3>
        {conclusionBlocks.map((b) => (
          <p key={b.id} className="mt-2 text-sm text-slate-700">
            <strong>{b.label} — </strong>
            {text(b)}
          </p>
        ))}
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">7. Annexes</h3>
        <ul className="mt-2 space-y-1">
          {work.annexes.map((a) => (
            <li key={a.id} className="text-sm text-slate-700">
              {a.available ? "✓" : "—"} {a.label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold text-acadia-navy">8. Bibliographie</h3>
        {work.bibliography.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune référence enregistrée.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {[...work.bibliography]
              .sort((a, b) => a.author.localeCompare(b.author))
              .map((ref) => (
                <li key={ref.id} className="text-sm text-slate-700">
                  {ref.author} ({ref.year ?? "s.d."}). {ref.title}.
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
