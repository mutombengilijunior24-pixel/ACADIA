"use client";

import { useState } from "react";

import ProjectCard from "./ProjectCard";
import SearchProjects from "./SearchProjects";
import ProjectFilters from "./ProjectFilters";

import { useProjects } from "@/contexts/ProjectContext";

export default function ProjectGrid() {
  const { projects, demoProjects } = useProjects();

  const [searchValue, setSearchValue] = useState("");
  const [filterValue, setFilterValue] = useState("Tous");
  // P13.2 — les projets de démonstration ne s'affichent que sur
  // demande explicite, jamais mélangés silencieusement aux vrais
  // projets du compte (voir ACADIA_P13_2_AUDIT.md).
  const [showDemo, setShowDemo] = useState(false);

  const sourceProjects = showDemo ? demoProjects : projects;

  const filteredProjects = sourceProjects.filter((project) => {
    const matchSearch =
      project.title
        .toLowerCase()
        .includes(searchValue.toLowerCase()) ||
      project.name
        .toLowerCase()
        .includes(searchValue.toLowerCase());

    const matchFilter =
      filterValue === "Tous" ||
      project.level === filterValue;

    return matchSearch && matchFilter;
  });

  return (
    <section className="mt-10">

      <div className="mb-8">
        <SearchProjects
          value={searchValue}
          onChange={setSearchValue}
        />
      </div>

      <div className="mb-8">
        <ProjectFilters
          value={filterValue}
          onChange={setFilterValue}
        />
      </div>

      {showDemo && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3">
          <p className="text-sm font-semibold text-amber-800">
            Vous consultez des projets de démonstration — ils ne font pas partie de votre compte.
          </p>
          <button
            type="button"
            onClick={() => setShowDemo(false)}
            className="text-sm font-semibold text-amber-800 underline hover:text-amber-900"
          >
            Revenir à mes projets
          </button>
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">

          <h3 className="text-2xl font-bold text-slate-800">
            {showDemo ? "Aucun projet de démonstration" : "Vous n'avez encore aucune recherche."}
          </h3>

          <p className="mt-3 text-slate-500">
            Commencez par créer votre premier projet de recherche.
          </p>

          {!showDemo && demoProjects.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="mt-6 text-sm font-semibold text-acadia-blue hover:underline"
            >
              Voir un projet de démonstration →
            </button>
          )}

        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">

          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}

        </div>
      )}

    </section>
  );
}
