// ============================================================
// ACADIA — DÉCLENCHEMENT D'ÉVÉNEMENT PRODUIT CÔTÉ CLIENT (Bloc 2, 08/09/2026)
//
// Fire-and-forget : n'attend jamais de réponse, n'affiche jamais
// d'erreur à l'utilisateur si l'envoi échoue (réseau coupé, etc.) —
// le tracking est secondaire à l'action principale (voir mission §4).
// Réservé aux moments sans aller-retour serveur naturel à réutiliser
// (la plupart des événements sont journalisés directement dans leur
// route existante, jamais ici — voir lib/server/analytics/ProductEvents.ts).
// ============================================================

export function trackClientEvent(
  eventType: string,
  options?: { projectId?: string; metadata?: Record<string, string | number | boolean> }
): void {
  try {
    void fetch("/api/product/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, projectId: options?.projectId, metadata: options?.metadata }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Le tracking ne doit jamais interrompre le parcours utilisateur.
  }
}
