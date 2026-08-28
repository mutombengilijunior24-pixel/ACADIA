"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Project } from "@/types/Project";
import { useProjects } from "@/contexts/ProjectContext";
import ProjectForm from "./ProjectForm";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project | null;
};

export default function EditProjectModal({
  open,
  onClose,
  project,
}: Props) {
  const { updateProject } = useProjects();

  const [form, setForm] = useState<Partial<Project>>({});

  useEffect(() => {
    if (project) {
      setForm(project);
    }
  }, [project]);

  if (!open || !project) return null;

  function handleSave() {
    updateProject(form as Project);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">

      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b p-6">

          <h2 className="text-2xl font-bold">
            Modifier le projet
          </h2>

          <button onClick={onClose}>
            <X />
          </button>

        </div>

        <div className="p-6">

          <ProjectForm
            project={form}
            onChange={setForm}
          />

        </div>

        <div className="flex justify-end gap-4 border-t p-6">

          <button
            onClick={onClose}
            className="rounded-xl border px-5 py-3"
          >
            Annuler
          </button>

          <button
            onClick={handleSave}
            className="rounded-xl bg-blue-600 px-5 py-3 text-white"
          >
            Enregistrer
          </button>

        </div>

      </div>

    </div>
  );
}