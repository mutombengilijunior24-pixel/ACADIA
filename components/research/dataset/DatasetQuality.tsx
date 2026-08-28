"use client";

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { DatasetQualityResult, DatasetQualitySeverity } from "@/lib/core/dataset/DatasetTypes";

const SEVERITY_META: Record<
  DatasetQualitySeverity,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  pass: { label: "PASS", className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  warning: { label: "WARNING", className: "bg-amber-50 text-amber-700", icon: AlertTriangle },
  needs_review: { label: "NEEDS_REVIEW", className: "bg-amber-50 text-amber-700", icon: HelpCircle },
  error: { label: "ERROR", className: "bg-red-50 text-red-700", icon: XCircle },
};

export default function DatasetQuality({ quality }: { quality: DatasetQualityResult }) {
  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        Contrôles de forme uniquement — présence, unicité, cohérence de type. Aucun calcul statistique
        (moyenne, corrélation, test) n&apos;est effectué à ce stade.
      </p>
      <div className="space-y-2">
        {quality.items.map((item) => {
          const meta = SEVERITY_META[item.severity];
          const Icon = meta.icon;
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className.split(" ")[1]}`} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-acadia-navy">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
                {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
