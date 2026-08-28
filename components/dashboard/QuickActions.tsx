"use client";

import Link from "next/link";
import {
  FilePlus2,
  FolderKanban,
  FolderOpen,
  Settings,
  ArrowRight,
} from "lucide-react";

const actions = [
  {
    title: "Nouvelle recherche",
    description: "Démarrer un nouveau mémoire avec l'assistant ACADIA",
    href: "/dashboard/research/new",
    icon: FilePlus2,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Mes recherches",
    description: "Reprendre une recherche en cours",
    href: "/dashboard/research",
    icon: FolderKanban,
    color: "from-violet-500 to-indigo-600",
  },
  {
    title: "Mes projets",
    description: "Vue d'ensemble de vos projets",
    href: "/dashboard/projects",
    icon: FolderOpen,
    color: "from-emerald-500 to-green-600",
  },
  {
    title: "Paramètres du compte",
    description: "Gérer votre profil et votre mot de passe",
    href: "/dashboard/settings",
    icon: Settings,
    color: "from-slate-700 to-slate-900",
  },
];

export default function QuickActions() {
  return (
    <section className="mt-16">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Actions rapides</h2>
        <p className="mt-2 text-slate-500">Accédez instantanément aux fonctionnalités principales d&apos;ACADIA.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-7 text-left shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r ${action.color} text-white shadow-lg`}>
                <Icon className="h-8 w-8" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">{action.title}</h3>
              <p className="mt-3 leading-7 text-slate-500">{action.description}</p>
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-sm font-semibold text-blue-600">Ouvrir</span>
                <ArrowRight className="h-5 w-5 text-blue-600 transition group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
