"use client";

import type { WorkContentBlock } from "@/lib/core/scientific-work/ScientificWorkTypes";
import AnnotatedBlock from "@/components/research/analysis/AnnotatedBlock";

/**
 * Rendu générique d'un ensemble de WorkContentBlock éditables — même
 * mécanique que P9/P10 (AnnotatedBlock), réutilisée à l'identique
 * pour chaque chapitre du travail scientifique (P11.23).
 */
export default function ScientificWorkSection({
  researchId,
  title,
  blocks,
}: {
  researchId: string;
  title: string;
  blocks: (WorkContentBlock | undefined)[];
}) {
  const validBlocks = blocks.filter((b): b is WorkContentBlock => Boolean(b));

  if (validBlocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {validBlocks.map((b) => (
          <AnnotatedBlock key={b.id} researchId={researchId} blockId={b.id} title={b.label} statements={b.statements} compact />
        ))}
      </div>
    </div>
  );
}
