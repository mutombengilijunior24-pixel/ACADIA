"use client";

import { CheckCircle2 } from "lucide-react";

interface ResearchTextAreaProps {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  savedLabel?: string;
}

export default function ResearchTextArea({
  id,
  label,
  required = false,
  value,
  onChange,
  placeholder,
  rows = 5,
  savedLabel = "Enregistré",
}: ResearchTextAreaProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-acadia-navy">
        {label} {required && <span className="text-acadia-blue">*</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="shadow-2xs w-full rounded-2xl border border-slate-300 p-4 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-acadia-blue focus:ring-3 focus:ring-acadia-blue/15 focus:outline-none sm:p-5"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{value.length} caractères</span>
        {value.trim().length > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {savedLabel}
          </span>
        )}
      </div>
    </div>
  );
}
