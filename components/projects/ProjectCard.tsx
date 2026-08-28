"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ArrowRight,
  Pencil,
  Trash2,
  Archive,
} from "lucide-react";

import { Project } from "@/types/Project";
import { useProjects } from "@/contexts/ProjectContext";

import EditProjectModal from "./EditProjectModal";
import DeleteProjectModal from "./DeleteProjectModal";
import ArchiveProjectModal from "./ArchiveProjectModal";

type Props = {
  project: Project;
};

export default function ProjectCard({
  project,
}: Props) {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openArchive, setOpenArchive] = useState(false);

  const { deleteProject, archiveProject } = useProjects();

  const {
    title,
    university,
    level,
    progress,
    currentChapter,
    updatedAt,
  } = project;

  return (
    <>
      <div
        className="
          group
          relative
          overflow-hidden
          rounded-[32px]
          border
          border-slate-200
          bg-white
          p-7
          shadow-sm
          transition-all
          duration-300
          hover:-translate-y-2
          hover:border-blue-300
          hover:shadow-2xl
        "
      >
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-50 blur-3xl" />

        <div className="relative z-10">

          <div className="flex items-start justify-between">

            <div className="flex items-center gap-4">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                <BookOpen className="h-8 w-8 text-blue-600" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {title}
                </h2>

                <p className="mt-1 text-slate-500">
                  {university}
                </p>
              </div>

            </div>

            <div className="flex gap-2">

              <button
                onClick={() => setOpenEdit(true)}
                className="rounded-xl p-2 hover:bg-slate-100"
              >
                <Pencil className="h-5 w-5 text-slate-600" />
              </button>

              <button
                onClick={() => setOpenDelete(true)}
                className="rounded-xl p-2 hover:bg-red-50"
              >
                <Trash2 className="h-5 w-5 text-red-600" />
              </button>

              <button
                onClick={() => setOpenArchive(true)}
                className="rounded-xl p-2 hover:bg-amber-50"
              >
                <Archive className="h-5 w-5 text-amber-600" />
              </button>

            </div>

          </div>

          <div className="mt-8 flex items-center justify-between">

            <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              {level}
            </span>

            <span className="font-bold text-blue-600">
              {progress}%
            </span>

          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">

            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-5">

            <p className="text-sm text-slate-500">
              Étape actuelle
            </p>

            <h3 className="mt-2 text-lg font-bold text-slate-900">
              {currentChapter}
            </h3>

          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {updatedAt}
            </div>

            <Link
              href={`/dashboard/projects/${project.id}`}
              className="group flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Continuer

              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>

          </div>

        </div>

      </div>
            <EditProjectModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        project={project}
      />

      <DeleteProjectModal
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onDelete={() => {
          deleteProject(project.id);
          setOpenDelete(false);
        }}
      />

      <ArchiveProjectModal
        open={openArchive}
        onClose={() => setOpenArchive(false)}
        onArchive={() => {
          archiveProject(project.id);
          setOpenArchive(false);
        }}
      />
    </>
  );
}