"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ExportCheckStatus, ExportReadinessResult } from "@/lib/core/export/DocumentTypes";

const META: Record<ExportCheckStatus, { label: string; badge: string; icon: string; iconComponent: typeof CheckCircle2 }> = {
  READY: { label: "READY", badge: "bg-emerald-50 text-emerald-700", icon: "text-emerald-600", iconComponent: CheckCircle2 },
  WARNING: { label: "WARNING", badge: "bg-amber-50 text-amber-700", icon: "text-amber-600", iconComponent: AlertTriangle },
  BLOCKED: { label: "BLOCKED", badge: "bg-red-50 text-red-700", icon: "text-red-600", iconComponent: XCircle },
};

/**
 * P12.24 — Export readiness : "document exportable" est distinct de
 * "travail scientifiquement prêt" (P11). Un document peut être
 * techniquement exportable même si le travail reste incomplet — les
 * deux notions ne doivent jamais être confondues à l'écran.
 */
export default function ExportReadiness({ readiness }: { readiness: ExportReadinessResult }) {
  const overall = META[readiness.overallStatus];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Readiness d&apos;export</p>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${overall.badge}`}>{overall.label}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-acadia-navy">
          {readiness.documentExportable ? "Document exportable." : "Export bloqué — voir les contrôles ci-dessous."}
        </p>
        <p className="mt-2 text-2xs text-slate-400">
          « Document exportable » signifie que la mise en page peut être produite — jamais que le travail
          scientifique est prêt (voir la readiness scientifique dans l&apos;onglet Validation de la Production
          scientifique).
        </p>
      </div>

      <div className="space-y-2">
        {readiness.items.map((checkItem) => {
          const meta = META[checkItem.status];
          const Icon = meta.iconComponent;
          return (
            <div key={checkItem.id} className="flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.icon}`} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-acadia-navy">{checkItem.label}</p>
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
