# Verify — the commonsense layer (Phase 3.0 / 3.5 / 3b)

All commands from `engine/`, Windows 11, Node v24.19.0.

## 1. The battery: 61 micro-stories, 14 categories

```
$ npx tsx scripts/battery.ts
61/61 micro-stories drawn as a human would picture them
report: out/battery/report.md
```

Per category (from `out/battery/report.md`):

| category | pass | rate |
|---|---|---|
| posture | 5/5 | 100% |
| location | 4/4 | 100% |
| containment | 4/4 | 100% |
| held | 4/4 | 100% |
| in-use | 4/4 | 100% |
| state | 5/5 | 100% |
| time-weather | 4/4 | 100% |
| motion | 5/5 | 100% |
| count-scale | 4/4 | 100% |
| people | 5/5 | 100% |
| emotion | 4/4 | 100% |
| negation | 5/5 | 100% |
| cause | 4/4 | 100% |
| abstract | 4/4 | 100% |

Every entry is checked three ways at once: the geometry gate on the resolved shot, the glossary for
every phrase the sentence matches, and the entry's own written expectation.

**Two real defects were found and fixed while building this suite** (see §3).

## 2. Scene Spec: the Director's Brief

```
$ npx tsx scripts/spec_check.ts stories/tests/chair-office.json
Chair Test Office: 4 shot spec(s), 4 shot(s) — 0 error(s), 0 warning(s)
PASS — every body has a support and every stated relation holds in the resolved scene.

$ npx tsx scripts/spec_check.ts stories/tests/bed-sleep.json
Bed Test Sleep: 4 shot spec(s), 4 shot(s) — 0 error(s), 0 warning(s)
PASS — every body has a support and every stated relation holds in the resolved scene.
```

The bed spec caught a genuine mismatch on first run:

```
ERROR shot  4 [RELATION] man facing window is false: "man" faces front, `window` is right
Bed Test Sleep: 4 shot spec(s), 4 shot(s) — 1 error(s), 0 warning(s)
FAIL — the brief still leaves a human assumption unstated or contradicted.
```

The narration says "stands and stretches by the window" but the actor was drawn facing the camera.
Fixed by setting `"facing": "right"` in that shot — the spec disagreed with the storyboard and the
storyboard was wrong, which is the whole point of the stage.

## 3. Defects this layer found in the existing repo

| Found by | Defect | Fix |
|---|---|---|
| glossary on the demo | `use-cooking` matched the **metaphor** "his phone goes from cool to cooking" and demanded a kitchen | phrase tightened to literal cooking forms; added a reasoned `intentExempt` mechanism for genuine metaphors |
| spec on the chair fixture | narration says "walks to the window" but the shot had **no window prop** | window added to that shot |
| spec on the bed fixture | narration says "by the window", no window prop and the actor faced the camera | window added, `facing: "right"` |
| battery `negation-02` | "the seat was empty" was checked as *chair* only, so a bench failed | `noActorOnAny` — a seat is chair, bench, stool or couch |
| battery `negation-05` | "the chair sat empty in the crowd" had 2 actors; a crowd is not two people | fixture fixed to 5 actors; the gate was right |
| `qa_geometry` | **any** non-`none` action demanded an `on` prop, so `react`/`hold`/`handOver` were errors | only placement actions (`sitOn`, `lieOn`, `sleepOn`, `standAt`) resolve anchors |

## 4. Glossary over every shipped story

```
chair-office.json     4 shots  0 commonsense error(s)  0 warning(s)  coverage 47%
bed-sleep.json        4 shots  0 commonsense error(s)  0 warning(s)  coverage 69%
chart-daynight.json   3 shots  0 commonsense error(s)  1 warning(s)  coverage 36%
dialogue-two.json     4 shots  0 commonsense error(s)  1 warning(s)  coverage 31%
drive-travel.json     3 shots  0 commonsense error(s)  1 warning(s)  coverage 47%
edge-short.json       1 shots  0 commonsense error(s)  1 warning(s)  coverage  0%
history-dialogue.json 3 shots  0 commonsense error(s)  1 warning(s)  coverage 17%
kitchen-cook.json     4 shots  0 commonsense error(s)  1 warning(s)  coverage 44%
science-explainer.json 4 shots 0 commonsense error(s)  1 warning(s)  coverage 38%
```

The single warning on the stories without a spec is `NO-SPEC` ("write the Scene Spec"). Coverage
is reported, not enforced, by default: it is the share of narration content words the glossary can
speak to, and it is deliberately low on dialogue-heavy stories. Pass `--min-coverage 40` to enforce
it for explainer scripts.

## 5. Unit tests

```
$ npm test
  ok  the glossary accepts a body actually lying in the bed
  ok  the glossary rejects 'asleep' with no bed in the shot
  ok  the relation graph proves 'on bed' only for a body that resolves onto the mattress
  ok  the spec rejects a chair support the shot never places
  ok  a reasoned intent exemption is accepted by the schema and keeps its reason

27 passed
```

## 6. What is NOT proven

- **Cross-model pass rates** (largest / mid / smallest model) were not measured. This environment
  has one model. The battery measures what the *engine and skill* can draw, not what a given model
  writes; the model-side measurement needs the `evals/` harness run with each model's API, which is
  a paid API and therefore out of scope for this repository's rules. Recorded in `BLOCKERS.md`.
- The battery checks single shots. Multi-shot continuity, transitions and the "other room" cut are
  checked by the spec (`where.otherRoom` + `transitionPlan`) and by `qa_sync`, not by rendering.
- Stills for the 61 battery entries were **not** rendered. They are gate-checked only (schema,
  geometry on the resolved scene, glossary, written expectation). The two rendered fixtures
  (`chair-office`, `bed-sleep`) cover `posture-01` and `location-01` and were inspected by eye.
