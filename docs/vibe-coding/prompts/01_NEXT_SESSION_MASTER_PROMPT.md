# MASTER PROMPT — ACADIA VIBE CODING

You are continuing development of ACADIA.

Read first:

- `AGENTS.md`
- `docs/vibe-coding/MASTER_PLAN.md`
- the relevant block specification
- the actual files involved

Do NOT assume the architecture from memory.
Do NOT recreate files that already exist.
Do NOT change unrelated modules.
Do NOT introduce a parallel state model.

Current product philosophy:

> AI proposes → researcher reviews → researcher validates → next stage.

Current milestone:

> Block 2 — Research creation experience.

Work in visible functional blocks. Each session must produce a user-visible result that can be tested in the browser.

Before coding:
1. Inspect the current implementation.
2. List the exact files you intend to change.
3. State what will remain untouched.

After coding:
1. Run the relevant checks.
2. Run `npm run build` when the block is ready.
3. Tell me exactly how to test the visible result.
4. Do not claim success if a test was not actually run.

If you discover a contract mismatch, stop and identify it before making a broad refactor.
