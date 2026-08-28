# ACADIA — Audit P18 (Stabilisation, staging, sécurité, validation)

## 1. Base de données

Prisma + SQLite en développement (`prisma/dev.db`, gitignoré), 16 modèles relationnels
(`prisma/schema.prisma`), migrations réelles sous `prisma/migrations/` (`init`,
`fix_assignment_constraint`). **Aucune instance PostgreSQL n'est accessible dans cet
environnement** (pas de `psql`, pas de Docker, aucun identifiant de connexion managé
fourni dans `.env.local` ou ailleurs — confirmé par recherche exhaustive). `DATABASE_URL`
pointe vers un fichier SQLite local. Voir `ACADIA_P18_POSTGRES_BLOCKER.md`.

## 2. Auth

`lib/auth/{AuthTypes.ts, UserStore.ts, passwords.ts, session.ts}` — bcrypt (12 rounds),
cookie de session HMAC-SHA256 signé, `HttpOnly`/`SameSite=lax`/`Secure` en production,
expiration 30 jours. `UserStore.ts` entièrement basé sur Prisma depuis P17 (fonctions
asynchrones). `role: UserRole` (`student | supervisor | admin`) fixé à l'inscription
(P17) — aucune route ne permet d'écrire `role` directement depuis un corps de requête
générique.

## 3. Supervision

10 stores (`lib/supervision/*Store.ts`) + moteurs déterministes
(`SupervisorBriefEngine`, `RevisionComparisonEngine`, `CanevasComplianceEngine`) —
tous basés sur Prisma depuis P17, signatures asynchrones, aucune logique métier modifiée
par la migration. Chaque route `/api/supervision/**` dérive l'utilisateur de la session
serveur (`getSessionUser()`), jamais d'un id client.

## 4. Stockage

`lib/server/documents/DocumentStorageProvider.ts` — interface + une seule implémentation
active (`LocalDevDocumentStorageProvider`, écrit sous `data/documents/`, gitignoré).
`getSignedUrl()` retourne `null` (non applicable au stockage local). Aucun appelant
réel dans le produit ne l'utilise encore (les exports DOCX/PDF restent stateless,
générés à la volée — voir §12) : ce provider a été posé en architecture P17 mais n'a
jamais été câblé à une fonctionnalité utilisateur.

## 5. Email

`lib/email/EmailProvider.ts` — `NoOpEmailProvider` seule implémentation active, chaque
tentative journalisée (`EmailLog`, table Prisma depuis P17) avec `status:
"not_configured"`. Aucune variable `EMAIL_PROVIDER`/`EMAIL_API_KEY` renseignée. Le
contrat de réponse API expose déjà `{ email: { status: "not_configured" } }` aux
endpoints concernés (soumission, feedback) — jamais un texte affirmant un envoi réussi
côté serveur. **Reste à vérifier** : que le texte affiché côté client (s'il existe) dit
bien « non configuré » plutôt que rien — voir §Partie 5 du test report.

## 6. Rate limiting

`lib/server/security/RateLimiter.ts` — fenêtre glissante en mémoire process. **État après
correction (Partie 4 de ce sprint) :** appliqué désormais à `/api/auth/login` et
`/api/auth/register` (10/10 min, préexistant P17), `/api/auth/forgot-password` (5/15 min
par email), `/api/auth/reset-password` (10/15 min par token), `/api/supervision/invitations`
POST (20/heure par directeur), `/api/supervision/invitations/accept` POST (15/10 min par
utilisateur — protection contre le brute-force du code d'invitation), et
`/api/supervision/submissions` POST (10/10 min par étudiant). Reste non limité : les
routes de lecture simples (GET) et `/api/export/{pdf,docx}` (voir §7 pour pourquoi ces
dernières ne sont volontairement pas modifiées dans ce sprint).

## 7. Audit logs

Table `AuditLog` (Prisma) + `lib/server/audit/AuditLog.ts`. **État après correction
(Partie 4 de ce sprint) :** `USER_CREATED`, `LOGIN_FAILED`, `SUBMISSION_CREATED`,
`FEEDBACK_CREATED` (préexistants P17) + `ROLE_ASSIGNED` (câblé dans
`/api/auth/become-supervisor`), `CORRECTION_UPDATED` (câblé dans
`/api/supervision/corrections/[id]` PATCH), `ACCESS_DENIED` (câblé génériquement dans le
helper `forbidden()` de `lib/supervision/apiAuth.ts` — accepte un contexte optionnel
`{ actorId, entityType, entityId }` et journalise avant de renvoyer 403 ; appliqué à tous
les appels `forbidden(...)` du périmètre `/api/supervision/**`).

**`EXPORT_CREATED` reste volontairement non câblé.** Les routes `/api/export/pdf` et
`/api/export/docx` (`app/api/export/{pdf,docx}/route.ts`) sont des routes stateless du
périmètre protégé (DocumentBuilder/export DOCX-PDF) : elles ne dérivent aucun utilisateur
de session (`getSessionUser()` n'y est jamais appelé) et ne lisent aucune donnée en base —
elles se contentent de mettre en forme un `DocumentModel` déjà construit côté client.
Journaliser `EXPORT_CREATED` avec un `actorId` réel exigerait d'ajouter une vérification de
session à ces routes, ce qui est une modification fonctionnelle d'une route protégée sans
bug de sécurité critique démontré (l'absence d'authentification ici n'expose aucune donnée :
la route ne fait que formater ce que l'appelant lui envoie déjà). Ce gap est donc documenté
ici comme **NON CORRIGÉ — hors périmètre P18** plutôt que masqué.

## 8. Déploiement

`ACADIA_P17_DEPLOYMENT.md` : aucun environnement de staging/production provisionné,
architecture uniquement documentée. Confirmé inchangé.

## 9bis. Balayage spécifique au bundle client (P18)

Recherche de `NEXT_PUBLIC_` dans tout le code source : une seule occurrence
(`lib/email/EmailProvider.ts`, `NEXT_PUBLIC_APP_URL`, une simple URL non sensible — aucun
secret exposé via ce mécanisme). Recherche des importeurs de chaque module lisant un
secret serveur (`process.env.OPENAI_API_KEY`, `SESSION_SECRET`, `DATABASE_URL` — dans
`lib/openai.ts`, `lib/ai/openai/client.ts`, `lib/core/research/VariableIntelligenceAI.ts`,
`lib/auth/session.ts`) : tous les importeurs sont des routes `app/api/**/route.ts`, le
helper serveur `lib/supervision/apiAuth.ts`, ou `proxy.ts` (middleware serveur) — aucun
composant marqué `"use client"` n'importe, directement ou transitivement, l'un de ces
modules. Aucun secret ne peut donc se retrouver dans le bundle JavaScript envoyé au
navigateur.

## 9. Variables d'environnement

`.env.local` : `OPENAI_API_KEY`, `SESSION_SECRET`, `DATABASE_URL` (SQLite) — les trois
seules variables réellement renseignées. `.env.example` catégorisé (DATABASE/AUTH/AI/
EMAIL/STORAGE/APP/SECURITY/FUTURE PAYMENTS) mais la plupart vides par construction (aucun
service externe configuré). `.gitignore` vérifié : couvre `.env*`, `/data/*.json`,
`/data/documents/`, `/prisma/dev.db*`. Aucun secret trouvé committé (recherche
`OPENAI_API_KEY|DATABASE_URL|SECRET|PASSWORD|TOKEN|AWS|S3|SMTP` dans le code source hors
`.env.example`/documentation : aucune valeur réelle, uniquement des noms de variables).

## 10. Ce que ce sprint va réellement construire

Étant donné qu'aucun service externe supplémentaire n'est disponible (pas plus qu'en
P17), P18 se concentre sur ce qui est réellement actionnable sans dépendance externe :
tests d'autorisation croisée réels, tests de résilience (JSON corrompu, ressource
supprimée, session invalide), complétion du rate limiting et de l'audit log sur les
routes identifiées comme manquantes ci-dessus, test de régression scientifique complet,
test de concurrence, et documentation honnête de tout ce qui reste bloqué par l'absence
de services externes — sans jamais en simuler la présence.
