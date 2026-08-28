import { ReactNode } from "react";

type StatsCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  color: string;
};

export default function StatsCard({
  title,
  value,
  icon,
  color,
}: StatsCardProps) {
  return (
    <div
      className="
        group
        relative
        overflow-hidden
        rounded-[32px]
        border
        border-slate-200
        bg-white
        p-8
        shadow-sm
        transition-all
        duration-500
        hover:-translate-y-2
        hover:shadow-2xl
      "
    >
      {/* Halo */}

      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />

      {/* Ligne lumineuse */}

      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-500" />

      <div className="relative z-10">

        {/* Header */}

        <div className="flex items-start justify-between">

          <div>

            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              {title}
            </p>

            <h2 className="mt-5 text-5xl font-black text-slate-900">
              {value}
            </h2>

          </div>

          <div
            className={`
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              shadow-lg
              transition-all
              duration-300
              group-hover:scale-110
              group-hover:rotate-6
              ${color}
            `}
          >
            {icon}
          </div>

        </div>

      </div>

    </div>
  );
}