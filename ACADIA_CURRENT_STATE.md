# ACADIA — État actuel du projet

Document produit dans le cadre du Master Implementation Sprint (spécialisation Sciences économiques et de gestion). Base factuelle pour les trois documents qui l'accompagnent : `ACADIA_SEG_METHODOLOGY.md`, `ACADIA_ECONOMETRIC_SPEC.md`, `ACADIA_PRODUCT_ROADMAP.md`.

Aucune ligne de code n'a été modifiée pour produire ce document. Il reflète l'état du dépôt tel qu'inspecté à date.

---

## 1. Identité technique

- Next.js 16.2.12 (App Router, Turbopack), React 19.2.4, TypeScript 5 strict, Tailwind CSS v4 (config CSS-first via `@theme`, pas de `tailwind.config.js`).
- Package `openai` ^7.4.0 (SDK officiel).
- Pas de dépôt Git initialisé (`git status` échoue avec "not a git repository"). `.gitignore` créé lors d'une session précédente (ignore `.env*`, `node_modules`, `.next`).
- `OPENAI_API_KEY` configurée dans `.env.local` (vérifiée présente et non vide, valeur jamais affichée). `NEXT_PUBLIC_OPENAI_API_KEY` : absente. Aucune clé codée en dur (hors placeholder de secours `sk-placeholder-key-for-build`, présent dans 3 fichiers, jamais une vraie clé).
- `npm run build` : **PASS** — 0 erreur TypeScript, 26 routes générées (mix statique/dynamique).

## 2. Architecture des routes (`app/`)

- `/` , `/landing`, `/ui` — pages vitrine/kit UI.
- `/dashboard`, `/dashboard/research`, `/dashboard/research/new`, `/dashboard/research/[id]` — parcours recherche.
- `/dashboard/projects`, `/dashboard/projects/[id]`, `/dashboard/projects/[id]/editor` — espace projet.
- `/dashboard/questionnaire-lab` — labo de génération de questionnaire.
- `/dashboard/research-core-test`, `/dashboard/research-understanding-test` — **pages de debug/démo, exécutent du code de test au build (effets de bord `console.log`), à retirer ou protéger avant mise en production.**
- `/questionnaire/[id]`, `/questionnaire/test` — parcours répondant.
- API : `/api/ai/{generate,questionnaire,research-intelligence}`, `/api/understanding`, `/api/questionnaire/{[id],[id]/responses,publish}`, `/api/test-a1-openai`, `/api/test-a2-openai`, `/api/test-research-intelligence` — **Corrigé (Priorité 1 / Point 2)** : les 3 routes `test-*` sont désormais gardées par `lib/api/devOnlyRoute.ts` (`NODE_ENV === "development"`), vérifié en conditions réelles : `404 DEV_ONLY_ROUTE` sous `npm run start` (production), accès normal sous `npm run dev`. Aucun appel OpenAI possible via ces routes hors développement.

## 3. Contexts

- `contexts/ProjectContext.tsx`, `contexts/ResearchContext.tsx` — montés uniquement sur `app/dashboard/layout.tsx` (`ProjectProvider > ResearchProvider > MainLayout`). Le layout racine (`app/layout.tsx`) ne contient aucun provider : `/`, `/landing`, `/questionnaire/*` n'ont pas accès au state recherche.
- `ResearchContext` expose : `researches`, `currentResearch`, `currentProject`, `intelligence`, `methodology`, `sample`, `updateCurrentResearch`, `resetCurrentResearch`, `buildCurrentProject`, `createCurrentResearch`, `analyzeCurrentResearch`, CRUD/archive/restore.
- **Corrigé (Priorité 1 / Point 1)** : `ResearchContext.tsx` importait auparavant directement `analyzeResearch()` de `lib/core/research/ResearchIntelligenceEngine.ts`, ce qui bundlait le SDK OpenAI et les prompts A1/A2 dans le JavaScript navigateur. `analyzeCurrentResearch()` appelle désormais `POST /api/ai/research-intelligence` via `fetch()` ; seul le **type** `ResearchIntelligenceResult` est encore importé (`import type`, effacé à la compilation). Vérifié par inspection du bundle de production (`.next/static/`) : aucune trace du modèle, des prompts, de `dangerouslyAllowBrowser` ni de `OPENAI_API_KEY`. Détail complet dans `ACADIA_AI_ARCHITECTURE.md`.
- `hooks/useResearch.ts` et `hooks/useWizard.ts` sont des **fichiers vides** (stubs non implémentés) ; le hook réellement utilisé est `useResearch` exporté par `ResearchContext.tsx`.

## 4. Types (`types/`, `lib/core/research/ResearchTypes.ts`)

- `types/Research.ts` — `ResearchData` (input brut du Wizard, tous champs requis), `Research` (+ id/status/progress/dates), `initialResearchData`.
- `lib/core/research/ResearchTypes.ts` — contrat central du moteur scientifique. **Déjà beaucoup plus riche que ce que le Wizard exploite aujourd'hui** :
  - `ResearchVariable { id, name, role: VariableRole, definition, dimensions: ResearchDimension[], indicators: ResearchIndicator[], linkedObjectiveIds, status, confidence }`
  - `VariableRole = independent | dependent | mediating | moderating | control | descriptive` (6 rôles déjà typés)
  - `ResearchDimension`, `ResearchIndicator` (avec `variableId`, `dimensionId`)
  - `ResearchRelation { from, to, relation: ResearchRelationType, description, status, confidence }` — `ResearchRelationType = influence | impact | effect | relationship | association | correlation | mediation | moderation`
  - `ResearchHypothesis { id, statement, role, variableIds[], objectiveId, status, confidence }` — **existe déjà au niveau racine de `ResearchProject.hypotheses`**, non utilisée par le Wizard actuel.
  - `ResearchMatrix { variables, objectives, hypotheses, indicators }`, `ResearchInstrument`, `ResearchMethodology` (approche, méthode, techniques, population, `samplingMethod`, `sampleSize`, `dataSources`, `analysisMethods`).
  - `ResearchProject` — structure racine, contient déjà `variables`, `relations`, `hypotheses`, `methodology`, `matrix?`, `instruments`, `metadata`.
- **Conclusion clé pour le sprint SEG** : le Bloc 2/3/4 (modèle conceptuel, opérationnalisation, hypothèses) demandé n'est **pas à créer from scratch** — le type `ResearchTypes.ts` prévoit déjà la structure. Ce qui manque, c'est (a) le câblage réel (rien ne peuple `relations`/`hypotheses` aujourd'hui dans le pipeline actif), (b) les types Bloc 5-11 (dataset, modèle économétrique, tests, résultats, discussion) qui n'existent pas encore.
- Duplication mineure : `ResearchStatus` est déclaré séparément dans `types/Research.ts` et `ResearchTypes.ts` (mêmes valeurs, deux sources).

## 5. Moteurs scientifiques (`lib/core/research/`, `lib/core/methodology/`)

Il existe **deux architectures parallèles pour A1/A2**, une seule est réellement branchée :

| Couche | Fichier réellement actif (branché sur les routes/Context) | Fichier(s) mort(s) / non branchés |
|---|---|---|
| A0 — Research Core | `ResearchCore.ts` (déterministe, construit `ResearchProject`, génère une méthodologie heuristique placeholder) | — |
| A1 — Compréhension | `lib/ai/openai/SubjectUnderstandingAI.ts` (appel OpenAI réel, `responses.create`, `json_schema` strict) | `lib/core/research/SubjectUnderstandingEngine.ts` (squelette local sans IA, branché uniquement sur `/api/understanding`) |
| A2 — Variables | `lib/ai/openai/VariableIntelligenceAI.ts` (appel OpenAI réel) | `lib/core/research/VariableIntelligenceEngine.ts` + `lib/core/research/VariableIntelligenceAI.ts` (signature différente, modèle différent, jamais appelés en production) |
| Adapter | `lib/core/research/AIResearchAdapter.ts` (normalise la sortie A2 → `ResearchVariable[]`) — **Corrigé (Priorité 2 / Point 1)** : les 6 rôles de `VariableRole` sont désormais tous conservés (vérifié en conditions réelles : une variable `descriptive` a été correctement préservée sur le sujet PME). L'adaptateur construit aussi désormais `ResearchRelation[]` et `ResearchHypothesis[]` à partir de `understanding.proposedRelationship` (auparavant jamais peuplés) — jamais de relation "unknown" transformée en hypothèse. | `lib/core/research/VariableIntelligenceFallback.ts` (fallback local codé en dur, jamais appelé — aucune dégradation gracieuse réelle si OpenAI échoue) |
| Orchestrateur | `lib/core/research/ResearchIntelligenceEngine.ts` (`analyzeResearch()`) — en interne, ne rejette toujours jamais (renvoie `status:"failed"` avec projet de secours en cas d'échec, comportement volontairement non modifié pour ne pas réécrire A1/A2). **Corrigé au niveau de la route** : `app/api/ai/research-intelligence/route.ts` inspecte désormais `status` et transforme un `"failed"` en réponse HTTP d'erreur explicite (`{success:false, error:{code, message}}`, 502/500) au lieu de le laisser passer pour un succès. | — |
| A3 — Méthodologie | `ResearchCore.buildMethodology()` (heuristique par mots-clés, c'est ce qui s'affiche réellement) | `lib/core/methodology/MethodologyEngine.ts`, `MethodologyIntelligenceEngine.ts` — **jamais appelés par aucune route/composant**, donc la méthodologie n'est jamais recalculée après l'analyse A1/A2 |
| Échantillonnage | `lib/core/methodology/SamplingEngine.ts` — `calculateSampleSize(population, marginOfError)`, formule de Yamane, **seul module de la couche méthodologie réellement utilisé en production** (via `ResearchContext.tsx`) |  |

Modèles OpenAI utilisés : A1 et A2 actifs lisent désormais `AI_MODEL` depuis `lib/ai/openai/config.ts` (valeur fonctionnelle inchangée : `"gpt-5.6"`, override possible via la variable d'environnement `AI_MODEL`). `/api/ai/generate` (`"gpt-5"`) et le moteur A2 mort (`"gpt-5-mini"`) sont hors périmètre de ce point (routes/moteurs distincts, non touchés) — restent une incohérence à traiter séparément si ces chemins sont un jour réactivés.

`lib/core/questionnaire/` — moteur de génération de questionnaire (12 fichiers : `QuestionnaireEngine`, `QuestionnaireMatrix`, `QuestionnaireQualityEngine`, `QuestionnaireValidator`, etc.). Non ré-audité en détail dans cette passe ; à examiner avant le Bloc 4 du sprint (opérationnalisation → questionnaire).

## 6. Wizard (`components/research/ResearchWizard/`)

- 15 écrans (0-14), state centralisé dans `ResearchContext` via `updateCurrentResearch(field, value)` — mécanisme uniforme, aucune divergence de nommage avec `ResearchData`.
- **Bloc 2A (identité visuelle ACADIA) réalisé** lors d'une session précédente : Design System de marque créé (voir §7), palette réelle du logo appliquée, écrans restylés.
- **Bloc 2B (navigation/validation) non réalisé** :
  - Aucune validation bloquante (le paramètre `isNextDisabled` de `Navigation.tsx` n'est jamais alimenté).
  - Aucune persistance au-delà de la mémoire React (`useState`) — perte totale au F5, y compris sur `/dashboard/research/[id]` qui devient "introuvable" après rafraîchissement juste après création.
  - `resetCurrentResearch()` existe dans le Context mais n'est câblée à aucun bouton du Wizard.

## 7. Design System ACADIA (existant, à réutiliser)

`components/research/ResearchWizard/brand/` :
`ResearchBrand` (logo réel, variantes full/compact/symbol, aucune retouche du fichier logo), `ResearchStepHeader`, `ResearchOptionCard`, `ResearchTextArea`, `ResearchInsight` (coquille visuelle vide, prête à recevoir des sorties IA), `ResearchPrimaryButton`, `ResearchSummaryCard`.

Tokens dans `app/globals.css` (`@theme`) : `--color-acadia-blue: #2554EB`, `--color-acadia-blue-light/dark`, `--color-acadia-navy: #0B1B3A`, `--color-acadia-navy-soft`. Génèrent les utilitaires Tailwind `bg-acadia-blue`, `text-acadia-navy`, etc. Validé visuellement (captures d'écran desktop + mobile) et par `npm run build`.

## 7bis. P2.4 / P3 (mise à jour) — Chaînage, persistance, méthodologie

- **Chaînage scientifique** : `ResearchProject.researchQuestions` est désormais peuplé (uniquement si `problem` est déjà formulé comme une question par le chercheur — jamais généré). `ResearchVariable.linkedObjectiveIds` est calculé par correspondance structurelle (nom de variable contenu dans le texte d'un objectif). `ResearchHypothesis.objectiveId` pointe vers l'objectif général.
- **Persistance** : `contexts/ResearchContext.tsx` persiste désormais `researches` et un nouveau `projects: Record<string, ResearchProject>` dans `localStorage` (clés `acadia-researches`/`acadia-projects`, même mécanisme que `QuestionnaireBuilder.tsx`). Hydratation après montage (évite un décalage SSR/client). Aucune base de données n'a été ajoutée.
- **Bug corrigé (pré-existant, sans rapport avec les blocs précédents)** : `app/dashboard/research/[id]/page.tsx` recevait `params` comme un objet alors que Next.js 15+ le fournit comme une `Promise` pour les Client Components — la page affichait donc systématiquement "Projet introuvable" quel que soit l'id, pour n'importe quel visiteur, depuis sa création. Corrigé via `useParams()` (`next/navigation`).
- **Méthodologie SEG (P3)** : nouveau `lib/core/methodology/MethodologyRecommendationEngine.ts` — moteur déterministe, aucun appel OpenAI, qui enrichit `project.methodology` (déjà construite par `ResearchCore`) d'une recommandation explicitement marquée "proposition" (orientation, devis de recherche, échantillon, collecte, source des données, plan d'analyse, éléments à valider). Le devis de recherche proposé n'est **jamais** écrit dans `project.methodology` elle-même — volontairement gardé ephémère/recalculé à l'affichage, pour ne jamais mélanger "fait persisté" et "proposition".
- **Cohérence méthodologique** : `ResearchConsistencyEngine.ts` étendu avec 8 checks (A-H) comparant orientation/collecte/objectifs/variables/hypothèses/population/échantillon entre eux.
- **UI ajoutée** (réutilise le Design System, aucune nouvelle identité) : `MethodologyOverview.tsx`, `ResearchChainView.tsx`, montés sur `/dashboard/research/[id]` aux côtés de `ResearchConsistencyOverview.tsx` (Bloc P2.3), désormais alimentés par le projet **persisté** plutôt que seulement `currentProject`.

## 8. Ce qui manque totalement pour le sprint SEG

- Aucun moteur/formulaire de **gestion des hypothèses** exploitant `ResearchHypothesis` (le type existe, rien ne l'alimente ni ne l'affiche).
- Aucune **étape d'opérationnalisation des variables** dans le Wizard (définition conceptuelle vs opérationnelle, unité de mesure, indicateurs proposés avec justification).
- Aucun **moteur de validation de cohérence** ("Research Consistency Check").
- Aucune **structure de dataset/modèle économétrique** (types `Dataset`, `Model`, `Test`, `Result`, `Discussion` inexistants — à créer, voir `ACADIA_ECONOMETRIC_SPEC.md`).
- Aucun **tableau de bord "Research Health" / "Econometric Readiness"**.
- Aucune **couche pédagogique** (explications R², p-value, etc.).
- `docs/vibe-coding/MASTER_PLAN.md` décrit un Bloc 2C/2D (intelligence A1 visible, validation utilisateur réelle) qui **précède naturellement** une bonne partie de ce sprint SEG — à réconcilier dans `ACADIA_PRODUCT_ROADMAP.md`.

## 9. Ce qui fonctionne et doit être préservé tel quel

`ResearchCore.ts` (A0), le mécanisme de state du Wizard, `SamplingEngine.ts`, le Design System de marque, la structure de types `ResearchTypes.ts`, le pipeline A1/A2 réel de `lib/ai/openai/*` (une fois le problème de frontière client/serveur corrigé), les 26 routes existantes.
