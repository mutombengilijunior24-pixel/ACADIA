// ============================================================
// ACADIA — AUTHENTIFICATION : TYPES (P13)
//
// Architecture minimale et honnête pour un produit en bêta :
// utilisateurs stockés côté serveur (fichier JSON local, mots de
// passe hachés), sessions par cookie signé. Les données de
// recherche elles-mêmes restent dans localStorage (ResearchContext,
// P1-P12 inchangés) mais cloisonnées par identifiant utilisateur —
// voir ACADIA_P13_AUTH_ARCHITECTURE.md pour la limite assumée
// (pas encore de synchronisation multi-appareil).
// ============================================================

// ------------------------------------------------------------
// P14 a posé un champ de rôle jamais câblé. P16 le câble
// réellement : "student" par défaut, "supervisor" auto-déclaré via
// POST /api/auth/become-supervisor (aucune vérification
// institutionnelle — voir ACADIA_P16_ARCHITECTURE.md §5), "admin"
// reste une fondation de type sans UI (aucun compte n'y est
// assigné dans ce sprint).
// ------------------------------------------------------------

export type UserRole = "student" | "supervisor" | "admin";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName?: string;
  domain?: string;
  role: UserRole;
  createdAt: string;
}

export type PublicUser = Omit<StoredUser, "passwordHash">;

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: string;
  usedAt?: string;
}

export interface SessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export function toPublicUser(user: StoredUser): PublicUser {
  const rest: Partial<StoredUser> = { ...user };
  delete rest.passwordHash;
  return rest as PublicUser;
}
