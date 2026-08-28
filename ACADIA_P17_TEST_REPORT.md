# ACADIA — Rapport de tests P17 (Infrastructure production)

## 1. Audit initial

Voir `ACADIA_P17_AUDIT.md`. Constat central : aucun ORM, aucune base de données, aucun
serveur PostgreSQL disponible dans l'environnement — décision retenue : Prisma + SQLite en
développement (base réelle, transactionnelle), PostgreSQL documenté comme cible de
production (voir `ACADIA_P17_PRODUCTION_ARCHITECTURE.md`).

## 2. Build / Lint / Typecheck

`npx tsc --noEmit` : propre. `npm run build` : propre, 60 routes générées (dont
`/api/research-state` et les 24 routes de supervision migrées vers Prisma). `npm run lint` :
56 problèmes, tous préexistants (baseline identique à P16 — vérifié fichier par fichier,
aucun nouveau).

## 3. Problème réel découvert et corrigé pendant les tests (méthode + cause)

**Symptôme** : après la première migration Prisma, plusieurs routes API de supervision
(`notifications`, `messages`, `canevas`, `invitations`, `profile`) renvoyaient des objets
vides (`{}`) au lieu des données attendues, provoquant des plantages client
(`messages.filter is not a function`, `notifications.filter is not a function`).

**Cause réelle** : la migration de `lib/auth/UserStore.ts` et des dix stores de
`lib/supervision/` vers Prisma a rendu **toutes** leurs fonctions asynchrones (Prisma est
intrinsèquement basé sur des Promises). `npx tsc --noEmit` a bien signalé la plupart des
appels non attendus (`await` manquant) — mais **pas ceux imbriqués directement dans
`Response.json({ ... })`**, puisque `Response.json()` accepte un argument de type `any` :
`Response.json({ notifications: listNotifications(user.id) })` compile sans erreur même si
`listNotifications` retourne une Promise, mais sérialise cette Promise en `{}` au lieu
d'attendre sa résolution.

**Correction** : sweep manuel systématique de chaque route appelant une fonction des stores
migrés, ajout de `await` partout où manquant (10 routes concernées :
`canevas`, `invitations`, `messages`, `messages/[id]/read`, `notifications`, `profile`).
Revérifié par une recherche exhaustive croisant chaque nom de fonction contre chaque
fichier de route — confirmé 0 appel non attendu restant.

**Second problème découvert** : après un redémarrage du serveur de développement, toutes
les routes `/api/**` renvoyaient 404 alors que les pages fonctionnaient. Cause : cache
Turbopack (`.next/`) corrompu par l'accumulation de nombreux changements de fichiers dans
la même session de développement longue. Résolu par `rm -rf .next` puis redémarrage —
confirmé que ce n'était pas lié à la nouvelle configuration `next.config.ts` (testée
isolément). Documenté ici comme point de vigilance pour la suite du développement.

## 4. Test end-to-end réel (scénario complet du sprint, Parties 39/44/58)

Exécuté en navigateur réel (Edge headless, CDP) après résolution des deux problèmes
ci-dessus — succès complet :

1. **Compte étudiant créé via le nouveau parcours en 2 étapes** (`/register` →
   choix de rôle → formulaire) → `role: "student"` réellement persisté en base.
2. **Recherche créée** (simulée via injection localStorage, comme le ferait le Wizard) →
   visible sur le dashboard après rechargement.
3. **Synchronisation vers la base confirmée** : `GET /api/research-state` retourne bien la
   recherche après le délai de synchronisation différée (~1,5s).
4. **PREUVE CRITIQUE (Partie 43/58)** : `localStorage.clear()` exécuté intégralement, page
   rechargée → **la recherche reste visible**, restituée depuis la base de données. Ceci
   démontre que le navigateur n'est plus la source de vérité.
5. **Déconnexion puis reconnexion** → la recherche reste visible.
6. **Compte directeur créé via le nouveau parcours en 2 étapes** → `role: "supervisor"`
   réellement persisté.
7. **Accès à `/dashboard/supervisor` confirmé** (pas de redirection).
8. **Canevas créé** → persiste après rechargement (relu depuis la base, pas depuis un état
   client mis en cache).
9. **Invitation → acceptation → affectation** créée en base.
10. **Étudiant soumet V1** → directeur voit la soumission dans sa liste réelle, brief ACADIA
    généré (`overallState: "bloquant"`, cohérent avec un projet minimal réel).
11. **Isolation** : un troisième compte reçoit 403 sur l'accès à la soumission, un état
    `research-state` vide pour lui-même, et une redirection réelle loin de
    `/dashboard/supervisor`.
12. **Sécurité** : accès non authentifié à `/api/research-state` → 401 confirmé.

## 5. Non-régression supervision (P16)

Le flux complet P16 (canevas, invitation, soumission, brief, feedback, comparaison,
correction) a été revérifié fonctionnel sur la nouvelle infrastructure Prisma — les
signatures de fonctions exportées par chaque store ont été conservées à l'identique
(seulement rendues asynchrones), aucune route consommatrice n'a dû changer de logique
métier, seulement ajouter `await`.

## 6. Non-régression scientifique (P1-P16)

Aucun moteur protégé modifié (vérifié par relecture des imports : tous en lecture seule).
Le build de production inclut toutes les routes scientifiques existantes sans erreur. Un
test manuel complet de bout en bout du pipeline scientifique (A0-A2, questionnaire,
dataset, analyses, export) n'a pas été rejoué dans cette passe au-delà de la vérification
de compilation — limite assumée, documentée plutôt que déclarée testée par erreur (le
temps du sprint a été concentré sur l'infrastructure elle-même, conformément à l'objectif
du sprint).

## 7. Sécurité

- Toutes les routes dérivent l'utilisateur de la session serveur.
- `/api/research-state` : `ownerId` toujours dérivé de la session ; une tentative
  d'écraser une ligne appartenant à un autre utilisateur (collision d'id générée côté
  client) est explicitement rejetée (voir `ResearchStateService.ts`).
- Rate limiting appliqué à `/api/auth/login` et `/api/auth/register` (implémentation de
  développement en mémoire process — voir `ACADIA_P17_SECURITY.md` §5 pour la limite
  assumée).
- Journal d'audit réel : `USER_CREATED`, `LOGIN_FAILED`, `SUBMISSION_CREATED`,
  `FEEDBACK_CREATED` vérifiés enregistrés en base pendant les tests (4 entrées réelles
  observées).

## 8. Migration

`scripts/migrate-json-to-db.ts` testé en mode aperçu (dry-run) : s'exécute sans erreur,
rapporte 0 enregistrement trouvé (les fichiers `data/*.json` sont vides depuis la fin de
P16 — rien à migrer dans cet environnement). La logique d'idempotence (vérification
d'existence avant insertion) n'a donc pas pu être testée avec des données réelles
préexistantes dans cette passe — limite assumée.

## 9. Nettoyage

Base de données de développement réinitialisée (toutes les tables vidées) après les tests.
`data/*.json` confirmés vides (inutilisés depuis la migration).

## 10. Limites / non testé dans cette passe

- PostgreSQL de production non provisionné, jamais testé.
- Migration réelle de données JSON préexistantes non testée (aucune donnée à migrer dans
  cet environnement).
- Pipeline scientifique complet (P1-P12) non rejoué de bout en bout dans cette passe.
- Discussion sur corrections, rôle admin : non retestés (inchangés depuis P16).
- Tests de charge / concurrence réelle non effectués (SQLite sérialise les écritures au
  niveau fichier — suffisant pour une bêta à faible concurrence, non stress-testé).
