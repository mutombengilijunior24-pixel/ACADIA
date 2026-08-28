# ACADIA — Rapport de tests P13.2 (Scientific Research Integrity)

## 1. Audit initial

Voir `ACADIA_P13_2_AUDIT.md`. Constat central : `ResearchConsistencyEngine.ts` et
`MethodologyRecommendationEngine.ts` (tous deux non protégés) couvraient déjà une large part de ce
que le sprint demandait — cohérence structurelle avec vocabulaire PASS/WARNING/NEEDS_REVIEW/ERROR,
méthodologie jamais inventée. Le vrai vide : aucun concept de cadre théorique, et une seule
hypothèse jamais structurée en principale/secondaires.

## 2. Architecture retenue

Extension des deux moteurs existants plutôt que création d'un troisième moteur de cohérence
parallèle (qui aurait violé la règle anti-duplication du sprint). Un seul concept réellement
nouveau créé : le cadre théorique, sur le même patron que la bibliographie P11 (vit dans
`ResearchContext`, jamais dans `ResearchTypes.ts`).

## 3. Fichiers créés

- `lib/core/research/TheoreticalFrameworkTypes.ts`
- `lib/core/research/HypothesisProposalEngine.ts`
- `components/research/consistency/TheoreticalFrameworkSection.tsx`
- `components/research/consistency/HypothesisStructureSection.tsx`
- `ACADIA_P13_2_AUDIT.md`, `ACADIA_P13_2_TEST_REPORT.md`

## 4. Fichiers modifiés

`contexts/ResearchContext.tsx` (collection `theoreticalFramework` + `addHypothesis`/
`updateHypothesisStatus`, mêmes patrons que P11/P4), `lib/core/research/ResearchConsistencyEngine.ts`
(2 nouveaux contrôles + `computeResearchIntegrityReadiness`), `components/research/consistency/
ResearchConsistencyOverview.tsx`, `components/research/consistency/MethodologyOverview.tsx` (14
sections au lieu de 8), `components/research/consistency/QuestionnaireOverview.tsx` (compteurs
réels supplémentaires), `contexts/ProjectContext.tsx` + `components/projects/ProjectGrid.tsx` (bug
corrigé), `lib/openai.ts` (retrait de `dangerouslyAllowBrowser`).

**Aucun moteur protégé modifié** : `AIResearchAdapter.ts` en particulier n'a pas été touché — la
génération de l'hypothèse principale reste exactement celle d'avant P13.2 ; les hypothèses
secondaires sont ajoutées par un mécanisme entièrement séparé et optionnel.

## 5-6. Chaîne scientifique avant / après

**Avant** : Sujet → Problématique → Objectifs → Variables → Dimensions → Indicateurs → **1
hypothèse (jamais structurée)** → Questionnaire → Méthodologie, sans cadre théorique nulle part.

**Après** : le même chemin, plus **Cadre théorique** (explicite, jamais déduit) et une **hypothèse
principale + hypothèses secondaires proposées à partir des dimensions réellement opérationnalisées**
(jamais une nouvelle variable inventée), le tout visible dans une seule readiness globale
(**Research Integrity Readiness**, 0-100, bandée) qui descend réellement quand un maillon manque —
vérifié : cadre théorique non renseigné + hypothèses non structurées → needs_review comptabilisés,
score < 100.

## 7. Génération réelle du questionnaire

Non modifiée (moteur protégé). Vérifié que `QuestionnaireOverview` affiche désormais, en plus de la
couverture déjà réelle (`X / Y indicateurs couverts`) : le nombre total de questions, le nombre de
variables couvertes, et le nombre de questions `needs_review` — tous calculés depuis l'instrument
réel, jamais fabriqués.

## 8. Cohérence problématique/objectifs

Inchangée (déjà couverte par les checks 1-3 et 9 de `ResearchConsistencyEngine`, vérifiés non
régressés — voir §18).

## 9. Cadre théorique

Nouveau contrôle (Check 11) : `needs_review` avec le message exact
« Cadre théorique à préciser par le chercheur. » si aucune entrée, `pass` sinon. Ajout/suppression
explicites uniquement via `TheoreticalFrameworkSection` — testé en navigateur : ajout d'une entrée,
disparition immédiate du message d'absence, persistance après reload.

## 10. Hypothèses

Nouveau contrôle (Check 12) sur la structure principale/secondaires (`role`). Nouveau moteur
`HypothesisProposalEngine.ts` : recommandation du nombre de secondaires dérivée du nombre réel de
dimensions de la variable explicative (jamais 3 par défaut), proposition de secondaires à partir de
ces dimensions réelles, jamais une nouvelle variable inventée. Testé en navigateur sur le sujet SNCC
(variable explicative à 5 dimensions) : recommandation exacte « 3 hypothèses secondaires... 5
dimensions distinctes déjà opérationnalisées », 3 propositions générées, une acceptée, une rejetée,
état persistant après reload.

## 11. Variables / 12. Indicateurs

Inchangés (checks 4, 7, 9 déjà existants, non régressés).

## 13. Méthodologie

`MethodologyOverview` passe de 8 à 14 sections en s'appuyant sur des champs déjà réels mais non
affichés (`project.location`, `methodology.analysisUnit`, `recommendation.dataSourceType`,
`methodology.instruments`, `methodology.warnings`) — aucun nouveau calcul, uniquement de l'affichage
de données déjà présentes dans le modèle, avec les mêmes retombées « À définir »/« À préciser »
qu'ailleurs.

## 14. Population inconnue

Déjà correct avant ce sprint (`MethodologyRecommendationEngine` ne calcule jamais de valeur si
absente) — **vérifié explicitement en navigateur** avec un projet à population volontairement
vidée : message exact « À préciser par le chercheur. » et avertissement explicite affichés, aucun
nombre inventé.

## 15. Licence/Master

Champ déjà réel (`ResearchProject.level`, alimenté par `StepLevel.tsx`) — aucune nouvelle
adaptation automatique de la rigueur par niveau n'a été construite dans ce sprint (voir §25,
limite assumée pour éviter tout risque d'invention).

## 16. Contextualisation RDC/Lubumbashi

Restée volontairement légère — aucune statistique locale, institution ou réglementation n'a été
ajoutée nulle part (rien à ajouter sans risquer d'inventer).

## 17. OpenAI

Audité (voir `ACADIA_P13_2_AUDIT.md`) : génération de production 100 % déterministe, garde-fous
anti-invention déjà présents dans les prompts A1. Correctif appliqué : retrait de
`dangerouslyAllowBrowser: true` (inutile côté serveur).

## 18. Tests

**Standalone** : `npx tsc --noEmit` propre après chaque bloc de modification (vérifié une dizaine de
fois).

**Navigateur — scénario central** (sujet SNCC, Master, quantitatif mixte) : 17/17 assertions
passées — création de compte, chargement du projet, Research Integrity Readiness affichée, ajout
d'un cadre théorique (apparition/disparition du message d'absence), hypothèse principale affichée,
recommandation à 3 basée sur les données réelles, 3 hypothèses secondaires proposées, acceptation/
rejet, persistance après reload, non-régression de Research Health / Econometric Readiness /
Méthodologie / Instrument de collecte.

**Navigateur — scénarios explicitement requis par le sprint** : 12/12 assertions passées —
descriptif (aucune hypothèse forcée), qualitatif (aucune hypothèse forcée, aucune statistique
quantitative forcée, readiness tout de même calculée), population inconnue (message exact, jamais
un nombre inventé).

**Balayage anti-hallucination** : recherché dans toutes les captures de texte de page —
`/hypothèse confirmée/i`, `/hypothèse infirmée/i`, `/β\s*=/` (hors contexte qualitatif) : aucune
occurrence hors des messages de garde-fou attendus.

## 19. Tests navigateur (résumé)

29 assertions au total, 0 échec, sur Edge headless réel (CDP), profils SNCC/Descriptif/Qualitatif,
avec captures d'écran inspectées visuellement (`p13_2_readiness_theory.png` notamment).

## 20. Responsive

390px : `scrollWidth === innerWidth` sur la page de cohérence après ajout des nouvelles sections —
aucun débordement introduit. 1440px vérifié visuellement. 768/1024px non revérifiés spécifiquement
pour ce sprint (déjà couverts en P13 pour le layout général, non modifié ici).

## 21. Isolation utilisateur

Non re-testée spécifiquement dans ce sprint (déjà testée en profondeur en P13, architecture de
stockage inchangée par P13.2 — les nouvelles collections `theoreticalFramework` suivent
scrupuleusement le même mécanisme `scopedStorageKey(..., userId)` déjà validé).

## 22-23. Build / Lint

`npm run build` : propre, toutes routes générées. `npm run lint` : 61 problèmes, tous préexistants
(aucun nouveau — vérifié explicitement avant/après chaque bloc).

## 24. Problèmes corrigés (au-delà du périmètre strict du sprint, mais découverts pendant l'audit)

- **Bug réel** : `ProjectContext` affichait 3 projets fictifs (directeurs fictifs) à tout compte, y
  compris nouvellement créé — corrigé (`/dashboard/projects` démarre à 0 projet réel, démonstration
  accessible uniquement sur demande explicite et clairement identifiée).
- `lib/openai.ts` : `dangerouslyAllowBrowser` retiré.

## 25. Problèmes restants / limites assumées

- Pas de visualisation dédiée de la « carte de cohérence » sous forme de chaîne graphique
  (Étape 2) — substantiellement couvert par les sections déjà existantes (Research Health,
  Opérationnalisation) plutôt que dupliqué sous une nouvelle forme visuelle.
- Aucune adaptation automatique de la rigueur méthodologique par niveau (Licence/Master) au-delà
  de l'affichage déjà réel du champ — non construite pour éviter tout risque de sur-ingénierie
  hasardeuse dans le temps imparti.
- Contextualisation RDC/Lubumbashi restée volontairement minimale.
- Référentiel Sem Mbimbi & Cornet toujours absent du dépôt — jamais utilisé, jamais simulé comme
  utilisé (conforme à l'Étape 20).

**STOP — je ne démarre pas de nouveau sprint.**
