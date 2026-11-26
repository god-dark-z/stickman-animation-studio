# 14 — Model tiers: the same gates, different ambition

Three tiers. The **quality gates are identical in all three** — a `small` run that passes ships the
same verified MP4 as a `max` run. What changes is how much the agent attempts: beats, staging,
research depth, polish passes.

Pick your tier by probing yourself (step 0 of `SKILL.md`), not by which model name you are:

| Probe | Result | Tier |
|---|---|---|
| Can you read `references/13-format-library.md` and pick a non-default format with a defensible reason? | yes, and you can hold 4+ files of context | `max` |
| Can you follow a reference literally and fill the templates without improvising? | yes, but planning across many references is error-prone | `standard` |
| Do you lose details from long instructions, or produce malformed JSON on the first try? | yes | `small` |

Default when unsure: **`standard`**.

## What each tier does differently

| Dimension | `small` | `standard` | `max` |
|---|---|---|---|
| Format | **Explainer with mystery** only | any format that clearly fits | any, with a written reason for the choice |
| Hook | pick from the hook bank verbatim pattern | pick and adapt a pattern | may write a new pattern; must still be a fact, not a question |
| Research | 3–5 sources, essential claims only | 6–10 sources, every factual claim | 10+ sources, competing claims noted, dates cross-checked |
| Shot count (60 s) | 10–12 | 12–16 | 14–20 |
| Framing variety | 3 distinct framings minimum | 4 | 5, including one deliberate extreme close |
| Camera moves | `pushIn`, `cut` only | 4 distinct moves | all, chosen per beat |
| Beats / reaction | one beat per shot maximum | one or two | two or three, with anticipation |
| Inserts | 1 (the mechanism) | 1–2 | 2–3, one per explanatory beat |
| Scene Spec | fill the template for every shot | full spec + relations | full spec + relations + negations + world states |
| Self-check | run the gates, fix errors | gates + WARN review | gates + WARN review + watch the stills contact sheet yourself |
| Repair rounds | stop at 1 (deliver with notes) | up to 2 | up to 3 |
| Deliverable notes | gates run + limits | same + voice reason | same + what you would improve |

## Rules that do **not** change by tier

- Every gate in `SKILL.md` runs, in order. No tier skips a gate.
- No AI imagery, no paid APIs, no API keys.
- One production language per video.
- English is the default; Bangla only on an explicit request.
- The fact-check table exists even if it has three rows.
- You never claim a check you did not run.

## How to declare the tier

State it in one line of your working notes and in the delivery report:

```
tier: standard (probe: follows references literally, planning across 4 files is reliable)
```

If the agent's scaffolding supports a tier flag, pass `--tier draft|standard|studio` to the
orchestrator, which controls render quality. **That flag is separate from the model tier**: a
`small` model still produces a `standard`-tier render. Do not downgrade the render to compensate
for a weaker model — downgrade the *ambition*, not the output.

## Failure modes per tier (and the fix)

| Tier | Typical failure | Fix |
|---|---|---|
| `small` | invents a fact to make the story flow | cut the sentence; a shorter true video beats a longer false one |
| `small` | every shot is the same medium framing | use the framing ladder explicitly: write the framing list before the JSON |
| `small` | malformed story JSON | build it from `stories/tests/science-explainer.json` as a template, edit one field at a time |
| `standard` | chooses a format it cannot fill with facts | fall back to the explainer format; the format serves the material |
| `standard` | skips the Scene Spec because the JSON "looks fine" | the spec is what the gates check; write it first, always |
| `max` | over-stages and breaks sync (props the sentence never mentions) | the sync gate is the authority, not your ambition — cut props |
| `max` | too many inserts, feels like a slideshow | ≤ 1 insert per 8–10 shots |
