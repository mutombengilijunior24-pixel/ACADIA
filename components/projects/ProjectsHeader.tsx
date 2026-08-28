"use client";

import {
  FolderKanban,
  Plus,
  BookOpen,
  Clock3,
  GraduationCap,
} from "lucide-react";

type Props = {
  onNewProject: () => void;
};

export default function ProjectsHeader({
  onNewProject,
}: Props) {
  return (
    <section className="mb-10">

      {/* Header */}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">

        <div>

          <div className="flex items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-white shadow-lg">

              <FolderKanban className="h-8 w-8" />

            </div>

            <div>

              <h1 className="text-5xl font-black text-slate-900">
                Mes projets
              </h1>

              <p className="mt-2 text-lg text-slate-500">
                Gérez tous vos mémoires et recherches depuis un seul espace.
              </p>

            </div>

          </div>

        </div>

        <button
  onClick={onNewProject}
  className="
            group
            flex
            items-center
            gap-3
            rounded-2xl
            bg-blue-600
            px-7
            py-4
            text-lg
            font-bold
            text-white
            shadow-lg
            transition
            hover:scale-105
            hover:bg-blue-700
          "
        >
          <Plus className="h-6 w-6 transition group-hover:rotate-90" />

          Nouveau projet

        </button>

      </div>

      {/* Statistiques */}

      <div className="mt-10 grid gap-6 md:grid-cols-3">

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <div className="rounded-2xl bg-blue-100 p-4">

              <BookOpen className="h-7 w-7 text-blue-600" />

            </div>

            <div>

              <p className="text-sm text-slate-500">
                Total des projets
              </p>

              <h2 className="text-4xl font-black text-slate-900">
                12
              </h2>

            </div>

          </div>

        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <div className="rounded-2xl bg-emerald-100 p-4">

              <Clock3 className="h-7 w-7 text-emerald-600" />

            </div>

            <div>

              <p className="text-sm text-slate-500">
                Projets actifs
              </p>

              <h2 className="text-4xl font-black text-slate-900">
                5
              </h2>

            </div>

          </div>

        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-4">

            <div className="rounded-2xl bg-violet-100 p-4">

              <GraduationCap className="h-7 w-7 text-violet-600" />

            </div>

            <div>

              <p className="text-sm text-slate-500">
                Soutenances prévues
              </p>

              <h2 className="text-4xl font-black text-slate-900">
                2
              </h2>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}