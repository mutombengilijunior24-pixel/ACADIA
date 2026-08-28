"use client";

export default function WorkspaceHeader() {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-500 p-10 text-white">

      <p className="text-sm uppercase tracking-widest opacity-80">
        Workspace
      </p>

      <h1 className="mt-3 text-4xl font-black">
        Mon Projet
      </h1>

      <p className="mt-3 max-w-2xl text-blue-100">
        Gérez votre mémoire, vos chapitres, votre bibliographie et votre assistant IA.
      </p>

    </div>
  );
}