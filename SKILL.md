---
name: stickman-animation-studio
description: |
  Produce a complete professional English-narrated stickman cartoon video from one prompt (a
  topic, a title, "explain why X", or a TXT file with a video concept). Covers the full pipeline:
  capability probing, research and fact-checking, English script and voice direction, a
  narration-to-visual synchronized storyboard (validated by an executable sync gate), programmatic
  2D/3D animation with the bundled Remotion engine, narration + captions + procedural music and
  sound effects, stills QA, audio QA, final render and verification. Use whenever the user asks to
  make/create/generate a video, short, cartoon, or animated explainer — especially with the
  /make-video command. Model- and agent-agnostic. No AI image generation, no AI video generation,
  no paid APIs: every frame and every sound is produced by code.
---

# Stickman Animation Studio — /make-video

Turn one prompt into a finished, studio-quality English vertical cartoon (1080×1920, 30 fps,
H.264 + AAC) using nothing but code. You write the story, storyboard it with an explicit
narration-to-visual sync contract, run the bundled engine through its QA gates, and hand back the
verified MP4 with its sources.

**Operate autonomously.** No confirmation questions, no progress narration, no stopping halfway.
If a step is blocked, treat it as a routing problem: try the next tool, the next asset, or build
it yourself. Only stop when the video is rendered, verified, and delivered.

**Production language is English — exclusively.** Narration, dialogue, on-screen text, captions,
labels, and insert copy are all English. The narration must sound like professional documentary,
educational, or animated storytelling (`references/10-english-voice-direction.md`).

## 0. Probe your capabilities, then adapt

Before producing, inspect what THIS agent/model can actually do, and adapt the workflow. Do not
assume; check. One minute here saves a broken render later.

| Probe | How | If missing → adaptation |
|---|---|---|
| Shell + file access | run `node --version` | No shell at all → this skill cannot render; fall back to `install/PASTE-THIS-PROMPT.md` handoff to a coding agent |
| Web research | a web-search tool available? | No search → write from internal knowledge, mark every claim "unverified" in `fact-check.md`, prefer evergreen physics/history topics |
| Vision on images | can you read image files? | No vision → rely on `engine/scripts/qa_stills.py` + `engine/scripts/qa_sync.ts` pixel/lexicon gates and say so in the delivery report |
| Background execution | can you run long commands in the background? | No → run renders in the foreground and use `--preview` first; budget for several minutes |
| Context budget | very large context? | Tight context → read only the `references/` files the current stage names, one at a time; keep the story JSON as the single source of truth |
| Reasoning depth | strong model → push craft further: richer staging, more beats, deeper research | Weaker model → follow the reference defaults literally; they are calibrated to produce good results without improvisation |

Whatever the environment, the quality gates (steps 4, 5, 7) are **not optional** — a weaker
workflow must still pass the same executable checks.

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
`--no-tts` works fully offline for staging work. English voices only — see
`references/10-english-voice-direction.md` for the voice catalog and direction rules.

## 1. Research the topic (English)

- Input is a topic, a title, or a path to a TXT file (read it if given).
- Research with web search before writing. Build a fact-check table (claim | what the source says
  | source URL) for **every** factual claim you will narrate → `stories/<slug>/fact-check.md`.
- If something is only rumored or folklore, either drop it or mark it in-narration ("legend has it…").
- Prefer the weirdest *true* detail over a smoother invented one.

## 2. Write the script + choose the voice

Aim for **190–210 words ≈ 60–75 s**. Structure (follow it exactly):

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

**Narration-to-visual synchronization is mandatory and machine-checked.** Every narration segment
(a shot's `say`) must visibly show what it says: right place, right time of day, the described
action as a pose/beat/prop, mentioned objects on screen, quoted lines bound to a `quote` actor,
and continuity across shots. Word-level timing inside a shot is bound with `beats` (`at` = a
spoken word).

Run the executable gate and iterate to zero errors:

```bash
npx tsx scripts/qa_sync.ts stories/<file>.json            # place/time/action/object/dialogue/continuity checks
npx tsx scripts/qa_sync.ts stories/<file>.json --map      # print the shot-by-shot sync contract table
```

- All ERRORs must be fixed (change the shot's world/time/pose/props, or rephrase the narration).
- Review every WARN; either fix it or record why it is acceptable in `stories/<slug>/sync-map.md`
  (generate the table with `--map`; template: `templates/sync-map.md`).
- A story-specific lexicon (idioms, invented nouns) goes in `stories/<slug>/sync-lexicon.json` —
  see the template.

## 5. Stills gate (never skip)

```bash
npm run make -- stories/<file>.json --stills        # one QA still per shot → out/<slug>/stills/
python scripts/qa_stills.py out/<slug>/stills       # exposure/dead-frame gate (exit 1 on fail)
```

Then inspect every still for framing, faces, floating props, readability, consistency — with your
own vision if you have it, else `agentvision check <file>` per still plus the pixel gate above.
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
- **English only** — narration, dialogue, on-screen text, captions.

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
