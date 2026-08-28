"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

import { Project } from "../types/Project";
import { sampleProjects } from "../data/sampleProjects";

type ProjectContextType = {
  projects: Project[];

  // P13.2 — les projets d'exemple (data/sampleProjects.ts) ne sont
  // JAMAIS mélangés à `projects` : un compte nouvellement créé doit
  // voir 0 projet réel (voir ACADIA_P13_2_AUDIT.md, bug corrigé).
  // Exposés séparément, à afficher uniquement sur demande explicite
  // et toujours identifiés comme démonstration.
  demoProjects: Project[];

  addProject: (project: Project) => void;

  updateProject: (project: Project) => void;

  deleteProject: (id: string) => void;

  archiveProject: (id: string) => void;

  restoreProject: (id: string) => void;
};

const ProjectContext =
  createContext<ProjectContextType | null>(null);

export function ProjectProvider({
  children,
}: {
  children: ReactNode;
}) {
  // P13.2 — un compte réel démarre avec 0 projet, jamais les 3
  // projets fictifs (attribués à des directeurs fictifs) qui
  // apparaissaient auparavant à tout compte, y compris nouveau.
  const [projects, setProjects] =
    useState<Project[]>([]);

  function addProject(project: Project) {
    setProjects((prev) => [project, ...prev]);
  }

  function updateProject(project: Project) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? project : p
      )
    );
  }

  function deleteProject(id: string) {
  if (!confirm("Supprimer définitivement ce projet ?")) return;

  setProjects((prev) =>
    prev.filter((p) => p.id !== id)
  );
}

  function archiveProject(id: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "archived",
            }
          : p
      )
    );
  }

  function restoreProject(id: string) {
  setProjects((prev) =>
    prev.map((p) =>
      p.id === id
        ? {
            ...p,
            status: "active",
          }
        : p
    )
  );
}

  return (
    <ProjectContext.Provider
      value={{
        projects,
        demoProjects: sampleProjects,
        addProject,
        updateProject,
        deleteProject,
        archiveProject,
        restoreProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}


export function useProjects() {
  const context =
    useContext(ProjectContext);

  if (!context) {
    throw new Error(
      "useProjects must be used inside ProjectProvider"
    );
  }

  return context;
}