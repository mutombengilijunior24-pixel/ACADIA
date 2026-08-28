"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import HeroFlowPreview from "./HeroFlowPreview";

export default function Hero() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid items-center gap-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-acadia-blue-50 px-5 py-2 text-sm font-semibold text-acadia-blue">
              Academic Intelligence for Economics &amp; Management
            </span>

            <h1 className="mt-8 text-5xl font-extrabold leading-[1.05] tracking-tight text-acadia-navy lg:text-6xl">
              Transformez votre recherche
              <br />
              en travail scientifique
              <span className="text-acadia-blue"> structuré.</span>
            </h1>

            <p className="mt-8 max-w-xl text-xl leading-9 text-slate-600">
              ACADIA vous accompagne du sujet jusqu&apos;à l&apos;analyse, l&apos;interprétation et la production de
              votre travail scientifique — spécialisé en Sciences Économiques et de Gestion.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="flex items-center gap-2 rounded-xl px-8 py-4 font-semibold text-white transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
              >
                Commencer ma recherche
                <ArrowRight size={18} />
              </Link>

              <a
                href="#workflow"
                className="rounded-xl border border-slate-300 bg-white px-8 py-4 font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Découvrir ACADIA
              </a>
            </div>

            <div className="mt-10 space-y-3 text-slate-600">
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Gratuit pour commencer
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Sans carte bancaire
              </p>
              <p className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-500" size={20} />
                Le chercheur reste décisionnaire à chaque étape
              </p>
            </div>
          </div>

          <HeroFlowPreview />
        </div>
      </div>
    </section>
  );
}
