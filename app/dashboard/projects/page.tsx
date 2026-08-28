"use client";

import { useState } from "react";

import ProjectsHeader from "@/components/projects/ProjectsHeader";
import ProjectSearch from "@/components/projects/ProjectSearch";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ProjectGrid from "@/components/projects/ProjectGrid";
import NewProjectModal from "@/components/projects/NewProjectModal";

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);

  const [filter, setFilter] = useState("Tous");

  return (
    <div className="space-y-8">
      <ProjectsHeader
        onNewProject={() => setOpen(true)}
      />

      <ProjectSearch />

      <ProjectFilters
        value={filter}
        onChange={setFilter}
      />

      <ProjectGrid />

      <NewProjectModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}