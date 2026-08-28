"use client";

import { Search, SlidersHorizontal } from "lucide-react";

export default function ProjectSearch() {
  return (
    <section className="mb-8">

      <div className="flex flex-col gap-4 lg:flex-row">

        {/* Barre de recherche */}

        <div className="relative flex-1">

          <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

          <input
            type="text"
            placeholder="Rechercher un projet, un directeur, une université..."
            className="
              w-full
              rounded-2xl
              border
              border-slate-200
              bg-white
              py-4
              pl-14
              pr-5
              text-lg
              shadow-sm
              outline-none
              transition
              focus:border-blue-500
              focus:ring-4
              focus:ring-blue-100
            "
          />

        </div>

        {/* Bouton Filtres */}

        <button
          className="
            flex
            items-center
            justify-center
            gap-3
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-6
            py-4
            font-semibold
            shadow-sm
            transition
            hover:border-blue-300
            hover:bg-blue-50
          "
        >
          <SlidersHorizontal className="h-5 w-5 text-blue-600" />

          Filtres

        </button>

      </div>

    </section>
  );
}