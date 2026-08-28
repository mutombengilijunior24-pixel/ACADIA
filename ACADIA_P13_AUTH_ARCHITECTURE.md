# ACADIA — Architecture d'authentification (P13)

## Décision de portée

Avant P13, ACADIA n'avait aucune authentification : toutes les données
vivaient dans `localStorage`, sans notion de compte. Une isolation « complète »
(données consultables depuis n'importe quel appareil) aurait exigé de migrer
chaque opération CRUD de `ResearchContext` vers une API + base de données — un
chantier à part entière. Le choix retenu pour ce sprint (validé explicitement
avec le porteur du produit) est :

> **Authentification réelle + isolation locale.** Comptes réels, mots de passe
> hachés, sessions sécurisées, routes `/dashboard` protégées. Les données de
> recherche restent dans `localStorage`, mais cloisonnées par identifiant
> utilisateur — un second compte utilisé sur le même navigateur ne voit jamais
> les données du précédent.

**Limite assumée et documentée** : ces données ne sont pas encore
synchronisées entre appareils. Se connecter au même compte depuis un autre
navigateur ou un autre ordinateur ne restitue pas les recherches déjà créées.
C'est un choix de portée délibéré pour ce sprint, pas un oubli.

## Stockage des comptes

- `lib/auth/UserStore.ts` — fichier JSON local (`data/users.json`, jamais
  commité, voir `.gitignore`), lecture/écriture synchrone pour éviter les
  courses entre requêtes dans le même processus. Suffisant pour une bêta à
  faible concurrence sur un serveur Node persistant ; **pas conçu pour un
  déploiement serverless multi-instance** (chaque instance aurait son propre
  fichier). Migration vers une vraie base de données recommandée avant une
  mise à l'échelle.
- Mots de passe hachés avec `bcryptjs` (12 rounds) — jamais stockés en clair.
  `bcryptjs` a été choisi plutôt que `bcrypt` : implémentation pure JS, aucune
  compilation native, donc aucun risque d'échec d'installation.

## Sessions

- `lib/auth/session.ts` — cookie `acadia_session`, HttpOnly, `sameSite=lax`,
  `secure` en production, 30 jours. Contenu : identifiant utilisateur +
  expiration, signé par HMAC-SHA256 (`node:crypto`, aucune dépendance
  supplémentaire). Aucune donnée sensible dans le cookie lui-même.
- `SESSION_SECRET` (voir `.env.example`) doit être une valeur aléatoire par
  environnement — jamais la même en développement et en production.

## Protection des routes

Cette version de Next.js renomme `middleware.ts` en **`proxy.ts`** (fonction
exportée `proxy`, voir `node_modules/next/dist/docs/.../file-conventions/proxy.md` —
la documentation embarquée de ce projet doit être consultée avant tout code
sur ce point, la convention a changé par rapport aux versions précédentes).
`proxy.ts` à la racine du dépôt protège tout `/dashboard/**` : sans session
valide, redirection vers `/login?next=<chemin>`. Proxy s'exécute par défaut
sur le runtime Node.js dans cette version — `node:crypto` est donc utilisable
directement dans `verifySessionToken`, sans restriction Edge.

## Isolation des données par utilisateur

`contexts/ResearchContext.tsx` a été modifié (seul fichier « métier » touché
par P13, hors de la liste des moteurs scientifiques protégés) : chacune des 7
clés `localStorage` (`acadia-researches`, `acadia-projects`,
`acadia-instruments`, `acadia-datasets`, `acadia-annotations`,
`acadia-bibliography`, `acadia-export-history`) est désormais suffixée par
`:<userId>`. L'hydratation attend explicitement que la session soit résolue
(`useAuth()`) avant de lire quoi que ce soit, et se ré-exécute si l'identifiant
change (changement de compte dans le même onglet). Testé en navigateur avec
deux comptes réels : le second ne voit jamais les données injectées pour le
premier (voir `ACADIA_P13_TEST_REPORT.md`).

Les clés `localStorage` non suffixées, créées avant P13, restent présentes
mais ne sont plus jamais lues ni écrites par le code actuel — inertes, sans
risque, à nettoyer manuellement si souhaité.

## Mot de passe oublié

Aucun service d'email n'est branché en bêta. `/api/auth/forgot-password`
génère un vrai jeton à usage unique (1 heure) mais le renvoie **directement
dans la réponse**, jamais un faux message « un email vous a été envoyé ». Le
compromis assumé : cela révèle si une adresse existe (petite fuite
d'énumération), acceptable pour une bêta fermée, à corriger avant une
ouverture publique en branchant un vrai service d'email.

## Routes créées

`/login`, `/register`, `/forgot-password`, `/reset-password`,
`/dashboard/settings` (changement de mot de passe) — et côté API :
`app/api/auth/{register,login,logout,me,forgot-password,reset-password,change-password}/route.ts`.
