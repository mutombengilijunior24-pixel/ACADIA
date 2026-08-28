# ACADIA — Audit P18-FINAL (avant action)

Lecture effectuée avant toute action : `ACADIA_P18_AUDIT.md`, `ACADIA_P18_TEST_REPORT.md`,
`ACADIA_P18_SECURITY_REPORT.md`, `ACADIA_P18_DEPLOYMENT_STATUS.md`,
`ACADIA_P17_PRODUCTION_ARCHITECTURE.md`, `ACADIA_P17_DATABASE_SCHEMA.md`,
`ACADIA_P17_DEPLOYMENT.md`. Inspection effectuée : `prisma/schema.prisma`, `package.json`,
`.env.local`/`.env.example`/`prisma/.env`, `next.config.ts`, les services de stockage
(`DocumentStorageProvider`), email (`EmailProvider`), auth (`UserStore`, `session.ts`),
export (`app/api/export/{pdf,docx}`), `ResearchContext.tsx`, et les routes API principales.
**Aucune modification de code n'a été apportée pendant cette phase d'audit.**

## Constat 1 — PostgreSQL toujours indisponible

Re-vérifié à neuf pour ce sprint (l'audit P18 précédent ne devait pas être supposé
encore valide sans nouvelle vérification) : ni `psql`, ni `docker` ne sont présents dans
l'environnement (`which`/`where.exe` : introuvables). Aucun `DATABASE_URL` PostgreSQL
dans `.env.local`, `.env.example` ou `prisma/.env` — uniquement une URL SQLite locale.
**Blocker 1 confirmé toujours bloqué**, aucun changement depuis `ACADIA_P18_POSTGRES_BLOCKER.md`.

## Constat 2 — Schéma et configuration inchangés depuis le dernier audit, sauf un ajout du sprint précédent

`prisma/schema.prisma` : 16 modèles identiques à P17, plus la contrainte
`@@unique([researchId, studentId, version])` sur `Submission`, ajoutée à la fin de la
session P18 précédente pour corriger un bug de concurrence réel (voir
`ACADIA_P18_TEST_REPORT.md` §11). 3 migrations appliquées au total. `package.json` :
dépendances inchangées (`prisma`/`@prisma/client` toujours épinglés en 6.19.3, jamais
« latest »).

## Constat 3 — Stockage, email : toujours non câblés à une fonctionnalité réelle

`DocumentStorageProvider`/`LocalDevDocumentStorageProvider` existent mais ne sont
appelés par aucune route ni composant. `EmailProvider` reste `NoOpEmailProvider`. Rien
n'a changé depuis le dernier audit — confirmé par re-lecture, pas supposé.

## Constat 4 — Export DOCX/PDF : les deux routes sont stateless et non authentifiées

`app/api/export/pdf/route.ts` et `app/api/export/docx/route.ts` ne dérivent aucune
session utilisateur et ne touchent aucune base de données — elles reçoivent un
`DocumentModel` déjà construit et le mettent en forme. Point important retenu pour la
suite de l'audit : **le gestionnaire POST de la route PDF n'entoure PAS
`renderToBuffer(buildPdfDocument(model))` d'un `try/catch`** — une exception y
provoque un crash non contrôlé de la route (confirmé au Blocker 3, voir
`ACADIA_P18_FINAL_TEST_REPORT.md` §3).

## Constat 5 — `ResearchContext.tsx` : le pipeline IA réel passe par `/api/ai/research-intelligence`

Le seul point d'entrée réellement utilisé par le produit pour l'intelligence
scientifique (A1 compréhension → A2 variables → adaptation en `ResearchProject`) est
`POST /api/ai/research-intelligence`, qui appelle `analyzeResearch()`
(`lib/core/research/ResearchIntelligenceEngine.ts`). Ce point a été confirmé par
recherche exhaustive des appelants réels (`fetch("/api/ai/research-intelligence"...)`
dans `ResearchContext.tsx`) plutôt que supposé.

## Constat 6 (effet de bord découvert, non un blocage) — une route `/api/ai/questionnaire` orpheline

`app/api/ai/questionnaire/route.ts` appelle directement l'API OpenAI avec un modèle
`"gpt-5.6"` (nom de modèle inexistant) et ne passe JAMAIS par le moteur déterministe
protégé `QuestionnaireGenerationEngine`/`generateInstrumentFromProject`. Recherche
exhaustive des appelants : **seul `app/dashboard/questionnaire-lab/page.tsx`
l'utilise** — un labo de test isolé, jamais lié depuis la navigation réelle du produit,
jamais atteignable par un étudiant ou un directeur dans le parcours normal. Ce n'est
donc pas un blocage produit, mais une incohérence de code mort à signaler : si cette
page devait un jour être exposée, elle romprait la traçabilité variable→questionnaire
(elle re-génère des variables différentes de celles d'A2) et échouerait de toute façon
(modèle inexistant). Non corrigé ici : corriger `QuestionnaireGenerationEngine` ou les
routes IA sort du périmètre de fermeture des 4 blockers et n'est pas un bug de sécurité
critique.

## Constat 7 — Rôle `admin`

Confirmé à nouveau : seule occurrence du littéral `"admin"` dans le code applicatif est
sa définition de type (`lib/auth/AuthTypes.ts`). Aucune route, page ni capability ne
l'utilise. Rien à auditer pour ce rôle au-delà de ce simple constat.

## Ce que ce sprint va réellement fermer ou confirmer

Sur cette base, P18-FINAL exécute des tests réels (jamais simulés) contre les 4
blockers, en utilisant les vrais moteurs et les vraies routes de production, avec des
fixtures de test clairement identifiées (préfixe `p18test-`, domaine
`test.acadia.local`, toutes nettoyées de la base après usage). Voir
`ACADIA_P18_FINAL_TEST_REPORT.md`.
