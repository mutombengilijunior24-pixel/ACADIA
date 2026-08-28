"use client";

import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

type Props = {
  id: number;
  title: string;
  university: string;
  progress: number;
  stage: string;
  pages: number;
  chapters: number;
  references: number;
  updated: string;
  status: "success" | "progress" | "new";
};

export default function ProjectCard({
  title,
  university,
  progress,
  stage,
  pages,
  chapters,
  references,
  updated,
  status,
}: Props) {
  const color =
    status === "success"
      ? "from-emerald-500 to-green-600"
      : status === "progress"
      ? "from-orange-500 to-amber-500"
      : "from-blue-600 to-indigo-600";

  const badge =
    status === "success"
      ? "Prêt pour la soutenance"
      : status === "progress"
      ? "Recherche en cours"
      : "Nouveau projet";

  return (
    <div
      className="
        group
        relative
        overflow-hidden
        rounded-[30px]
        border
        border-slate-200
        bg-white
        p-8
        shadow-sm
        transition-all
        duration-500
        hover:-translate-y-2
        hover:shadow-2xl
      "
    >
      {/* Halo */}

      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Header */}

      <div className="relative z-10 flex items-start justify-between">

        <div>

          <span
            className={`
              inline-flex
              rounded-full
              bg-gradient-to-r
              ${color}
              px-4
              py-2
              text-xs
              font-bold
              uppercase
              tracking-wider
              text-white
            `}
          >
            {badge}
          </span>

          <h3 className="mt-6 text-2xl font-black text-slate-900">
            {title}
          </h3>

          <p className="mt-2 flex items-center gap-2 text-slate-500">
            <GraduationCap className="h-4 w-4" />
            {university || "Commencez votre premier projet"}
          </p>

        </div>

        <button
          className="
            rounded-xl
            p-2
            transition
            hover:bg-slate-100
          "
        >
          <MoreHorizontal />
        </button>

      </div>

      {/* Progression */}

      <div className="mt-10">

        <div className="mb-3 flex items-center justify-between">

          <span className="text-sm font-semibold text-slate-500">
            Progression
          </span>

          <span className="text-xl font-black text-slate-900">
            {progress}%
          </span>

        </div>

        <div className="h-3 overflow-hidden rounded-full bg-slate-200">

          <div
            style={{ width: `${progress}%` }}
            className={`
              h-full
              rounded-full
              bg-gradient-to-r
              ${color}
            `}
          />

        </div>

      </div>

      {/* Étape */}

      <div className="mt-8 rounded-2xl bg-slate-50 p-5">

        <p className="text-sm font-semibold text-slate-500">
          Étape actuelle
        </p>

        <p className="mt-2 font-bold text-slate-900">
          {stage}
        </p>

      </div>

      {/* Stats */}

      <div className="mt-8 grid grid-cols-3 gap-4">

        <div className="rounded-2xl bg-slate-50 p-4">

          <BookOpen className="mb-2 h-5 w-5 text-blue-600" />

          <p className="text-2xl font-black">
            {chapters}
          </p>

          <p className="text-xs text-slate-500">
            Chapitres
          </p>

        </div>

        <div className="rounded-2xl bg-slate-50 p-4">

          <FileText className="mb-2 h-5 w-5 text-indigo-600" />

          <p className="text-2xl font-black">
            {pages}
          </p>

          <p className="text-xs text-slate-500">
            Pages
          </p>

        </div>

        <div className="rounded-2xl bg-slate-50 p-4">

          <Sparkles className="mb-2 h-5 w-5 text-amber-500" />

          <p className="text-2xl font-black">
            {references}
          </p>

          <p className="text-xs text-slate-500">
            Références
          </p>

        </div>

      </div>

      {/* Footer */}

      <div className="mt-8 flex items-center justify-between border-t pt-6">

        <div>

          <p className="text-sm text-slate-500">
            Dernière modification
          </p>

          <p className="font-semibold">
            {updated || "À l'instant"}
          </p>

        </div>

        <button
          className="
            group
            inline-flex
            items-center
            gap-2
            rounded-2xl
            bg-slate-900
            px-6
            py-4
            font-semibold
            text-white
            transition-all
            duration-300
            hover:bg-blue-600
          "
        >
          Continuer

          <ArrowRight className="transition group-hover:translate-x-1" />

        </button>

      </div>

    </div>
  );
}