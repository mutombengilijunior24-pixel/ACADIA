# ACADIA — Rapport de test P18

Légende : **FAIT** (implémenté), **TESTÉ** (vérifié en conditions réelles contre le
serveur de développement, avec preuve reproductible), **NON TESTÉ** (pas exécuté dans
cette session, portée non couverte), **NON CONFIGURÉ** (dépend d'un service externe
absent), **BLOQUÉ** (impossible sans ressource externe), **À FAIRE** (reste explicitement
identifié pour un sprint futur).

## Partie 1 — PostgreSQL de staging

**BLOQUÉ.** Aucune instance accessible dans cet environnement. Voir
`ACADIA_P18_POSTGRES_BLOCKER.md` pour la procédure exacte à exécuter le jour où une
instance est disponible.

## Partie 2 — Migrations / intégrité des données

**FAIT + TESTÉ (partiel).** Les 3 migrations existantes (`init`,
`fix_assignment_constraint`, et `add_submission_version_unique_constraint` ajoutée ce
sprint) s'appliquent proprement via `prisma migrate deploy`. Cas non explicitement
rejoués ce sprint : id en collision inter-utilisateurs (déjà couvert par
`ResearchStateService.syncResearchState()` en P17, non re-testé ici), projet/utilisateur
supprimé, JSON corrompu — voir Partie 12 pour ce qui a été couvert côté résilience.

## Partie 3 — Matrice d'autorisation (STUDENT × SUPERVISOR × ADMIN)

**TESTÉ EN CONDITIONS RÉELLES.** Script Node exécuté contre le serveur de développement
réel (`http://localhost:3000`), avec 4 comptes de test créés via l'API d'inscription
réelle (fixtures clairement identifiées : préfixe `p18test-`, domaine
`test.acadia.local`). **20 / 20 scénarios réussis** :

- **États de session** : aucun cookie → 401 ; cookie corrompu (`garbage.invalid.token`)
  → 401 ; cookie vide → 401.
- **STUDENT sur routes réservées SUPERVISOR** : `/supervision/students` (GET),
  `/supervision/profile` (GET), `/supervision/canevas` (GET+POST),
  `/supervision/invitations` (POST), `/supervision/feedback` (POST) → 403 dans tous les
  cas.
- **SUPERVISOR sur route réservée STUDENT** : `/supervision/submissions` (POST) → 403.
- **Scénario réel d'affectation** : directeur A crée une invitation (201), étudiant A
  l'accepte (200), étudiant A soumet une version (201).
- **Ids forgés et isolation croisée** : `submissionId` inexistant → 404 ; un étudiant
  tiers non affecté (« Étudiant B ») lisant la soumission de A → 403 ; un directeur tiers
  non affecté (« Directeur B ») lisant ou validant la soumission de A → 403 dans les deux
  cas ; le bon directeur (A) validant sa propre soumission → 200 ; `messageId` forgé →
  jamais 200 ; `canevasId` forgé n'appartenant à personne → 404.

**Rôle ADMIN** : non testé — le rôle existe dans `UserRole` (type système, P17) mais
**aucune route, page ou capability n'implémente de comportement spécifique à
`admin`** aujourd'hui (vérifié par recherche exhaustive : seule occurrence du littéral
`"admin"` dans tout le code applicatif est sa définition de type dans
`lib/auth/AuthTypes.ts`). Il n'y a donc rien de fonctionnel à tester pour ce rôle.

**Preuve** : chaque `ACCESS_DENIED` généré pendant ce test a été retrouvé, avec le bon
`actorId` et le bon motif, par requête directe dans la table `AuditLog` (voir Partie 4
du présent rapport et `ACADIA_P18_AUDIT.md` §7).

## Partie 4 — Rate limiting et journal d'audit

**FAIT + TESTÉ.**

- Rate limiting complété sur les 5 routes identifiées comme manquantes par l'audit :
  `forgot-password` (5/15min par email), `reset-password` (10/15min par token),
  `invitations` POST (20/h par directeur), `invitations/accept` POST (15/10min par
  utilisateur), `submissions` POST (10/10min par étudiant).
- **Test réel** : 7 appels consécutifs à `/api/auth/forgot-password` avec le même email
  → les 5 premiers renvoient 200, les 2 suivants renvoient **429** — comportement
  attendu confirmé.
- Journal d'audit complété : `ROLE_ASSIGNED` (câblé dans `become-supervisor`),
  `CORRECTION_UPDATED` (câblé dans `corrections/[id]` PATCH), `ACCESS_DENIED` (câblé
  génériquement dans le helper `forbidden()`, appliqué à tous les points d'appel du
  périmètre `/api/supervision/**`).
- **Test réel** : requête directe dans la table `AuditLog` après la matrice
  d'autorisation de la Partie 3 → 7 entrées `ACCESS_DENIED` réelles avec le bon motif
  (ex. « Vous n'êtes pas le directeur de cette soumission. »), 1 `SUBMISSION_CREATED`,
  confirmant que le câblage fonctionne de bout en bout (pas seulement que le code
  compile).
- `EXPORT_CREATED` **volontairement non câblé** : les routes `/api/export/{pdf,docx}`
  sont stateless et n'authentifient aucun appelant (aucun `getSessionUser()`) — ce sont
  des routes du périmètre protégé (DocumentBuilder/export). Ajouter un `actorId` réel y
  exigerait d'ajouter une vérification de session, ce qui est une modification
  fonctionnelle d'une route protégée sans bug de sécurité critique démontré (l'absence
  d'authentification n'expose aucune donnée : la route ne fait que formater ce que
  l'appelant lui envoie déjà). Documenté explicitement plutôt que masqué.

## Partie 5 — Statut email

**FAIT + TESTÉ.** Voir `ACADIA_P18_EMAIL_STATUS.md` en détail. Gap réel trouvé et
corrigé : le serveur exposait déjà `email: { status: "not_configured" }` mais aucun
composant client ne l'affichait. Corrigé dans `SubmitVersionButton.tsx` et
`app/dashboard/supervisor/review/[submissionId]/page.tsx` : un message explicite
apparaît désormais quand aucun email n'a été envoyé.

## Partie 6 — Stockage de documents

**NON TESTÉ.** `DocumentStorageProvider`/`LocalDevDocumentStorageProvider` existent
depuis P17 mais ne sont appelés par aucune fonctionnalité produit réelle (les exports
restent stateless, générés à la volée côté client puis mis en forme côté serveur sans
jamais passer par ce provider). Il n'y a donc pas de flux utilisateur réel à tester —
tester le provider isolément (upload/download/delete direct) sans appelant produit
n'aurait testé que du code mort. Statut honnête : **LOCAL DEV, non intégré**.

## Partie 7 — Sauvegardes

**FAIT (documentation).** Voir `ACADIA_P18_BACKUP_STATUS.md` — confirmation qu'aucun
changement depuis P17, aucun service réel disponible.

## Partie 8 — Observabilité

**FAIT.** Voir `ACADIA_P18_OBSERVABILITY.md`. Gap réel trouvé et corrigé : aucune page
`error.tsx`/`global-error.tsx`/`not-found.tsx` n'existait à la racine de l'application —
ajoutées ce sprint (correction d'état d'erreur, pas de refonte visuelle).

## Partie 9 — Variables d'environnement / balayage bundle client

**TESTÉ.** Un seul usage de `NEXT_PUBLIC_*` dans tout le code (`NEXT_PUBLIC_APP_URL`,
non sensible). Tous les modules lisant un secret serveur (`OPENAI_API_KEY`,
`SESSION_SECRET`, `DATABASE_URL`) ne sont importés que par des routes API, le helper
`apiAuth.ts`, ou `proxy.ts` (middleware serveur) — aucun composant `"use client"` ne les
importe, directement ou transitivement. Voir `ACADIA_P18_AUDIT.md` §9bis.

## Partie 10 — Domaine / HTTPS

**NON APPLICABLE (documenté).** Voir `ACADIA_P18_DOMAIN_STATUS.md`.

## Partie 11 — Concurrence

**TESTÉ — bug réel trouvé et corrigé.** 5 requêtes `POST /api/supervision/submissions`
envoyées en parallèle par le même étudiant : **avant correction**, les 5 recevaient la
version `1` (lecture non atomique de la dernière version dans
`SubmissionStore.createSubmission()`). Corrigé par une contrainte unique en base
(`@@unique([researchId, studentId, version])`, migration
`add_submission_version_unique_constraint` créée et appliquée) et une relecture
automatique en cas de conflit (`P2002`, jusqu'à 5 tentatives). **Après correction**, les
5 mêmes requêtes reçoivent bien les versions `1, 2, 3, 4, 5`. Aucun moteur scientifique
protégé n'a été touché — `SubmissionStore` est une brique d'infrastructure de
supervision, hors du périmètre protégé listé dans les règles du sprint.

## Partie 12 — Résilience

**PARTIELLEMENT TESTÉ.** Couvert par les Parties 3 et 4 : cookie corrompu/vide/absent
(401 propre, pas de crash), ressource inexistante forgée (404 propre), corps JSON
invalide (géré par un `try/catch` systématique déjà en place sur chaque route, confirmé
par lecture de code — comportement `400` cohérent). **Non testé** : base de données
indisponible (arrêt volontaire du process SQLite non tenté, risque de perturber le
serveur de développement partagé par le reste de la session), timeout réseau simulé.

## Partie 13 — Régression scientifique complète (A0 → export, V1 → V2)

**NON TESTÉ CE SPRINT.** Aucune régression de bout en bout (génération de
questionnaire, dataset, analyses descriptives/bivariées/économétriques, interprétation,
discussion, export, puis cycle de révision complet V1→feedback→correction→V2→comparaison)
n'a été rejouée dans cette session — portée non couverte faute de temps disponible dans
ce tour de travail. **Aucune modification n'a été apportée à un moteur protégé** pendant
ce sprint ; ce point reste donc à vérifier avant tout déploiement, mais n'a pas de raison
de régresser puisque rien dans les moteurs A0-A2/ResearchCore/QuestionnaireGenerationEngine/
DatasetEngine/*AnalysisEngine/EconomicInterpretationEngine/ScientificDiscussionEngine/
ScientificWorkEngine/DocumentBuilder n'a été touché.

## Partie 14 — Régression projet qualitatif

**NON TESTÉ CE SPRINT**, même raison que la Partie 13.

## Partie 15 — Nouveaux comptes, zéro activité fictive

**PARTIELLEMENT TESTÉ.** Les 6 comptes créés pendant les tests de ce sprint (Parties 3
et 11) sont apparus sans aucune donnée pré-remplie côté serveur (aucune soumission,
aucune notification, aucun message avant action explicite) — confirmé indirectement par
le comportement observé (chaque ressource n'existait qu'après l'action qui la créait).
**Non vérifié visuellement** : le rendu réel du tableau de bord dans un navigateur pour
un compte neuf (nécessiterait un test d'interface, non réalisé ce sprint).

## Partie 16 — Flux de supervision complet

**PARTIELLEMENT TESTÉ.** Le chemin invitation → acceptation → soumission → validation a
été rejoué réellement et avec succès (Parties 3 et 11), y compris l'isolation d'un
directeur tiers non affecté. **Non rejoué ce sprint** : feedback structuré complet avec
sections, discussion sur correction, comparaison V1/V2 avec `RevisionComparisonEngine`
(logique déjà validée en P16/P17, non re-testée ici).

## Partie 17 — Export DOCX/PDF sur recherche persistée en base

**NON TESTÉ CE SPRINT.**

## Partie 18 — Responsive (390/768/1024/1440px)

**NON TESTÉ CE SPRINT** — nécessite un test navigateur, non réalisé dans cette session.

## Partie 19 — Audit de performance pragmatique

**NON MESURÉ FORMELLEMENT.** Observation informelle uniquement : toutes les requêtes API
testées (Parties 3, 4, 11) ont répondu sans latence perceptible en local ; le build de
production (Partie 23) s'est terminé sans anomalie. Aucun chronométrage systématique
n'a été effectué.

## Partie 20 — Checklist de production

Voir `ACADIA_P18_PRODUCTION_CHECKLIST.md`.

## Partie 21 — Verdict GO/NO-GO

Voir `ACADIA_P18_DEPLOYMENT_STATUS.md`.

## Partie 22 — Rapports finaux

Ce document, `ACADIA_P18_SECURITY_REPORT.md`, `ACADIA_P18_DEPLOYMENT_STATUS.md`.

## Partie 23 — Build / lint / typecheck

**TESTÉ.**

- `npx tsc --noEmit` : **0 erreur** (avant et après chaque changement de ce sprint).
- `npm run lint` : **56 problèmes (39 erreurs, 17 avertissements)** — identique au
  baseline établi avant ce sprint. Deux avertissements introduits par les nouveaux
  fichiers d'erreur (`eslint-disable` superflu) ont été détectés et retirés
  immédiatement ; le compte final est strictement égal au baseline, aucune régression.
- `npm run build` : **succès**, toutes les routes se compilent (pages statiques et
  dynamiques), aucune erreur de build.
