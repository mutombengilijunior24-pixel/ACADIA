# ACADIA — Audit P13.2 (avant développement)

Audit réalisé fichier par fichier avant tout code, conformément à l'Étape 0.
Réponses aux questions A-L du sprint.

## A-L. Où vit chaque élément de la chaîne scientifique

| Élément | Fichier / champ |
|---|---|
| Sujet | `ResearchProject.title` (`lib/core/research/ResearchTypes.ts:688`) |
| Problématique | `ResearchProject.problem?.statement` (:719-723) |
| Objectifs | `ResearchProject.objectives: ResearchObjective[]`, discriminant `role: "general"\|"specific"` (:138-179) |
| Variables | `ResearchProject.variables: ResearchVariable[]` (:286-340), avec `linkedObjectiveIds: string[]` — lien variable→objectif, **aucun lien inverse objectif→variable** |
| Dimensions / Indicateurs | `ResearchVariable.dimensions: ResearchDimension[]` (:242-262, chacune avec `variableId` de retour) et `.indicators: ResearchIndicator[]` (:208-235, avec `variableId?`/`dimensionId?`) |
| Hypothèses | `ResearchProject.hypotheses: ResearchHypothesis[]` (:397-413), avec `role?: "general"\|"specific"` (distinction principale/secondaire déjà présente mais optionnelle, jamais exploitée par une UI), `variableIds?`, `objectiveId?` |
| **Cadre théorique** | **Absent — confirmé par grep, zéro occurrence dans `lib/core/research/**`.** Gap réel, central au sprint. |
| Questionnaire | `QuestionnaireQuestion` (`lib/core/questionnaire/QuestionnaireTypes.ts:84-170`) porte déjà `variableId?/dimensionId?/indicatorId?` — la traçabilité réelle existe déjà, jamais inventée quand absente (ex. section sociodémographique) |
| Bibliographie (P11) | `ResearchContext.bibliography` / `BibliographyReference` (`lib/core/scientific-work/ScientificWorkTypes.ts:159-174`) — inchangé |

## Constat central : deux moteurs existants couvrent déjà l'essentiel de ce que le sprint demande

**`lib/core/research/ResearchConsistencyEngine.ts`** (déterministe, aucun appel OpenAI) exporte déjà
`checkResearchConsistency(project)` avec exactement le vocabulaire demandé par le sprint
(`pass | warning | needs_review | error`) et couvre déjà : présence du sujet/question, objectifs
généraux/spécifiques, opérationnalisation des variables (dimensions/indicateurs), résolution des
`variableIds` des relations et hypothèses, liaison objectifs↔variables, et 8 contrôles de cohérence
méthodologique (A-H). Ce fichier **n'est pas dans la liste protégée**.

**`lib/core/methodology/MethodologyRecommendationEngine.ts`** (déterministe, aucun appel OpenAI)
exporte déjà `buildMethodologyRecommendation(project)` avec exactement le modèle demandé par le
sprint : chaque section a `{ value?, status: "proposed"|"confirmed"|"needs_review", justification? }`.
Il ne calcule et n'affiche **jamais** de population/échantillon inventés — `population.value` reste
`undefined` et `status: "needs_review"` si non renseigné (:158-163), même chose pour `sampleSize`
(:180-183). Son en-tête documente déjà explicitement l'absence du référentiel Sem Mbimbi & Cornet.
Ce fichier n'est pas non plus dans la liste protégée.

**`QuestionnaireOverview.tsx`** affiche déjà des chiffres réels et calculés (pas fabriqués) :
`{coveredIndicators} / {totalIndicators} indicateurs couverts`, taux de couverture, via
`analyzeInstrument(project, questionnaire)` (fonction déjà exportée, en lecture seule, de
`QuestionnaireGenerationEngine.ts`).

**Décision d'architecture** (justifiée par cet audit, pas par contournement de la règle) :
créer un troisième moteur de cohérence dupliquerait ces deux fichiers existants — exactement ce que
le sprint interdit ("NE PAS dupliquer"). Le plan retenu est donc :

1. **Étendre** `ResearchConsistencyEngine.ts` (nouveaux contrôles : cadre théorique, structure des
   hypothèses) et `MethodologyRecommendationEngine.ts` (sections manquantes, adaptation
   niveau/contexte) — ce sont déjà les moteurs de cohérence/méthodologie que le sprint demande de
   construire "au-dessus des structures existantes", ils ne sont pas protégés, et les réécrire
   ailleurs violerait la règle anti-duplication.
2. **Créer uniquement ce qui n'existe nulle part** : un concept `TheoreticalFramework` (types +
   statut, aucun moteur nécessaire — c'est un champ, pas un calcul), une fonction de recommandation
   du nombre d'hypothèses secondaires (dérivée de données réelles, jamais inventée), et les
   composants d'interface (carte de cohérence, cadre théorique, structure des hypothèses).
3. **Ne jamais toucher** aux moteurs explicitement protégés : `QuestionnaireGenerationEngine.ts`,
   `DatasetEngine.ts`, `DescriptiveAnalysisEngine.ts`, `BivariateAnalysisEngine.ts`,
   `EconometricModelEngine.ts`, `EconomicInterpretationEngine.ts`, `ScientificDiscussionEngine.ts`,
   `ScientificWorkEngine.ts`, `ScientificWorkValidationEngine.ts`, `DocumentBuilder.ts`, export
   DOCX/PDF, `ResearchCore.ts`, `types/Research.ts` (ResearchData) — et, par extension de la même
   logique de protection, `AIResearchAdapter.ts` (qui dérive déjà `ResearchHypothesis`/
   `ResearchRelation` depuis A1 avec des garde-fous anti-invention explicites dans son code — non
   modifié, uniquement consommé en lecture).

## Génération d'hypothèses aujourd'hui : une seule hypothèse, jamais de structure principale/secondaires

`AIResearchAdapter.ts:buildHypothesesFromRelations` (:1021+) ne produit **qu'une seule hypothèse**
(`id: "hypothesis-1"`), dérivée de la relation unique proposée par A1, et seulement si cette relation
n'est pas `"unknown"` (jamais inventée sinon). Il n'existe aujourd'hui aucun mécanisme produisant des
hypothèses secondaires. C'est le vrai écart derrière l'Étape 5 du sprint. La solution retenue :
une nouvelle fonction déterministe, séparée de `AIResearchAdapter.ts` (jamais modifié), qui propose
des hypothèses secondaires à partir des **dimensions réellement déjà opérationnalisées** de la
variable explicative existante (jamais une nouvelle variable inventée) — proposées, jamais
imposées, validables via le mécanisme d'annotation déjà existant (P9/P10/P11 : `generated` →
`accepted`/`edited`/`needs_review`).

## Niveau Licence/Master

Deux représentations non réconciliées : `types/Project.ts` (mock, `"Licence"|"Master"|"Doctorat"`,
utilisé par le tableau de bord factice — voir plus bas) et `ResearchProject.level?: string`
(non typé, alimenté par `StepLevel.tsx` du Wizard avec 4 valeurs réelles : `"Licence"`, `"Master"`,
`"Doctorat"`, `"Projet professionnel"`). Le champ réel existe déjà et est déjà rempli par
l'utilisateur — aucun nouveau champ nécessaire, seulement une logique qui en tient compte.

## Référentiel Sem Mbimbi & Cornet

**Confirmé absent du dépôt** (aucun fichier PDF/texte nulle part hors `node_modules`/`.next`). Déjà
documenté comme absent dans plusieurs en-têtes de fichiers existants
(`MethodologyRecommendationEngine.ts`, `ResearchTypes.ts`, `ACADIA_SEG_METHODOLOGY.md`). Aucune
action de code requise pour l'Étape 20 — seulement continuer à ne jamais prétendre l'utiliser.

## Bug réel découvert pendant l'audit : projets de démonstration affichés comme réels à tout compte

`contexts/ProjectContext.tsx` (mock, sans persistance, distinct de `ResearchContext`) seed
`useState<Project[]>(sampleProjects)` depuis `data/sampleProjects.ts` — **3 projets fictifs**
attribués à des directeurs fictifs ("Pr. Kabemba", "Pr. Mukendi", "Pr. Kalala"). `ProjectProvider`
est monté globalement dans `app/dashboard/layout.tsx`, donc **tout compte, y compris un compte
tout juste créé, voit ces projets sur `/dashboard/projects` comme s'ils étaient siens**. C'est
exactement le problème que l'Étape 27 du sprint demande de corriger ("un compte nouvellement créé
doit avoir 0 projet réel... les anciens projets de démonstration ne doivent jamais apparaître comme
appartenant au nouvel utilisateur"). Corrigé dans ce sprint.

## OpenAI

Confirmé : la génération d'instrument réelle (production) est 100 % déterministe
(`QuestionnaireGenerationEngine`, aucun appel réseau). Le seul appel OpenAI direct pour un
questionnaire (`app/api/ai/questionnaire/route.ts`) n'est atteignable que depuis la page de debug
`questionnaire-lab`, déjà protégée hors développement (P13). Le prompt A1
(`lib/ai/openai/SubjectUnderstandingAI.ts`) interdit déjà explicitement l'invention ("tu ne dois
jamais inventer une information", "population lorsqu'elle est identifiable", relation `"unknown"`
si incertaine). Aucune instruction relative au cadre théorique n'existe — cohérent avec l'absence du
champ. Point relevé en P13 mais non corrigé à l'époque : `lib/openai.ts` porte
`dangerouslyAllowBrowser: true`, inutile côté serveur — corrigé dans ce sprint (retrait).

## Portée retenue pour ce sprint

Compte tenu de l'ampleur du sprint (37 étapes) et de ce que l'audit révèle déjà construit, la
priorité va au **critère final de réussite** explicite du sprint : cadre théorique jamais inventé,
structure des hypothèses réelle et choisie par le chercheur, chaîne de cohérence visible et
traçable, méthodologie structurée sans jamais inventer population/échantillon, readiness réelle,
correction du bug des projets fictifs. Les points 13 (contextualisation RDC profonde) et 20
(référentiel) restent volontairement légers (aucune donnée à inventer pour les enrichir sans
risquer justement d'inventer). Documenté honnêtement dans le rapport final, pas masqué.
