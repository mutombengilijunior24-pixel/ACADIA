// ============================================================
// ACADIA — MOTS DE PASSE (P13)
//
// bcryptjs : implémentation pure JS (aucune compilation native),
// évite les échecs d'installation liés à `bcrypt` sur certains
// environnements. Jamais de mot de passe stocké en clair.
// ============================================================

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isPasswordStrongEnough(plain: string): boolean {
  return typeof plain === "string" && plain.length >= 8;
}
