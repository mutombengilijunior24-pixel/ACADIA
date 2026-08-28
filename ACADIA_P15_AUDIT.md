# ACADIA — Audit P15 (Scientific Research Assistant)

## 1. Moteurs audités et constat

- **`QuestionnaireGenerationEngine.ts` (protégé)** : `generateInstrumentFromProject()` ne
  gate que sur `project.variables.length === 0` ; ne connaît pas `project.level` ; produit
  déjà une vraie traçabilité `variableId`/`dimensionId`/`indicatorId` par question et
  distingue déjà quantitatif/qualitatif/mixte. Aucune modification apportée — extensions
  faites via de nouveaux fichiers adjacents (`QuestionnaireReadiness.ts`,
  `QuestionnaireTraceability.ts`).
- **`ResearchConsistencyEngine.ts` (non protégé, étendu par P13.2)** : déjà un vocabulaire
  PASS/WARNING/NEEDS_REVIEW/ERROR complet sur 12 checks. Réutilisé tel quel (lecture seule)
  par le nouveau `NotificationsCenter` (P14) — non modifié dans ce sprint.
- **`MethodologyRecommendationEngine.ts` (non protégé)** : ne connaissait pas `project.level`
  — Licence et Master recevaient exactement la même recommandation. Aucune justification
  affichée pour les sections `needs_review` (population, échantillonnage, sources de
  données) au-delà du statut brut. **Étendu** dans ce sprint (voir §2).
- **`ResearchTypes.ts` (contrat central, traité comme quasi protégé depuis P13.2)** : non
  modifié. `ResearchHypothesis` a déjà `variableIds` mais pas de lien direct vers une
  dimension — la liaison hypothèse secondaire ↔ dimension existe déjà de façon déterministe
  via l'id `hypothesis-secondary-${dimension.id}` (`HypothesisProposalEngine`, P13.2),
  réutilisée sans modification.
- **`HypothesisProposalEngine.ts` (P13.2, non protégé)** : couvre déjà la recommandation du
  nombre de secondaires + leur proposition à partir des dimensions réelles. Le vrai vide
  trouvé : aucun moyen de modifier le texte d'une hypothèse, ni d'en ajouter une écrite par
  le chercheur lui-même (seulement accepter/rejeter une proposition d'ACADIA).
- **`ResearchWizard/StepPopulationSize.tsx`** : le choix « population connue / non connue »
  existe déjà (bouton « Non connue »). Rien à reconstruire — le vide était uniquement dans
  la méthodologie (aucune justification textuelle du pourquoi aucune taille n'est proposée).
- **`ResearchChainView.tsx`** : couvre déjà Question → Objectifs → Variables → Hypothèses +
  Relations. Ne couvre pas Cadre théorique / Indicateurs / Questionnaire / Méthodologie sous
  la forme compacte ✓/⚠/○ demandée par ce sprint — non dupliqué, complété par un nouveau
  composant dédié (`ScientificChainStrip.tsx`).
- **Modèles de variables/indicateurs** (`ResearchVariable`, `ResearchDimension`,
  `ResearchIndicator`) : déjà un champ réel `measurementType` (P13.2) jamais exposé au
  chercheur dans l'explication d'une question — corrigé (§3).
- **Rôle/Plan/Paiement** : `lib/core/entitlements/` (P14) n'avait qu'un seul plan (`free`).
  Aucun scaffolding de rôle superviseur/feedback n'existait avant ce sprint.

## 2. Bug réel trouvé pendant les tests (hors périmètre strict de l'audit initial, mais
   directement lié à la « prochaine étape honnête » visée par ce sprint)

`app/dashboard/research/[id]/page.tsx` contenait un bandeau d'en-tête et 4 cartes
(« Méthodologie / Questionnaire / Collecte / Analyse ») **entièrement statiques** :
`research.progress ?? 20` (le champ `progress` est figé à 0 depuis sa création, jamais
recalculé — voir P14), « Méthodologie : Terminée » toujours affiché même non validée,
« Questionnaire : Pas encore créé » même après génération, bouton « Générer mon
questionnaire » redirigeant vers une route inexistante (`/dashboard/research/[id]/
questionnaire`, jamais créée), 3 autres boutons sans action câblée. Corrigé (§3).

## 3. Architecture retenue pour ce sprint

1. `lib/core/questionnaire/QuestionnaireReadiness.ts` (nouveau) : calcule si le minimum
   d'informations est réuni avant de permettre la génération, et construit le résumé
   pré-génération (sujet/problématique/objectifs/hypothèses/variables/indicateurs/
   population/niveau/cadre théorique).
2. `lib/core/questionnaire/QuestionnaireTraceability.ts` (nouveau) : reconstruit, pour une
   question donnée, la chaîne réelle mesure → indicateur → dimension → variable →
   hypothèse — jamais une relation inventée (retourne `undefined` si non résolvable).
3. `QuestionnaireOverview.tsx` : résumé pré-génération + gating réel, panneau
   « Pourquoi cette question ? » repliable, nouveau type `conditional` (+ champ texte libre
   de condition d'affichage).
4. `MethodologyRecommendationEngine.ts` : `levelGuidance` dérivé de `project.level`
   (Licence/Master, jamais l'un présenté comme meilleur que l'autre), analyse
   économétrique proposée par défaut uniquement à partir de Master (Licence : analyse
   bivariée approfondie, modélisation optionnelle), justifications textuelles ajoutées pour
   population/échantillonnage/sources de données non renseignées.
5. `MethodologyOverview.tsx` : badge de niveau, note de niveau, boutons « Pourquoi ? »
   repliables sur les sections concernées.
6. `ScientificChainStrip.tsx` (nouveau) : vue compacte ✓/⚠/○ des 8 maillons de la chaîne
   scientifique, dérivée de données déjà réelles.
7. `HypothesisStructureSection.tsx` : ajout de l'édition du texte d'une hypothèse (principale
   et secondaires) et de l'ajout d'une hypothèse secondaire rédigée librement par le
   chercheur — `updateHypothesisStatement` ajouté à `ResearchContext.tsx` sur le même
   patron que `updateHypothesisStatus`.
8. `TheoreticalFrameworkTypes.ts` / `TheoreticalFrameworkSection.tsx` : lien optionnel
   `variableId` vers une variable déjà opérationnalisée, choisi explicitement par le
   chercheur — jamais déduit.
9. `lib/core/entitlements/EntitlementTypes.ts` : ajout des plans conceptuels `premium` et
   `supervisor` (`monthlyPriceUsd: null`, `conceptual: true`) — aucun compte réel n'y est
   assigné, `DEFAULT_PLAN_ID` reste `free`.
10. `lib/core/supervision/SupervisionTypes.ts` (nouveau) : scaffolding de types uniquement
    (`SupervisorFeedback`), aucune UI, aucun câblage — conforme à la consigne explicite du
    sprint de ne pas construire cette couche maintenant.
11. `app/dashboard/research/[id]/page.tsx` : remplacement du bandeau/cartes fabriqués par
    des données réelles (`ResearchProgressEngine`, statut réel de la méthodologie/instrument/
    dataset), et remplacement des boutons morts/mal dirigés par un défilement réel vers la
    section correspondante déjà existante sur la page (ancres `methodology-section`,
    `questionnaire-section`, `analysis-section`).

**Aucun moteur protégé modifié** (`QuestionnaireGenerationEngine`, `ResearchCore`,
`ResearchData`, `DatasetEngine`, `DescriptiveAnalysisEngine`, `BivariateAnalysisEngine`,
`EconometricModelEngine`, `EconomicInterpretationEngine`, `ScientificDiscussionEngine`,
`ScientificWorkEngine`, `ScientificWorkValidationEngine`, `DocumentBuilder`).

## 4. Limites assumées (documentées plutôt qu'inventées)

- Le texte des questions conditionnelles reste une note libre (« Si Q5 = Oui ») plutôt
  qu'un moteur d'affichage conditionnel exécuté en temps réel — aucun runtime de collecte en
  ligne avec logique de branchement n'existe encore dans ACADIA.
- Contextualisation RDC/Lubumbashi non étendue au-delà de l'existant (`StepPopulation.tsx`)
  — aucune donnée locale nouvelle n'a été ajoutée, pour ne pas inventer de statistique.
- Le rôle superviseur reste un type de données sans UI, comme explicitement demandé.
