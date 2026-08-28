"use client";

import { useState } from "react";
import { generate } from "@/lib/services/ai";

export default function AIPanel() {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    try {
      setLoading(true);

      const result = await generate(`
Rédige une introduction académique complète sur le sujet :
"L'impact du marketing digital sur la performance des PME en RDC".
`);

      console.log(result);

      alert("Introduction générée.");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border bg-white p-6">
      <h2 className="text-2xl font-bold">
        Assistant IA
      </h2>

      <p className="mt-4 text-slate-500">
        Génération intelligente de mémoire.
      </p>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Génération..." : "Générer l'introduction"}
      </button>
    </div>
  );
}