"use client";

import type { DocumentModel, DocumentTableModel, DocumentFigureModel } from "@/lib/core/export/DocumentTypes";

/**
 * P12.23 — Aperçu du document avant export : couverture, table des
 * matières, chapitres, tableaux, figures, conclusion, annexes. Lit
 * directement le DocumentModel déjà construit par DocumentBuilder —
 * jamais un second calcul, jamais un contenu différent de ce que
 * produiront les exports DOCX/PDF.
 */
export default function DocumentPreview({ model }: { model: DocumentModel }) {
  return (
    <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6">
      <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">{model.coverPage.institution}</p>
        <p className="mt-1 text-xs text-slate-400">{model.coverPage.faculty}</p>
        <p className="text-xs text-slate-400">{model.coverPage.department}</p>
        <p className="mt-8 text-xl font-bold text-acadia-navy">{model.coverPage.title}</p>
        <p className="mt-6 text-sm text-slate-500">{model.coverPage.degreeStatement}</p>
        <p className="mt-8 text-sm text-slate-600">Par : {model.coverPage.author}</p>
        <p className="text-sm text-slate-600">Directeur / encadreur : {model.coverPage.supervisor}</p>
        <p className="mt-2 text-sm text-slate-600">Année académique : {model.coverPage.academicYear}</p>
      </section>

      <section>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Table des matières</p>
        <div className="mt-3 space-y-1">
          {model.tableOfContents.map((entry, i) => (
            <p key={i} className={entry.level === 1 ? "text-sm font-bold text-acadia-navy" : "ml-4 text-xs text-slate-500"}>
              {entry.number} {entry.title}
            </p>
          ))}
        </div>
      </section>

      {model.chapters.map((chapter) => (
        <section key={chapter.id}>
          <h3 className="text-base font-bold text-acadia-navy">
            {chapter.number}. {chapter.title}
          </h3>
          {chapter.sections.map((s) => (
            <div key={s.id} className="mt-3">
              <p className="text-sm font-semibold text-acadia-navy">
                {s.number} {s.title}
              </p>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="mt-1.5 text-sm text-slate-700">
                  {p}
                </p>
              ))}
              {s.tableIds.map((tid) => {
                const t = model.tables.find((x) => x.id === tid);
                return t ? <PreviewTable key={tid} table={t} /> : null;
              })}
              {s.figureIds.map((fid) => {
                const f = model.figures.find((x) => x.id === fid);
                return f ? <PreviewFigure key={fid} figure={f} barColor={model.style.figureStyle.barColor} /> : null;
              })}
            </div>
          ))}
        </section>
      ))}

      <section>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Annexes</p>
        {model.annexes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune annexe disponible pour ce projet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {model.annexes.map((a) => (
              <li key={a.id} className="text-sm text-slate-700">
                Annexe {a.number} — {a.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Bibliographie</p>
        {model.bibliography.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune référence enregistrée.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {model.bibliography.map((ref) => (
              <li key={ref.id} className="text-sm text-slate-700">
                {ref.formatted}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PreviewTable({ table }: { table: DocumentTableModel }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="text-xs font-semibold text-acadia-navy">
        Tableau {table.number} : {table.title}
      </p>
      <table className="mt-1.5 w-full text-left text-xs">
        <thead>
          <tr className="text-slate-400">
            {table.columns.map((col) => (
              <th key={col} className="pb-1 pr-4 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-200/70">
              {row.map((cell, j) => (
                <td key={j} className="py-1 pr-4 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-2xs italic text-slate-400">{table.source}</p>
    </div>
  );
}

function PreviewFigure({ figure, barColor }: { figure: DocumentFigureModel; barColor: string }) {
  const max = Math.max(1, ...figure.data.map((d) => d.value));
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-acadia-navy">
        Figure {figure.number} : {figure.title}
      </p>
      <div className="mt-2 flex h-24 items-end gap-2">
        {figure.data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end">
            <span className="text-2xs text-slate-500">{d.value}</span>
            <div className="w-full rounded-t" style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: `#${barColor}` }} />
            <span className="mt-1 text-center text-2xs text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-2xs italic text-slate-400">{figure.source}</p>
    </div>
  );
}
