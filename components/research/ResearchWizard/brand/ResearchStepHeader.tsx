import GuidanceVideo, { type GuidanceVideoProps } from "@/components/shared/GuidanceVideo";

interface ResearchStepHeaderProps {
  /** Index de l'étape, 0-based (aligné sur ResearchWizard / STEP_METADATA). */
  step: number;
  totalSteps?: number;
  category: string;
  title: string;
  description?: string;
  /** P13.14 — guidage vidéo optionnel, jamais obligatoire. */
  guidance?: GuidanceVideoProps;
}

export default function ResearchStepHeader({
  step,
  totalSteps = 15,
  category,
  title,
  description,
  guidance,
}: ResearchStepHeaderProps) {
  const stepNumber = String(step + 1).padStart(2, "0");
  const totalLabel = String(totalSteps).padStart(2, "0");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
        <span className="rounded-md bg-acadia-blue-50 px-2 py-1 tracking-[0.14em] text-acadia-blue uppercase">
          Étape {stepNumber} / {totalLabel}
        </span>
        <span className="text-slate-300">•</span>
        <span className="tracking-[0.14em] text-slate-500 uppercase">
          {category}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl leading-snug font-extrabold tracking-tight text-acadia-navy sm:text-3xl">
          {title}
        </h1>
        {guidance && <GuidanceVideo {...guidance} />}
      </div>

      {description && (
        <p className="mt-2.5 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
