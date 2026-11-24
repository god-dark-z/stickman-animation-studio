# Scene Spec — the Director's Brief (fill this in before storyboarding)

One block per shot. Copy it, fill every field, save beside the story as
`stories/<slug>.spec.json` (or `stories/<name>.spec.json` next to `stories/tests/<name>.json`).

A human reading "he is asleep in the other room" silently supplies a bed, a mattress, a pillow,
a blanket, a different room and dim light. This form makes you write those down, so the engine can
build them and `spec_check` can disagree with you before a frame is rendered.

**Rule:** if a human would assume it, write it here; if a human would never draw it, do not draw it.

```json
{
  "title": "Why Does Your Phone Get Hot When Signal Is Weak?",
  "shots": [
    {
      "shot": 1,
      "where": {
        "bg": "bedroom",
        "otherRoom": false,
        "transitionPlan": "",
        "note": "night, his own room"
      },
      "who": [
        { "id": "sam", "support": "bed_mattress", "at": "center", "posture": "lying" }
      ],
      "props": [
        { "type": "bed", "role": "required" },
        { "type": "phone", "role": "used" }
      ],
      "relations": [
        { "subject": "sam", "relation": "on", "object": "bed" },
        { "subject": "sam", "relation": "holding", "object": "phone" }
      ],
      "world": { "time": "night", "weather": "clear", "states": ["lights off", "phone screen on"] },
      "emotion": "annoyed, half awake",
      "cameraPurpose": "show a phone in bed at night, the screen lighting his face",
      "negations": []
    }
  ]
}
```

## Field by field

| Field | What to write | Example |
|---|---|---|
| `shot` | 1-based index into `story.shots` | `3` |
| `where.bg` | the 2D background id for this shot | `"kitchen"` |
| `where.location` | 3D location name, if the shot uses one | `"desert"` |
| `where.otherRoom` | `true` only when the sentence changes place | `true` |
| `where.transitionPlan` | **required** when `otherRoom`: how the film shows the change | `"cut on the closing door, new bg in the next shot"` |
| `who[].id` | actor id from `story.cast` — every actor on screen must appear | `"worker"` |
| `who[].support` | what holds the body up: `floor`, `chair_seat`, `sofa_seat`, `bench_seat`, `bed_mattress`, `ground`, `wall_lean`, `car_seat`, `ladder`, `air` | `"chair_seat"` |
| `who[].whyAir` | only for `support: "air"` | `"falling off the ladder"` |
| `who[].at` | `left`, `center`, `right` | `"right"` |
| `props[].role` | `required` (the sentence implies it), `used` (an actor touches it), `background` (set dressing) | `"required"` |
| `relations` | `subject` (actor id or prop type) + `relation` + `object`; checked numerically | `{ "subject": "sam", "relation": "on", "object": "bed" }` |
| `world.time` | `day`, `sunset`, `night`, `dawn` | `"night"` |
| `world.weather` | `clear`, `rain`, `snow`, `fog`, `wind`, `heat` | `"rain"` |
| `world.states` | short notes on door/lamp/screen/empty/full state | `["door open", "lamp off"]` |
| `emotion` | what the face and body must communicate | `"exhausted but relieved"` |
| `cameraPurpose` | what the viewer must notice in one second | `"the empty chair, centred"` |
| `negations[]` | `{ "kind": "empty", "target": "chair" }`, `absent`, `noOne`, `noMotion` | empty chair |

## Relation vocabulary

`on` · `in` · `inside` · `under` · `behind` · `in_front_of` · `beside` · `holding` · `wearing` ·
`facing` · `looking_at` · `touching` · `inside_room` · `part_of`

Every relation except `wearing` and `part_of` is tested numerically against the resolved scene.
Those two are accepted but reported as visual-only — do not rely on them for a claim that matters.

## Self-check before you run anything

1. For **every actor**: what supports the body? (If you cannot answer, the film will draw them on the floor.)
2. For **every object the sentence names**: is it in `props` and visible?
3. For **every place word**: does the background change, and does the cut show it?
4. For **every relation you wrote**: would a stranger see it in one frame?
5. Is **anyone on screen the sentence did not put there**? Remove them or justify them in `note`.
6. Could a viewer with **the sound off** understand this shot? If not, the picture is doing less
   than the narration.

## Ambiguity protocol

When the sentence can be read two ways, choose the **most physically natural, most common human
interpretation**, write it in `note`, and continue. Never choose the odd reading (sleeping on bare
floor, sitting in mid-air, a cup floating beside a hand) unless the prompt says so.

## Metaphors

A figure of speech will trip the glossary (`"his phone goes from cool to cooking"` matches the
kitchen intent). Do not weaken the gate — exempt that one intent, in that one shot, with a reason:

```json
{ "intentExempt": [{ "shot": 8, "id": "use-cooking", "reason": "metaphor: the phone heats up" }] }
```
