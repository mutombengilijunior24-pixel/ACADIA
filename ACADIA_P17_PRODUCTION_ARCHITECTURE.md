# ACADIA — Architecture Production P17

## 1. Vue d'ensemble

```
CLIENT (navigateur)
  ↓ fetch (crédentiels cookie HttpOnly)
NEXT.JS API ROUTES (runtime Node)
  ↓ authenticate() → session HMAC (inchangé depuis P13)
  ↓ authorize()   → vérifie la relation réelle (ownerId, assignment...)
  ↓ service()     → lib/server/*
PRISMA CLIENT
  ↓
BASE DE DONNÉES (SQLite en dev — réelle, transactionnelle, fichier local ;
                  PostgreSQL documenté comme cible de production)
```

Les composants React ne lisent/écrivent plus une source de vérité côté navigateur pour les
données critiques (comptes, recherches, supervision). Le localStorage devient un **cache
d'écriture simultanée** (write-through) pour la fluidité perçue de l'UI, jamais la source de
vérité — voir §4.

## 2. Base de données : choix et justification

**Prisma + SQLite (dev) / PostgreSQL (production documentée).**

Aucun ORM n'existait avant ce sprint (confirmé par audit) — aucun conflit à arbitrer.
PostgreSQL a été explicitement demandé par défaut, mais **aucune instance PostgreSQL n'est
disponible dans cet environnement** (ni serveur installé, ni Docker pour en démarrer un).
Prétendre configurer PostgreSQL sans pouvoir réellement le faire tourner violerait la règle
anti-hallucination du sprint. SQLite via Prisma est :

- une **vraie base de données relationnelle avec transactions ACID**, pas un JSON déguisé ;
- un fichier local (`prisma/dev.db`, gitignoré), zéro service externe à provisionner ;
- migrable vers PostgreSQL en changeant uniquement `provider` et `DATABASE_URL` dans
  `schema.prisma` — le reste du code applicatif (requêtes Prisma) ne change pas.

**Statut explicite : base de données de développement opérationnelle et testée. PostgreSQL
de production non provisionné — architecture prête, service non configuré.**

## 3. Modèle de données

Voir `ACADIA_P17_DATABASE_SCHEMA.md` pour le schéma Prisma complet. Résumé des choix :

- **Relationnel** pour tout ce qui doit être filtré/listé/contraint : `User`,
  `StudentProfile`, `SupervisorProfile`, `ResearchProject` (métadonnées), 
  `SupervisionCanevas`, `SupervisorInvitation`, `SupervisionAssignment`, `Submission`,
  `InboxMessage`, `FeedbackEntry`, `Correction`, `Notification`, `EmailLog`.
- **JSON** pour les structures scientifiques imbriquées déjà stables et jamais recalculées
  par la base : le `ResearchProject` scientifique complet (variables/dimensions/
  indicateurs/hypothèses/méthodologie — type `ResearchProject` de
  `lib/core/research/ResearchTypes.ts`, **non modifié**), l'instrument généré, le dataset,
  les entrées de bibliographie/cadre théorique/historique d'export d'une recherche, les
  sections d'un feedback, le snapshot d'une soumission, les étapes d'un canevas.

Ce choix suit explicitement l'approche hybride autorisée par le sprint : « relational
metadata + JSON/JSONB scientific payload ». Aucune donnée scientifique n'est recalculée par
la base — elle reste calculée par les moteurs déterministes existants (P1-P16), la base ne
fait que la conserver.

## 4. Migration de ResearchContext (localStorage → base) : le mécanisme d'écriture simultanée

`ResearchContext.tsx` a déjà, avant ce sprint, un point d'hydratation unique et huit points
de persistance déjà centralisés (un par collection — voir audit §2). Plutôt que de réécrire
les ~25 fonctions de mutation consommées par des dizaines de composants (risque de
régression majeur sur un fichier de 2700+ lignes), P17 :

1. Ajoute `lib/server/research/ResearchStateService.ts` + `app/api/research-state/route.ts`
   (GET/PUT, authentifié, jamais de `userId` accepté du client).
2. À l'hydratation : le client tente d'abord `GET /api/research-state` (source de vérité).
   Si la base contient des données, elles priment. Si le localStorage contient des données
   plus anciennes non encore migrées (compte créé avant P17), une migration automatique
   ponctuelle les transmet à la base (voir `ACADIA_P17_MIGRATION_GUIDE.md`).
3. À chaque persistance locale (les 8 effets déjà existants), un envoi `PUT` (débattu/
   asynchrone, best-effort, ne bloque jamais l'UI) synchronise la même donnée vers la base.

**Preuve du critère de succès (Partie 43/58 du sprint)** : après une soumission de
formulaire, vider le localStorage puis se reconnecter restitue les données depuis la base —
testé explicitement (voir `ACADIA_P17_TEST_REPORT.md`).

## 5. Authentification

Conservée : bcrypt (12 rounds), cookie de session HMAC-SHA256 signé, HttpOnly, `SameSite=lax`,
`Secure` en production, expiration 30 jours (P13). `UserStore.ts` migre son stockage de
fichier JSON vers Prisma (mêmes signatures de fonctions exportées — aucun appelant modifié
en dehors du fichier lui-même).

Améliorations P17 : contrainte d'unicité réelle sur `email` au niveau base (au-delà de la
vérification applicative déjà existante), architecture de vérification d'email préparée
(non activée — aucun fournisseur email réel, voir `ACADIA_P16_EMAIL_ARCHITECTURE.md`),
abstraction de limitation de débit (voir §10).

## 6. Rôles dès l'inscription

`/register` devient un choix explicite en deux temps : « Comment allez-vous utiliser
ACADIA ? » (Étudiant / Directeur) puis un formulaire spécifique à chaque rôle. Le rôle est
fixé à la création du compte côté serveur — jamais modifiable depuis le client après coup
sans passer par une route serveur dédiée et auditée (`role` n'est jamais accepté tel quel
dans le corps d'une requête générique).

## 7. Vérification du directeur

`SupervisorProfile.verificationStatus` (`pending | verified | rejected`). Un compte
directeur nouvellement créé est `pending` — aucune fonctionnalité de supervision n'est
bloquée par défaut (documenté comme choix : bloquer aurait cassé la démonstration bout-en-
bout déjà validée en P16 sans bénéfice réel tant qu'aucun processus d'administration humain
n'existe). L'interface affiche honnêtement le statut plutôt que de prétendre une
vérification effectuée.

## 8. Autorisation serveur (multi-tenancy)

Chaque route qui touche une ressource appartenant à un utilisateur vérifie la relation
réelle en base avant de répondre — jamais uniquement une vérification de rôle générique.
Patron centralisé dans `lib/server/auth/authorize.ts` :

```ts
requireOwner(researchProject, session.user.id)
requireSupervisorOfAssignment(assignment, session.user.id)
requireStudentOfAssignment(assignment, session.user.id)
```

## 9. Stockage de documents

`DocumentStorageProvider` (interface) + `LocalDevDocumentStorageProvider` (implémentation
de développement : écrit sous `data/documents/`, jamais commité). Aucun fournisseur cloud
réel n'est configuré — documenté explicitement dans
`ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §14 comme options futures (S3, Cloudflare R2,
Supabase Storage), sans identifiants ni activation.

## 10. Rate limiting

`lib/server/security/RateLimiter.ts` — interface + implémentation de développement en
mémoire process (fenêtre glissante simple). **Ne fonctionne correctement que sur un seul
processus** — documenté explicitement comme limite de développement ; la recommandation de
production (Redis/KV partagé) est documentée, non installée.

## 11. Entitlements côté serveur

`lib/server/entitlements/` réutilise `lib/core/entitlements/` (P14/P15/P16, non dupliqué) et
l'applique désormais **dans chaque route sensible**, pas seulement dans l'UI (masquer un
bouton ne suffit jamais). Un rôle `student` appelant une route réservée au directeur reçoit
un refus serveur, identique que le bouton soit visible ou non côté client.

## 12. Notifications

Migrées de fichier JSON vers table `Notification` (Prisma) — même modèle logique que P16,
uniquement le mécanisme de persistance change.

## 13. Email

Abstraction `EmailProvider` (P16) conservée à l'identique. `NoOpEmailProvider` reste la
seule implémentation active — aucun fournisseur réel configuré.

## 14. Environnements

| | Développement | Staging | Production |
|---|---|---|---|
| Base de données | SQLite locale (`prisma/dev.db`) | À provisionner (PostgreSQL managé recommandé) | À provisionner (PostgreSQL managé recommandé) |
| Stockage documents | Système de fichiers local | À provisionner | À provisionner |
| Email | NoOp (journalisé) | À provisionner | À provisionner |
| IA | Clé OpenAI développeur | Clé dédiée recommandée | Clé dédiée recommandée |
| Domaine | `localhost:3000` | À définir | À définir |

## 15. Ce qui N'EST PAS fait dans ce sprint (limite assumée)

- Aucune base PostgreSQL de production provisionnée.
- Aucun stockage cloud réel connecté.
- Aucun fournisseur email réel connecté.
- Aucun déploiement réel exécuté (Vercel/autre) — préparation documentée uniquement.
- Aucune vérification institutionnelle réelle du rôle directeur (auto-déclaration +
  statut honnête, comme en P16, désormais avec un statut `pending` explicite).
