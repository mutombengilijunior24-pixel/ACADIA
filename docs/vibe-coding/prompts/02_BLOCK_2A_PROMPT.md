# PROMPT — BLOCK 2A

We are implementing ACADIA Block 2A: Research Wizard presentation and visual UX.

Goal: make `/dashboard/research/new` look and feel like a polished product while preserving all current research logic and contracts.

Read `docs/vibe-coding/BLOCK_2A_SPEC.md` first.

Inspect the real current files under:

`components/research/ResearchWizard/`

At minimum inspect:
- `ResearchWizard.tsx`
- `ProgressBar.tsx`
- `Navigation.tsx`
- `LiveSummary.tsx`
- `StepRenderer.tsx`
- every Step component used by StepRenderer

Also inspect:
- `contexts/ResearchContext.tsx`
- `types/Research.ts`
- existing shared UI components
- existing global styles

Do not rewrite the research architecture.
Do not change A1/A2/ResearchCore/API contracts.
Do not invent a new state management system.

Implement only the visual/UX improvements required by Block 2A:
- coherent page frame;
- clear hierarchy;
- polished progress indicator;
- polished navigation;
- useful live summary;
- consistent step cards;
- responsive behavior;
- loading/disabled/focus states where appropriate;
- no visual regressions in existing steps.

After changes:
1. Run `npm run build`.
2. Run the app.
3. Test `/dashboard/research/new` from step 0 to step 14.
4. Report the exact files changed.
5. Give a short visual QA checklist.
