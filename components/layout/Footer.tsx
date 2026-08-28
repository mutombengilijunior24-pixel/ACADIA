import {
  GraduationCap,
  Globe,
  Mail,
  LifeBuoy,
  BookOpen,
  ShieldCheck,
  Bell,
  ArrowUpRight,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 overflow-hidden rounded-[36px] bg-slate-950 text-white shadow-2xl">

      {/* Halo */}

      <div className="relative">

        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-8 py-20">

          {/* Première ligne */}

          <div className="grid gap-16 lg:grid-cols-4">

            {/* Logo */}

            <div className="lg:col-span-2">

              <div className="flex items-center gap-4">

                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl">

                  <GraduationCap className="h-8 w-8" />

                </div>

                <div>

                  <h2 className="text-3xl font-black tracking-tight">
                    ACADIA
                  </h2>

                  <p className="text-slate-400">
                    AI Research Workspace
                  </p>

                </div>

              </div>

              <p className="mt-8 max-w-xl text-lg leading-8 text-slate-400">
                Merci d'utiliser ACADIA pour développer vos recherches
                scientifiques. Continuez votre mémoire en toute confiance,
                sauvegardez automatiquement vos travaux et avancez étape par
                étape jusqu'à votre soutenance.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">

                <button className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-700">
                  Tableau de bord
                  <ArrowUpRight className="h-5 w-5" />
                </button>

                <button className="flex items-center gap-2 rounded-2xl border border-slate-700 px-6 py-3 font-semibold transition hover:border-blue-500 hover:bg-slate-900">
                  Documentation
                </button>

              </div>

            </div>

            {/* Support */}

            <div>

              <h3 className="text-lg font-bold">
                Assistance
              </h3>

              <ul className="mt-8 space-y-5 text-slate-400">

                <li className="flex items-center gap-3 transition hover:text-white cursor-pointer">
                  <LifeBuoy className="h-5 w-5 text-blue-500" />
                  Centre d'aide
                </li>

                <li className="flex items-center gap-3 transition hover:text-white cursor-pointer">
                  <Mail className="h-5 w-5 text-blue-500" />
                  Support
                </li>

                <li className="flex items-center gap-3 transition hover:text-white cursor-pointer">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  Documentation
                </li>

                <li className="flex items-center gap-3 transition hover:text-white cursor-pointer">
                  <Bell className="h-5 w-5 text-blue-500" />
                  Nouveautés
                </li>

              </ul>

            </div>

            {/* Compte */}

            <div>

              <h3 className="text-lg font-bold">
                Compte
              </h3>

              <ul className="mt-8 space-y-5 text-slate-400">

                <li className="transition hover:text-white cursor-pointer">
                  Mon profil
                </li>

                <li className="transition hover:text-white cursor-pointer">
                  Paramètres
                </li>

                <li className="transition hover:text-white cursor-pointer">
                  Abonnement
                </li>

                <li className="flex items-center gap-3 transition hover:text-white cursor-pointer">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  Confidentialité
                </li>

              </ul>

            </div>

          </div>

          {/* Séparateur */}

          <div className="my-14 h-px bg-slate-800" />

          {/* Bas */}

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="font-semibold text-white">
                © 2026 ACADIA
              </p>

              <p className="mt-2 text-slate-400">
                Conçu à Lubumbashi 🇨🇩 pour les chercheurs africains.
              </p>

            </div>

            <div className="flex gap-4">

              <button className="rounded-2xl bg-slate-900 p-4 transition hover:bg-blue-600">
                <Globe className="h-5 w-5" />
              </button>

              <button className="rounded-2xl bg-slate-900 p-4 transition hover:bg-blue-600">
                <Mail className="h-5 w-5" />
              </button>

              <button className="rounded-2xl bg-slate-900 p-4 transition hover:bg-blue-600">
                <LifeBuoy className="h-5 w-5" />
              </button>

            </div>

          </div>

        </div>

      </div>

    </footer>
  );
}