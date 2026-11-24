# Verify — Phase 3 (visuals provably match the narration)

All commands run from `engine/` on Windows 11, Node v24.19.0.

## 1. Unit tests (22, including the two regressions)

```
> stickman-studio-engine@3.0.0 test
> tsx scripts/test.ts

  ok  tokenize keeps English words
  ... (14 existing tests) ...
  ok  sitOn puts the hip joint on the chair seat
  ok  sitting feet stay within a foot of the floor (no dangle, no sink)
  ok  sleepOn rests the body on the mattress with the head on the pillow
  ok  a lying body is horizontal: head and feet share a height
  ok  the geometry gate flags a seated pose that never touched the chair
  ok  the geometry gate passes the anchored chair story
  ok  an action without a prop anchor is an error, not a silent guess
  ok  inside=true puts a driver behind the car body

22 passed
```

The fourth of the new tests is the important one: it asserts that `pose: "sit"` with a chair on
screen and **no** semantic action produces a `MISSING-ACTION` ERROR. That is the exact class of
shot the old gates passed.

## 2. Geometry gate across the whole story suite

```
$ for f in stories/tests/*.json stories/why-phone-gets-hot.json; do npx tsx scripts/qa_geometry.ts "$f"; done

bed-sleep.json            0 errors, 1 warning   (close-up crops the mattress — expected)
chair-office.json         0 errors, 0 warnings
chart-daynight.json       0 errors, 0 warnings
dialogue-two.json         0 errors, 0 warnings
drive-travel.json         0 errors, 1 warning   (close-up crops the car seat)
edge-short.json           0 errors, 0 warnings
history-dialogue.json     0 errors, 0 warnings
kitchen-cook.json         0 errors, 0 warnings
science-explainer.json    0 errors, 0 warnings
why-phone-gets-hot.json   0 errors, 0 warnings   (23 shots, after the shot-21 fix)
```

## 3. The demo's sleeping shot — before / after

Before, the shot declared `"pose": "lie"` with a bed somewhere in the background set:

```json
"actors": [{ "id": "sam", "x": 0.3, "z": 0.4, "pose": "lie", "expression": "sleepy" }]
```

`qa_sync` reported **0 errors** for this shot, because the word "sleeping" matched the token `lie`
in the JSON. The still showed the character lying flat on the floorboards while the bed stood
empty next to him — `out/why-does-your-phone-get-hot-when-signal-is-weak/stills/shot21.png`
(regenerate with the pre-fix story to see it).

After:

```json
"actors": [{ "id": "sam", "action": "sleepOn", "on": "bed", "expression": "sleepy", "underBlanket": true }],
"props": [{ "type": "bed", "x": 0.25, "z": 0.12 }, { "type": "phone", ... }]
```

The still now shows the body on the mattress, head on the pillow, blanket drawn over the torso, and
the geometry gate confirms body-bottom == mattress-top within 1 px.

## 4. Stills inspected by eye (the check that matters)

| Still | What I looked for | Result |
|---|---|---|
| `out/chair-test-office/stills/shot00.png` | body on the chair, chair visible, both legs down | **seated on a visible red chair**, backrest behind the torso, feet on the floor |
| `.../shot02.png` | same, medium framing | **seated**, chair back + seat visible |
| `out/bed-test-sleep/stills/shot00.png` | body in the bed, head on pillow, under blanket | **in bed**, head on the white pillow, blanket over the body |
| `out/why-…/stills/shot21.png` | same for the demo | **in bed** (was: on the floor) |
| `out/edge-test-very-short/stills/shot00.png` | void shot renders at all | correct, plain void |

Two composition defects were found *by looking* and then fixed in the fixtures:

- `shot00` originally had a monitor at a nearer z covering the entire character → added the
  `FACE-OCCLUDED` check and restaged the desk to the side.
- `underBlanket` drew the blanket below the body, so the sleeper looked like he was on top of the
  covers → blanket edge moved to `mattress_top - 40·scale`, and the body is now covered to the chin.

## 5. What the geometry gate does **not** prove

- It does not prove the acting reads well, only that contact/layering/framing are legal.
- It does not run for 3D locations: anchor actions are rejected there with `ANCHOR-3D` rather than
  silently misplacing a body (see `BLOCKERS.md`).
- Anchor tables are hand-measured from `Props.tsx`. If a prop's drawing changes, its anchors must
  change with it; the unit tests only cover chair/bed/car.
