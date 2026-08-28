"use client";

type ProjectFiltersProps = {
  value: string;
  onChange: (value: string) => void;
};

const filters = [
  "Tous",
  "Brouillons",
  "En cours",
  "Terminés",
  "Archivés",
];

export default function ProjectFilters({
  value,
  onChange,
}: ProjectFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const active = value === filter;

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={
              active
                ? "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            }
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}