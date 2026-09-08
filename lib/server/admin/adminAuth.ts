// ============================================================
// ACADIA — GARDE D'ACCÈS ADMINISTRATEUR (Bloc 2, 08/09/2026)
//
// Réutilise le rôle "admin" déjà prévu dans UserRole (voir
// lib/auth/AuthTypes.ts — fondation posée en P16, jamais câblée
// jusqu'ici) et getSessionUser() (lib/supervision/apiAuth.ts) — aucun
// deuxième système d'authentification/autorisation. Aucun compte n'a
// ce rôle par défaut ; l'attribuer requiert une mise à jour directe en
// base (aucune route d'auto-attribution, contrairement à
// become-supervisor — un accès administrateur ne doit jamais être
// auto-attribuable par un utilisateur).
// ============================================================

import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";
import type { StoredUser } from "@/lib/auth/AuthTypes";

/**
 * Retourne l'utilisateur si authentifié ET administrateur, sinon la
 * réponse HTTP appropriée (401 sans session, 403 si connecté mais pas
 * admin) à retourner immédiatement par l'appelant.
 */
export async function requireAdmin(): Promise<{ user: StoredUser } | { response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: unauthorized() };
  if (user.role !== "admin") {
    return { response: forbidden("Accès réservé aux administrateurs.", { actorId: user.id, entityType: "Admin" }) };
  }
  return { user };
}
