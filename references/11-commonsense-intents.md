# 11 — Commonsense intents: draw what the sentence implies

A viewer who hears "he is asleep in the other room" fills in a bed, a mattress, a pillow, a
blanket, a body on it, dim light and a different room. An agent reading the same sentence draws a
man on the floor next to a bed, in the same room as before, and every text gate passes.

This file is the human-readable half of `engine/data/intent-glossary.json`. The data is what
`qa_commonsense.ts` checks; this page is what you read before storyboarding. 61 intents, each with
a GOOD and a BAD rendering in the data.

> **Rule:** if a human would assume it, the film must show it; if a human would never draw it, the
> film must not contain it.

## The 14 categories

| Category | What it catches | Examples |
|---|---|---|
| **posture** | a body with no correct support | sits at desk, sits on sofa, lies in bed, stands by window, floor on purpose |
| **location** | a place word with no change of place | "the other room", kitchen, upstairs, at the door |
| **containment** | in/on/under/inside drawn as "near" | in the car, in the box, under the blanket, in the water |
| **held** | a prop floating beside a hand | holds a cup, carries a box, hands over money, pulls the rope |
| **in-use** | an object present but not used | typing, reading, phone call, cooking |
| **state** | a described state not drawn | door open, lights off, chair empty, machine broken |
| **time-weather** | a time or weather word with no grade | at night, raining, snowing, rain on the window |
| **motion** | a verb of movement drawn as standing | runs, walks away, stops at the red light, falls |
| **count-scale** | a number drawn as one | two friends, a crowd, a giant, three cups |
| **people** | two people who never interact | conversation, argument, hug, handshake |
| **emotion** | the emotion only in the narration | tired, angry, shocked, scared |
| **negation** | absence drawn as presence | no one home, empty chair, did not move, before/after |
| **cause** | effect without a visible cause | pressed the button, lights went out, flashback |
| **abstract** | an abstraction never drawn | imagine, chart, diagram, metaphor |

## Decision tables you will use most

### Place

| Sentence | Do | Do not |
|---|---|---|
| "in the kitchen" | `bg: "kitchen"`, counters behind | reuse the office background |
| "in the other room" | new `bg` + a transition that shows the move (`where.otherRoom` + `transitionPlan` in the spec) | same background, claim it is another room |
| "upstairs" / "in his room" | a private-room interior (bedroom / room_night) | the ground-floor scene unchanged |
| "at the door" | `door` prop in frame, actor beside it | gesturing at blank wall |

### Body

Always answer: **what holds this body up?** `floor`, `chair_seat`, `sofa_seat`, `bench_seat`,
`bed_mattress`, `bed_edge`, `ground`, `wall_lean`, `car_seat`, `ladder`, or `air` **with a reason**
(falling, flying, jumping). Blank support is an error in `spec_check`.

| Posture | Action | Contact the gate proves |
|---|---|---|
| sitting on chair/sofa/bench/car | `action: "sitOn"`, `on: <type>` | hip inside the seat surface, body in front of the backrest |
| lying / sleeping | `action: "lieOn"` / `"sleepOn"`, `on: "bed"` | body bottom on the mattress, head within the mattress span, head on the pillow |
| sitting on the edge of a bed | `action: "sitOn"`, `on: "bed"` | hip on the bed's near-edge seat anchor |
| standing at desk/table/counter | `action: "standAt"`, `on: <type>` | body beside the working surface |
| driving | `action: "sitOn"`, `on: "car"`, `inside: true` | body behind the car body, head above it |

### Held objects and interactions

| Sentence | Fields |
|---|---|
| holds a cup / box / letter / phone | `holding: "<type>"` on the actor **and** the prop at hand height (`y` ≈ 110–140) |
| hands something over | `action: "handOver"` on the giver, two actors `facing` each other |
| types | `pose: "type"` with `computer`/`laptop` at desk height |
| phone call | `pose: "phone"` with the `phone` prop |
| reads | `pose: "hold"` with `holding: "letter"` (or book/paper) |

### Time, weather, state

| Sentence | Fields |
|---|---|
| at night / midnight | `time: "night"` |
| raining (outdoors) | `fx: ["rain"]` and a darker grade |
| raining (indoors) | a `window` prop + `fx: ["rain"]`, never rain over the room |
| door opens | `door` with `"open": 1` |
| lights off | lamp/floorlamp with `"lit": 0` + `fx: ["darken"]` |
| empty chair | the chair visible, and **no** actor with `on: "chair"` |

### Negation, absence, contrast

| Sentence | Implementation |
|---|---|
| "no one was home" | `actors: []`, a lived-in detail (lamp on, door ajar) |
| "the chair was empty" | chair centred, no actor on it; spec `negations: [{ kind: "empty", target: "chair" }]` |
| "he did not move" | one actor, `pose: "stand"`, movement from the camera only |
| "before and after" | an `insert: "versus"` (or timeline/chart) — the contrast must be drawn |

## Ambiguity protocol

Choose the **most physically natural, most common human interpretation**, record it in the spec's
`note`, continue. Never the odd reading (sleeping on bare floor, sitting in mid-air, a cup floating
beside a hand) unless the prompt explicitly says so.

## Metaphors

A figure of speech will match a literal intent ("cool to cooking" → kitchen). Exempt it explicitly,
per shot, with a reason, in the story:

```json
{ "intentExempt": [{ "shot": 8, "id": "use-cooking", "reason": "metaphor: the phone heats up" }] }
```

The gate then prints `EXEMPT` as a warning naming your reason. It is never silent.

## Extending the glossary

Add an entry to `engine/data/intent-glossary.json`:

```json
{
  "id": "held-holds-bottle",
  "category": "held",
  "phrases": ["holds a bottle", "opens the bottle"],
  "requires": { "props": ["bottle"], "holding": "bottle" },
  "good": "the bottle in one hand at chest height, fingers around it",
  "bad": "a bottle on the table beside a character with empty hands"
}
```

Available requirement keys: `props`, `propsAny`, `bgAnyOf`, `bgNotAnyOf`, `actionAnyOf`,
`poseAnyOf`, `expressionAnyOf`, `timeAnyOf`, `fxAnyOf`, `transitionAnyOf`, `insertAnyOf`,
`holding`, `minActors`, `maxActors`, `minScale`, `propCount`, `propOpen`, `facingEachOther`,
`forbidProps`, `noActorOn`, `noActorOnAny`.

A phrase is matched on whole words, so keep entries specific ("holds a cup", not "cup").

## How this is enforced

| Command | Checks |
|---|---|
| `npx tsx scripts/qa_commonsense.ts <story>` | glossary (every matched phrase's picture) + the Scene Spec |
| `npx tsx scripts/spec_check.ts <story>` | the Scene Spec alone: supports, required props, relations, negations |
| `npx tsx scripts/qa_geometry.ts <story>` | the resolved scene: contact, sink/float, layering, occlusion, framing, facing |
| `npx tsx scripts/battery.ts` | all 61 micro-stories across the 14 categories, as a regression score |

Relations in a spec are numeric: `on`, `in`, `inside`, `under`, `behind`, `in_front_of`, `beside`,
`holding`, `facing`, `looking_at`, `touching`, `inside_room` are all tested against the resolved
scene. `wearing` and `part_of` are accepted but reported as visual-only — do not build a critical
claim on them.
