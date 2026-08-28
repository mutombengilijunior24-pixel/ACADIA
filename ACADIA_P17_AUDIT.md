# ACADIA — Audit P17 (Infrastructure production)

## 0. Environnement de développement — contrainte déterminante

Cet audit a d'abord vérifié ce qui est *réellement disponible* dans l'environnement avant
de choisir une architecture de base de données, conformément à la règle anti-hallucination
du sprint :

- **Aucun serveur PostgreSQL** n'est installé ou accessible (`psql` absent).
- **Aucun Docker** disponible pour en démarrer un.
- **Aucun ORM** n'existe dans `package.json` (`prisma`, `drizzle-orm`, etc. absents avant ce
  sprint).
- **L'accès réseau npm fonctionne** (`registry.npmjs.org` joignable) — les paquets peuvent
  être installés.
- Node 24.18.1, npm 11.16.0.

**Décision découlant de cet audit** (détaillée dans `ACADIA_P17_PRODUCTION_ARCHITECTURE.md`) :
Prisma + **SQLite en développement** (base de données réelle, transactionnelle, fichier
local, zéro serveur externe requis) avec **PostgreSQL documenté comme cible de
production** — Prisma rend ce changement un simple changement de `provider` +
`DATABASE_URL`, sans réécriture du schéma ni du code applicatif. Annoncer « PostgreSQL
configuré » serait faux ici : aucune instance PostgreSQL n'existe dans cet environnement.

## 1. Ce qui est actuellement persistant, et où

| Domaine | Mécanisme actuel | Fichier(s) |
|---|---|---|
| Comptes utilisateurs, mots de passe, rôle | Fichier JSON serveur (`data/users.json`) | `lib/auth/UserStore.ts` |
| Jetons de réinitialisation de mot de passe | Fichier JSON serveur | `lib/auth/UserStore.ts` |
| Session | Cookie HttpOnly signé HMAC (sans état serveur) | `lib/auth/session.ts` |
| Recherches (liste), projets scientifiques complets, instruments, datasets, annotations, bibliographie, historique d'export, cadre théorique | **localStorage**, scopé par utilisateur (`acadia-*:{userId}`) | `contexts/ResearchContext.tsx` |
| Profils directeur, canevas, invitations, affectations, soumissions (+ snapshot complet), messages, feedback, corrections, notifications, journal email | Fichiers JSON serveur (10 fichiers sous `data/`) | `lib/supervision/*Store.ts` |

## 2. Ce qui est actuellement localStorage

Huit collections, toutes scopées par `userId` via `scopedStorageKey()` (P13) :
`acadia-researches`, `acadia-projects`, `acadia-instruments`, `acadia-datasets`,
`acadia-annotations`, `acadia-bibliography`, `acadia-export-history`,
`acadia-theoretical-framework`. Hydratation et persistance déjà **centralisées** dans
`ResearchContext.tsx` : un seul effet d'hydratation (lignes ~729-759) et **huit effets de
persistance séparés, un par collection** (lignes ~761-799), chacun déclenché uniquement
quand sa collection change. C'est le point d'insertion naturel et à faible risque pour un
mécanisme d'écriture simultanée vers la base de données (voir Architecture §4) — aucune des
~25 fonctions de mutation de `ResearchContext` n'a besoin d'être réécrite individuellement.

Sept des huit collections sont déjà indexées par identifiant de recherche
(`Record<string, ...>`) — seule `researches` (liste plate façon "carte dashboard") ne l'est
pas directement mais contient l'id de chaque recherche. Cette structure se prête bien à un
modèle relationnel « une ligne par recherche, sous-structures scientifiques en JSON ».

## 3. Ce qui est actuellement fichier JSON serveur

`lib/auth/UserStore.ts` + les 10 stores de `lib/supervision/` (`SupervisorProfileStore`,
`CanevasStore`, `InvitationStore`, `AssignmentStore`, `SubmissionStore`, `MessageStore`,
`FeedbackStore`, `CorrectionStore`, `NotificationStore`, `EmailLogStore`, `BriefStore`),
tous construits sur le même patron `lib/supervision/jsonStore.ts` (lecture/écriture
synchrone de tableau JSON) — **explicitement documenté dès P13/P16 comme une limite
temporaire** (pas de vraie transaction, lecture-modification-écriture non atomique,
risque réel de perte d'écriture concurrente sous charge).

## 4. Ce qui doit migrer

- Comptes utilisateurs (`UserStore`) → table `User`.
- Les 10 stores de supervision → tables relationnelles correspondantes (clés étrangères
  réelles, contraintes d'unicité réelles — ex. code d'invitation unique, email unique).
- Recherches/projets/instruments/datasets/bibliographie/annotations/cadre
  théorique/historique d'export → table `ResearchProject` (relationnelle pour les champs de
  liste/filtrage, JSON pour les structures scientifiques imbriquées — jamais recalculées
  par la base).

## 5. Ce qui peut rester côté client

- Préférences d'affichage (ex. onglet actif, filtres de recherche du tableau de bord
  directeur, `localStorage` de l'onboarding déjà utilisé par `OnboardingModal.tsx`).
- État de brouillon non encore soumis du Wizard (`currentResearch`) — reste en mémoire/
  état React le temps de la session, sans conséquence s'il est perdu avant sauvegarde
  explicite (comportement déjà actuel, non modifié).

## 6. Risques de sécurité identifiés

- **Confirmé par lecture de code** : aucune route API existante (`/api/supervision/**`,
  P16) ne fait confiance à un `studentId`/`supervisorId` envoyé par le client — toutes
  dérivent l'utilisateur de `verifySessionToken()`. Ce principe est conservé et
  **renforcé** par les contraintes relationnelles de la base (une ligne ne peut exister
  sans clé étrangère valide vers un `User` réel).
- Fichiers JSON sous `data/` sont lisibles par quiconque a accès au système de fichiers du
  serveur (pas de chiffrement au repos) — un vrai SGBD avec contrôle d'accès réduit ce
  risque sans l'éliminer totalement (dépend de la configuration de production, non
  couverte ici).

## 7. Risques de concurrence

Le patron `readJsonArray` → modifier en mémoire → `writeJsonArray` (fichier entier réécrit
à chaque opération) n'est **pas atomique** : deux requêtes quasi simultanées sur la même
collection (ex. deux soumissions au même instant) peuvent s'écraser mutuellement. Un vrai
SGBD avec transactions (même SQLite, qui sérialise les écritures au niveau fichier) élimine
ce risque concret pour le volume attendu d'une bêta.

## 8. Risques de perte de données

- Aucune sauvegarde n'existe pour les fichiers `data/*.json` ni pour le localStorage
  (perte totale si le navigateur/profil est effacé — c'est précisément le problème que ce
  sprint corrige pour les données critiques).
- Voir `ACADIA_P17_BACKUP_POLICY.md` pour l'état réel (aucun service de sauvegarde
  configuré).

## 9. Dépendances externes

Aucune (ni base de données managée, ni stockage cloud, ni fournisseur email — confirmé
par les audits P16 et reconfirmé ici). Toutes les intégrations externes restent à l'état
d'architecture préparée, jamais présentées comme opérationnelles.

## 10. Décisions d'architecture (résumé — détail dans le document Architecture)

1. Prisma comme ORM (aucun autre ORM présent, aucun conflit).
2. SQLite en développement (base réelle, aucun serveur à provisionner) ; PostgreSQL
   documenté comme cible de production.
3. Modèle hybride : tables relationnelles pour les entités identifiables/filtrables
   (User, ResearchProject, SupervisionAssignment, Submission...), colonnes JSON pour les
   structures scientifiques imbriquées déjà stables (jamais recalculées par la base).
4. Synchronisation « écriture simultanée » (write-through) insérée aux 8 points de
   persistance déjà centralisés de `ResearchContext.tsx`, plutôt qu'une réécriture des ~25
   fonctions de mutation — réduit le risque de régression sur un fichier de 2700+ lignes
   consommé par des dizaines de composants.
5. Les 10 stores de supervision et `UserStore` migrent entièrement vers Prisma (aucune
   double source de vérité conservée pour ces domaines).
