"use client";

import { Check } from "lucide-react";
import type { ComponentType } from "react";

interface ResearchOptionCardProps {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  emoji?: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
}

export default function ResearchOptionCard({
  title,
  description,
  icon: Icon,
  emoji,
  badge,
  selected,
  onClick,
}: ResearchOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all duration-150 sm:p-5 ${
        selected
          ? "border-acadia-blue bg-acadia-blue-50 shadow-xs ring-1 ring-acadia-blue/30"
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        {(Icon || emoji) && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
              selected ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {Icon ? <Icon className="h-5 w-5" /> : emoji}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm font-bold sm:text-base ${
                selected ? "text-acadia-navy" : "text-slate-900"
              }`}
            >
              {title}
            </h3>
            {badge && (
              <span className="text-2xs rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-acadia-blue bg-acadia-blue text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {selected && <Check className="h-3 w-3 stroke-[3]" />}
      </div>
    </button>
  );
}
