"use client";

import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  Plus,
  Sparkles,
  CalendarDays,
  FolderKanban,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useResearch } from "@/contexts/ResearchContext";

const TODAY_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

export default function DashboardHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const { researches } = useResearch();

  const activeCount = researches.filter((r) => r.status !== "archived").length;

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-acadia-blue">Tableau de bord</p>
            <h1 className="mt-3 text-5xl font-black text-slate-900">Bonjour {user?.firstName ?? ""} 👋</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-500">
              {activeCount > 0
                ? "Où en êtes-vous dans votre recherche ? Continuez là où vous l'avez laissée."
                : "Votre première recherche commence ici."}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-acadia-blue hover:bg-acadia-blue-50">
              <Bell className="h-6 w-6 text-slate-700" />
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard/research/new")}
              className="flex items-center gap-3 rounded-2xl px-6 py-4 font-semibold text-white transition hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)" }}
            >
              <Plus className="h-5 w-5" />
              Nouvelle recherche
            </button>
          </div>
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5">
            <Search className="h-6 w-6 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une recherche, une analyse..."
              className="w-full bg-transparent text-lg outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-acadia-blue-50 p-5">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-6 w-6 text-acadia-blue" />
              <div>
                <p className="text-sm text-slate-500">Recherches actives</p>
                <h3 className="text-2xl font-black text-slate-900">{activeCount} {activeCount > 1 ? "recherches" : "recherche"}</h3>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-violet-50 p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-violet-600" />
              <div>
                <p className="text-sm text-slate-500">Assistant ACADIA</p>
                <h3 className="text-2xl font-black text-slate-900">Disponible</h3>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-sm text-slate-500">Aujourd&apos;hui</p>
                <h3 className="text-2xl font-black capitalize text-slate-900">{TODAY_LABEL}</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
