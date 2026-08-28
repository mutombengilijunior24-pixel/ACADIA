"use client";

import { CheckCircle2, AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import type { ScientificWorkCheckSeverity, ScientificWorkValidationResult } from "@/lib/core/scientific-work/ScientificWorkTypes";
import { computeScientificWorkReadiness } from "@/lib/core/scientific-work/ScientificWorkValidationEngine";
import ScientificWorkReadiness from "./ScientificWorkReadiness";

const META: Record<ScientificWorkCheckSeverity, { label: string; badge: string; icon: string; iconComponent: typeof CheckCircle2 }> = {
  pass: { label: "PASS", badge: "bg-emerald-50 text-emerald-700", icon: "text-emerald-600", iconComponent: CheckCircle2 },
  warning: { label: "WARNING", badge: "bg-amber-50 text-amber-700", icon: "text-amber-600", iconComponent: AlertTriangle },
  needs_review: { label: "NEEDS_REVIEW", badge: "bg-amber-50 text-amber-700", icon: "text-amber-600", iconComponent: HelpCircle },
  error: { label: "ERROR", badge: "bg-red-50 text-red-700", icon: "text-red-600", iconComponent: XCircle },
};

export default function ScientificWorkValidation({ validation }: { validation: ScientificWorkValidationResult }) {
  const readiness = computeScientificWorkReadiness(validation);

  return (
    <div className="space-y-4">
      <ScientificWorkReadiness readiness={readiness} />

      <div className="space-y-2">
        {validation.items.map((checkItem) => {
          const meta = META[checkItem.severity];
          const Icon = meta.iconComponent;
          return (
            <div key={checkItem.id} className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.icon}`} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-acadia-navy">
                    {checkItem.id}. {checkItem.label}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${meta.badge}`}>{meta.label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{checkItem.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
