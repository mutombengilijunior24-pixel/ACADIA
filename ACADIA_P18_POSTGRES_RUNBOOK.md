# ACADIA — Runbook PostgreSQL staging (P18-FINAL)

## Statut

**Toujours bloqué.** Aucune instance PostgreSQL accessible dans cet environnement (ni
`psql`, ni `docker`, aucun compte Neon/Supabase, aucun identifiant). Ce runbook
documente la procédure exacte à exécuter — il ne remplace pas le provisionnement réel.

## Étape A — Provisionner l'instance (à faire par le propriétaire du projet)

**Fournisseur recommandé : Neon** (simplifie l'architecture Prisma existante — pooling
de connexions natif compatible avec les fonctions serverless/edge, plan gratuit
suffisant pour un premier staging).

1. Créer un compte sur https://neon.tech (ou https://supabase.com en alternative).
2. Créer un projet, une base nommée `acadia_staging`.
3. Copier la chaîne de connexion (`postgresql://<user>:<password>@<host>/<db>?sslmode=require`).
4. **Coût** : plan gratuit Neon suffisant pour un staging à faible trafic ; prévoir un
   plan payant (~19$/mois) si le volume augmente.

## Étape B — Configuration (déjà préparée dans ce sprint, aucune valeur réelle insérée)

Dans `.env.staging` (jamais commité) :
```
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
```

Dans `prisma/schema.prisma`, changer uniquement :
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Aucun autre changement de code requis — confirmé par cet audit (aucune requête SQL
brute, aucune fonctionnalité spécifique à SQLite dans le code applicatif).

## Étape C — Migration

```bash
npx prisma migrate deploy
npx prisma generate
```

## Étape D — Vérifications à faire une fois l'instance disponible

1. Connexion réelle (`npx prisma db pull` ou une requête simple).
2. Les 16 modèles présents avec les bonnes colonnes.
3. Contraintes uniques : `User.email`, `SupervisorInvitation.code`,
   `Submission(researchId, studentId, version)`.
4. Index : `ownerId`, `supervisorId`, `studentId`, `recipientId`, `submissionId`.
5. Relations `onDelete: Cascade` fonctionnelles (supprimer un utilisateur de test ne
   laisse pas de lignes orphelines).
6. Transactions : la contrainte unique sur `Submission` (ajoutée en P18) doit toujours
   provoquer une erreur `P2002` proprement gérée par `SubmissionStore.createSubmission()`
   en cas de conflit de version.
7. Rejouer le scénario complet déjà validé en SQLite (P18/P18-FINAL) : inscription,
   connexion, création de projet, questionnaire, dataset, supervision, invitation,
   soumission, feedback, corrections, notifications, audit log, export DOCX/PDF.

## Étape E — Isolation des données (multi-tenant)

Vérifier explicitement qu'aucune donnée d'un utilisateur n'est visible par un autre —
déjà testé et confirmé au niveau applicatif (routes API, voir
`ACADIA_P18_FINAL_TEST_REPORT.md`) ; à revalider une fois PostgreSQL réellement branché,
car le comportement applicatif ne change pas mais mérite une dernière vérification en
conditions réelles.

## Ce que ce sprint N'A PAS pu faire

Provisionner réellement l'instance (nécessite un compte externe et un paiement/carte
éventuels), exécuter `prisma migrate deploy` contre une vraie base, et rejouer les tests
ci-dessus. **SQLite reste la base de développement active** — rien n'a été supprimé ni
remplacé.
