# ACADIA — Audit P16 (Supervision académique)

## 1. Authentification / rôles

- `lib/auth/{AuthTypes.ts, UserStore.ts, passwords.ts, session.ts}` (P13) : store fichier JSON
  (`data/users.json`), bcrypt, session HMAC signée en cookie HttpOnly. `StoredUser` a déjà un
  champ optionnel `role?: UserRole` (`"student" | "supervisor"`, ajouté en P14, jamais câblé
  nulle part). **Aucune valeur `"admin"` n'existe.** Aucune route ne permet de devenir
  superviseur. Aucun profil académique (institution/faculté/titre...) n'existe.
- `contexts/AuthContext.tsx` : expose `user` (PublicUser), `login/register/logout/refresh`.
  Rien lié au rôle.
- `proxy.ts` : protège `/dashboard/**` par simple présence de session — aucune vérification de
  rôle par route.

## 2. ResearchContext / ResearchProject

- **Toutes les données de recherche vivent en `localStorage`, scopées par utilisateur**
  (`scopedStorageKey(base, userId)`, P13). C'est la contrainte architecturale centrale de P16 :
  **aucune donnée de recherche n'est accessible depuis un autre compte/navigateur.** Un
  directeur ne peut donc jamais lire directement le `ResearchProject` d'un étudiant tant que
  l'étudiant ne l'a pas explicitement transmis via une action serveur (soumission).
- `ResearchProject` (contrat central, `lib/core/research/ResearchTypes.ts`) : structure complète
  déjà stable depuis P1-P15 (problem, objectives, variables, hypotheses, methodology...).
  Sérialisable en JSON directement (les seules dates vivent dans `Research`, pas dans
  `ResearchProject` lui-même — vérifié).
- `InstrumentRecord` (`{questionnaire?, interviewGuide?, status}`) et `TheoreticalFrameworkEntry[]`
  vivent aussi en localStorage, séparément du projet.

## 3. Annotations (P9/P10), ScientificWork (P11), Export (P12)

- `AnnotationRecord` (`status, editedContent?, datasetVersionAtEdit?, updatedAt`) : mécanisme
  générique déjà utilisé pour marquer un contenu comme édité par le chercheur. Pas de concept de
  "commentaire d'un tiers" — c'est un espace mono-utilisateur.
  `buildScientificWork()`/`validateScientificWork()`/`computeScientificWorkReadiness()` : moteurs
  déterministes réels, réutilisables en lecture seule pour un "brief" superviseur, jamais
  appelés depuis un contexte multi-utilisateur avant P16.
- P12 (export) : les routes `/api/export/docx|pdf` sont **stateless** — le serveur ne stocke
  jamais de document. Confirmation : **aucun système de stockage de fichier/document n'existe
  côté serveur.** `ExportHistoryEntry` n'est qu'un journal client (localStorage) de métadonnées.

## 4. Entitlements (P14/P15)

`lib/core/entitlements/EntitlementTypes.ts` : `Role = "student" | "supervisor"` (doublon
conceptuel avec `UserRole` de `AuthTypes.ts` — jamais unifié). `PlanId` inclut déjà `free`,
`premium` (conceptuel), `supervisor` (conceptuel). Un seul `hasFeatureAccess(featureId, planId)`
existe ; aucune notion de capacité par rôle (`canInviteStudent` etc.) n'existe encore.

## 5. Scaffold SupervisorFeedback (P15)

`lib/core/supervision/SupervisionTypes.ts` contenait uniquement `SupervisorFeedback` (types
seuls, jamais câblés, comme explicitement demandé en P15). **Ce fichier est réutilisé et
largement étendu dans P16** — pas de second fichier créé pour la même responsabilité.

## 6. Routes API existantes

`app/api/{auth/*, ai/*, export/*, questionnaire/*, understanding}` — toutes stateless ou
mono-utilisateur. Aucune route ne vérifie de relation entre deux comptes. Aucun répertoire
`app/api/supervision/` n'existe.

## 7. Dashboard / composants

`components/dashboard/*` (P14) : tous réécrits en P14 pour être honnêtes (données réelles ou
état vide), mais 100% orientés étudiant (recherches, progression, plan). Aucune notion de
directeur. `NotificationsCenter.tsx` (P14) dérive des "points d'attention" depuis
`checkResearchConsistency` — ce n'est **pas** un système de notifications d'événements
(soumission reçue, feedback envoyé...), qui n'existe pas encore.

## 8. Système de notification / email

**Recherche exhaustive confirmée : aucun système de notification événementiel, aucune
infrastructure email (aucun `nodemailer`/`resend`/`sendgrid`, aucune fonction `sendEmail`)
n'existe nulle part dans le code.** `lib/auth/UserStore.ts` documente déjà explicitement cette
absence pour la réinitialisation de mot de passe (le jeton est retourné directement, jamais
« envoyé »). Terrain vierge pour l'abstraction `EmailProvider` demandée par ce sprint.

## 9. Configuration domaine/email

Aucune variable d'environnement liée à l'email n'existe dans `.env.example`
(`OPENAI_API_KEY`, `SESSION_SECRET` uniquement). Aucun domaine n'est configuré nulle part dans
le code ou la documentation.

## 10. Fichiers legacy non liés (confirmés inertes, non réutilisés ni supprimés)

`lib/core/workflow/WorkflowEngine.ts`, `lib/core/validation/ValidationEngine.ts` : classes
triviales d'un prototype très ancien, jamais importées ailleurs que par elles-mêmes / un
`AssistantStep` inutilisé. `lib/core/config/research.config.ts` : fichier vide. Non modifiés,
non dupliqués — hors périmètre de P16.

## 11. Décision architecturale centrale de P16

Puisque les données de recherche sont strictement locales au navigateur de l'étudiant, la
supervision multi-utilisateur **doit** passer par un vrai stockage serveur pour tout ce qui doit
être visible par deux comptes différents (soumissions, feedback, messages, invitations,
canevas, notifications). Solution retenue, cohérente avec le précédent déjà établi par
`lib/auth/UserStore.ts` : des stores fichier JSON supplémentaires sous `data/`, une même
discipline de lecture/écriture synchrone, la même limite assumée (pas de vraie base de données
concurrente — documentée, pas cachée). Le contenu scientifique d'une soumission est envoyé par
le client au serveur **au moment de soumettre** (même logique que les routes d'export P12 :
le serveur reçoit un JSON déjà construit, il ne recalcule jamais la science). Voir
`ACADIA_P16_ARCHITECTURE.md` pour le détail complet.

## 12. Moteurs protégés — non modifiés dans ce sprint

`ResearchCore`, `ResearchData`, `QuestionnaireGenerationEngine`, `DatasetEngine`,
`DescriptiveAnalysisEngine`, `BivariateAnalysisEngine`, `EconometricModelEngine`,
`EconomicInterpretationEngine`, `ScientificDiscussionEngine`, `ScientificWorkEngine`,
`ScientificWorkValidationEngine`, `DocumentBuilder`, `DocumentFormatter`, export DOCX/PDF —
tous réutilisés uniquement en **lecture seule** (import de fonctions pures), jamais modifiés.
