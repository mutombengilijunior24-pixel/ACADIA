# ACADIA — BLOCK 2A SPEC
# Wizard presentation / visual UX

## Objective

Make the research-creation wizard presentable as a real product without changing the scientific architecture.

## User-visible result

The user should immediately understand:

- what ACADIA is doing;
- what step they are on;
- what information is being requested;
- what has already been entered;
- what they should do next.

## Current flow

1. Welcome
2. Research title
3. Domain
4. Academic level
5. University
6. Research type
7. Problem
8. General objective
9. Specific objectives
10. Population
11. Population size
12. Location
13. Collection method
14. Analysis
15. Methodology summary

## 2A acceptance criteria

### Layout
- Clean main content area.
- Clear visual hierarchy.
- Comfortable spacing.
- Responsive desktop/tablet/mobile behavior.
- No accidental horizontal overflow.

### Progress
- Current step clearly visible.
- Progress percentage or equivalent is understandable.
- Progress does not visually dominate the content.

### Navigation
- Previous/next actions are visually distinct.
- Previous is disabled on the first step.
- Next is disabled or replaced by a completion action on the last step.
- Buttons have hover/focus/disabled states.

### Live summary
- Shows useful information already entered.
- Empty values are handled elegantly.
- Summary does not become unusably long.
- Summary remains useful on mobile.

### Step cards
- Consistent card/panel treatment.
- Consistent headings, helper text and fields.
- Long text remains readable.

### Accessibility basics
- Inputs have labels.
- Buttons have meaningful text.
- Focus states are visible.
- Contrast is readable.

### No scientific behavior changes
Block 2A must not alter:

- ResearchTypes contracts;
- A1/A2 logic;
- ResearchCore behavior;
- API contracts;
- questionnaire generation.

## Visual test

Run:

```bash
npm install
npm run build
npm run dev
```

Open:

`/dashboard/research/new`

Walk through all 15 steps.

Capture screenshots of:

1. Welcome
2. Title
3. A populated middle step
4. Objectives
5. Methodology summary
6. Mobile layout

Evaluate each screenshot on:

- clarity;
- hierarchy;
- spacing;
- consistency;
- perceived professionalism;
- ease of use.

## Important product rule

Do not add more fields just because they can be added. The wizard should feel guided, not bureaucratic.
