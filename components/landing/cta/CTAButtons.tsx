import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";

export default function CTAButtons() {
  return (
    <div className="mt-12 flex flex-col items-center justify-center gap-5 sm:flex-row">
      <Link
        href="/register?next=/dashboard/research/new"
        className="group inline-flex items-center gap-3 rounded-2xl bg-white px-9 py-5 text-lg font-bold text-slate-900 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
      >
        Commencer
        <ArrowRight className="transition group-hover:translate-x-1" />
      </Link>
      <a
        href="#workflow"
        className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-9 py-5 text-lg font-semibold text-white backdrop-blur transition-all duration-300 hover:bg-white/20"
      >
        <ListChecks className="h-6 w-6" />
        Voir comment ça marche
      </a>
    </div>
  );
}
