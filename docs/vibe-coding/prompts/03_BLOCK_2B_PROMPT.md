# PROMPT — BLOCK 2B

Continue ACADIA after Block 2A is visually accepted.

Read:
- `docs/vibe-coding/MASTER_PLAN.md`
- `docs/vibe-coding/BLOCK_2B_SPEC.md`

Goal: make the existing research wizard behavior reliable without changing its visual architecture unnecessarily.

Inspect first:
- `ResearchWizard.tsx`
- all Step components
- `Navigation.tsx`
- `LiveSummary.tsx`
- `ResearchContext.tsx`
- `types/Research.ts`
- `ResearchCore.ts`

Implement:
- safe navigation;
- field persistence while navigating;
- required-field validation where appropriate;
- clear errors;
- final project creation/building;
- reset behavior;
- no duplicate project creation.

Do not add unrelated features.
Do not redesign the application.
Do not modify A1/A2 unless a concrete contract issue blocks Block 2B.

Finish with build + browser test instructions.
