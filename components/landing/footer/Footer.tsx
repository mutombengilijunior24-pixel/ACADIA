import {
  GraduationCap,
  Globe,
  Mail,
  Phone,
  ArrowUpRight,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-24">

        <div className="grid gap-16 lg:grid-cols-5">

          {/* Logo */}

          <div className="lg:col-span-2">

            <div className="flex items-center gap-3">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
                <GraduationCap className="h-7 w-7" />
              </div>

              <div>
                <h2 className="text-3xl font-black">
                  ACADIA
                </h2>

                <p className="text-slate-400">
                  AI Research Assistant
                </p>
              </div>

            </div>

            <p className="mt-8 max-w-md leading-8 text-slate-400">
              ACADIA accompagne les étudiants, chercheurs et universités
              dans la réalisation de travaux scientifiques plus rapides,
              plus fiables et mieux structurés grâce à l'intelligence
              artificielle.
            </p>

          </div>

          {/* Produit */}

          <div>

            <h3 className="font-bold text-white">
              Produit
            </h3>

            <ul className="mt-6 space-y-4 text-slate-400">
              <li className="hover:text-white cursor-pointer transition">
                Assistant IA
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Questionnaires
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Analyses statistiques
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Bibliographie
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Tarification
              </li>
            </ul>

          </div>

          {/* Ressources */}

          <div>

            <h3 className="font-bold text-white">
              Ressources
            </h3>

            <ul className="mt-6 space-y-4 text-slate-400">
              <li className="hover:text-white cursor-pointer transition">
                Documentation
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Guide
              </li>

              <li className="hover:text-white cursor-pointer transition">
                FAQ
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Tutoriels
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Blog
              </li>
            </ul>

          </div>

          {/* Entreprise */}

          <div>

            <h3 className="font-bold text-white">
              Entreprise
            </h3>

            <ul className="mt-6 space-y-4 text-slate-400">
              <li className="hover:text-white cursor-pointer transition">
                À propos
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Contact
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Partenaires
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Confidentialité
              </li>

              <li className="hover:text-white cursor-pointer transition">
                Conditions
              </li>
            </ul>

          </div>

        </div>

        {/* Bas du footer */}

        <div className="mt-20 border-t border-slate-800 pt-8">

          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">

            <p className="text-slate-400">
              © 2026 ACADIA. Tous droits réservés.
              <br />
              Conçu à Lubumbashi pour les chercheurs africains.
            </p>

            <div className="flex gap-4">

              <button className="rounded-xl bg-slate-900 p-3 transition hover:bg-blue-600">
                <Globe className="h-5 w-5" />
              </button>

              <button className="rounded-xl bg-slate-900 p-3 transition hover:bg-blue-600">
                <Mail className="h-5 w-5" />
              </button>

              <button className="rounded-xl bg-slate-900 p-3 transition hover:bg-blue-600">
                <Phone className="h-5 w-5" />
              </button>

              <button className="rounded-xl bg-slate-900 p-3 transition hover:bg-blue-600">
                <ArrowUpRight className="h-5 w-5" />
              </button>

            </div>

          </div>

        </div>

      </div>
    </footer>
  );
}