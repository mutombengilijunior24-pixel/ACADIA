# ACADIA — Rapport de tests P14 (Product Core)

## 0. Avertissement sur le périmètre réel de ce sprint

Une coupure de connexion est survenue juste après que le chercheur a collé la spécification
complète de P14 (24 parties, A→X, fusionnant P13.3 et P14). Le texte exact de chaque partie
n'a pas survécu mot pour mot à la reprise — voir `ACADIA_P14_AUDIT.md` §0 pour le détail. Ce
sprint traite donc, avec certitude et sans invention, le constat le plus grave et le plus
vérifiable de l'audit (le dashboard entièrement fabriqué) plus les fondations citées sans
ambiguïté dans le résumé disponible (entitlements, progression réelle, éducation permanente,
scaffolding de rôle). Les parties dont le détail précis n'était plus disponible sont listées
honnêtement comme non traitées plutôt que déclarées faites par erreur (§7 de ce rapport).

## 1. Audit initial

Voir `ACADIA_P14_AUDIT.md`. Constat central : les 7 widgets du dashboard laissés « à faire »
par `ACADIA_P13_PRODUCT_ARCHITECTURE.md` étaient encore montés tels quels et **entièrement
fabriqués** (crédits IA inventés, activités inventées, calendrier inventé, notifications
inventées, progression inventée). Un 8e problème, non répertorié jusqu'ici, a été découvert
pendant les tests de ce sprint : `StatsCard.tsx` affichait un « +12 % cette semaine » et un
statut « Actif » statiques sur les 4 cartes de statistiques réelles, et le widget « Assistant
IA » du dashboard (`AssistantWidget` + 4 sous-composants) affichait un chat non fonctionnel
prétendant savoir « analyser vos données SPSS » — une capacité déjà retirée du marketing en
P13 mais oubliée ici.

## 2. Architecture retenue

- `lib/core/entitlements/{EntitlementTypes.ts, EntitlementEngine.ts}` (nouveau, isolé) :
  remplace le vocabulaire « crédits IA » par `User → Role → Plan → Entitlements →
  FeatureAccess`. Un seul plan réel (`free`), aucun prix, aucun paiement.
- `lib/core/dashboard/ResearchProgressEngine.ts` (nouveau, isolé) : dérive une progression
  réelle (0-100 %, liste d'étapes réelles, « prochaine étape » réelle) à partir de données
  déjà présentes dans `ResearchProject` — ne recalcule jamais de science, ne duplique aucun
  moteur protégé.
- `lib/auth/AuthTypes.ts` : ajout d'un champ optionnel `role?: UserRole` sur `StoredUser`
  (scaffolding de données uniquement, aucune UI, aucun comportement n'en dépend encore).

**Aucun moteur protégé modifié.** `ResearchConsistencyEngine.checkResearchConsistency` est
réutilisé tel quel (lecture seule) par le nouveau `NotificationsCenter`.

## 3. Fichiers créés

- `lib/core/entitlements/EntitlementTypes.ts`, `lib/core/entitlements/EntitlementEngine.ts`
- `lib/core/dashboard/ResearchProgressEngine.ts`
- `components/dashboard/UnderstandAcadia.tsx`
- `ACADIA_P14_AUDIT.md`, `ACADIA_P14_TEST_REPORT.md`

## 4. Fichiers réécrits (fabrication → donnée réelle)

- `components/dashboard/CreditsCenter.tsx` — crédits/abonnement inventés → plan réel +
  fonctionnalités réellement incluses (`EntitlementEngine`).
- `components/dashboard/RecentActivity.tsx` — activités inventées → recherches réelles +
  export réels, triés par date réelle, état vide honnête si aucune activité.
- `components/dashboard/ProgressChart.tsx` — série hebdomadaire inventée → barres de
  préparation réelle par recherche (`ResearchProgressEngine`) + moyenne réelle.
- `components/dashboard/ProgressGoals.tsx` — étapes fixes inventées → checklist réelle de la
  recherche la plus récemment modifiée, « Prochaine étape » réelle et cliquable.
- `components/dashboard/NotificationsCenter.tsx` — notifications inventées → « Points
  d'attention » réels (checks `warning`/`needs_review`/`error` de
  `checkResearchConsistency`, par recherche réelle).
- `components/dashboard/AcademicCalendar.tsx` — calendrier académique inventé (aucune
  fonctionnalité de calendrier n'existe) → « Dernières mises à jour », dates réelles des
  recherches du chercheur.
- `components/dashboard/QuickActions.tsx` — 6 boutons décoratifs sans `onClick` → 4 actions
  réelles vers des routes existantes (`/dashboard/research/new`, `/dashboard/research`,
  `/dashboard/projects`, `/dashboard/settings`).
- `components/dashboard/StatsCard.tsx` — retrait du bandeau « +12 % cette semaine / Dernière
  mise à jour : Aujourd'hui / Statut : Actif », qui s'affichait identique quel que soit
  l'état réel du compte.
- `components/assistant/AssistantWidget.tsx` — chat non fonctionnel prétendant analyser des
  données SPSS et préparer la soutenance par message → état honnête expliquant qu'aucun chat
  libre n'existe encore et renvoyant vers l'assistant de structuration réel. Les 4
  sous-composants désormais inutilisés (`AssistantHeader.tsx`, `QuickPrompts.tsx`,
  `Conversation.tsx`, `ChatInput.tsx`, `MessageBubble.tsx`) ont été supprimés plutôt que
  laissés comme code mort trompeur.
- `app/dashboard/page.tsx` — montage de `UnderstandAcadia`.

## 5. Bloc « Comprendre ACADIA »

Section pédagogique permanente ajoutée en haut du dashboard : ce qu'ACADIA génère, ce qu'il
ne fait jamais (inventer population/théorie/référence/résultat/note), et le rôle du
chercheur (valider ≠ garantie scientifique). Toujours visible, jamais un blocage.

## 6. Fondation monétisation

Recherche exhaustive confirmée : aucun concept de rôle/plan/paiement n'existait avant ce
sprint. `EntitlementTypes.ts` définit un catalogue de 6 fonctionnalités réelles et un seul
plan (`free`, `monthlyPriceUsd: null`, tout inclus) — poser l'architecture sans inventer de
tarification tant qu'aucune tarification réelle n'existe.

## 7. Ce qui n'est PAS traité dans ce sprint (limite assumée, documentée dans l'audit)

- Visualisation graphique dédiée de la chaîne du parcours scientifique au-delà de
  l'existant (`ResearchChainView.tsx`, déjà réel et non dupliqué ici).
- Contextualisation RDC/Lubumbashi au-delà de l'existant (`StepPopulation.tsx`).
- Intégration Mobile Money / `PaymentProvider` réel ou simulé.
- UI de feedback superviseur/professeur (seul le champ de rôle est posé en base).
- Le contenu exact des parties dont le texte précis n'a pas survécu à la coupure de
  connexion (voir `ACADIA_P14_AUDIT.md` §0 et §5).

## 8. Tests

**Standalone** : `npx tsc --noEmit` propre après chaque bloc de modification.

**Navigateur (Edge headless réel, CDP, 1440px)** : compte réel créé via `/register`,
`/api/auth/me` interrogé pour obtenir l'id réel, fixtures 5 sujets (`all_researches5.json`/
`all_projects5.json`) injectées dans `localStorage` scopé par cet id réel (mécanisme P13
inchangé), dashboard rechargé. Vérifié à l'écran et dans le texte de page :
- Zéro occurrence de « SPSS », « crédit(s) » (hors la phrase honnête qui l'exclut
  explicitement), « +12 % », « Actif » statique, dates de calendrier inventées.
- `RecentActivity` affiche les 5 vraies recherches avec leurs vrais titres et un horodatage
  relatif réel.
- `ProgressChart` affiche 5 barres réelles + une moyenne réelle (45 % sur ce jeu de fixtures).
- `ProgressGoals` affiche la checklist réelle de la recherche la plus récente (38 % sur le
  sujet PME gouvernance) avec une « Prochaine étape » réelle et cliquable vers la bonne
  recherche.
- `NotificationsCenter` affiche 6 « Points d'attention » réels, chacun rattaché à la bonne
  recherche et à la bonne raison exacte (ex. « Cadre théorique à préciser par le chercheur »,
  « Des variables sont identifiées mais aucun instrument de mesure n'est encore déclaré »).
- `CreditsCenter` affiche le plan réel (`ACADIA Gratuit`) et les 6 fonctionnalités réelles,
  toutes marquées incluses.
- `AcademicCalendar` affiche les 4 recherches les plus récentes avec leurs vraies dates de
  mise à jour.
- `QuickActions` : les 4 liens pointent vers des routes réelles existantes.
- Nouveau compte (0 recherche) : toutes les sections passent correctement à leur état vide
  honnête (« Aucune activité... », « Aucune recherche structurée... », etc.) — vérifié sur
  un deuxième compte fraîchement créé, sans injection de fixtures.

**Responsive (390px, Edge headless réel)** : `scrollWidth === innerWidth` sur le dashboard
avec l'ensemble des nouveaux widgets — aucun débordement introduit. Capture visuelle
inspectée : pas de chevauchement, `StatsCard` plus compact après retrait du bandeau fabriqué.

## 9. Build / Lint

`npm run build` : propre, 36 routes générées, aucune erreur. `npm run lint` : 56 problèmes,
tous préexistants et vérifiés absents de tout fichier créé ou modifié dans ce sprint (aucun
nouveau problème introduit — la baisse de 61 à 56 vient de la suppression des 5 fichiers
`components/assistant/*` désormais inutiles, qui portaient une partie des anciens
avertissements).

## 10. Nettoyage

`data/users.json` et `data/password-reset-tokens.json` réinitialisés à `[]` après les tests
(7 comptes de test accumulés pendant les essais successifs).

**P14 — Product Core terminé.
P15 non commencé.**
