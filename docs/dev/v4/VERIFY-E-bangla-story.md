# VERIFY-E — Bangla story-making, script craft and the sync contract

## 1. Bangla script-craft reference

`references/12-bangla-voice-and-script.md` — register rules (চলিত, one address level), the measured
word budgets (120/165/205 words for 45/60/75 s), the six-beat structure executed in Bangla, number
and loanword guidance, the **22 good/bad sentence pairs** (brief asked 20), cultural-context rules,
the voice catalog with direction, and the on-screen Bangla rules.

## 2. The language-neutral meaning layer

Every spoken Bangla shot carries `say` (Bangla) and `gloss` (plain English). The Scene Spec, claim
checks and relation checks run on the gloss and the spec fields.

### The sync lexicon

`engine/lang/bn/sync-lexicon.json` — **66 canonical claims**, each with Bangla and English cues
(`rain`, `bed`, `sit`, `sleep`, `other-room`, `empty`, `signal`, `heat`, `years-later`, …). One id
space for both languages is what makes the comparison possible.

### The gloss-faithfulness gate

`npx tsx scripts/qa_gloss.ts stories/<file>.json` — wired into the `bangla` orchestrator stage
(`qa_bangla.py --with-gloss`).

```
$ npx tsx scripts/qa_gloss.ts stories/tests/bangla-dialogue-two.json
bangla-dialogue-two.json: 3 shots, 3 glossed — 0 gloss error(s)
PASS — every Bangla claim is in the gloss, and the gloss invents nothing.
```

Negative test (Bangla says rain, gloss drops it):

```
ERROR shot  1 [GLOSS-DRIFT] the Bangla says "বৃষ্টি" (claim `rain`) but the gloss never says it —
      the picture would be validated against a weaker meaning.
```

Three real bugs the gate found in the lexicon during development, all fixed by tightening cues
rather than weakening the check:

| False positive | Cause | Fix |
|---|---|---|
| `closed` from "বন্ধু" (friend) | substring "বন্ধ" (closed) | whole-word matching for cues ≤4–5 Bangla chars |
| `cup` from "চা" (tea, the drink) | tea ≠ cup | removed `চা`; the cue is `কাপ` |
| `market` from "চায়ের দোকান" (tea stall) | `দোকান` is any shop | removed the bare cue; `বাজার` only |

The gate also caught a **real story error**: Maya's line said "সকালে" (in the morning) while the
shot was graded `sunset`. The commonsense gate reported it and the line was rewritten. That is
exactly the class of narration↔picture contradiction this layer exists for.

### Bangla intent glossary

`engine/lang/bn/intent-glossary.json` — **108 entries across all 14 categories** (brief asked
100+), each with idiomatic Bangla phrases and a GOOD/BAD picture. It shares the English glossary's
`requires` vocabulary, so one checker serves both languages, and it includes the idioms the brief
names:

- `অন্য ঘরে ঘুমিয়ে আছে` → bed + body on the mattress + a transition that shows the change,
- `চেয়ারে বসে আছে` → chair + `sitOn` (the seat is occupied),
- `জানালার পাশে দাঁড়িয়ে` → a visible window + standing body,
- `বৃষ্টি পড়ছে` → rain fx and wet ground, never rain indoors.

**Two engine fixes were required to make this work at all:**

1. **The phrase normalizer deleted Bangla.** `norm()` used `[^a-z0-9' ]`, so every Bangla
   character became a space and no Bangla phrase could ever match. It is now
   `[^\p{L}\p{N}\p{M}' ]` — and the `\p{M}` (marks) part is essential: Bangla vowel signs are
   combining marks, so `চেয়ারে` was becoming `চ য র`.
2. **The glossary was English-only.** `matches()` and `coverage()` now take a language and load the
   Bangla entries on demand; `qa_commonsense.ts` passes the story's `lang`.

## 3. Bangla commonsense battery

`engine/lang/bn/commonsense-battery.json` — **49 micro-stories across all 14 categories**
(brief asked 40+), each with a Bangla sentence, its English gloss, what a human expects to see, a
storyboard plan and a machine-checkable expectation.

```
$ npx tsx scripts/battery.ts --lang bn
48/49 → 49/49 after the fixes below

$ npx tsx scripts/battery.ts --lang all
110/110 micro-stories drawn as a human would picture them
```

Per category (all 100 %):

| category | pass | | category | pass |
|---|---|---|---|---|
| abstract | 7/7 | | motion | 8/8 |
| cause | 7/7 | | negation | 8/8 |
| containment | 7/7 | | people | 8/8 |
| count-scale | 7/7 | | posture | 9/9 |
| emotion | 7/7 | | state | 10/10 |
| held | 7/7 | | time-weather | 10/10 |
| in-use | 7/7 | | location | 8/8 |

Full report: `docs/dev/v4/battery-report.md`.

### Bugs the Bangla battery found (all real, all fixed at the cause)

| Failure | Real cause | Fix |
|---|---|---|
| `পড়ছে` matched "reading" in "বৃষ্টি পড়ছে" (rain *falling*) | the bare verb is ambiguous in Bangla | the reading entry now requires a reading object (`বই পড়ছে`, `কাগজ পড়ছে`, …) |
| invalid backgrounds `room`, `village`, `plains` | my data used names that are not in the catalog | mapped to `livingroom`, `village_dawn`, `field` |
| `fx: "wind"`, `fx: "impact"` | those are **SFX** names, not FX ids | real ids (`rain`, `lightning`, `debris`, `shake`, `dust`, `fog`) |
| "no actor uses face / none" | `none` is filtered out of the actions list, so it can never satisfy a requirement | dropped the `none` requirement; the pose carries the meaning |
| `count-three` demanded 3 chairs | it hard-coded a prop type | new `propCountAnyMin` requirement: three of *something* or three people |
| cooking without food on screen | the entry declared a pot but not a plate | data fixed; the requirement was right |

## 4. English did not regress

```
$ npx tsx scripts/battery.ts --lang en            → 61/61
$ npx tsx scripts/qa_commonsense.ts why-phone…    → 0 errors, 1 warning, coverage 24%
$ npx tsx scripts/qa_geometry.ts why-phone…       → 0 errors, 0 warnings
$ npx tsx scripts/qa_sync.ts why-phone…           → PASS
$ npm test                                        → 99 passed
$ npx tsc --noEmit                                → clean
```

Identical to the Phase A baseline.

## 5. What is not proven

- The Bangla intents were written by me from how these sentences are actually used, not harvested
  from a labelled corpus. They are data: `doctor` and the battery re-run on every change, and a
  wrong interpretation shows up as a battery failure, not a silent miss.
- The Bangla battery checks single shots (same as English). Multi-shot continuity is checked by
  `qa_sync` + the spec's `where.otherRoom`/`transitionPlan`, not by rendering every entry.
- Cross-model pass rates are still not measurable in this environment (BLOCKERS B4-2).