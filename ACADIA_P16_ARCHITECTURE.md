# ACADIA — Architecture P16 (Supervision académique)

## 1. Principe directeur

ACADIA reste un assistant. Toute sortie générée par ACADIA dans le contexte de supervision
(brief, comparaison de versions) est explicitement labellisée « Analyse préparatoire ACADIA —
validation du directeur requise. » et n'affirme jamais une correction faite avec certitude
(« potentiellement résolu », jamais « résolu »).

## 2. Stockage — pourquoi un nouveau store serveur

Le localStorage (P1-P15) reste la source de vérité du TRAVAIL en cours de l'étudiant — non
modifié. Mais un directeur et un étudiant sont deux navigateurs/comptes différents : pour
qu'une donnée traverse ce mur, elle doit passer par le serveur. Neuf nouveaux fichiers JSON
sous `data/` (même discipline que `data/users.json`, gitignorés, pas de vraie base de données
concurrente — limite assumée et documentée, pas cachée) :

```
data/supervisor-profiles.json
data/canevas.json
data/invitations.json
data/assignments.json
data/submissions.json      (contient le snapshot JSON du projet au moment de la soumission)
data/messages.json
data/feedback.json
data/corrections.json
data/notifications.json
data/email-log.json
```

Un helper unique `lib/supervision/jsonStore.ts` factorise la lecture/écriture (repris du
patron déjà établi par `UserStore.ts`, pas dupliqué dix fois).

## 3. Snapshot de soumission — le "document"

Il n'existe aucun stockage de fichier réel (confirmé par l'audit). `DocumentStorageProvider`
(Partie 20 du sprint) est donc implémenté avec un seul stockage réellement disponible :
le JSON de la soumission lui-même, dans `data/submissions.json`. Un `Submission` contient
`snapshot: { project: ResearchProject; instrument?: InstrumentRecord; theoreticalFramework:
TheoreticalFrameworkEntry[] }` — exactement l'objet que le client envoie déjà (même logique que
les routes d'export P12, stateless, qui reçoivent un `DocumentModel` déjà construit). Aucune
prétention de stockage cloud.

## 4. Modèle de données (nouveau, `lib/core/supervision/SupervisionTypes.ts`)

- `SupervisorProfile` — profil académique (institution, faculté, département, titre...).
- `SupervisionCanevas` — étapes + règles, versionné par `academicYear` (plusieurs canevas actifs
  possibles par directeur, un seul `isActive` par année).
- `SupervisorInvitation` — code à usage unique, expiration, statut.
- `SupervisionAssignment` — lien étudiant↔directeur (+ `researchId` optionnel).
- `Submission` — version d'un travail, `previousSubmissionId` chaîné (jamais écrasé).
- `InboxMessage` — messagerie académique structurée (pas un chat libre).
- `FeedbackEntry` — évaluation globale + par section, statuts OK/à corriger/bloquant.
- `Correction` — suivi individuel, avec fil de discussion court attaché.
- `SupervisorBrief` — généré par un moteur déterministe (voir §6), jamais une validation.
- `RevisionComparison` — diff déterministe entre deux snapshots.
- `Notification` — événements réels uniquement.
- `EmailLogEntry` — trace honnête de chaque tentative d'envoi (`sent`/`failed`/`not_configured`).

## 5. Rôles

`UserRole` (`lib/auth/AuthTypes.ts`) devient `"student" | "supervisor" | "admin"` — `"admin"`
est une fondation de type uniquement (aucune UI admin construite, conforme à la consigne).
`EntitlementTypes.ts`'s `Role` est désormais un alias direct de `UserRole` (suppression du
doublon conceptuel constaté à l'audit — pas de nouvelle divergence). Un compte reste `student`
par défaut ; devenir superviseur est une auto-déclaration explicite (aucun système de
vérification institutionnelle n'existe — documenté honnêtement, pas simulé) via
`POST /api/auth/become-supervisor`, qui fixe `role="supervisor"` et crée un `SupervisorProfile`
vide à compléter.

## 6. Moteurs déterministes ajoutés (non protégés, nouveaux)

- `SupervisorBriefEngine.ts` — réutilise `checkResearchConsistency` +
  `computeResearchProgress` (aucune science recalculée) pour produire un brief : état général,
  points forts (checks PASS), incohérences (WARNING/NEEDS_REVIEW/ERROR), sections incomplètes,
  progression. Toujours suffixé de la mention de validation humaine requise.
- `RevisionComparisonEngine.ts` — diff champ à champ entre deux snapshots
  (problématique/objectifs/hypothèses/variables/dimensions/indicateurs/nombre de questions) →
  `added/removed/modified/unchanged`, puis croise les corrections `open` de la version
  précédente avec les sections modifiées pour proposer `unresolved` vs « potentiellement
  résolu » (jamais affirmé).
- `CanevasComplianceEngine.ts` — compare une règle explicite du canevas (ex. nombre
  d'hypothèses secondaires attendu) au projet réel soumis — jamais une règle universelle
  câblée en dur (Partie 25).

## 7. API (`app/api/supervision/**`, toutes `runtime = "nodejs"`)

Chaque route dérive l'utilisateur depuis `verifySessionToken` (jamais un id envoyé par le
client) puis vérifie l'autorisation via les stores (`Assignment`/`Submission` appartient bien à
ce `userId`) avant toute lecture/écriture. Aucune route ne fait confiance à un
`studentId`/`supervisorId` du corps de requête pour l'autorisation.

## 8. Client (`contexts/SupervisionContext.tsx`)

Nouveau contexte, monté dans `app/dashboard/layout.tsx` aux côtés de `ResearchProvider`/
`ProjectProvider` — wrappe les appels aux routes ci-dessus (pas de localStorage ici, tout passe
par le serveur puisque c'est justement la donnée cross-utilisateur).

## 9. Pages / composants

- `/dashboard/supervisor` — dashboard directeur (état vide honnête).
- `/dashboard/supervisor/canevas` — éditeur de canevas.
- `/dashboard/supervisor/review/[submissionId]` — page d'examen.
- `/invite/[code]` — acceptation d'invitation (redirige vers login/register si nécessaire, code
  préservé via `?next=`).
- `components/dashboard/MyEncadrement.tsx` — section « Mon encadrement » sur le dashboard
  étudiant.
- `components/supervision/*` — inbox, formulaire de feedback, vue de soumission en lecture
  seule (`SubmissionSnapshotView`), qui **ne réutilise pas** les composants d'édition existants
  (`QuestionnaireOverview`, `MethodologyOverview`) pour la vue directeur — ces composants
  appellent `useResearch()` (contexte local du navigateur courant), inadapté à l'affichage d'un
  snapshot appartenant à un autre compte. Seul `ScientificChainStrip` (déjà 100% piloté par
  props, sans hook interne) est réellement réutilisé tel quel.

## 10. Sécurité / confidentialité

`proxy.ts` étendu : `/dashboard/supervisor/**` vérifie en plus que `role === "supervisor"`
(lecture directe du store utilisateur, runtime Node) — un étudiant y accédant est redirigé vers
`/dashboard`. Toutes les routes API de supervision revalident l'autorisation indépendamment du
proxy (défense en profondeur).

## 11. Email

`lib/email/EmailProvider.ts` — interface + implémentation unique `NoOpEmailProvider` (aucun
fournisseur n'est configuré, voir audit §8-9) : chaque tentative est journalisée
(`EmailLogEntry`) avec `status: "not_configured"`, jamais présentée comme un envoi réussi.
Variables d'environnement déclarées dans `.env.example` (non renseignées). Voir
`ACADIA_P16_EMAIL_ARCHITECTURE.md`.

## 12. Ce qui n'est PAS construit (limite assumée)

- Vraie base de données / stockage cloud de documents.
- Vérification institutionnelle de l'identité d'un directeur.
- UI d'administration pour le rôle `admin`.
- Envoi d'email réel (aucun fournisseur configuré).
- Système de paiement (entitlements restent conceptuels, comme en P14/P15).
