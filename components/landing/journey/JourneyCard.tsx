"use client";

import { useState } from "react";
import PricingModal from "./PricingModal";

import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  BookOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  BarChart3,
  Lock,
} from "lucide-react";

type Props = {
  id: number;
  step: string;
  icon: string;
  title: string;
  description: string;
  status: "completed" | "current" | "locked";
  locked: boolean;
};

export default function JourneyCard({
  id,
  step,
  icon,
  title,
  description,
  status,
  locked,
}: Props) {
  const completed = status === "completed";
  const current = status === "current";

  const [open, setOpen] = useState(false);
  const icons = {
    folder: FolderOpen,
    brain: Brain,
    clipboard: ClipboardList,
    chart: BarChart3,
    book: BookOpen,
    file: FileText,
    graduation: GraduationCap,
  };

  const Icon =
    icons[icon as keyof typeof icons] ?? FolderOpen;

  return (
    <div
      className={`
        group
        relative
        overflow-hidden
        rounded-[34px]
        border
        p-8
        transition-all
        duration-500
        hover:-translate-y-2
        hover:shadow-2xl

        ${
          current
            ? "border-blue-500 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white shadow-xl"
            : completed
            ? "border-emerald-200 bg-white"
            : "border-slate-200 bg-white"
        }
      `}
    >
      {/* Halo lumineux */}

      {current && (
        <>
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-12 bottom-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
        </>
      )}

      <div className="relative z-10">

        {/* Header */}

        <div className="flex items-start justify-between">

          <div>

            <span
              className={`
                inline-flex
                rounded-full
                px-3
                py-1
                text-xs
                font-bold
                tracking-[0.25em]
                uppercase

                ${
                  current
                    ? "bg-white/15 text-white"
                    : completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }
              `}
            >
              Étape {step}
            </span>

          </div>

          <div
            className={`
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl

              ${
                current
                  ? "bg-white/15"
                  : completed
                  ? "bg-emerald-100"
                  : "bg-slate-100"
              }
            `}
          >
            {completed ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            ) : locked ? (
              <Lock
                className={`h-6 w-6 ${
                  current
                    ? "text-white"
                    : "text-slate-500"
                }`}
              />
            ) : (
              <Icon
                className={`h-7 w-7 ${
                  current
                    ? "text-white"
                    : "text-blue-600"
                }`}
              />
            )}
          </div>

        </div>

        {/* Titre */}

        <h3
          className={`
            mt-8
            text-3xl
            font-black
            leading-tight

            ${
              current
                ? "text-white"
                : "text-slate-900"
            }
          `}
        >
          {title}
        </h3>

        {/* Description */}

        <p
          className={`
            mt-5
            leading-8

            ${
              current
                ? "text-blue-100"
                : "text-slate-600"
            }
          `}
        >
          {description}
        </p>

        {/* État */}

        <div className="mt-8">

          {completed && (
            <span className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
              ✓ Étape terminée
            </span>
          )}

          {current && (
            <span className="inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
              En cours
            </span>
          )}

          {locked && (
            <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
              Fonctionnalité verrouillée
            </span>
          )}

        </div>

        {/* CTA */}

        <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6">

          <div>

            <p
              className={`
                text-sm

                ${
                  current
                    ? "text-blue-100"
                    : "text-slate-500"
                }
              `}
            >
              {locked
                ? "Continuez votre recherche"
                : completed
                ? "Recherche débloquée"
                : "Étape actuelle"}
            </p>

            {locked && (
              <p className="mt-1 font-bold text-blue-600">
                À partir de 5 $
              </p>
            )}

          </div>

          <button
  onClick={() => {
    if (locked) {
      setOpen(true);
    }
  }}
  className={`
              flex
              items-center
              gap-2
              rounded-xl
              px-5
              py-3
              font-semibold
              transition-all
              duration-300

              ${
                current
                  ? "bg-white text-slate-900 hover:scale-105"
                  : completed
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }
            `}
          >
            {locked
              ? "Débloquer"
              : completed
              ? "Revoir"
              : "Continuer"}

            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />

          </button>

        </div>

        </div>

      <PricingModal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        price="5 $"
        features={[
          "Assistant IA spécialisé",
          "Questionnaires intelligents",
          "Export Word",
          "Export PDF",
          "Corrections illimitées",
          "Support prioritaire",
        ]}
      />

    </div>
  );
}