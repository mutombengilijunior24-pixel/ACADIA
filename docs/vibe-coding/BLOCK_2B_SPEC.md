# ACADIA — BLOCK 2B SPEC
# Wizard behavior / navigation / validation

## Objective

After 2A looks good, make the wizard behavior reliable and safe.

## Requirements

- Every field updates `currentResearch` correctly.
- Going backward preserves values.
- Going forward preserves values.
- Refresh behavior is explicitly decided; do not assume persistence exists.
- Invalid required steps prevent inappropriate progression.
- Error messages are human-readable.
- The final step creates/builds the research project correctly.
- No duplicate projects are created accidentally.
- Reset starts a clean research.
- The live summary reflects changes immediately.

## Acceptance scenario

1. Start a new research.
2. Enter a complete research.
3. Go backward through at least 5 steps.
4. Change a value.
5. Go forward again.
6. Confirm the summary updates.
7. Finish the wizard.
8. Confirm the resulting project contains the same validated values.

Then repeat with missing fields and deliberately invalid values.
