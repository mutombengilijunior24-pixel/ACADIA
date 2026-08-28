import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

interface ResearchInsightProps {
  title?: string;
  children: ReactNode;
}

/**
 * Coquille visuelle destinée à accueillir les futures recommandations
 * de l'intelligence ACADIA (A1/A2). Purement présentationnelle pour
 * l'instant : aucun appel IA, aucune donnée générée ici.
 */
export default function ResearchInsight({
  title = "Insight ACADIA",
  children,
}: ResearchInsightProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-acadia-blue-100 bg-gradient-to-br from-acadia-blue-50 to-white p-4 sm:p-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-acadia-navy text-acadia-blue-light">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-bold tracking-wide text-acadia-navy uppercase">
          ✦ {title}
        </p>
        <div className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
