import { redirect } from "next/navigation";

// ============================================================
// ACADIA — "MES PROJETS" RETIRÉ (passe UX)
//
// Cette page reposait sur ProjectContext (contexts/ProjectContext.tsx),
// un état React en mémoire uniquement — aucune persistance serveur,
// aucune sauvegarde dans PostgreSQL. Un utilisateur y créant un
// "projet" le perdait intégralement au rechargement de la page, alors
// que la sidebar/le dashboard le présentaient comme une destination
// principale au même titre que "Mes recherches" (contexts/ResearchContext.tsx,
// réellement persisté). Plutôt que de maintenir deux systèmes parallèles
// dont un trompeur, ce lien redirige vers le système réel.
// ============================================================

export default function ProjectsPage() {
  redirect("/dashboard/research");
}
