"use client";

// ============================================================
// ACADIA — REPRISE APRÈS PREVIEW (MVP simplification, 10/09/2026)
//
// Seul but : convertir la preview obtenue avant inscription (sujet +
// narration IA, voir components/landing/SubjectPreviewOverlay.tsx)
// en un vrai projet, sans perte, puis rediriger vers ce projet. Ne
// relance jamais l'IA — createResearchFromPreview réutilise le
// résultat déjà obtenu (voir contexts/ResearchContext.tsx).
//
// BUG RÉEL CORRIGÉ (10/09/2026) : juste après l'inscription,
// ResearchProvider se monte pour la toute première fois (il ne
// couvre pas /register) et lance son hydratation initiale
// (localStorage, potentiellement vide pour un compte tout neuf) en
// arrière-plan. Appeler createResearchFromPreview() avant la fin de
// cette hydratation faisait gagner la course à l'hydratation : le
// projet fraîchement créé était écrasé par un état vide juste après
// avoir été ajouté, d'où "Projet introuvable" sur la page suivante.
// On attend désormais isHydrated avant de muter quoi que ce soit.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import { trackClientEvent } from "@/lib/client/trackEvent";
import { readPendingPreview, clearPendingPreview } from "@/lib/client/previewStorage";

export default function PreviewResumePage() {
  const router = useRouter();
  const { createResearchFromPreview, isHydrated } = useResearch();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!isHydrated || ran.current) return;
    ran.current = true;

    const pending = readPendingPreview();
    if (!pending) {
      router.replace("/dashboard?onboarding=1");
      return;
    }

    try {
      const research = createResearchFromPreview(pending.subject, pending.understanding, pending.contextItems);
      trackClientEvent("ACCOUNT_CREATED_AFTER_PREVIEW", { projectId: research.id });
      clearPendingPreview();
      router.replace(`/dashboard/research/${research.id}`);
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  if (failed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base font-semibold text-acadia-navy">
          Votre proposition n&apos;a pas pu être récupérée automatiquement.
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          Rien n&apos;est perdu de votre compte — vous pouvez démarrer une nouvelle recherche normalement.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/dashboard/research/new")}
          className="rounded-xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white hover:brightness-110"
        >
          Démarrer ma recherche
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-acadia-blue" />
      <p className="text-sm text-slate-500">Préparation de votre recherche...</p>
    </div>
  );
}
