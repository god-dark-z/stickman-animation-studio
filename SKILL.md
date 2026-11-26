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

# Stickman Animation Studio — the director's manual

One prompt becomes a verified vertical cartoon (1080×1920, 30 fps, H.264 + AAC). You write the
story, storyboard it with an explicit narration-to-visual contract, and drive the bundled engine
through every gate. The engine draws, speaks, scores and measures; **you decide what the film is
about and what each shot proves.**

Read this file in one pass. Then read only the reference for the stage you are in — the table at
the end names them.

---

## 0. Hard rules (apply to every run, no exceptions)

1. **No AI imagery.** No image generation, no video generation, no stock footage, no paid APIs, no
   API keys. Every frame and every sound is code. Free edge-tts narration is the one accepted
   network dependency.
2. **One language per video.** `en` (default) or `bn` (only on an explicit request). Narration,
   dialogue, captions, labels, inserts — all of it in that language. Never mix.
3. **English does not regress.** `en` behaviour, numbers and defaults are frozen by tests.
4. **Gates are not optional.** Every `ERROR` is fixed at the cause. Never weaken a gate, never
   exempt an intent without a written reason.
5. **Never claim a check you did not run.** If you could not see an image, say "visual QA was
   geometric only". If you skipped a stage, name it and why.
6. **Runs on a CPU-only 16 GB machine.** No GPU, no Blender, no browser extension.
7. **Deliver even when imperfect.** After the repair budget, ship with an explicit note about what
   remains. Never ship a silent known failure; never stop without a video.

## 1. Probe yourself, then choose a tier

Before anything else, answer these honestly. The answers pick your **model tier**
(`references/14-model-tiers.md`); the gates are identical in every tier.

| Probe | How | If missing → adapt |
|---|---|---|
| Shell + files | `node --version` | no shell → hand off via `install/PASTE-THIS-PROMPT.md` |
| Web search | is a search tool available? | no search → write from knowledge, mark every claim unverified in `fact-check.md`, prefer evergreen topics |
| Vision on images | can you open an image file? | no vision → rely on `qa_geometry`, `qa_stills.py` and say "geometric only" in the report |
| Background execution | can you run long commands async? | no → render `--tier draft` first, then the final in the foreground |
| Context budget | how many files can you hold? | tight → read one reference per stage, keep the story JSON as the single source of truth |

Tier in one line, in your working notes and the final report:
`tier: standard (probe: follows references literally; planning across 4 files is reliable)`.

## 2. The pipeline (13 stages, one command)

```bash
npx tsx scripts/studio.ts <story.json|slug> \
  --tier draft|standard|studio \
  [--lang en|bn] [--voice auto|male|female|<voice-id>] \
  [--no-tts] [--resume] [--from <stage>]
```

Stages run in this order and **stop at the first failure**, printing the exact command to resume:

| # | Stage | Proves |
|---|---|---|
| 1 | `validate` | schema, props, cast, voices exist in the pack |
| 2 | `bangla` | one script, every spoken shot glossed, Bangla claims == gloss claims (skipped for en) |
| 3 | `glyphs` | every on-screen character has a glyph in the bundled font (skipped for en) |
| 4 | `narration` | audio + per-word timings (skipped with `--no-tts`) |
| 5 | `timeline` | shots resolve, words align, beats land on spoken words |
| 6 | `sync` | narration ↔ visual contract (place, time, action, objects, dialogue, continuity) |
| 7 | `geometry` | the picture actually contains the claim (contact, layering, framing, scale) |
| 8 | `commonsense` | the Scene Spec + intent glossary: what a human pictures |
| 9 | `stills` | one still per shot rendered |
| 10 | `pixels` | exposure / dead-frame / blank gates |
| 11 | `timing` | word timings are real speech, inside the audit limits |
| 12 | `render` → `video` | the MP4 exists and is inside spec |
| 13 | `audio` → `visual` | loudness/peak/voice-presence; per-shot review file |

State: `stories/<slug>/.state.json`. Full log: `out/<slug>/run.log`.

**Before the first run on a machine:** `npm run doctor` → PASS/WARN/FAIL with a fix per line.
Do not render until it is green or you have read and accepted every WARN.

---

## 3. Stage direction

### Stage 0 — Resolve the language (mechanical, never a judgement call)

```bash
npx tsx scripts/resolve_language.ts --text "<the user's exact request>" --json
# → { lang, voice_pref, evidence[], note? }
```

- `en` is the default. `bn` only on an explicit request.
- `--lang` beats any wording; a negation ("not in Bangla", "English only", "ইংরেজিতে") forces en.
- A topic that merely *mentions* Bangla ("a story about Bangla literature", "the Bengal tiger")
  stays English. The resolver is unit-tested on exactly these (59 cases).
- If it returns a `note`, print that line in the final report.

**Self-check:** did I pass the user's words verbatim, or my paraphrase? Verbatim.

### Stage 1 — Research and fact-check

- Input is a topic, a title, or a TXT concept file (read the file if given).
- Research before writing. Build `stories/<slug>/fact-check.md`: **claim | what the source says |
  URL**. One row per factual claim you will narrate.
- Prefer the weirdest **true** detail over a smoother invented one. If something is legend, say so
  in-narration ("legend has it…") or cut it.
- Bangla videos: research in any language, narrate in Bangla, and write each claim in both English
  and Bangla in the fact-check table.

**Quality bar:** every number, date, name and causal claim has a source, or is marked unverified.
**Common mistake:** researching to fill 60 seconds. Research to find the one fact that makes the
video worth watching; the length follows.

### Stage 2 — Story concept and format

Choose a format from `references/13-format-library.md` by what the material supports. Ten formats
are documented with beat structure, shot grammar, endings and worked examples in English and
Bangla.

Default when nothing clearly fits: **explainer with mystery**.

Before writing shots, record in `script.md`:

```
format: explainer with mystery
arc: curiosity → understanding
hook pattern: observable oddity
first three seconds: <what is on screen while the hook line plays>
ending move: protective irony
```

**Self-check:** would two of my last three videos share the same format, hook pattern and ending
move? If yes, change three of the five axes (format, hook, opening framing, insert type, ending).

### Stage 3 — Write the script

Word budget **from the language pack**, never from habit:

| Length | English | Bangla |
|---|---|---|
| 45 s | 150 words | 120 words |
| 60 s | 200 words | 165 words |
| 75 s | 250 words | 205 words |

(Bangla reads 2.75 words/s at `+22 %`; English 3.9. Measured, not estimated.)

English craft: `references/04-script-craft.md`. Bangla craft — register, address level, loanwords,
22 good/bad sentence pairs: `references/12-bangla-voice-and-script.md`.

Rules that apply to both:

- **Line 1 is a fact, not a greeting.** No "Did you know", "In this video", "আজ আমরা জানব".
- Short sentences. One idea each. The mechanism sentence is the calmest and slowest line.
- Numbers written the way they are spoken; the Bangla normalizer converts digits, currency and
  years automatically (৪০% → চল্লিশ শতাংশ, ১৯৯০ → উনিশশো নব্বই).
- Quotes ≤ 12 words so the mouth animation reads.
- The twist is the last line. End hard; no moral, no sign-off.

Save `stories/<slug>/script.md`. For Bangla, a two-column table: Bangla line | English gloss.

### Stage 4 — Choose and direct the voice

If the user named a voice, use it. Otherwise:

```bash
npx tsx scripts/choose_voice.ts --text "<topic>" --lang <en|bn> --write stories/<slug>/voice-decision.md
```

It scores tone and genre from the topic, records the reason and the breakdown, and writes the
decision file. Precedence: user preference → first-person narrator match → genre score → pack
default. **Read the reason line** — if it looks wrong for the material, override with
`--voice male|female|<id>` and say why in the report.

Dialogue: give each character their own `voice`/`voiceRate` in the cast. Two speakers on the same
voice at the same rate are rejected (they sound like one person talking to themselves). The engine
builds one multi-voice track and every downstream stage reads it unchanged.

**Quality bar:** hook line synthesized and listened to (or measured) before committing the voice.

### Stage 5 — Check assets

```bash
npx tsx scripts/locations.ts --list
```

Reuse before building. Never make a near-duplicate. Missing asset → build it **before**
storyboarding (`references/08-extending-assets.md`), and verify 3D with
`locations.ts --stills --only=<name>`.

Bangla stories: check the setting is culturally plausible (tea stall, rickshaw, village house,
bazaar, rain on a window). Never force it — a phone-overheating story is a phone story.

### Stage 6 — The Scene Spec (write this before the shot JSON)

One block per shot using `templates/scene-spec.md`. It is a form, not an essay: where, who, what
holds each body up, which props the sentence implies, which relations hold, world state, emotion,
what the camera must make unmissable, and what must be absent.

**The rule for the whole film:** if a human would assume it, the film must show it; if a human would
never draw it, the film must not contain it.

For Bangla, write the spec **from the gloss**, not from the Bangla text — the gloss is the meaning
layer the checks read.

The assumptions agents get wrong (each is a gate ERROR):

| If the sentence says… | The shot must have | Never |
|---|---|---|
| sits at a desk / on a sofa / on a chair | the furniture declared + `action: "sitOn"` + `on` | a body at floor level beside an empty chair |
| sleeps / lies in bed | `action: "sleepOn"` / `"lieOn"` on a declared `bed`, `underBlanket: true` | a body on the floor, bed as decoration |
| stands by the window | the `window` prop in frame, actor turned toward it | a windowless wall |
| holds a cup / box / letter | `holding` on the actor + the prop visible | a prop floating beside the palm |
| is in the other room / upstairs | a **different** `bg`/`location` + a transition that shows the change | the same background reused |
| it is raining | `fx: ["rain"]` outdoors, or a `window` with rain on it indoors | rain falling inside a room |
| at night / at sunset | `time: "night"` / `"sunset"` | a daylight grade |
| two people / a crowd / a giant | 2 / 4+ actors, or `scale` ≥ 1.6 | one figure described as many |
| they talk / argue | two actors facing each other, only the speaker's mouth moving | both facing camera |
| no one was home / the chair was empty | no actors, or the empty prop framed and unoccupied | a character standing in the "empty" room |
| imagine / the chart / a diagram | an `insert` that draws the abstraction | a talking head over "the numbers" |

### Stage 7 — Storyboard

Write `stories/<title>.json`. Schema: `references/09-schema-reference.md`; ids:
`engine/src/catalog.ts`; shot grammar: `references/05-storyboard-craft.md`.

**Say what happens; let the engine place the body.** Use the semantic action layer:

```json
{ "id": "worker", "action": "sitOn", "on": "chair", "facing": "right" }
```

`on` resolves to the **nearest** prop of that type to the actor, so two people on "chair" get two
chairs. Hand-written `x`/`z`/`pose` still work and the geometry gate flags a `sit` drawn at floor
level.

Every shot's `say` must visibly show what it says, and word-level beats bind with `at: "<a spoken
word>"`.

```bash
npx tsx scripts/qa_sync.ts  stories/<file>.json            # contract
npx tsx scripts/qa_sync.ts  stories/<file>.json --map      # the shot-by-shot table
npx tsx scripts/qa_geometry.ts stories/<file>.json         # scene graph
npx tsx scripts/qa_commonsense.ts stories/<file>.json      # spec + intents
```

Zero ERRORs. Every WARN either fixed or explained in `stories/<slug>/sync-map.md`.

**Bangla shots** also carry `"gloss": "<the meaning in plain English>"`:

```json
{ "say": "ছেলেটি অন্য ঘরে বিঘ্নায় ঘুমিয়ে আছে।", "gloss": "The boy is asleep in bed in the other room." }
```

### Stage 8 — Stills, and actually look

```bash
npm run make -- stories/<file>.json --stills
python scripts/qa_stills.py out/<slug>/stills
python scripts/qa_visual_report.py stories/<file>.json out/<slug>/stills
```

This writes `out/<slug>/contact-sheet.png` and `visual-review.md` — per shot, what the narration
claims next to what the scene declares and the offline CV numbers.

- **If you can see images:** open the contact sheet, compare each still to its claim, write PASS or
  FAIL in the verdict column. Re-running the script reads your verdicts and exits 1 on any FAIL.
- **If you cannot:** use `qa_geometry` + the CV numbers and write "visual QA was geometric only" in
  the delivery report.

**Never render video before this gate passes.**

### Stage 9 — Render and verify

```bash
npm run make -- stories/<file>.json            # full quality
npm run make -- stories/<file>.json --preview  # half-size draft first
```

Then verify the file, not the intention:

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -of csv=p=0 out/<slug>/<slug>.mp4
ffmpeg -i out/<slug>/<slug>.mp4 -vf fps=1/5 qa_%03d.jpg
python scripts/qa_audio.py out/<slug>/<slug>.mp4
```

Specs: 1080×1920, 30 fps, h264 + aac, duration ≈ narration + 0.6 s. Audio: −14 LUFS ±1.5, true peak
≤ −1.0 dBTP, voice present.

### Stage 10 — Repair, then deliver

Loop stages 6→9. Budget: **3 rounds per gate**. Still failing after that → deliver with an explicit
note about what remains.

Deliver as a set: the MP4, `script.md`, `fact-check.md`, `sync-map.md`, `voice-decision.md` (when
the pipeline chose), the story JSON, any new assets, and honest limits (verified vs dramatised;
which gates ran; how visual QA was done).

---

## 4. Failure playbook

| Symptom | Cause | Fix |
|---|---|---|
| `sync` ERROR: object/place/action missing | the shot does not draw what the sentence says | change the shot's world/props/action, or rephrase the narration. Never exempt unless it is a metaphor, and then write the reason |
| `geometry` ERROR: contact | body drawn at floor level, or on the wrong prop | use `action` + `on`; declare the prop in that shot |
| `geometry` WARN: two bodies overlap | both actors took the same prop | expected for `on: "chair"` with two chairs — check the chairs exist; the engine picks the nearest |
| `commonsense` ERROR: intent | the phrase implies a picture that is missing | the error prints GOOD and BAD — fix props/action/time/bg |
| `bangla` ERROR: gloss drift | the English gloss says something the Bangla does not (or less) | rewrite the gloss to match the meaning exactly |
| `bangla` ERROR: mostly Latin | an English line in a Bangla story | write the line in Bangla |
| `glyphs` ERROR: U+XXXX | a character no bundled font has | replace the character, or add a Bengali font (see THIRD_PARTY.md) |
| `timing` FAIL | estimated timings used, or words misaligned | delete `out/<slug>/narration.key` and re-render to force real synthesis |
| `pixels` FAIL | black/blank/near-uniform still | check that shot's bg/location/lighting; a dark grade needs a light source |
| `audio` FAIL: loudness | manual audio, or a silent render | the pipeline loudnorms automatically — do not hand-edit audio |
| narration fails: `WSServerHandshakeError 403` / `NoAudioReceived` | the TTS endpoint rate-limits | the engine retries with backoff and falls back to another same-gender voice; if all fail, wait a minute and re-run |
| render OOM / very slow | concurrency too high for free RAM | `--concurrency 2`; the engine already caps by free RAM |
| captions show boxes | missing glyph in the bundled font | `npm run doctor` → `bangla fonts`; `python scripts/fetch_fonts.py` |

## 5. Quality bar (the bar, not a wish list)

- **Sync:** the picture shows exactly what the narration says — zero contradictions, zero dead shots.
- **Characters:** one rig per character, consistent across shots; reactions land on the spoken word;
  idle life (breathing, blink, walk) is automatic, intentional motion on top.
- **Camera:** a framing ladder per scene; no three consecutive shots with the same framing+camera
  (the sync gate flags it); one visual purpose per shot.
- **Sound:** the voice is always the loudest thing; ducking is automatic; manual `sfx` only for
  specific moments.
- **Restraint:** ≤ 2 fx per shot, ≤ 1 insert per 8–10 shots, no repeated shot shapes.
- **Language:** one script on screen; Bangla never letter-spaced or uppercased.
- **Honesty:** the delivery report lists what ran, what passed, and what you could not check.

## 6. If you are a particular agent

`docs/agents/` has a playbook per product: Claude Code, Google Antigravity, ZCode, Codex CLI,
OpenCode, Cursor, Gemini CLI, GitHub Copilot, Windsurf, Aider, and chat-only agents. Each states
where instructions/skills live, what the product can parallelise, and how to use that for speed
(parallel research, parallel stills, background renders, vision for the stills review).

Read the one that matches you, then follow this manual unchanged. The playbook changes how you run
the work, never what the work must prove.

## 7. Reference map (read per stage, not all at once)

| File | Read it for |
|---|---|
| `references/01-animation-principles.md` | motion, easing, anticipation, secondary action — as the engine implements them |
| `references/02-character-system.md` | the rig: proportions, builds, poses, faces, consistency |
| `references/03-scenes-camera-light.md` | parallax, framing, camera moves, lighting, locked palettes |
| `references/04-script-craft.md` | English script structure, hooks, analogies, budgets |
| `references/05-storyboard-craft.md` | shot grammar, beats, transitions, the sync contract |
| `references/06-sound-design.md` | ducking, auto-SFX map, music moods, audio gates |
| `references/07-rendering-qa.md` | every gate, pixel checks, ffprobe, repair loops |
| `references/08-extending-assets.md` | recipes: 3D location/object, 2D prop/background, outfit, sfx |
| `references/09-schema-reference.md` | every story JSON field with defaults and constraints |
| `references/10-english-voice-direction.md` | English voice catalog, direction, pacing, offline fallback |
| `references/11-commonsense-intents.md` | the intent table with GOOD and BAD pictures |
| `references/12-bangla-voice-and-script.md` | Bangla register, budgets, 22 sentence pairs, voices, screen rules |
| `references/13-format-library.md` | 10 story formats, hook bank, arcs, repetition guard |
| `references/14-model-tiers.md` | small / standard / max — what each attempts |
| `templates/scene-spec.md` | the Director's Brief form |
| `templates/sync-map.md` | the shot-by-shot contract table |
| `templates/fact-check-table.md` | the claim/source table |
