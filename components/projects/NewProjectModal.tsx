"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { Project } from "@/types/Project";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function NewProjectModal({ open, onClose }: Props) {
  const { addProject } = useProjects();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [university, setUniversity] = useState("");
  const [director, setDirector] = useState("");
  const [level, setLevel] = useState<"Licence" | "Master" | "Doctorat">("Licence");

  if (!open) return null;

  function handleCreate() {
    if (!name.trim() || !title.trim()) return;

    const project: Project = {
      id: crypto.randomUUID(),
      name,
      title,
      university,
      faculty: "",
      department: "",
      director,
      academicYear: "2025-2026",
      level,
      progress: 0,
      currentChapter: "Introduction",
      status: "active",
      updatedAt: "À l'instant",
      createdAt: new Date().toISOString(),
    };

    addProject(project);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-2xl font-bold">Nouveau projet</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <input
            value={name}
            onChange={(e)=>setName(e.target.value)}
            placeholder="Nom du projet"
            className="w-full rounded-xl border p-3"
          />

          <textarea
            value={title}
            onChange={(e)=>setTitle(e.target.value)}
            placeholder="Titre du mémoire"
            className="w-full rounded-xl border p-3"
            rows={4}
          />

          <input
            value={university}
            onChange={(e)=>setUniversity(e.target.value)}
            placeholder="Université"
            className="w-full rounded-xl border p-3"
          />

          <input
            value={director}
            onChange={(e)=>setDirector(e.target.value)}
            placeholder="Directeur"
            className="w-full rounded-xl border p-3"
          />

          <select
            value={level}
            onChange={(e)=>setLevel(e.target.value as "Licence"|"Master"|"Doctorat")}
            className="w-full rounded-xl border p-3"
          >
            <option>Licence</option>
            <option>Master</option>
            <option>Doctorat</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 border-t p-6">
          <button
            onClick={onClose}
            className="rounded-xl border px-5 py-3"
          >
            Annuler
          </button>

          <button
            onClick={handleCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-white"
          >
            Créer le projet
          </button>
        </div>
      </div>
    </div>
  );
}
