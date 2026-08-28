import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-acadia-blue">Erreur 404</p>
      <h1 className="mt-3 text-2xl font-bold text-acadia-navy">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-acadia-blue/90"
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
