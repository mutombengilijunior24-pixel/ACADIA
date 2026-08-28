# PROMPT — BLOCK 2C

Continue ACADIA after Block 2B is accepted.

Read:
- `docs/vibe-coding/MASTER_PLAN.md`
- `docs/vibe-coding/BLOCK_2C_SPEC.md`

Goal: expose the first useful A1 scientific intelligence directly in the user experience.

Inspect the actual contracts before coding:
- `SubjectUnderstandingAI.ts`
- `SubjectUnderstandingEngine.ts`
- `ResearchIntelligenceEngine.ts`
- `AIResearchAdapter.ts`
- `ResearchTypes.ts`
- `ResearchContext.tsx`
- the API route `/api/ai/research-intelligence`
- the current wizard steps

Do not duplicate A1 logic inside React components.
Do not hard-code scientific answers.
Do not present AI assumptions as facts.

The UI must make visible:
- understanding;
- main concepts;
- proposed relationship;
- population/location when supported;
- confidence;
- points to confirm;
- human validation controls.

Use the existing engine/context architecture.

After implementation, test at least five subjects representing different research structures.
