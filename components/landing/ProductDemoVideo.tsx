"use client";

import { VideoContentPlayer } from "@/components/shared/VideoContent";

// ============================================================
// P13.5 — Emplacement vidéo premium du Hero/Demo. Prêt à recevoir
// /videos/acadia-introduction.mp4 plus tard (voir
// ACADIA_P13_PRODUCT_ARCHITECTURE.md) — aucune vidéo fictive
// n'est ajoutée dans ce sprint.
// ============================================================

const DEMO_VIDEO_URL: string | undefined = undefined; // ex. "/videos/acadia-introduction.mp4"

export default function ProductDemoVideo() {
  return (
    <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-2xl">
      <VideoContentPlayer
        title="Voir ACADIA en 30 secondes"
        description="Regardez comment ACADIA transforme un sujet de recherche en travail scientifique structuré."
        videoUrl={DEMO_VIDEO_URL}
        duration="0:30"
      />
    </div>
  );
}
