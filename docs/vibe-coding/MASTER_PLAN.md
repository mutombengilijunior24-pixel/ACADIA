# ACADIA — Vibe Coding Master Plan

## 1. Mission

ACADIA is a research-construction platform. The product must guide a student/researcher from a research subject toward a scientifically coherent research project, while keeping the researcher in control of every AI proposal.

Core principle:

> AI proposes → researcher reviews → researcher validates → next stage.

Do not turn ACADIA into an autonomous system that silently invents scientific information.

---

## 2. Development method

Every feature is delivered as a visible functional block:

1. Build one block.
2. Run the application.
3. Use it as a real user.
4. Inspect screenshots/visual result.
5. Identify UX/scientific problems.
6. Correct only the relevant block.
7. Run `npm run build`.
8. Validate the block.
9. Freeze it before moving on.

Do NOT batch many invisible architectural changes before visual validation.

---

## 3. Current milestone

### Block 1 — Technical foundation
STATUS: VALIDATED by the project owner.

Known result from the working session:
- production build passed;
- TypeScript compilation passed;
- application routes were generated successfully.

Do not reopen Block 1 unless a later change causes a regression.

### Block 2 — Research creation experience
CURRENT MILESTONE.

Sub-blocks:

- 2A — Wizard presentation and visual UX
- 2B — Wizard navigation, validation and data behavior
- 2C — Visible A1 scientific understanding
- 2D — Real-user visual validation

### Block 3 — Variable intelligence

A1 understanding → A2 variables → dimensions → indicators → relations.

### Block 4 — Questionnaire intelligence

Variables → dimensions → indicators → questions → quality checks.

### Block 5 — Research workspace

Validated research → persistent project workspace → progress and editing.

### Block 6 — Questionnaire publication and collection

Questionnaire → public link → responses → storage.

### Block 7 — Analysis and interpretation

Responses → statistical/qualitative analysis → interpretation support.

### Block 8 — Closed beta

5 users → corrections → 20–50 users → stabilization.

---

## 4. Block 2 definition of done

Block 2 is NOT done merely because the wizard compiles.

A user must be able to:

- start a new research project;
- understand where they are in the process;
- enter research information without confusion;
- move backward and forward safely;
- see a useful live summary;
- understand what ACADIA knows and does not know;
- receive an A1 proposal;
- edit/reject/validate AI proposals;
- finish with a coherent research structure.

The visual experience must look like a real product, not a technical form.

---

## 5. Scientific pipeline

```text
Research subject
    ↓
A0 / Research Core
    ↓
A1 — Understanding
    ↓
Problem / objectives / context
    ↓
A2 — Variable Intelligence
    ↓
Variables
    ↓
Dimensions
    ↓
Indicators
    ↓
Questionnaire
    ↓
Collection
    ↓
Analysis
```

The current work must not bypass this pipeline.

---

## 6. Non-negotiable scientific rules

1. Never invent missing facts.
2. Distinguish user-provided facts from AI proposals.
3. Do not force every concept into a variable.
4. Do not force every research subject into an independent/dependent-variable model.
5. Never silently change a researcher's validated information.
6. Every AI proposal must be editable or rejectable.
7. Uncertainty must be visible.
8. Subject → problem → objectives → methodology must remain coherent.
9. A2 must consume A1 understanding rather than independently inventing a second architecture.
10. The Research Core is a structural layer, not the place for arbitrary scientific invention.

---

## 7. Current wizard architecture

The current wizard lives under:

`components/research/ResearchWizard/`

Main files:

- `ResearchWizard.tsx` — orchestration and current step state
- `StepRenderer.tsx` — step selection
- `ProgressBar.tsx` — progress UI
- `Navigation.tsx` — previous/next controls
- `LiveSummary.tsx` — current research summary
- `StepWelcome.tsx`
- `StepTitle.tsx`
- `StepDomain.tsx`
- `StepLevel.tsx`
- `StepUniversity.tsx`
- `StepResearchType.tsx`
- `StepProblem.tsx`
- `StepObjective.tsx`
- `StepObjectives.tsx`
- `StepPopulation.tsx`
- `StepPopulationSize.tsx`
- `StepLocation.tsx`
- `StepCollectionMethod.tsx`
- `StepAnalysis.tsx`
- `MethodologySummary.tsx`

The current wizard has 15 steps, indexed 0–14.

Important: inspect the actual files before modifying them. Do not recreate files from memory.

---

## 8. Current state model

The main research state is held by `contexts/ResearchContext.tsx`.

The context currently exposes:

- `researches`
- `currentResearch`
- `currentProject`
- `intelligence`
- `methodology`
- `sample`
- `updateCurrentResearch`
- `resetCurrentResearch`
- `buildCurrentProject`
- `createCurrentResearch`
- `analyzeCurrentResearch`
- CRUD/archive/restore functions

The research data type is `types/Research.ts`.

Do not create a parallel research state model without first checking the existing types and Core.

---

## 9. Intelligence architecture

Relevant modules:

- `lib/core/research/SubjectUnderstandingEngine.ts`
- `lib/core/research/SubjectUnderstandingTest.ts`
- `lib/ai/openai/SubjectUnderstandingAI.ts`
- `lib/core/research/VariableIntelligenceEngine.ts`
- `lib/core/research/VariableIntelligenceAI.ts`
- `lib/core/research/VariableIntelligenceFallback.ts`
- `lib/core/research/ResearchIntelligenceEngine.ts`
- `lib/core/research/AIResearchAdapter.ts`
- `lib/core/research/ResearchCore.ts`
- `lib/core/research/ResearchTypes.ts`

A1 should be treated as the understanding layer. A2 should be treated as variable intelligence. The adapter/Core layer should normalize the result into the application's project model.

---

## 10. Current API surface

Existing relevant routes include:

- `/api/ai/research-intelligence`
- `/api/ai/questionnaire`
- `/api/ai/generate`
- `/api/understanding`
- `/api/test-a1-openai`
- `/api/test-a2-openai`
- `/api/test-research-intelligence`

Before adding another API route, inspect whether an existing route already provides the required behavior.

---

## 11. Vibe-coding operating protocol

Before editing:

1. Inspect the relevant files.
2. Identify the current contract.
3. State exactly what will change.
4. Do not touch unrelated modules.

After editing:

1. Type-check/build.
2. Run the app.
3. Test the visible flow.
4. Report files changed.
5. Report what was not changed.
6. Report any unresolved issue honestly.

When an error appears:

- fix the smallest relevant surface;
- do not rewrite the architecture unless the contract is demonstrably wrong;
- rebuild immediately after the fix.

---

## 12. Definition of a successful coding session

A successful session ends with:

- a visible improvement;
- a reproducible test;
- a clear acceptance result;
- no unexplained TypeScript/build regression;
- a short handoff note for the next session.

