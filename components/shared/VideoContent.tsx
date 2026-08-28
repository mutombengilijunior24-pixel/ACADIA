"use client";

// ============================================================
// ACADIA — CONTENU VIDÉO PARTAGÉ (P13)
//
// Moteur commun à ProductDemoVideo (landing) et GuidanceVideo
// (guidage in-app). Aucun fichier vidéo fictif n'est ajouté ici :
// tant que `videoUrl` n'est pas fourni, un poster premium et un
// message honnête sont affichés à la place — jamais une fausse
// lecture vidéo.
// ============================================================

import { useState } from "react";
import { Play } from "lucide-react";

export interface VideoContentProps {
  title: string;
  description?: string;
  videoUrl?: string;
  poster?: string;
  duration?: string;
}

export function VideoContentPlayer({ title, description, videoUrl, poster, duration }: VideoContentProps) {
  const [playing, setPlaying] = useState(false);

  if (playing && videoUrl) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        <video src={videoUrl} controls autoPlay poster={poster} className="h-full w-full">
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => videoUrl && setPlaying(true)}
      disabled={!videoUrl}
      className="group relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-center"
      style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <span
        className={`flex h-20 w-20 items-center justify-center rounded-full text-3xl text-white shadow-xl transition ${videoUrl ? "cursor-pointer group-hover:scale-110" : "cursor-default opacity-70"}`}
        style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
      >
        <Play className="ml-1 h-8 w-8" fill="white" />
      </span>
      <h3 className="mt-6 text-xl font-bold text-slate-800">{title}</h3>
      {description && <p className="mt-2 max-w-sm px-4 text-sm text-slate-500">{description}</p>}
      {!videoUrl && <p className="mt-2 text-xs text-slate-400">Vidéo à venir — aucune vidéo n&apos;est encore disponible ici.</p>}
      {duration && videoUrl && <p className="mt-2 text-xs text-slate-400">{duration}</p>}
    </button>
  );
}
