// ============================================================
// ACADIA — AUTORISATION CENTRALISÉE (P17)
//
// Patron unique pour vérifier une relation réelle avant tout accès
// — jamais uniquement un rôle générique (Partie 8/15/16 du sprint).
// Ces fonctions ne remplacent pas les vérifications déjà présentes
// dans chaque route (défense en profondeur) : elles centralisent le
// patron pour les nouvelles routes.
// ============================================================

export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export function requireOwner(resourceOwnerId: string | undefined, userId: string): void {
  if (!resourceOwnerId || resourceOwnerId !== userId) {
    throw new AuthorizationError("Vous n'êtes pas propriétaire de cette ressource.");
  }
}

export function requireSupervisorOfAssignment(assignmentSupervisorId: string | undefined, userId: string): void {
  if (!assignmentSupervisorId || assignmentSupervisorId !== userId) {
    throw new AuthorizationError("Vous n'êtes pas le directeur associé à cette ressource.");
  }
}

export function requireStudentOfAssignment(assignmentStudentId: string | undefined, userId: string): void {
  if (!assignmentStudentId || assignmentStudentId !== userId) {
    throw new AuthorizationError("Vous n'êtes pas l'étudiant associé à cette ressource.");
  }
}
