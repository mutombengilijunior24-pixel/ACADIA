# ACADIA — Roadmap produit (spécialisation Sciences économiques et de gestion)

Séquencement des 28 blocs du Master Implementation Sprint, réordonnés selon la priorité explicitement fixée par le sprint, et réconciliés avec les blocs déjà en cours (`docs/vibe-coding/MASTER_PLAN.md`, Bloc 2A réalisé, 2B/2C/2D non réalisés).

Règle de travail imposée par le sprint et rappelée ici : **un bloc à la fois**. Après chaque bloc → `npm run build` → correction → vérification des routes → vérification visuelle (desktop + mobile) → documentation → seulement ensuite le bloc suivant. Ne jamais enchaîner plusieurs blocs sans validation intermédiaire.

---

## PRIORITÉ 1 — Stabilité

Avant d'ajouter la moindre couche scientifique, corriger ce qui rend le pipeline IA actuel non fiable (constaté dans `ACADIA_CURRENT_STATE.md` §5) :

1. **Frontière client/serveur A1/A2** — `ResearchContext.tsx` (`"use client"`) appelle directement `ResearchIntelligenceEngine.analyzeResearch()`, ce qui bundle le SDK OpenAI et les prompts dans le JavaScript navigateur. À corriger : faire transiter l'appel par `fetch("/api/ai/research-intelligence")` (la route existe déjà côté serveur, elle est juste orpheline).
2. **Nom de modèle incohérent** (`gpt-5.6` / `gpt-5` / `gpt-5-mini` selon les fichiers) — harmoniser sur un seul modèle validé pour le compte OpenAI utilisé.
3. **Masquage des échecs OpenAI** — `analyzeResearch()` avale les erreurs et renvoie un statut "succès" avec projet vide ; l'UI ne peut donc pas distinguer un vrai succès d'une panne. Corriger pour propager un état d'échec exploitable (prépare aussi le Bloc 21 — Fallback).
4. ~~**Routes de test non authentifiées**~~ — **Fait** : `/api/test-a1-openai`, `/api/test-a2-openai`, `/api/test-research-intelligence` sont gardées par `lib/api/devOnlyRoute.ts` (404 hors `NODE_ENV=development`), vérifié sous build de production.
5. **Pages de debug shippées** (`/dashboard/research-core-test`, `/dashboard/research-understanding-test`) — masquer ou retirer.

*Validation de fin de bloc : `npm run build` PASS, test manuel du Wizard jusqu'à l'étape d'analyse IA sans exposer d'appel OpenAI côté client (vérifiable dans le bundle `.next/static/chunks`).*

## PRIORITÉ 2 — Modèle de données scientifique

6. Étendre `ResearchTypes.ts` (sans casser les types existants) avec les interfaces du Bloc 19 : `VariableOperationalization`, `HypothesisDetail`, `EconometricModel`, `Dataset`/`DatasetVariable` — définies dans `ACADIA_ECONOMETRIC_SPEC.md`.
7. ~~Câbler `relations`/`hypotheses`~~ — **Fait** : `buildRelationsFromUnderstanding`/`buildHypothesesFromRelations` dans `AIResearchAdapter.ts`, appelés depuis `ResearchIntelligenceEngine.ts`. Vérifié sur 3 sujets réels (SNCC, PME, marketing digital).
8. ~~Étendre `normalizeVariableRole`~~ — **Fait** : les 6 rôles sont conservés, vérifié en conditions réelles (rôle `descriptive` préservé sur le sujet PME).

*Validation : `npm run build` PASS, projet de démonstration (Bloc 22) affichant au moins une relation et un rôle de variable non-independent/dependent correctement conservés.*

## PRIORITÉ 3 — Validation méthodologique

9. Construire le moteur de **Research Consistency Check** (Bloc 14) en s'appuyant sur la table de dépendances du §1 de `ACADIA_SEG_METHODOLOGY.md`. Commencer par 3-4 règles à fort impact (ex. « question causale sans variable dépendante », « hypothèse référençant une variable absente du modèle ») plutôt que la liste complète d'un coup.
10. Distinction quantitatif/qualitatif/mixte avec justification explicite (au lieu du simple label actuel dans `StepResearchType`).

*Validation : Test B et Test C du Bloc 23 (sujet trop large, question incohérente) déclenchent une alerte visible.*

## PRIORITÉ 4 — Variables / hypothèses / opérationnalisation

11. Nouvel écran (ou extension du Wizard existant, cohérent avec `docs/vibe-coding/MASTER_PLAN.md` Bloc 2C « intelligence A1 visible ») exposant `ResearchVariable`/`ResearchHypothesis` avec Accepter/Modifier/Régénérer/Rejeter — reprend directement les règles scientifiques non négociables déjà actées dans `MASTER_PLAN.md` §6.
12. Étape d'opérationnalisation (Bloc 3) utilisant `VariableOperationalization`.
13. Gestion des hypothèses (Bloc 4) utilisant `HypothesisDetail`, avec le texte de prudence causale systématique.

*Validation : Test D et Test E du Bloc 23 (hypothèse sans variables, variable non mesurable) produisent le comportement attendu (alerte / demande d'opérationnalisation).*

## PRIORITÉ 5 — Préparation économétrique (socle uniquement)

14. `EconometricModel`, `Dataset` en base de données/état applicatif (pas de moteur de calcul).
15. Composant visuel **Econometric Readiness** (Bloc 17).
16. Cadre de sélection des tests (Bloc 9) avec les 6 questions pédagogiques par test, sans calcul réel.

*Validation : Test F et Test G du Bloc 23 (modèle cohérent / incohérent) — readiness score correct dans les deux cas, explication affichée pour le cas incohérent.*

## PRIORITÉ 6 — Dashboard chercheur

17. Écran "Mon projet" + **Research Health** (Bloc 16) — barres de progression par section (Cadrage, Problématique, Variables, Méthodologie, Données, Économétrie).
18. Liste d'alertes de cohérence agrégées (sortie du moteur de Priorité 3).

*Validation : Research Health reflète fidèlement l'état réel d'un projet de démonstration (Bloc 22) sur desktop et mobile.*

## PRIORITÉ 7 — UX premium

19. Appliquer le Design System ACADIA existant (`components/research/ResearchWizard/brand/`) aux nouveaux écrans (variables, hypothèses, readiness, dashboard) — **réutiliser** `ResearchOptionCard`, `ResearchInsight`, `ResearchSummaryCard`, `ResearchPrimaryButton` plutôt que recréer des variantes.
20. Nouveaux objets visuels demandés par le Bloc 15 (Variable Map, Hypothesis Card, Methodology Check, Model Preview) — à construire comme extensions du Design System existant, pas comme un second système.
21. Couche pédagogique (Bloc 18) : tooltips/panneaux d'explication (R², p-value, Student, Fisher, etc.) réutilisant `ResearchInsight`.

*Validation : parcours complet testé à 390px / 768px / 1280px / 1440px, aucun débordement horizontal (Bloc 26), contrôle accessibilité de base (Bloc 27).*

## PRIORITÉ 8 — Tests

22. Implémenter les 5 projets de démonstration du Bloc 22 comme données réutilisables (pas de cas particuliers codés en dur dans la logique).
23. Dérouler les 8 scénarios du Bloc 23 (Test A à H) comme suite de vérification manuelle reproductible, documentée dans `docs/vibe-coding/TEST_PROTOCOL.md` (existant, à étendre plutôt que remplacer).

---

## Réconciliation avec `docs/vibe-coding/MASTER_PLAN.md`

- Bloc 2A (UX visuelle du Wizard) : **fait**.
- Bloc 2B (navigation/validation/persistance) : **non fait** — recommandé de le traiter en même temps que la Priorité 1 de ce document (la validation bloquante est un prérequis naturel du moteur de cohérence de la Priorité 3).
- Bloc 2C (intelligence A1 visible) : correspond directement à la Priorité 4, point 11 ci-dessus.
- Bloc 2D (validation visuelle réelle par un utilisateur) : à positionner après la Priorité 6 (dashboard), avant tout élargissement supplémentaire.
- Blocs 3-8 de `MASTER_PLAN.md` (intelligence des variables, questionnaire, espace de travail, publication, analyse, bêta fermée) restent valides comme horizon long terme ; ce roadmap SEG les détaille et les réordonne pour la spécialisation économie/gestion sans les contredire.

## Prochaine étape immédiate recommandée

Démarrer par la **Priorité 1, point 1** (frontière client/serveur A1/A2) : c'est le seul correctif qui conditionne la fiabilité de tout ce qui suit — construire des fonctionnalités scientifiques avancées sur un pipeline IA qui s'exécute silencieusement dans le navigateur avec une clé absente serait un travail à refaire.
