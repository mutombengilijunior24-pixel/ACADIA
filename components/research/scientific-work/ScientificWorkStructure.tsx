"use client";

import type { ScientificWorkSectionNode } from "@/lib/core/scientific-work/ScientificWorkTypes";

export default function ScientificWorkStructure({ structure }: { structure: ScientificWorkSectionNode[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Structure IRMRD proposée par ACADIA, inspirée du référentiel <em>Méthodes de recherche en sciences
        économiques et de gestion</em> (Sem Mbimbi &amp; Cornet, chapitre 4) — une proposition adaptable selon
        l&apos;objet de recherche, jamais une citation littérale de l&apos;ouvrage ni une structure
        universellement obligatoire.
      </p>
      {structure.map((chapter) => (
        <div key={chapter.id} className="rounded-2xl border border-slate-200/90 bg-white p-4">
          <p className="text-sm font-bold text-acadia-navy">
            {chapter.number}. {chapter.title}
          </p>
          {chapter.children && (
            <ul className="mt-2 space-y-1">
              {chapter.children.map((child) => (
                <li key={child.id} className="text-xs text-slate-500">
                  {child.number} {child.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
