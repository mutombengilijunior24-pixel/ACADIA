"use client";

import { Project } from "@/types/Project";

type Props = {
  project: Partial<Project>;
  onChange: (project: Partial<Project>) => void;
};

export default function ProjectForm({
  project,
  onChange,
}: Props) {
  return (
    <div className="space-y-6">

      <div>
        <label className="mb-2 block font-semibold">
          Nom du projet
        </label>

        <input
          type="text"
          value={project.name || ""}
          onChange={(e) =>
            onChange({
              ...project,
              name: e.target.value,
            })
          }
          className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-600"
        />
      </div>

      <div>
        <label className="mb-2 block font-semibold">
          Titre
        </label>

        <textarea
          rows={4}
          value={project.title || ""}
          onChange={(e) =>
            onChange({
              ...project,
              title: e.target.value,
            })
          }
          className="w-full rounded-2xl border border-slate-200 p-5 outline-none focus:border-blue-600"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">

        <div>
          <label className="mb-2 block font-semibold">
            Université
          </label>

          <input
            type="text"
            value={project.university || ""}
            onChange={(e) =>
              onChange({
                ...project,
                university: e.target.value,
              })
            }
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block font-semibold">
            Directeur
          </label>

          <input
            type="text"
            value={project.director || ""}
            onChange={(e) =>
              onChange({
                ...project,
                director: e.target.value,
              })
            }
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-600"
          />
        </div>

      </div>

      <div>
        <label className="mb-2 block font-semibold">
          Cycle
        </label>

        <select
          value={project.level || "Licence"}
          onChange={(e) =>
            onChange({
              ...project,
              level: e.target.value as
                | "Licence"
                | "Master"
                | "Doctorat",
            })
          }
          className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-600"
        >
          <option>Licence</option>
          <option>Master</option>
          <option>Doctorat</option>
        </select>
      </div>

    </div>
  );
}