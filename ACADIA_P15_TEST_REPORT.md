# ACADIA — Rapport de tests P15 (Scientific Research Assistant)

## 1. Audit initial

Voir `ACADIA_P15_AUDIT.md`. Constat central : les moteurs déterministes existants
(`QuestionnaireGenerationEngine`, `ResearchConsistencyEngine`, `MethodologyRecommendationEngine`,
`HypothesisProposalEngine`) couvraient déjà une large part de ce que le sprint demandait ; les
vrais vides étaient (a) l'absence de toute utilisation du niveau d'étude, (b) l'absence de
gating/résumé avant génération du questionnaire, (c) l'absence d'explication « Pourquoi ? » sur
les recommandations méthodologiques, (d) l'absence d'édition/ajout libre d'hypothèses, et (e) un
bandeau d'en-tête de la page recherche entièrement fabriqué (découvert pendant les tests de ce
sprint).

## 2. Fichiers créés

- `lib/core/questionnaire/QuestionnaireReadiness.ts`
- `lib/core/questionnaire/QuestionnaireTraceability.ts`
- `lib/core/supervision/SupervisionTypes.ts`
- `components/research/consistency/ScientificChainStrip.tsx`
- `ACADIA_P15_AUDIT.md`, `ACADIA_P15_TEST_REPORT.md`

## 3. Fichiers modifiés

`lib/core/questionnaire/QuestionnaireTypes.ts` (type `conditional` + champ `conditionOn`),
`components/research/consistency/QuestionnaireOverview.tsx` (résumé pré-génération, gating réel,
explication repliable par question, éditeur de condition), `lib/core/methodology/
MethodologyRecommendationEngine.ts` (niveau, justifications, `levelGuidance`), `components/
research/consistency/MethodologyOverview.tsx` (badge niveau, `WhyToggle`), `components/research/
consistency/ResearchConsistencyOverview.tsx` (montage de `ScientificChainStrip`), `components/
research/consistency/HypothesisStructureSection.tsx` (édition + ajout libre), `contexts/
ResearchContext.tsx` (`updateHypothesisStatement`), `lib/core/research/TheoreticalFrameworkTypes.ts`
+ `components/research/consistency/TheoreticalFrameworkSection.tsx` (lien optionnel vers une
variable), `lib/core/entitlements/EntitlementTypes.ts` (plans conceptuels premium/supervisor),
`lib/auth/AuthTypes.ts` (inchangé depuis P14, non retouché), `app/dashboard/research/[id]/page.tsx`
(bandeau et cartes fabriqués remplacés par des données réelles, boutons morts corrigés).

**Aucun moteur protégé modifié.**

## 4. Niveau d'étude (Licence / Master)

Vérifié en navigateur : un projet Master affiche « Niveau Master : profondeur méthodologique et
opérationnalisation plus détaillées attendues... » et propose « Modèle économétrique à définir »
quand les deux variables sont prêtes. Le même moteur, appelé avec `level: "Licence"`, produirait
« Analyse bivariée approfondie (modélisation économétrique optionnelle à ce niveau) » — vérifié par
lecture du code (branche `isLicence`), non re-testé avec un compte Licence dédié faute de fixture
disponible pour ce niveau exact ; le mécanisme est cependant strictement symétrique à celui du
Master déjà testé en direct.

## 5. Hypothèses

Testé en navigateur : édition du texte de l'hypothèse principale (bouton crayon → texte modifié →
persistant après reload), ajout d'une hypothèse secondaire rédigée librement par le chercheur
(« Ajouter ma propre hypothèse secondaire »), toujours aux côtés des propositions déterministes
dérivées des dimensions réelles — jamais une dimension inventée.

## 6. Théorie

Testé : lien optionnel théorie → variable via le nouveau sélecteur ; en l'absence de cadre
théorique, le message exact « Cadre théorique à préciser par le chercheur. » reste affiché
(inchangé depuis P13.2).

## 7. Cohérence scientifique

Nouveau `ScientificChainStrip` vérifié en navigateur sur le sujet SNCC (Master, quantitatif,
5 dimensions) : ✓ Problématique, ✓ Objectifs, ○ Cadre théorique, ✓ Hypothèses, ✓ Variables,
✓ Indicateurs, ○ Questionnaire (« questionnaire non généré »), ⚠ Méthodologie (« dépend des choix
restants »). Après génération de l'instrument, la case Questionnaire n'a pas été re-vérifiée
visuellement post-génération dans cette passe (voir §12, limite assumée).

## 8. Questionnaire (priorité n°1)

Résumé pré-génération vérifié en navigateur : Sujet, Niveau, Problématique, Objectifs (3),
Hypothèses (1), Variables, Indicateurs (27), Population, Cadre théorique — tous réels, bouton
activé uniquement lorsque le minimum est réuni (testé positif sur le sujet SNCC, entièrement
opérationnalisé). Génération réelle déclenchée en navigateur : 27 questions produites, 27/27
indicateurs couverts. Panneau « Pourquoi cette question ? » ouvert en navigateur : affiche
Indicateur/Dimension/Variable/Hypothèse liée réels et cohérents (repli sur l'hypothèse principale
en l'absence d'hypothèse secondaire spécifique à la dimension — comportement voulu, jamais une
relation inventée). Type « Conditionnelle » ajouté à l'éditeur avec champ de condition en texte
libre — vérifié par lecture de code et typecheck, non testé interactivement en navigateur dans
cette passe (voir §12).

## 9. Qualitatif / Population inconnue

Non re-testés spécifiquement dans ce sprint : comportements déjà validés en P13.2 (guide
d'entretien distinct, aucune statistique quantitative dans ce parcours ; bouton « Non connue » sur
la taille de population) et non modifiés ici. La nouvelle justification de méthodologie
(« La population d'étude n'est pas encore renseignée... ») a été ajoutée au moteur et vérifiée par
lecture de code + typecheck.

## 10. Bug corrigé (découvert pendant les tests, hors périmètre strict initial)

`app/dashboard/research/[id]/page.tsx` : bandeau et 4 cartes entièrement fabriqués (progression
figée, statuts toujours identiques, un bouton pointant vers une route inexistante). Remplacés par
des données réelles (`ResearchProgressEngine`, statuts réels de méthodologie/instrument/dataset) et
des actions réelles (défilement vers la section correspondante déjà présente sur la page). Vérifié
en navigateur avant/après : passage de « 50 % terminé » (avant génération de l'instrument) à
« 63 % terminé » (après), cohérent avec les 8 étapes réelles suivies.

## 11. Build / Lint / Typecheck

`npx tsc --noEmit` : propre après chaque bloc. `npm run build` : propre, 36 routes générées.
`npm run lint` : 56 problèmes, tous préexistants (baisse par rapport à P14 confirmée déjà due au
nettoyage des anciens fichiers `components/assistant/*` ; aucun nouveau problème introduit par ce
sprint — vérifié explicitement fichier par fichier).

## 12. Limites / tests non exécutés dans cette passe (assumées, pour ne pas déclarer testé ce qui
     ne l'a pas été)

- Pas de compte de test dédié au niveau Licence (fixtures disponibles limitées à Master/mixte) —
  le comportement Licence a été vérifié par lecture de code, pas par un parcours navigateur
  complet.
- Le champ de condition d'affichage (question conditionnelle) n'a pas été rempli/testé
  interactivement en navigateur.
- L'état ✓ du maillon « Questionnaire » dans `ScientificChainStrip` n'a pas été re-vérifié
  visuellement après génération de l'instrument dans la même session de test.
- Test humain complet du scénario « Master économie à Lubumbashi » (Partie 23) non rejoué de
  bout en bout dans ce sprint au-delà des vérifications ciblées ci-dessus.
- Non-régression P1-P14 vérifiée via build/lint/typecheck globaux et via les pages déjà
  parcourues (dashboard, page recherche complète) — pas un balayage exhaustif de toutes les
  pages historiques.

**P15 — Scientific Research Assistant terminé.
P16 non commencé.**
