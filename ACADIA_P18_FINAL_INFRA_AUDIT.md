# ACADIA — Audit infrastructure P18-FINAL (avant action)

Rien n'a été supposé : chaque point ci-dessous a été vérifié directement dans le dépôt
(fichiers de config, code source, dépendances installées) au moment de cet audit.

## 1. Prisma / base de données

**EXISTE.** `prisma/schema.prisma` : `provider = "sqlite"`, `url = env("DATABASE_URL")`.
`DATABASE_URL` dans `.env.local` pointe vers un fichier SQLite absolu local. 3 migrations
appliquées (`init`, `fix_assignment_constraint`, `add_submission_version_unique_constraint`).
`@prisma/client`/`prisma` épinglés en 6.19.3 (jamais « latest »). **À CONFIGURER** :
`DATABASE_URL` PostgreSQL de staging (aucune instance accessible dans cet
environnement — voir §3). Passer `provider` à `"postgresql"` ne nécessite aucun autre
changement de code (aucune fonctionnalité spécifique à SQLite utilisée).

## 2. Variables d'environnement nécessaires

Complet, listé dans `.env.example` : `DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`,
`EMAIL_FROM`/`EMAIL_REPLY_TO`/`EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_DOMAIN`,
`STORAGE_PROVIDER`/`STORAGE_BUCKET`/`STORAGE_REGION`/`STORAGE_ACCESS_KEY_ID`/
`STORAGE_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `RATE_LIMIT_KV_URL`,
`PAYMENT_PROVIDER`/`PAYMENT_API_KEY` (préparation uniquement). Seules 3 variables ont
une vraie valeur dans `.env.local` aujourd'hui : `OPENAI_API_KEY`, `SESSION_SECRET`,
`DATABASE_URL`.

## 3. Ce qui est réellement disponible dans CET environnement

**BLOQUÉ PAR SERVICE EXTERNE, sans exception** : ni `psql`, ni `docker`, aucun compte
Neon/Supabase/Cloudflare/Resend/Sentry, aucune clé API pour aucun de ces fournisseurs,
et aucune capacité de créer un compte payant ou de recevoir un email de confirmation
d'inscription depuis cet environnement d'exécution. **Rien de tout cela n'a été simulé
ni inventé.** Tout ce qui suit dans ce document sépare donc strictement le code qui
PEUT être préparé sans secret (et qui l'a été) de ce qui reste réellement bloqué tant
que le propriétaire du projet n'a pas lui-même créé les comptes et fourni les
identifiants.

## 4. localStorage — usage réel (recherche exhaustive, pas supposée)

Seuls 4 fichiers appellent réellement `localStorage.getItem/setItem/removeItem` :

- `contexts/ResearchContext.tsx` — cache d'écriture simultanée déjà documenté en P17,
  la base de données Prisma reste la source de vérité (`/api/research-state`).
- `components/dashboard/OnboardingModal.tsx` — un simple indicateur « déjà vu » par
  utilisateur, préférence UX sans conséquence si perdu.
- **`components/questionnaire/QuestionnaireBuilder.tsx` et
  `app/questionnaire/[id]/page.tsx` — 🔴 GAP RÉEL DÉCOUVERT.** Le générateur de
  questionnaire écrit la définition complète du questionnaire publié directement dans
  le `localStorage` du navigateur du chercheur (commentaire du code lui-même : « Pour
  notre prototype, localStorage joue le rôle de petite base de données »). La page
  publique `/questionnaire/[id]` (destinée aux répondants) lit cette même clé
  `localStorage`. **Conséquence concrète : un répondant ouvrant le lien du
  questionnaire sur un autre appareil ou navigateur ne verra jamais les questions**
  (message « Ce questionnaire n'existe pas ou n'est plus disponible »), puisque
  `localStorage` n'est jamais partagé entre navigateurs. Ce n'est pas un problème de
  connexion à un service externe : c'est une fonctionnalité de collecte de réponses
  distribuée qui n'a jamais été construite côté serveur. `lib/core/questionnaire/QuestionnaireStorage.ts`
  existe mais est **un fichier vide** ; `app/api/questionnaire/[id]/route.ts` et
  `app/api/questionnaire/publish/route.ts` sont des **stubs** qui ne persistent rien de
  réel. Seule `app/api/questionnaire/[id]/responses/route.ts` a une implémentation
  réelle, mais elle écrit dans un fichier JSON à la racine du dépôt
  (`questionnaire-responses.json`, non gitignoré jusqu'à cet audit — corrigé, voir §12),
  jamais dans Prisma. **Ce point est noté ici comme un gap architectural réel et
  important, mais sa correction (construire une vraie collecte de réponses
  multi-appareils) est une fonctionnalité nouvelle, hors du périmètre « connecter les
  services externes » de ce sprint — elle nécessite une décision explicite du
  propriétaire du produit avant d'être entreprise.**

## 5. DocumentStorageProvider

**EXISTE** (interface + `LocalDevDocumentStorageProvider`, P17), **jamais câblé à une
fonctionnalité réelle** (confirmé à nouveau : aucun appelant produit). **À CODER** :
une implémentation Cloudflare R2 derrière la même interface (préparée dans ce sprint,
voir §8) — **À CONFIGURER** : compte Cloudflare R2 + identifiants (bloqué, propriétaire
requis).

## 6. NoOpEmailProvider

**EXISTE**, seule implémentation active. **À CODER** : implémentation Resend derrière
la même interface (préparée dans ce sprint, voir §9). **À CONFIGURER** : compte Resend +
clé API + domaine vérifié (bloqué, propriétaire requis).

## 7. Routes email

Aucune route email dédiée séparée — l'envoi passe par `lib/email/EmailProvider.ts`,
appelé depuis les routes métier (`submissions`, `feedback`, `forgot-password`,
`invitations/accept`). Architecture correcte, rien à changer ici au-delà de brancher un
vrai fournisseur.

## 8. Routes d'export

`app/api/export/pdf/route.ts` et `app/api/export/docx/route.ts` — stateless, non
authentifiées (confirmé, voir `ACADIA_P18_FINAL_AUDIT.md` Constat 4). **Bug réel
confirmé** (voir `ACADIA_P18_FINAL_TEST_REPORT.md` Blocker 3) : l'export PDF échoue sur
un document volumineux. Corrigé dans ce sprint — voir §13 du présent audit / rapport de
test.

## 9. Configuration OpenAI

**EXISTE et fonctionne réellement** (`OPENAI_API_KEY` configurée, testée en conditions
réelles lors du sprint précédent — pipeline A0→A2). Vérifié pour ce sprint : aucun appel
OpenAI n'est fait depuis un composant `"use client"` (recherche exhaustive des
importeurs de `lib/openai.ts`/`lib/ai/openai/client.ts` — tous des routes serveur ou le
helper d'auth). Aucune clé n'apparaît dans le bundle client. **NON NÉCESSAIRE** de
modifier cette intégration.

## 10. Rate limiting

**EXISTE**, en mémoire process (`lib/server/security/RateLimiter.ts`), suffisant pour un
seul processus serveur. **BLOQUÉ PAR SERVICE EXTERNE** pour une version distribuée
(nécessiterait Redis/KV managé — aucun accès). Non introduit artificiellement, conforme
à la consigne « ne pas ajouter Redis pour le plaisir ».

## 11. Audit logs

**EXISTE** (table `AuditLog`, 7 types d'événements câblés — voir sprint P18 précédent).
Aucune interface d'administration pour les consulter (recherche SQL directe uniquement)
— **À CODER** dans un sprint futur si nécessaire, non demandé explicitement ici.

## 12. Fichier hérité trouvé et corrigé

`questionnaire-responses.json` (racine du dépôt) — fichier JSON de l'ère pré-P17,
jamais gitignoré, contenant des réponses de test. **Corrigé dans ce sprint** : ajouté à
`.gitignore`. Le fichier lui-même n'a pas été supprimé du disque (il reste utile tant
que la route `responses` s'appuie dessus) mais ne sera plus jamais committé par erreur.

## 13. Monitoring

**NON CONFIGURÉ.** Aucun SDK Sentry ou équivalent installé avant ce sprint (vérifié
dans `package.json`). Préparé dans ce sprint (voir document dédié) — activation réelle
bloquée par l'absence de compte/DSN Sentry.

## 14. Domaine / HTTPS

**NON CONFIGURÉ, aucun changement possible sans achat réel d'un domaine** — voir
`ACADIA_DOMAIN_SETUP.md`.

## 15. Dépendances déjà présentes (package.json)

`@prisma/client`/`prisma` 6.19.3, `@react-pdf/renderer` ^4.8.1, `bcryptjs`, `docx`,
`lucide-react`, `next` 16.2.12, `openai` ^7.4.0, `react`/`react-dom` 19.2.4, `recharts`.
Aucun SDK de fournisseur cloud (S3/R2, Resend, Sentry) n'était installé avant ce sprint.

## Synthèse (légende du sprint)

| Élément | Statut |
|---|---|
| PostgreSQL | 🔴 BLOQUÉ PAR SERVICE EXTERNE |
| Object Storage (R2) | 🟡 À CONFIGURER (code préparé ce sprint) |
| Email (Resend) | 🟡 À CONFIGURER (code préparé ce sprint) |
| Monitoring (Sentry) | 🟡 À CONFIGURER (code préparé ce sprint) |
| Domaine / HTTPS | 🔴 BLOQUÉ PAR SERVICE EXTERNE |
| OpenAI | ✅ EXISTE, fonctionne |
| Rate limiting distribué | 🔴 BLOQUÉ PAR SERVICE EXTERNE (KV managé requis) |
| Audit logs | ✅ EXISTE (sans UI d'administration) |
| Export PDF | 🟢 CORRIGÉ CE SPRINT (voir rapport de test) |
| Collecte de réponses de questionnaire multi-appareils | 🔴 GAP RÉEL — hors périmètre de ce sprint, décision du propriétaire requise |
| Fichier JSON hérité non gitignoré | 🟢 CORRIGÉ CE SPRINT |
