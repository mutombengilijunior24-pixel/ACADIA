# ACADIA — Schéma de base de données P17

Schéma complet : `prisma/schema.prisma`. Ce document en explique les choix ; il ne
duplique pas le schéma champ par champ.

## Moteur

SQLite en développement (`prisma/dev.db`, gitignoré), PostgreSQL documenté comme cible de
production (voir `ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §2 et §14). SQLite ne supportant
pas les enums natifs Prisma, tous les champs de statut/rôle/type sont des `String` —
validés côté application par les types TypeScript déjà existants (`UserRole`,
`SubmissionStatus`, `CorrectionStatus`, etc., `lib/core/supervision/SupervisionTypes.ts`,
`lib/auth/AuthTypes.ts`). Ce choix reste valide si le projet passe un jour à PostgreSQL
(les enums Postgres pourraient être introduits alors sans changer la forme des données déjà
stockées).

## Modèles relationnels

`User`, `StudentProfile`, `SupervisorProfile`, `PasswordResetToken`, `ResearchProject`,
`SupervisionCanevas`, `SupervisorInvitation`, `SupervisionAssignment`, `Submission`,
`InboxMessage`, `FeedbackEntry`, `Correction`, `SupervisorBrief`, `Notification`,
`EmailLog`, `AuditLog`.

Chaque modèle porte des clés primaires, des horodatages (`createdAt`/`updatedAt` quand
pertinent), des clés étrangères réelles vers `User`, et des index sur les colonnes utilisées
pour le filtrage par propriétaire (`ownerId`, `supervisorId`, `studentId`, `recipientId`,
`submissionId`).

## Contraintes d'intégrité réelles (Partie 33 du sprint)

- `User.email` — unique.
- `SupervisorInvitation.code` — unique (empêche deux invitations avec le même code).
- `SupervisionAssignment` — unique sur `(studentId, supervisorId, status)`, empêchant deux
  affectations actives simultanées identiques (contrainte que le store JSON P16 ne pouvait
  garantir qu'applicativement, jamais au niveau du stockage lui-même).
- Toutes les relations `onDelete: Cascade` vers `User` — supprimer un compte ne laisse
  jamais de lignes orphelines invisibles.

## Payload JSON — ce qui n'est jamais recalculé par la base

`ResearchProject.payload` (structure scientifique complète), `.researchData` (snapshot
Wizard), `.instrument`, `.dataset`, `.bibliography`, `.theoreticalFramework`,
`.exportHistory` ; `Submission.snapshot` ; `FeedbackEntry.sections` ;
`Correction.discussion` ; `SupervisionCanevas.steps`/`.workTypes`/`.hypothesisRules` ;
`SupervisorBrief.strengths`/`.inconsistencies`/`.incompleteSections`/
`.importantQuestions`. Toutes ces colonnes contiennent le JSON déjà produit par les
moteurs déterministes existants (P1-P16) ou saisi explicitement par un humain — la base
les conserve telles quelles, elle ne les régénère jamais.

## Ce qui N'A PAS été normalisé, et pourquoi

Les étapes d'un canevas (`CanevasStep[]`), les sections d'un feedback
(`FeedbackSectionEntry[]`) et le fil de discussion d'une correction
(`CorrectionDiscussionEntry[]`) restent des tableaux JSON plutôt que des tables séparées.
Choix assumé : ces structures sont toujours lues/écrites entièrement avec leur parent (on
n'a jamais besoin d'interroger "toutes les étapes de canevas de tous les directeurs"
indépendamment), et les normaliser aurait ajouté trois tables et leurs jointures sans
bénéfice de requête réel pour l'usage actuel du produit. Documenté ici plutôt que fait
silencieusement.

## Migrations

Voir `ACADIA_P17_MIGRATION_GUIDE.md` pour le flux Prisma Migrate (développement) et la
recommandation de production (`prisma migrate deploy`, jamais `db push`/`reset` en
production).
