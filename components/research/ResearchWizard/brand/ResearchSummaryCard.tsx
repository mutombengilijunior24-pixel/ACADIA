interface ResearchSummaryCardProps {
  label: string;
  value?: string;
  colSpan?: 1 | 2;
}

export default function ResearchSummaryCard({
  label,
  value,
  colSpan = 1,
}: ResearchSummaryCardProps) {
  return (
    <div
      className={`shadow-2xs space-y-1 rounded-2xl border border-slate-200/90 bg-white p-4 ${
        colSpan === 2 ? "sm:col-span-2" : ""
      }`}
    >
      <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
        {label}
      </p>
      <p className="text-sm leading-relaxed font-semibold break-words text-acadia-navy">
        {value?.trim() || (
          <span className="font-normal text-slate-400 italic">Non renseigné</span>
        )}
      </p>
    </div>
  );
}
