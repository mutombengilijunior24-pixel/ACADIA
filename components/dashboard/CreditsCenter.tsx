"use client";

import { Sparkles, CheckCircle2, Circle } from "lucide-react";
import { listFeatureAccess, getPlan } from "@/lib/core/entitlements/EntitlementEngine";
import { DEFAULT_PLAN_ID } from "@/lib/core/entitlements/EntitlementTypes";

export default function CreditsCenter() {
  const plan = getPlan(DEFAULT_PLAN_ID);
  const features = listFeatureAccess(DEFAULT_PLAN_ID);

  return (
    <section className="mt-16">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Votre plan ACADIA</h2>
        <p className="mt-2 text-slate-500">
          Fonctionnalités disponibles sur votre compte — pas de « crédits » à gérer.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-8 text-white shadow-2xl">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <Sparkles className="h-7 w-7" />
              <h3 className="text-2xl font-black">{plan.label}</h3>
            </div>
            <p className="mt-4 max-w-sm text-blue-100">
              {plan.monthlyPriceUsd === null
                ? "Aucune offre payante n'existe encore sur ACADIA. Toutes les fonctionnalités construites sont incluses dans ce plan."
                : `${plan.monthlyPriceUsd} $ / mois`}
            </p>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Fonctionnalités incluses</p>
          <div className="mt-4 space-y-3">
            {features.map((feature) => (
              <div key={feature.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                {feature.included ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                )}
                <div>
                  <p className="text-sm font-bold text-slate-900">{feature.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
