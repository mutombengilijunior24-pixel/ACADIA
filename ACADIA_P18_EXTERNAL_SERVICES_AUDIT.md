# ACADIA — Audit des services externes (P18-FINAL, Mission Maître, Phase 0)

Audit relu à neuf sur l'état réel des fichiers (pas de reconstruction de mémoire) :
`package.json`, `prisma/schema.prisma`, `prisma/.env`, `.env.local`, `.gitignore`,
`next.config.ts`, `lib/server/security/RateLimiter.ts`,
`lib/server/documents/{DocumentStorageProvider,R2DocumentStorageProvider}.ts`,
`lib/email/{EmailProvider,ResendEmailProvider}.ts`, `instrumentation.ts`,
`instrumentation-client.ts`, `prisma/migrations/`, `scripts/`, et les rapports P17/P18
listés dans la mission.

## A. PostgreSQL / Supabase

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🟡 Identifiants réels configurés (`prisma/.env`, `.env.local`), projet Supabase vide confirmé par le propriétaire (`prisma db pull` déjà exécuté avec succès **depuis sa machine**). Depuis cet environnement d'exécution : port 6543 (pooler transaction-mode) réellement joignable et parle le protocole Postgres (confirmé par une sonde `SSLRequest` brute) ; port 5432 (pooler session-mode, utilisé comme `DIRECT_URL`) **timeout systématique** depuis cet environnement — limitation réseau de ce sandbox, pas un problème Supabase (le propriétaire confirme un accès direct fonctionnel depuis sa machine). |
| CODE EXISTANT | `schema.prisma` déjà basculé sur `provider = "postgresql"` + `directUrl`. Aucune requête SQL brute ailleurs dans le code — migration de provider sans risque applicatif. |
| CONFIGURATION MANQUANTE | Historique de migrations propre pour PostgreSQL : `prisma/migrations/migration_lock.toml` indique encore `provider = "sqlite"` → cause exacte de l'erreur P3019 déjà rencontrée par le propriétaire. |
| ACTION AUTOMATISABLE | Sauvegarder l'historique SQLite, générer un historique PostgreSQL propre à partir du schéma actuel, l'appliquer (voir Phase 1). |
| ACTION MANUELLE | Aucune côté compte — le compte/projet Supabase existe déjà. Si l'application des migrations échoue depuis cet environnement (port 5432 bloqué), le propriétaire devra exécuter 1-2 commandes depuis sa propre machine (détaillé en Phase 1). |
| RISQUE | Faible si la sauvegarde de l'historique SQLite est faite avant toute suppression — aucune donnée réelle n'existe encore dans Supabase (base vide confirmée). |
| TEST À EFFECTUER | `_prisma_migrations` peuplée, les 16 tables présentes, contraintes/index vérifiés, puis register/login/auth-me/CRUD projet/supervision/isolation rejoués contre la vraie base. |

## B. Cloudflare R2

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🔴 Code prêt (`R2DocumentStorageProvider.ts`, écrit et compilé en P18-FINAL), jamais activé — aucun bucket, aucun identifiant. |
| CODE EXISTANT | Implémentation complète de `DocumentStorageProvider` (upload/download/delete/getMetadata/getSignedUrl via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, déjà installés). Activation conditionnelle déjà câblée dans `resolveDocumentStorageProvider()`. |
| CONFIGURATION MANQUANTE | `STORAGE_PROVIDER="r2"`, `STORAGE_BUCKET`, `STORAGE_R2_ACCOUNT_ID`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. |
| ACTION AUTOMATISABLE | Renseigner les variables une fois fournies, exécuter les tests upload/download/delete/URL signée. |
| ACTION MANUELLE | Créer un compte Cloudflare, activer R2, créer un bucket, créer un jeton API scoping lecture/écriture sur ce bucket (procédure détaillée : `ACADIA_STORAGE_SETUP.md`). |
| RISQUE | Aucun tant que non activé. Une fois activé : s'assurer que le bucket reste privé par défaut (déjà le comportement du code — `getSignedUrl` à expiration 1h). |
| TEST À EFFECTUER | Upload réel, téléchargement réel (comparaison octet à octet), URL signée expirant après 1h, suppression réelle, vérification qu'aucun accès public direct n'est possible, test d'isolation (un étudiant ne peut pas obtenir l'URL signée d'un document d'un autre). |

## C. Resend Email

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🔴 Code prêt (`ResendEmailProvider.ts`), jamais activé — aucun compte, aucune clé. |
| CODE EXISTANT | Implémentation complète, distingue toujours `sent`/`failed`, journalise dans `EmailLog`. 6 fonctions d'envoi déjà câblées aux routes métier réelles depuis P16 (vérification, reset password, invitation, soumission, feedback, révision). |
| CONFIGURATION MANQUANTE | `EMAIL_PROVIDER="resend"`, `EMAIL_API_KEY`, `EMAIL_FROM` (nécessite un domaine vérifié pour sortir du mode test Resend — voir Service E). |
| ACTION AUTOMATISABLE | Renseigner les variables une fois fournies, tester un envoi réel. |
| ACTION MANUELLE | Créer un compte Resend, obtenir une clé API. Vérifier un domaine d'envoi (dépend du Service E — domaine — pour sortir du mode test à une seule adresse). |
| RISQUE | Aucun tant que non activé. |
| TEST À EFFECTUER | Déclenchement réel de chaque type d'email, vérification de réception, vérification `EmailLog.status === "sent"`, test d'un échec volontaire (adresse invalide) → `status === "failed"` avec message exploitable. |

## D. Sentry Monitoring

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🔴 Code prêt (`instrumentation.ts`, `instrumentation-client.ts`, SDK installé), jamais activé — aucun DSN. |
| CODE EXISTANT | Initialisation conditionnelle serveur + client, `sendDefaultPii: false`, `onRequestError` déjà branché sur les erreurs Next.js non interceptées. |
| CONFIGURATION MANQUANTE | `SENTRY_DSN` (serveur), `NEXT_PUBLIC_SENTRY_DSN` (client, non secret par nature). |
| ACTION AUTOMATISABLE | Renseigner les DSN une fois fournis, déclencher une erreur de test contrôlée, vérifier sa remontée, retirer le mécanisme de test. |
| ACTION MANUELLE | Créer un compte Sentry, créer un projet Next.js, copier le DSN. |
| RISQUE | Aucun tant que non activé. Rappel : ne jamais confondre `SENTRY_DSN` (peut rester privé) avec un secret applicatif — les deux DSN sont conçus pour être relativement peu sensibles, mais ne doivent pas non plus être publiés sans raison. |
| TEST À EFFECTUER | Erreur serveur volontaire dans un environnement de test → apparition dans le tableau de bord Sentry, puis suppression du mécanisme de déclenchement. |

## E. Domaine / DNS

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🔴 Aucun domaine possédé. |
| CODE EXISTANT | Aucune valeur codée en dur — `NEXT_PUBLIC_APP_URL` déjà paramétrable partout où une URL est construite. |
| CONFIGURATION MANQUANTE | Domaine lui-même, enregistrements DNS (voir `ACADIA_DOMAIN_SETUP.md`). |
| ACTION AUTOMATISABLE | Aucune avant que le domaine soit choisi et acheté. |
| ACTION MANUELLE | Choisir une stratégie de nommage (proposée en Phase 8), acheter le domaine, configurer le DNS. |
| RISQUE | Aucun — bloque uniquement l'identité publique, pas la fonctionnalité (un sous-domaine d'hébergeur généré automatiquement fonctionne en attendant). |
| TEST À EFFECTUER | Résolution DNS réelle, certificat HTTPS valide, `dig`/vérification des enregistrements SPF/DKIM/DMARC une fois Resend configuré. |

## F. HTTPS

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | ⚪ Non applicable sans hébergement/domaine réels — géré automatiquement par la quasi-totalité des hébergeurs Next.js modernes (Vercel et équivalents) dès qu'un domaine est pointé. |
| CODE EXISTANT | Cookies déjà conditionnés `Secure` en production (`lib/auth/session.ts`), en-têtes de sécurité déjà présents (`next.config.ts`). |
| CONFIGURATION MANQUANTE | Dépend entièrement du Service E + I. |
| ACTION AUTOMATISABLE | Aucune avant le choix d'hébergeur. |
| ACTION MANUELLE | Choisir l'hébergeur (Phase 9), pointer le domaine. |
| RISQUE | Aucun. |
| TEST À EFFECTUER | Certificat valide, redirection HTTP→HTTPS effective, cookies `Secure` réellement respectés (inspection réseau navigateur). |

## G. Backups PostgreSQL

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🟡 Mécanisme générique prouvé sur SQLite (cycle réel backup→perte→restauration en P18). Offre Supabase native non encore vérifiée dans le tableau de bord réel du propriétaire. |
| CODE EXISTANT | Aucun code applicatif requis — les sauvegardes PostgreSQL gérées sont une fonctionnalité de plateforme (Supabase), pas de code ACADIA. |
| CONFIGURATION MANQUANTE | Vérifier le plan Supabase actuel du propriétaire (gratuit vs payant) — la rétention et le point-in-time recovery en dépendent directement. |
| ACTION AUTOMATISABLE | Aucune — dépend du plan déjà souscrit par le propriétaire. |
| ACTION MANUELLE | Le propriétaire consulte Supabase → Project Settings → Database → Backups pour indiquer le plan actuel et la rétention offerte. |
| RISQUE | Élevé tant que non vérifié : aucune promesse de sauvegarde ne doit être faite sans preuve. |
| TEST À EFFECTUER | Une fois le plan confirmé : cycle réel backup→perte simulée (sur staging uniquement, jamais sur des données réelles)→restauration, mesure du RTO réel observé. |

## H. Rate limiting distribué

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🟢 Fonctionnel pour un seul processus (mémoire process). 🔴 Non distribué. |
| CODE EXISTANT | `lib/server/security/RateLimiter.ts` — interface `RateLimiter` déjà découplée de l'implémentation (`InMemoryRateLimiter`), remplaçable sans changer les appelants (6 routes déjà protégées). |
| CONFIGURATION MANQUANTE | Un KV managé si un déploiement multi-instance est un jour choisi. |
| ACTION AUTOMATISABLE | Écrire un adapter KV derrière la même interface, une fois le fournisseur choisi. |
| ACTION MANUELLE | Décision à prendre : nécessaire seulement si l'hébergement choisi (Phase 9) tourne plusieurs instances. Vercel Serverless/Edge, par exemple, tourne potentiellement plusieurs instances même à faible trafic — à vérifier avant de considérer ce point comme non urgent. |
| RISQUE | Faible à court terme (trafic staging limité), mais pas nul si l'hébergeur choisi est multi-instance par défaut. |
| TEST À EFFECTUER | login, register, forgot-password, reset-password, invitations, accept-invitation, submissions — reconfirmer les seuils après tout changement d'implémentation. |

## I. Hébergement / Déploiement

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🔴 Aucun déploiement réel — ni fichier de config (`vercel.json`, `Dockerfile`), ni compte. |
| CODE EXISTANT | Aucun obstacle connu : Next.js 16 standard, routes API en runtime Node explicite partout où nécessaire (`export const runtime = "nodejs"`), Prisma compatible avec la plupart des hébergeurs modernes. |
| CONFIGURATION MANQUANTE | Choix de l'hébergeur, variables d'environnement de staging. |
| ACTION AUTOMATISABLE | Préparer les fichiers de configuration une fois l'hébergeur choisi. |
| ACTION MANUELLE | Créer un compte chez l'hébergeur choisi (proposition en Phase 9), connecter le dépôt (nécessite un dépôt Git réel — **ce projet n'est actuellement PAS un dépôt Git**, point à traiter avant tout déploiement). |
| RISQUE | Le projet n'étant pas encore un dépôt git, la plupart des hébergeurs (Vercel notamment) attendent un dépôt GitHub/GitLab connecté — à clarifier avant la Phase 9. |
| TEST À EFFECTUER | Build réel sur la plateforme, toutes les routes répondent, variables bien injectées, aucun secret dans les logs de build. |

## J. Variables d'environnement / secrets

| Champ | Valeur |
|---|---|
| STATUT ACTUEL | 🟡 `.env.local`/`prisma/.env` contiennent désormais de vrais identifiants Supabase (jamais commités — `.gitignore` vérifié, `.env*` couvert). |
| CODE EXISTANT | `.env.example` déjà à jour avec toutes les variables (catégorisées), aucune valeur réelle dedans. |
| CONFIGURATION MANQUANTE | Variables R2/Resend/Sentry réelles (voir B/C/D). |
| ACTION AUTOMATISABLE | Balayage de secrets avant tout déploiement (déjà fait une fois en P18 — à refaire après chaque ajout de service). |
| ACTION MANUELLE | Aucune à ce stade. |
| RISQUE | Faible — projet non versionné avec git (`Is a git repository: false`), donc aucun risque de fuite via commit tant que git n'est pas initialisé. À re-vérifier au moment de l'initialisation git. |
| TEST À EFFECTUER | Grep exhaustif des clés/URLs sensibles dans le code source (hors `.env.example`), vérification qu'aucun composant `"use client"` n'importe un module lisant un secret serveur (déjà fait en P18, à refaire après ce sprint). |

## K. Tests finaux de staging

Dépendent de la résolution de A à J — traités dans les phases suivantes de cette
mission, jamais déclarés « passés » sans exécution réelle.

## Constat transversal important pour la suite (Phase 1)

**Cet environnement d'exécution (celui où je travaille) ne peut pas établir de
connexion Postgres directe sur le port 5432** (timeout systématique, confirmé deux fois
à des moments différents) **alors que le port 6543 (pooler transaction-mode) fonctionne
de façon fiable et parle le vrai protocole Postgres.** Le propriétaire confirme un accès
direct fonctionnel depuis sa propre machine. Cela signifie concrètement que je peux
exécuter moi-même toute opération Postgres compatible avec le pooler transaction-mode
(requêtes, introspection simple), mais que `prisma migrate deploy`/`migrate dev`
(qui exigent `DIRECT_URL`, une connexion session-mode, pour leur verrouillage
consultatif interne) devront soit être exécutés par le propriétaire depuis sa machine,
soit tentés ici via un contournement temporaire (pointer `DIRECT_URL` vers le port 6543
également) — solution non officiellement recommandée par Prisma/Supabase mais
généralement suffisante pour des migrations DDL simples comme celles d'ACADIA (aucune
opération `CONCURRENTLY` dans l'historique existant). Ce point est détaillé et une
décision demandée au propriétaire en Phase 1.
