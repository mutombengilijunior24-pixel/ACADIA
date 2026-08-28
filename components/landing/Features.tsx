"use client";

import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from "react";
import { features } from "../../data/features";

import {
  Brain,
  ClipboardList,
  BarChart3,
  BookOpen,
  FileOutput,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const icons = {
  brain: Brain,
  clipboard: ClipboardList,
  chart: BarChart3,
  book: BookOpen,
  export: FileOutput,
  graduation: GraduationCap,
};

export default function Features() {
  return (
    <section
      id="features"
      className="bg-gradient-to-b from-white via-white to-slate-50 py-28"
    >
      <div className="mx-auto max-w-7xl px-6">

        {/* Header */}

        <div className="mx-auto max-w-3xl text-center">

          <span className="inline-flex rounded-full bg-blue-100 px-5 py-2 text-sm font-semibold text-blue-600">
            Fonctionnalités
          </span>

          <h2 className="mt-6 text-5xl font-black leading-tight text-slate-900">
            Une plateforme.
            <br />
            Tous les outils de la recherche.
          </h2>

          <p className="mt-6 text-xl leading-9 text-slate-600">
            ACADIA réunit la compréhension du sujet,
            les questionnaires, l'analyse statistique,
            l'interprétation et la production scientifique
            dans une seule plateforme.
          </p>

        </div>

        {/* Cards */}

        <div className="mt-20 grid gap-8 md:grid-cols-2 xl:grid-cols-3">

          {features.map((feature, index) => {

            const Icon =
              icons[feature.icon as keyof typeof icons];

            return (

              <div
                key={index}
                className="
                  group
                  rounded-3xl
                  border
                  border-slate-200
                  bg-white
                  p-7
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-2
                  hover:border-blue-500
                  hover:shadow-2xl
                "
              >

                {/* Icon */}

                <div
                  className={`
                    flex
                    h-16
                    w-16
                    items-center
                    justify-center
                    rounded-2xl
                    ${feature.color}
                    transition-transform
                    duration-300
                    group-hover:scale-110
                  `}
                >
                  <Icon className="h-8 w-8" />
                </div>

                {/* Title */}

                <h3 className="mt-6 text-2xl font-bold text-slate-900">
                  {feature.title}
                </h3>

                {/* Description */}

                <p className="mt-4 leading-7 text-slate-600">
                  {feature.description}
                </p>

                {/* Benefits */}

                <div className="mt-6 space-y-3">

                  {feature.benefits.map((item) => (

                    <div
                      key={item}
                      className="flex items-center gap-3"
                    >

                      <CheckCircle2 className="h-5 w-5 text-green-500" />

                      <span className="text-sm text-slate-700">
                        {item}
                      </span>

                    </div>

                  ))}

                </div>

                {/* Footer */}

                <div className="mt-8 flex items-center gap-2 font-semibold text-blue-600">

                  Explorer

                  <ArrowRight
                    className="
                      h-5
                      w-5
                      transition-transform
                      duration-300
                      group-hover:translate-x-2
                    "
                  />

                </div>

              </div>

            );

          })}

        </div>

      </div>
    </section>
  );
}