# ACADIA — Rapport de sécurité P18

## Résumé

Ce sprint a fermé les lacunes de sécurité réelles identifiées par `ACADIA_P18_AUDIT.md`
(rate limiting incomplet, journal d'audit incomplet), a validé la matrice
d'autorisation par des tests réels contre le serveur (pas seulement par lecture de
code), et a découvert puis corrigé un bug de concurrence réel dans la couche
supervision. Aucun moteur scientifique protégé n'a été modifié.

## Authentification

- bcrypt (12 rounds), cookie de session HMAC-SHA256 signé, `HttpOnly`, `SameSite=lax`,
  `Secure` en production, expiration 30 jours — inchangé depuis P17, re-testé ce sprint :
  cookie absent/corrompu/vide → 401 systématiquement (3/3 scénarios testés en conditions
  réelles).
- Rate limiting sur `login`/`register` (préexistant), `forgot-password`,
  `reset-password` désormais couverts (nouveau ce sprint) — testé réellement : 429
  déclenché après 5 tentatives sur `forgot-password`.

## Autorisation

- Chaque route `/api/supervision/**` dérive l'utilisateur de la session serveur
  (`getSessionUser()`), jamais d'un id envoyé par le client — vérifié par lecture
  exhaustive des 15 fichiers de routes.
- **20/20 scénarios d'autorisation testés en conditions réelles** contre le serveur de
  développement (détail complet dans `ACADIA_P18_TEST_REPORT.md` §3) : rôle croisé
  (STUDENT sur route SUPERVISOR et inversement), id forgé (`submissionId`,
  `messageId`, `canevasId` inexistants), tiers non affecté (étudiant B lisant la
  soumission de l'étudiant A, directeur B validant la soumission du directeur A) —
  systématiquement 403/404, jamais un accès ou une action non autorisée.
- Rôle `admin` : présent uniquement dans le type système (`UserRole`), aucune route ni
  capability ne l'utilise aujourd'hui — pas de surface d'attaque réelle à ce jour pour
  ce rôle, donc rien à corriger ni à masquer.

## Journal d'audit (traçabilité de sécurité)

Avant ce sprint : `USER_CREATED`, `LOGIN_FAILED`, `SUBMISSION_CREATED`,
`FEEDBACK_CREATED` seulement. Après ce sprint, ajout de :

- `ROLE_ASSIGNED` — quand un compte devient directeur (`become-supervisor`).
- `CORRECTION_UPDATED` — quand un directeur change le statut d'une correction.
- `ACCESS_DENIED` — génériquement, à chaque 403 renvoyé par le helper `forbidden()` du
  périmètre supervision, avec l'acteur, le type/id d'entité visée, et le motif refusé.

**Vérifié réellement** (pas seulement câblé) : après la matrice d'autorisation de la
Partie 3, une requête directe dans la table `AuditLog` a confirmé la présence des
entrées `ACCESS_DENIED` correspondant exactement aux tentatives refusées, avec le bon
`actorId` et le bon motif en métadonnées.

**Gap restant, documenté et justifié** : `EXPORT_CREATED` n'est pas câblé. Les routes
`/api/export/pdf` et `/api/export/docx` sont stateless, ne dérivent aucune session
utilisateur, et ne lisent aucune donnée en base — elles se contentent de mettre en forme
un `DocumentModel` déjà construit côté client. Elles font partie du périmètre protégé
(DocumentBuilder/export). Y ajouter une authentification pour permettre la
journalisation serait une modification fonctionnelle d'une route protégée, non justifiée
par un bug de sécurité critique démontré (aucune donnée n'est exposée par l'absence
d'authentification ici — la route ne fait que reformater ce que l'appelant fournit déjà).

## Bug de concurrence corrigé (intégrité des données, pas une faille de confidentialité)

`SubmissionStore.createSubmission()` lisait la dernière version puis créait la nouvelle
soumission en deux opérations non atomiques. Sous charge concurrente réelle (5 requêtes
simultanées), plusieurs soumissions distinctes recevaient silencieusement le même numéro
de version — un risque d'intégrité des données (le directeur aurait pu voir un historique
de versions incohérent) plutôt qu'une fuite de données entre utilisateurs. Corrigé par
une contrainte unique en base (migration Prisma appliquée) et une relecture automatique
en cas de conflit. Re-testé avec succès après correction.

## Fuite de secrets

Aucun secret serveur (`OPENAI_API_KEY`, `SESSION_SECRET`, `DATABASE_URL`) n'est importé,
directement ou transitivement, par un composant marqué `"use client"` — vérifié par
recherche exhaustive des importeurs de chaque module concerné. Un seul usage de
`NEXT_PUBLIC_*` dans tout le code, non sensible (URL de l'application).

## Ce qui reste explicitement non couvert par ce sprint

- Base de données réelle en production (PostgreSQL non provisionné — voir
  `ACADIA_P18_POSTGRES_BLOCKER.md`) : tant que SQLite reste utilisé, il n'y a qu'un seul
  process serveur possible, ce qui limite déjà la surface de risque de concurrence
  multi-instance (contrairement à un déploiement PostgreSQL multi-instance, où la
  correction apportée ce sprint — contrainte unique en base — reste valide et
  nécessaire).
- Résilience « base de données indisponible » non testée par arrêt volontaire du process
  (risque jugé disproportionné pour ce tour de travail vu que le serveur de
  développement est partagé avec le reste de la session).
- Aucun test d'intrusion externe (scan de vulnérabilités, fuzzing) n'a été réalisé — hors
  périmètre de ce sprint.

## Conclusion sécurité

Les lacunes réellement identifiées par l'audit de ce sprint (rate limiting, journal
d'audit) sont fermées et vérifiées en conditions réelles. Un bug de concurrence réel a
été trouvé et corrigé avant de causer un incident en production. Aucune régression de
sécurité introduite (lint et build inchangés). Le principal risque restant n'est pas un
défaut de sécurité du code applicatif, mais l'absence de services d'infrastructure
externes réels (base de données managée, sauvegardes, monitoring) — documentée
honnêtement plutôt que masquée.
