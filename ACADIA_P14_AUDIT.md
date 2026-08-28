# ACADIA — Audit P14 (Product Core)

## 0. Contexte de cet audit

P14 fusionne P13.3 et P14 et couvre 24 parties (A→X). La spécification complète a été
collée par le chercheur au tout début de ce sprint ; une coupure de connexion est survenue
immédiatement après et le contenu détaillé de chaque partie n'est plus disponible mot pour
mot au moment d'écrire ce document — seul un résumé fidèle de l'intention de chaque partie
a survécu. Conformément à la règle scientifique du projet (« ne jamais inventer »), cet audit
ne reconstruit pas de mémoire des points dont l'intention n'est pas claire : il documente ce
qui est vérifiable dans le code existant, et le sprint se concentre sur les points dont
l'intention est certaine et vérifiable ici. Toute partie non couverte est listée honnêtement
en fin de rapport plutôt que déclarée traitée par erreur.

## 1. Ce qui existe déjà et n'a pas besoin d'être recréé (moteurs protégés + non protégés)

- `QuestionnaireGenerationEngine` + `QuestionnaireOverview.tsx` (846 lignes) : déjà une
  vraie traçabilité variable→dimension→indicateur→question (`variableId`/`dimensionId`/
  `indicatorId` sur chaque question, `analyzeInstrument()` pour la couverture). Pas de
  recréation nécessaire.
- `MethodologyOverview.tsx` : déjà étendu à 14 sections par P13.2, y compris la population
  (avec avertissement honnête si non renseignée).
- `StepPopulationSize.tsx` : le choix « population connue / non connue » **existe déjà**
  (bouton « Non connue » → `populationSize = 0`, `SampleSizeCalculator` bascule alors sur la
  formule population indéterminée ≈384). Rien à ajouter ici.
- `HypothesisStructureSection.tsx` + `HypothesisProposalEngine.ts` (P13.2) : structure
  principale/secondaires déjà conforme (1 principale + 2 ou 3 secondaires dérivées des
  dimensions réelles, jamais imposées).
- `ResearchConsistencyEngine.computeResearchIntegrityReadiness()` : déjà un score 0-100
  bandé, réel, dérivé de la chaîne scientifique complète.
- `buildMethodologyRecommendation().readinessPercent` : déjà un pourcentage réel de
  préparation méthodologique.

**Conclusion : aucun de ces moteurs n'est recréé dans ce sprint.**

## 2. Ce qui est fabriqué et doit être corrigé (constat central du sprint)

Tous les widgets du dashboard listés comme non faits dans `ACADIA_P13_PRODUCT_ARCHITECTURE.md`
sont encore montés tels quels dans `app/dashboard/page.tsx` et **100 % fabriqués** :

| Widget | Fabrication constatée |
|---|---|
| `CreditsCenter.tsx` | « 78 crédits restants », « Renouvellement le 15 août 2026 », plan « Premium » actif — aucun de ces éléments n'existe dans un compte réel. |
| `RecentActivity.tsx` | 4 activités codées en dur (« 24 nouvelles références APA », « Mémoire exporté hier ») — jamais lues depuis `ResearchContext`. |
| `ProgressChart.tsx` | Série hebdomadaire inventée (18→88), « 187 générations », « 82 % — Chapitre III en cours » — aucune donnée réelle. |
| `ProgressGoals.tsx` | Liste d'étapes fixe (« Chapitre I/II/III », « Analyse SPSS ») avec `done` codé en dur, 82 % fixe, ignore totalement le projet réel de l'utilisateur. |
| `NotificationsCenter.tsx` | 4 notifications fictives dont une alerte d'abonnement Premium qui n'existe pas. |
| `AcademicCalendar.tsx` | 4 événements avec dates fixes (« 12 AOÛT — Rencontre avec le directeur ») qui ne correspondent à rien. |
| `QuickActions.tsx` | Boutons sans `onClick` — décoratifs uniquement. |

Ceci est la violation la plus visible et la plus grave de la règle scientifique du projet
(« ne jamais inventer ») transposée au produit : un chercheur ouvrant son tableau de bord
voit littéralement des faits inventés sur son propre travail. C'est la priorité réelle de ce
sprint, au même titre que le modèle crédits IA → Entitlements explicitement demandé.

## 3. Modèle de rôles / plans / paiement

Recherche exhaustive : **aucun concept de `Role`, `Plan`, `Entitlement` ou `Payment`
n'existe nulle part dans le code** (`lib/auth/AuthTypes.ts` ne contient que
`StoredUser`/`PublicUser`/session — pas de rôle). `PaymentBadge.tsx` (landing) est un badge
purement décoratif. Terrain vierge — architecture à créer de zéro, sans paiement réel ni
prix inventé, conformément à la consigne.

## 4. Architecture retenue pour ce sprint

1. **Dashboard honnête** : remplacer les 7 widgets fabriqués par des versions lisant
   `ResearchContext` (recherches, instruments, datasets, exports, cadre théorique,
   hypothèses, cohérence) et `AuthContext`. Quand une donnée n'existe pas encore, état vide
   explicite — jamais un nombre de substitution.
2. **Progression réelle** : un seul nouveau module de dérivation (non protégé, nouveau),
   `lib/core/dashboard/ResearchProgressEngine.ts`, qui **réutilise** les readiness déjà
   calculées par les moteurs existants (`computeResearchIntegrityReadiness`,
   `buildMethodologyRecommendation().readinessPercent`, présence d'un instrument généré,
   présence d'un `ScientificWork`) pour dériver une étape « Prochaine étape » réelle — jamais
   une nouvelle logique de notation scientifique.
3. **Fondation Entitlements** (nouveau, isolé) : `lib/core/entitlements/EntitlementTypes.ts`
   + `EntitlementEngine.ts` — `Role` (`student` par défaut, `supervisor` en scaffolding
   données uniquement), `PlanId` (`"free"` seul plan réellement actif), `FeatureId` (les
   fonctionnalités déjà réelles du produit), `hasFeatureAccess()`. Remplace le vocabulaire
   « crédits IA » par « fonctionnalités disponibles dans votre plan », sans prix ni paiement
   réel — un seul plan actif (`free`, tout débloqué) tant qu'aucune tarification n'existe
   réellement.
4. **Bloc « Comprendre ACADIA »** : section pédagogique permanente sur le dashboard,
   expliquant honnêtement ce qu'ACADIA fait et ne fait pas (déterministe vs IA, jamais de
   note scientifique).
5. **Rôle superviseur** : scaffolding de types uniquement (`Role`, champ optionnel sur
   `StoredUser`), aucune UI de feedback — non demandé de façon assez précise dans le résumé
   disponible pour construire une UI sans risquer d'inventer un flux non spécifié.

## 5. Ce qui n'est PAS traité dans ce sprint (limite assumée et documentée, par honnêteté)

Le texte exact des 24 parties (A→X) n'étant plus disponible mot pour mot après la coupure de
connexion, les points suivants — mentionnés dans le résumé mais dont le détail d'implémentation
n'est pas assez précis pour être construit sans risquer d'inventer un comportement non
demandé — ne sont **pas** construits dans ce sprint et sont listés ici plutôt que déclarés
faits par erreur :

- Visualisation graphique dédiée de la « chaîne du parcours scientifique » (au-delà des
  sections déjà réelles de Research Health / Consistency) — un résumé texte réel est ajouté
  au dashboard à la place, sans nouvelle représentation graphique inventée.
- Contextualisation RDC/Lubumbashi au-delà de ce qui existe déjà (exemples de population dans
  `StepPopulation.tsx`) — aucune donnée locale nouvelle n'est ajoutée, pour ne pas inventer de
  statistique.
- Intégration Mobile Money / `PaymentProvider` réel — seule l'architecture de données
  (`Entitlements`) est posée ; aucun flux de paiement, simulé ou réel, n'est construit.
- UI de feedback superviseur/professeur — seul le champ de rôle est posé en base.

Si le chercheur souhaite préciser à nouveau le contenu exact de l'une de ces parties, elle
pourra être traitée dans un sprint dédié plutôt que reconstruite de mémoire ici.
