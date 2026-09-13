"use client";

// ============================================================
// ACADIA — PORTE D'ENTITLEMENT (mission Conversion + Pay-as-you-progress)
//
// UX MINIMALE volontaire (mission §non-objectifs implicites des
// missions précédentes : pas de refonte, pas de premium visuel) —
// un seul composant réutilisable pour chaque étape verrouillée
// (Variables/Questionnaire/Analyse/Interprétation...), pas une page
// de paywall dédiée par étape.
//
// Affiche l'état verrouillé (prix, ce qui se débloque, pourquoi,
// et ensuite) tant que l'entitlement n'est pas actif ; une fois
// débloqué, rend directement `children` — jamais de friction
// supplémentaire au prochain rendu. PAYWALL_VIEWED se déclenche à
// l'affichage de l'état verrouillé, UNLOCK_CLICKED au clic — le
// reste (CHECKOUT_STARTED/PAYMENT_SUCCEEDED/ENTITLEMENT_GRANTED) est
// tracké côté serveur par EntitlementService.checkout.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import { trackClientEvent } from "@/lib/client/trackEvent";
import type { EntitlementKey } from "@/lib/server/billing/PricingConfig";

interface StageInfo {
  key: EntitlementKey;
  label: string;
  unlocks: string;
  why: string;
  thenWhat: string;
  priceUsd: number;
  unlocked: boolean;
}

export default function EntitlementGate({
  projectId,
  entitlementKey,
  children,
}: {
  projectId: string;
  entitlementKey: EntitlementKey;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked" | "error">("loading");
  const [stage, setStage] = useState<StageInfo | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewedTracked = useRef(false);
  // Stable pour la durée de vie du composant (initialiseur paresseux,
  // jamais réévalué aux rendus suivants) : un double clic sur
  // "Débloquer" réutilise la MÊME clé d'idempotence, jamais deux
  // transactions (mission §7, "double paiement").
  const [idempotencyKey] = useState(() => `unlock-${projectId}-${entitlementKey}-${Date.now()}`);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/billing/entitlements?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const found = (data.stages as StageInfo[] | undefined)?.find((s) => s.key === entitlementKey);
        if (!found) {
          setStatus("error");
          return;
        }
        setStage(found);
        setStatus(found.unlocked ? "unlocked" : "locked");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, entitlementKey]);

  useEffect(() => {
    if (status === "locked" && !viewedTracked.current) {
      viewedTracked.current = true;
      trackClientEvent("PAYWALL_VIEWED", { projectId, metadata: { entitlementKey } });
    }
  }, [status, projectId, entitlementKey]);

  async function handleUnlock() {
    trackClientEvent("UNLOCK_CLICKED", { projectId, metadata: { entitlementKey } });
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          entitlementKey,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.entitlement) {
        setError(data.error ?? "Le déblocage n'a pas pu être finalisé pour le moment.");
        return;
      }
      setStatus("unlocked");
    } catch {
      setError("Impossible de contacter ACADIA. Vérifiez votre connexion et réessayez.");
    } finally {
      setUnlocking(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Vérification de l&apos;accès...
      </div>
    );
  }

  // En cas d'erreur de vérification, on ne bloque jamais silencieusement
  // le chercheur derrière un état d'échec — on laisse passer (même
  // posture que le reste d'ACADIA : jamais bloquant pour un mécanisme
  // secondaire) plutôt que de casser une action scientifique réelle.
  if (status === "unlocked" || status === "error") {
    return <>{children}</>;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Lock className="h-4 w-4" />
        </span>
        <p className="text-sm font-bold text-acadia-navy">{stage?.label}</p>
      </div>

      {stage && (
        <div className="mt-3 space-y-1.5 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-acadia-navy">Ce que vous débloquez : </span>
            {stage.unlocks}
          </p>
          <p>
            <span className="font-semibold text-acadia-navy">Pourquoi : </span>
            {stage.why}
          </p>
          <p>
            <span className="font-semibold text-acadia-navy">Ensuite : </span>
            {stage.thenWhat}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleUnlock}
          disabled={unlocking}
          className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Débloquer — {stage && stage.priceUsd > 0 ? `${stage.priceUsd} $` : "0 $ (bêta)"}
        </button>
      </div>
    </div>
  );
}
