---
name: stickman-animation-studio
description: |
  Produce a complete professional stickman cartoon video from one prompt (a topic, a title,
  "explain why X", or a TXT file with a video concept), in English (default) or in Bangla / Bengali
  (বাংলা) when the user asks for it ("in Bangla", "বাংলায় বানাও", "bangla te banao", "Bangla
  narration / voice / voiceover"). Covers the full pipeline: capability probing, language
  resolution, research and fact-checking, script and voice direction, a narration-to-visual
  synchronized storyboard (validated by an executable sync gate), programmatic 2D/3D animation
  with the bundled Remotion engine, narration + captions + procedural music and sound effects,
  stills QA, audio QA, final render and verification. Use whenever the user asks to
  make/create/generate a video, short, cartoon, or animated explainer — especially with the
  /make-video command. Model- and agent-agnostic. No AI image generation, no AI video generation,
  no paid APIs: every frame and every sound is produced by code.
---

# Stickman Animation Studio — /make-video

Turn one prompt into a finished, studio-quality vertical cartoon (1080×1920, 30 fps,
H.264 + AAC) using nothing but code. You write the story, storyboard it with an explicit
narration-to-visual sync contract, run the bundled engine through its QA gates, and hand back the
verified MP4 with its sources.

**Operate autonomously.** No confirmation questions, no progress narration, no stopping halfway.
If a step is blocked, treat it as a routing problem: try the next tool, the next asset, or build
it yourself. Only stop when the video is rendered, verified, and delivered.

**Production language: English by default, Bangla on request.** Narration, dialogue, on-screen
text, captions, labels, and insert copy are all in the video's single production language. Never
mix languages inside one video. English direction: `references/10-english-voice-direction.md`;
Bangla direction: `references/12-bangla-voice-and-script.md`.

## 0.1 Resolve the language before anything else

Language is a **mechanical decision**, not a judgement call. Run the resolver on the user's exact
words; it is unit-tested (59 cases) and knows English, Bangla script and Banglish phrasings,
negations, and topic false positives.

```bash
npx tsx scripts/resolve_language.ts --text "<the user's exact request>" --json
# → { lang: "en" | "bn", voice_pref: "auto"|"male"|"female"|<voice-id>, evidence: [...], note? }
```

Rules it enforces (do not re-implement them by hand):

- `en` is the default. `bn` only on an explicit request.
- `--lang en|bn` beats any wording; a negation ("not in Bangla", "English only", "ইংরেজিতে")
  forces `en`.
- A topic that merely mentions Bangla — "a story about Bangla literature", "the Bengal tiger",
  "the language movement" — stays `en`.
- If the topic itself is Bangla script with no language request, the resolver keeps `en` and adds
  a `note`; print that one line in the final report.
- If it returns a note or all of the request is Bangla script with a directive verb ("বাংলায়
  বলো"), the `lang` decides everything downstream: voice, normalizer, fonts, captions, inserts.

Then pass it through **flags, not edits**: `--lang <id>` `--voice auto|male|female|<voice-id>` on
`studio.ts` / `make.ts`. The story JSON records it as `"lang": "bn"` so the run is reproducible.
Voice choice (when `voice_pref` is `auto`) is Phase-D logic: `scripts/choose_voice.ts` scores the
topic and writes `stories/<slug>/voice-decision.md` — never pick a voice silently.

## 0.2 Probe your capabilities, then adapt

Before producing, inspect what THIS agent/model can actually do, and adapt the workflow. Do not
assume; check. One minute here saves a broken render later.

| Probe | How | If missing → adaptation |
|---|---|---|
| Shell + file access | run `node --version` | No shell at all → this skill cannot render; fall back to `install/PASTE-THIS-PROMPT.md` handoff to a coding agent |
| Web research | a web-search tool available? | No search → write from internal knowledge, mark every claim "unverified" in `fact-check.md`, prefer evergreen physics/history topics |
| Vision on images | can you read image files? | No vision → rely on `qa_geometry.ts` (contact/framing), `qa_commonsense.ts` (intent + spec), `qa_stills.py` and say so in the delivery report |
| Background execution | can you run long commands in the background? | No → run renders in the foreground and use `--preview` first; budget for several minutes |
| Context budget | very large context? | Tight context → read only the `references/` files the current stage names, one at a time; keep the story JSON as the single source of truth |
| Reasoning depth | strong model → push craft further: richer staging, more beats, deeper research | Weaker model → follow the reference defaults literally; they are calibrated to produce good results without improvisation |

Whatever the environment, the quality gates (steps 4, 5, 7) are **not optional** — a weaker
workflow must still pass the same executable checks.

## 0.4 The Director's Brief — write what a human would picture, first

Every sentence quietly implies a picture. "He is asleep in the other room" means a bed, a
mattress, a pillow, a blanket, a body lying on it, dim light, and a *different room* — not a man
on the floor beside a bed. Before you write one line of story JSON, write one **Scene Spec block
per shot** using `templates/scene-spec.md`. It is a form, not an essay: where, who, what supports
each body, which props the sentence implies, which relations hold, the world state, the emotion,
what the camera must make unmissable, and what must be absent.

**The rule for the whole film:** if a human would assume it, the film must show it; if a human
would never draw it, the film must not contain it.

Then the engine argues with you:

```bash
npx tsx scripts/qa_commonsense.ts stories/<slug>.json   # glossary + spec
npx tsx scripts/spec_check.ts stories/<slug>.json       # spec only
```

### Decision table — the assumptions agents get wrong

| If the sentence says… | Then the shot must have | Never |
|---|---|---|
| sits at a desk / on a sofa / on a chair | that furniture declared + `action: "sitOn"` + `on` | a body at floor level beside an empty chair |
| sleeps / lies in bed | `action: "sleepOn"`/`"lieOn"` on a declared `bed`, `underBlanket: true` | a body on the floor, bed as decoration |
| stands by the window | the `window` prop in frame, the actor turned toward it | a windowless wall |
| holds a cup / box / letter | `holding` on the actor + the prop at hand height | a prop floating beside the palm |
| is in the other room / upstairs | a **different** `bg`/`location`, plus a transition that shows the change | the same background reused |
| it is raining | `fx: ["rain"]` outdoors, or a `window` with rain on it indoors | rain falling inside a room |
| at night | `time: "night"` | a daylight grade |
| two people / a crowd / a giant | 2 / 4+ actors, or `scale` ≥ 1.6 | one figure described as many |
| they talk / argue / shake hands | two actors facing each other, only the speaker's mouth moving | both facing camera |
| no one was home / the chair was empty | no actors, or the empty prop framed and unoccupied | a character standing in the "empty" room |
| imagine / the chart / a diagram | an `insert` that draws the abstraction | a talking head over "the numbers" |

Full intent table (61 intents, every phrase with a GOOD and a BAD rendering):
`references/11-commonsense-intents.md`. It is checked automatically — a matching phrase whose
picture is missing is an **ERROR**, not a suggestion.

### Self-check before storyboarding (answer all six)

1. For **every actor**: what holds the body up? (floor, chair seat, mattress, ground, wall, car seat)
2. For **every object the sentence names**: is it in `props` and visible?
3. For **every place word**: does the background change, and does the cut show it?
4. Is **anyone on screen the sentence did not put there**?
5. Does **every relation** you wrote survive a stranger looking at one frame?
6. **Sound off**: could a viewer still understand the shot?

### Ambiguity and metaphors

When a sentence can be read two ways, take the **most physically natural, most common human
interpretation**, write it in the spec's `note`, continue. Never choose the odd reading unless the
prompt says so.

A figure of speech can trip the glossary ("his phone goes from cool to cooking" matches the
kitchen intent). Do **not** weaken the gate — exempt that intent in that shot, with a reason:

```json
"intentExempt": [{ "shot": 8, "id": "use-cooking", "reason": "metaphor: the phone heats up" }]
```

## 0.5 Use the orchestrator, not eight commands

The pipeline is a state machine. Call it once; it runs every stage, refuses to advance when
a gate fails, and tells you the exact command to resume.

```bash
npx tsx scripts/studio.ts <story.json|slug> --tier draft        # fast half-size pass
npx tsx scripts/studio.ts <story.json> --tier standard          # 1080x1920 delivery
npx tsx scripts/studio.ts <story.json> --tier studio            # highest bitrate
npx tsx scripts/studio.ts <story.json> --from geometry --resume  # continue after a fix
```

State is written to `stories/<slug>/.state.json`, the full log to `out/<slug>/run.log`.
Stages: `validate → narration → timeline → sync → geometry → commonsense → stills → pixels →
timing → render → video → audio → visual`. `--no-tts` skips narration/timing/audio and renders silent.

Before the first run on a new machine: `npm run doctor` (prints PASS/WARN/FAIL and the fix
for each). Do not render until it is green or you understand every WARN.

## 0.5 Resolve the engine

The engine is a self-contained Remotion project. Find it in this order:

1. A directory in the current project whose `package.json` is named `stickman-studio-engine` — use it.
2. The `engine/` folder that ships next to this file — copy it into the workspace
   (`cp -r <skill-dir>/engine ./engine`) and run `npm install` inside it (first time only).
3. If neither exists, the skill was installed without its engine — clone the skill repository
   and take `engine/` from there.

One-time setup inside the engine directory:

```bash
npm install                      # Remotion + three + zod
pip install edge-tts imageio-ffmpeg numpy scipy pillow   # narration + procedural audio + QA
```

The 65 SFX, 6 music beds and film grain are generated procedurally on first render (no downloads,
no licenses, no third-party audio). Narration needs internet for edge-tts (free, no key);
`--no-tts` works fully offline for staging work. Voices come from the language pack
(`engine/lang/en/pack.json`, `engine/lang/bn/pack.json`) — English direction in
`references/10-english-voice-direction.md`, Bangla in `references/12-bangla-voice-and-script.md`.

## 1. Research the topic (English)

- Input is a topic, a title, or a path to a TXT file (read it if given).
- Research with web search before writing. Build a fact-check table (claim | what the source says
  | source URL) for **every** factual claim you will narrate → `stories/<slug>/fact-check.md`.
- If something is only rumored or folklore, either drop it or mark it in-narration ("legend has it…").
- Prefer the weirdest *true* detail over a smoother invented one.

## 2. Write the script + choose the voice

Measured speech rate on the reference machine (edge-tts, `+22%`, `en-US-AndrewMultilingualNeural`):
**≈3.8–4.0 words per second of audio**, so **190–210 words ≈ 50–57 s**. Do not estimate from a
fixed 60–75 s: the real duration comes from the synthesized audio. Slower presets (`+6…10%`)
read at ≈3.2–3.4 w/s; `AriaNeural @ +12%` ≈3.6 w/s.

Structure (follow it exactly):

1. **Line 1: paradox hook stated as plain fact.** No greetings, no "Did you know".
2. **Setup and stakes** — hero, place, want.
3. **Escalation + a short quoted line where someone mocks the hero.**
4. **Turning point / rhetorical question.**
5. **"You see," + the mechanism**, with an everyday analogy and an insert graphic.
6. **Twist on the last line.** End hard.

Full craft rules: `references/04-script-craft.md`. Save the script to `stories/<slug>/script.md`.

Then **direct the voice** before rendering: pick provider/voice/rate for the genre from
`references/10-english-voice-direction.md` (default: `en-US-AndrewMultilingualNeural` @ `+22%`;
calm documentary reads slower). Test the hook line with a quick synthesis if unsure.

## 3. Check and build assets

- List what the story needs: places, standing objects, held items.
- Check what exists: `npx tsx scripts/locations.ts --list`. Reuse before building; never make a
  near-duplicate; name assets for what they are.
- Build missing assets **before storyboarding** — recipes in `references/08-extending-assets.md`
  (3D location / 3D object / 2D prop / 2D background / outfit).
- Verify new 3D assets with `npx tsx scripts/locations.ts --stills --only=<name>`.

## 4. Storyboard WITH a sync contract (the sync gate)

Write `stories/<kebab-title>.json`. Schema + ids: `references/09-schema-reference.md`,
`engine/src/catalog.ts`. Craft rules: `references/05-storyboard-craft.md`.

**Say WHAT happens; let the engine decide WHERE the body goes.** Use the semantic action layer
first — it is what keeps quality independent of the agent writing the JSON:

```json
{ "id": "worker", "action": "sitOn", "on": "chair", "facing": "right" }
```

The engine looks up the chair's `seat` anchor, puts the hip joint on it, chooses the pose,
draws the body in front of the chair back and reports the contact to the geometry gate. You do
not write `x`, `z`, `pose` or a `y` lift for this.

| action | needs a prop with | example |
|---|---|---|
| `sitOn` | `seat` anchor | chair, stool, bench, couch, bed edge, car |
| `lieOn` / `sleepOn` | `mattress` anchor | bed, hospital bed |
| `standAt` | `top` anchor | desk, table, counter |

Hand-written `x`/`z`/`pose` still work (advanced override) but the geometry gate will flag a
`pose: "sit"` that is drawn at floor level next to a chair.

**Declare the prop you interact with in that shot's `props`.** If the background already has
the same furniture at the same x/z, the shot's declaration replaces it (no double bed).

**Narration-to-visual synchronization is mandatory and machine-checked.** Every narration segment
(a shot's `say`) must visibly show what it says: right place, right time of day, the described
action as a pose/beat/prop, mentioned objects on screen, quoted lines bound to a `quote` actor,
and continuity across shots. Word-level timing inside a shot is bound with `beats` (`at` = a
spoken word).

Run the executable gate and iterate to zero errors:

```bash
npx tsx scripts/qa_sync.ts stories/<file>.json            # place/time/action/object/dialogue/continuity checks
npx tsx scripts/qa_sync.ts stories/<file>.json --map      # print the shot-by-shot sync contract table
npx tsx scripts/qa_geometry.ts stories/<file>.json        # the scene-graph gate (see below)
```

- All ERRORs must be fixed (change the shot's world/time/pose/props, or rephrase the narration).
- Review every WARN; either fix it or record why it is acceptable in `stories/<slug>/sync-map.md`
  (generate the table with `--map`; template: `templates/sync-map.md`).
- A story-specific lexicon (idioms, invented nouns) goes in `stories/<slug>/sync-lexicon.json` —
  see the template.

## 4.5 Geometry gate — does the picture actually contain the claim?

The sync gate reads text. This one reads the scene graph: contact (hip inside the seat, body on
the mattress, head on the pillow), no sinking/floating, character-vs-prop scale, draw order,
face occlusion by props drawn in front, framing, facing in dialogue, and seated→standing
continuity. It runs the **same placement code as the renderer**, so a pass means the drawn
scene really touches the surface.

```bash
npx tsx scripts/qa_geometry.ts stories/<file>.json
```

Every ERROR names the shot and the fix. Typical repairs: add the semantic action, declare the
prop in that shot, move a desk/monitor aside in x, or widen the framing.

## 5. Stills gate (never skip)

```bash
npm run make -- stories/<file>.json --stills        # one QA still per shot → out/<slug>/stills/
python scripts/qa_stills.py out/<slug>/stills       # exposure/dead-frame gate (exit 1 on fail)
python scripts/qa_visual_report.py stories/<file>.json out/<slug>/stills
```

The last command writes `out/<slug>/contact-sheet.png` and `out/<slug>/visual-review.md`: a
per-shot checklist of what the narration claims, next to what the scene declares and the offline
CV measurements.

- **If you can see images:** open the contact sheet, compare each still to its claim column, and
  write `PASS` or `FAIL` in the verdict column. Re-running the script reads your verdicts and
exits 1 on any FAIL.
- **If you cannot see images:** rely on `qa_geometry` plus the CV numbers, and say
  "visual QA was geometric only" in the delivery report. Never claim you looked at a frame you
  did not look at.

Fix and re-run until clean. **Never render video before this gate passes.**

## 6. Render

```bash
npm run make -- stories/<file>.json            # full quality → out/<slug>/<slug>.mp4
npm run make -- stories/<file>.json --preview  # half-size draft first when unsure
```

Run in the background when possible; do not start unrelated heavy jobs concurrently. Narration is
cached per slug and re-synthesizes only when script/voice/rate change.

## 7. Verify (ffprobe + frames + audio gate)

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -of csv=p=0 out/<slug>/<slug>.mp4
ffmpeg -i out/<slug>/<slug>.mp4 -vf fps=1/5 qa_%03d.jpg     # pull frames across the video
python scripts/qa_audio.py out/<slug>/<slug>.mp4            # loudness/clipping/voice-presence gate
```

- Specs: 1080×1920 (540×960 for `--preview`), 30 fps, h264 + aac; duration ≈ narration + 0.6 s.
- Frames: first/middle/last not black; captions legible; no stuck shot.
- Audio gate must PASS: −14 LUFS ±1.5, true peak ≤ −1.0 dBTP, voice energy present.

## 8. Repair loop, then deliver

Loop stages 4→7 until every gate passes. Budget: up to **3 repair rounds per gate**; if a gate
still fails after that, deliver with an explicit note about what remains (never silently ship a
known failure, never stop without a delivery).

Deliver as a set: the MP4, `script.md`, `fact-check.md`, `sync-map.md`, the story JSON, any new
library assets, and honest limits (verified fact vs. dramatized; which gates ran and how they
were checked).

## Quality bar (non-negotiable)

- **Sync:** the visuals show exactly what the narration communicates — zero contradictions, zero
  dead shots. When narration and animation would tell two different stories, rewrite the storyboard.
- **Expressive characters:** reactions on beats, poses that read in silhouette, one consistent
  light source per scene; idle life (breathing/blink/walk) is automatic — intentional motion on top.
- **Cinematography:** framing ladder per scene, camera variety (the sync gate flags ≥3 identical
  framing+camera shots in a row), one clear visual purpose per shot.
- **Sound never fights the voice:** ducking is automatic; manual `sfx` only for specific moments;
  the audio gate enforces loudness and no clipping.
- **No repetition, no slop:** vary framings, transitions and reactions; ≤ 2 fx per shot; ≤ 1
  insert per 8–10 shots.
- **No AI-generated images or video, no image-generation services, no paid APIs. Ever.**
- **One language per video** — English (default) or Bangla (on request): narration, dialogue,
  on-screen text, captions, labels all follow the resolved `lang`.

## Deep reference material (read per stage, not all at once)

| File | Read it for |
|---|---|
| `references/01-animation-principles.md` | motion, easing, anticipation, secondary action — as the engine implements them |
| `references/02-character-system.md` | the stickman rig: proportions, builds, poses, faces, consistency |
| `references/03-scenes-camera-light.md` | parallax layers, framing, camera moves, lighting, locked palettes |
| `references/04-script-craft.md` | script structure, hooks, analogies, word budgets |
| `references/05-storyboard-craft.md` | shot grammar, beats, transitions, the sync contract |
| `references/06-sound-design.md` | ducking, auto-SFX map, music moods, comfort rules, audio gates |
| `references/07-rendering-qa.md` | all QA gates, pixel checks, ffprobe, repair loops |
| `references/08-extending-assets.md` | recipes: 3D location/object, 2D prop/background, outfit, sfx |
| `references/09-schema-reference.md` | every story JSON field, with defaults and constraints |
| `references/10-english-voice-direction.md` | the English voice catalog, direction, pacing, offline fallback |
