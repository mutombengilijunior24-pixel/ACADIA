# ACADIA — Browser Test Protocol

## Start

```bash
npm install
npm run build
npm run dev
```

## Main route

`/dashboard/research/new`

## Visual QA screenshots

Capture:

- Welcome
- Subject
- Domain/level
- Problem/objective
- Objectives
- Population/location
- Methodology summary
- Mobile view

## Functional QA

Record:

- step reached;
- value entered;
- value preserved after back/next;
- visible errors;
- summary update;
- final project result.

## Scientific QA

For A1, test:

1. Influence
2. Impact
3. Relationship
4. Descriptive
5. Determinants

For each case record:

- research focus;
- concepts;
- relationship;
- population;
- location;
- confidence;
- points to confirm.

## Decision labels

🟢 Accept — correct and usable.

🟡 Adjust — usable but needs UX/scientific refinement.

🔴 Block — wrong, broken, misleading or unsafe.

Never move to the next block while a critical red issue remains.
