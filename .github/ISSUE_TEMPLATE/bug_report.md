---
name: Bug report
about: Something in the pipeline produced a wrong result
title: "[bug] "
labels: bug
---

## What happened

<!-- One sentence. "The video looks wrong" cannot be acted on; "shot 7 draws the hand 40 px above the cup" can. -->

## The smallest story that reproduces it

```json
<!-- Paste the story JSON, or the few shots that fail -->
```

## The exact command

```bash
npx tsx scripts/studio.ts stories/<file>.json --tier draft
```

## The gate output

```
<!-- Full output, not a summary -->
```

## Environment

- OS:
- Node / Python:
- `npm run doctor` result (`PASS`/`WARN`/`FAIL` lines only):
- Language: en / bn
- Could you see the rendered frames? yes / no

## Anything else
