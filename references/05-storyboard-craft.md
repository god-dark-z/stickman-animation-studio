# 05 — Storyboard craft (story JSON)

One JSON file drives everything. Schema: `09-schema-reference.md`; ids: `engine/src/catalog.ts`.

## Timing model (memorize this)

- Shots are **timed by speech**: a shot starts 2 frames before its first word is spoken. There are
  no manual durations.
- Shot `say` slices must concatenate (in order) to the full script. The engine validates cast and
  props, and aligns TTS word timestamps to slices; a mismatch shows up as a dead shot — check the
  printed per-shot durations after the make step.
- `say: "…"` = a fully silent shot, held ≥ 2 s (use for a beat of dread or an environment breathe).
- Warnings printed by `make`: shot < 0.8 s → merge; shot > 6 s → split.

## Shot grammar

- Change the shot every 1–3 sentences; the default shot is 1 sentence.
- Framing ladder per scene: `wide` (establish) → `full`/`medium` (action) → `close`/`extreme`
  (reaction/punchline). Reset to `wide` when the location changes.
- Camera: default `pushIn`. `panLeft/Right` to reveal. `pullOut` after a crashZoom. `drift` for
  deadpan. `crashZoom` for punchlines only. `orbit` in 3D locations for grandeur.
- Two consecutive shots: never identical framing + camera.

## Reactions and beats

```jsonc
"beats": [
  { "at": "screams", "actor": "sam", "expression": "furious", "fx": "exclaim", "zoom": 1.15 },
  { "at": "help", "actor": "farmer", "pose": "facepalm", "sfx": "thud" }
]
```

- `at` = a word in this shot's `say` (or seconds). The rig blends pose over 7 frames.
- Best pairs: keyword of the line ↔ the reaction it causes. Reactions on the *listener* are
  cheaper and funnier than on the speaker.
- One to three beats per shot; more becomes noise.

## Inserts = the explanation beat

| type | carries |
|---|---|
| document | rules, notices, lists (highlight a line) |
| phone | chat messages, notifications |
| chart | numbers over time (`data[]`, `highlight` a bar) |
| counter | a number counting up/down (`from`, `value`, prefix/suffix) |
| bigtext | a single shouted word |
| versus | two-side comparison |
| map | journey with waypoints |
| timeline | dated events |
| list | checklist with animated ticks |

- `bg: "void"` + insert only = clean graphic shot (blurs the scene behind otherwise).
- Inserts auto-play their own SFX and reveal animation. One insert per shot.

## Transitions

`dissolve` (default, every other one gets a soft whoosh) · `cut` (same scene, momentum) ·
`flash` (impact/punchline) · `iris` ("meanwhile", flashback) · `whip` (fast location jump) ·
`zoom` (into an insert). Each has an auto-SFX; don't stack manual SFX on transitions.

## Staging numbers

- One actor: x 0.4–0.55. Two: 0.35/0.68, second `facing: "left"`. Groups: `wide`/`full` only.
- `z`: heroes 0.45–0.55; background extras 0.1–0.25 with lower `scale`.
- Focus: default first actor. `focus: "prop:N"` for object stories.
- `enter: pop` for comedy, `drop` for arrivals-from-above, `left/right` walks (auto slide SFX),
  `fade` for serious. Exits mirror.
- `moveTo` walks with a real walk cycle and auto-facing; the camera frames the midpoint, so keep
  moves inside ±0.25 x.
- Props: `enter: drop` + `count` for piles; `float` for magic; `glow` for lamps/screens (auto light).
- `quote: "<actorId>"` flaps that actor's mouth during the quoted line — set it on every quoted shot.

## Restraint checklist (the AI-slop killer)

- [ ] ≤ 2 fx per shot; fx repeat with meaning, not decoration
- [ ] No more than 1 insert per 8–10 shots
- [ ] Music mood changes only at real story turns (it's per-video — choose once, well)
- [ ] Every character speaks/narrates consistently; narrator never talks *as* the cast
- [ ] Night scenes use the locked-palette pattern (see `03`), not ad-hoc tints
- [ ] No ≥3 consecutive shots with identical framing+camera (the sync gate flags this)

## The sync contract (V2, mandatory)

The storyboard IS the narration-to-visual synchronization contract, and it is machine-checked:

```bash
npx tsx scripts/qa_sync.ts stories/<file>.json        # → 0 errors required
npx tsx scripts/qa_sync.ts stories/<file>.json --map  # → shot-by-shot contract table
```

What the gate enforces per shot: narrated places match the shot's world; narrated time-of-day
matches `time`; narrated actions appear as pose/beat/prop; narrated key objects are on screen;
quoted lines have a `quote` actor; continuity holds across shots (time jumps, prop persistence,
actor teleports) and shot grammar doesn't repeat. Negations are understood ("doesn't run" flags
nothing). Idioms and story-specific nouns go in `stories/<slug>/sync-lexicon.json`; accepted
WARNs are recorded in `stories/<slug>/sync-map.md` (template: `templates/sync-map.md`).

Timing inside a shot is bound to words: `beats[].at` = a word of that shot's `say` (or seconds).
If the narration describes an action that happens mid-line, put the beat on that exact word —
the engine resolves it to the spoken frame.

---

## The semantic action layer (write this first)

You describe **what happens**. The engine decides **where the body is drawn**, which surface it
touches and how it is layered — and then proves it with `qa_geometry.ts`.

```json
{ "id": "worker", "action": "sitOn", "on": "chair", "facing": "right", "expression": "bored" }
```

| action | prop needs | resolves to |
|---|---|---|
| `sitOn` | `seat` anchor | hip joint on the seat surface, body in front of the backrest, feet on/near the floor |
| `lieOn` | `mattress` anchor | body flat on the mattress, head on the pillow when one exists |
| `sleepOn` | `mattress` anchor | as `lieOn`; pair with `underBlanket: true` |
| `standAt` | `top` anchor | body beside the desk/table/counter |
| `hold` / `use` / `face` / `pointAt` / `react` / `handOver` | — | acting only; placement stays as authored |

Rules that keep you out of the gate's error list:

1. **Declare the prop you interact with in that shot's `props`.** If the background already has the
   same furniture at the same x/z, your declaration *replaces* it — you will not get two beds.
2. **Do not compute `x`/`z`/`y` for an interaction shot.** `action` overrides them. Writing
   `pose: "sit"` with a chair on screen is an error on purpose: that is the shot that draws the
   body at floor level.
3. **Leave room for the prop.** A desk or monitor at a *nearer* z can cover the face; the gate
   reports `FACE-OCCLUDED`. Move big props to one side in x, or send them behind.
4. **Framing matters.** A `close` shot crops the seat. Establish the contact in `full`/`medium`,
   then move in — that is ordinary shot grammar, and the gate only warns about it.
5. **Anchor actions are 2D only.** In a 3D `location` the gate raises `ANCHOR-3D`; use a 2D `bg`.

What stays hand-authored: staging of non-interaction shots, camera choice, beats, expressions,
props that are not touched, and `x`/`z` when you deliberately want a mark. The semantic layer
removes the coordinates you would otherwise get wrong.
