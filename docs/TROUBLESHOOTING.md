# Troubleshooting

Every error the pipeline can emit, what caused it, and the fix. Start with `npm run doctor` — it
covers most of this automatically and prints the fix command.

---

## Install / environment

**`fatal: repository 'https://github.com/<you>/…' not found`**
The clone URL placeholder was never replaced. Use
`https://github.com/god-dark-z/stickman-animation-studio`.

**`Could not find the engine. Run from the engine directory, pass --engine <dir>`**
`scripts/paths.ts` walks up from the script location and also looks for an `engine/` subfolder.
If your layout is unusual, `--engine /path/to/engine` (or `STUDIO_ENGINE=…`) resolves it. All
scripts accept it.

**`No story called "x". Looked in: …`**
`resolveStory` tries cwd, `stories/`, `stories/<x>.json`, `stories/tests/`. Pass the file path.

**doctor FAIL: `node` / `python` version**
Node 18+ and Python 3.10+ are required. Install Node 20 LTS / Python 3.12.

**doctor FAIL: `python deps missing: …`**
`python -m pip install -r requirements.txt` (pinned versions).

**doctor FAIL: `ffmpeg not reachable`**
`python -m pip install imageio-ffmpeg`. That wheel bundles ffmpeg; `qa_audio`/`qa_video` use it.

**doctor WARN: `ffprobe not on PATH`**
`qa_video.py` needs real FFmpeg's `ffprobe`. Install full FFmpeg and add it to PATH.

**doctor WARN: `edge-tts words — probe failed (NoAudioReceived)`**
Microsoft's endpoint intermittently refuses a connection. `tts.py` retries 4× with backoff, and
`qa_timing.py` verifies the result afterwards. If it persists, render with `--no-tts` (silent,
estimated timings) or use the `kokoro` provider for a local voice.

**doctor FAIL: WebGL frame black**
Software WebGL failed. Try `REMOTION_GL=swiftshader` or `--gl swangle`, then re-run
`npm run doctor`. If it still fails, use 2D backgrounds (`bg`) — every 2D path works without WebGL.

---

## Story JSON

**`Story JSON is invalid: shot.0.actors.0.action: Invalid enum value`**
The action list is: `none, sitOn, lieOn, sleepOn, standAt, hold, use, face, pointAt, react,
handOver`. A typo fails validation with the valid options printed.

**`shot 2: actor "sam" is not in cast`**
Every `actors[].id` must be a key in `cast`.

**`shot 3: no prop or object called "pan"`**
`pan` is not in the prop catalog. Check `npx tsx scripts/locations.ts --list`, or add the prop
(`references/08-extending-assets.md`). If it is a 3D object, the shot also needs a `location`.

**`shot 1: actor "worker" uses action "sitOn" on "chair" but that prop is not declared`**
Declare it in that shot's `props`. If the background already has the same furniture at the same
x/z, the declaration replaces it — no double chair.

**`no location called "desert"`**
The name must match a file in `engine/locations/` (`name` field == filename).

---

## Geometry gate (`qa_geometry.ts`)

**`MISSING-ACTION — pose "sit" with a chair on screen but no action`**
The body is drawn at floor level. Add `"action": "sitOn", "on": "chair"` and declare the chair.

**`CONTACT — actor "x" is not on the chair seat: hip … vs seat centre …`**
The prop has no seat anchor at that size, or the actor scale is far from 1. Check the chair is the
prop you think it is, and that `scale` is near 1.

**`CONTACT — "lamp" has no seat anchor`**
You cannot sit on that prop. Pick one with a `seat` (chair, stool, bench, couch, bed edge, car) or
add the anchor in `src/scene/anchors.ts`.

**`SINK — actor "x" is 40px below the floor while seated`**
The seat anchor is below the floor line for that z, or the pose lowers the body. Use the semantic
action (it keeps `drop: 0`) rather than a hand-written `pose: "sit"`.

**`FLOAT — body bottom … vs mattress top …`**
The mattress anchor does not match the drawing. Re-measure `bed` in `anchorOf` against `Props.tsx`.

**`FACE-OCCLUDED — the computer is drawn in front and covers 80% of "worker" face`**
A prop at a nearer z is in front of the face. Move it in x, send it behind (lower `z`), or reframe.

**`FRAMING — the chair seat is behind the caption band`** (WARN)
Captions start at y=1255. Widen the shot if the contact is the point of the shot.

**`ANCHOR-3D`**
Anchor actions are 2D-only. Use a 2D `bg` for that shot (see `BLOCKERS.md`).

**`LAYERING`**
`inside: true` must draw *behind* the vehicle; everything else must draw in front of the prop it
rests on.

---

## Sync gate (`qa_sync.ts`)

**`PLACE — narration says "canyon" but the shot shows "office"`**
Change `location`/`bg`, or rephrase. Acceptable ids are printed.

**`TIME — narration says "night" but time is "day"`**
Set `time`, or remove the time word from the narration.

**`ACTION — narration says "sleeps" but no pose shows it`**
Use the semantic action (`sleepOn`) — the gate maps actions to their pose — or add a beat.

**`PROP-CONT — prop "phone" was visible in shot 1 and is gone in shot 2`**
Restage the prop, or move the scene (a transition word like "later" licenses a jump).

**`DIALOGUE — quoted line but no quote actor`**
Set `"quote": "<actor id>"` so the mouth animates.

**Unknown words never fail silently** — they raise WARN with a suggestion. Add them to
`stories/<slug>/sync-lexicon.json` or rephrase.

---

## Render

**`render failed (…), retrying…` then success**
The bundle or a chunk retried once. Harmless if the run finishes.

**Out-of-memory / killed during render**
Concurrency is capped by free RAM, but other apps compete. `npm run make -- story.json
--concurrency 2`, close Chrome, and re-run.

**Black or empty frames in a 3D shot**
WebGL. Run `npm run doctor -- --webgl`. If black, switch that shot to a 2D `bg`. The pipeline
never silently ships black frames — `qa_stills`/`qa_video` will fail the run.

**`ffprobe` "could not read the file"**
The MP4 is truncated (disk full or killed render). Re-render; check `out/<slug>/run.log`.

---

## Audio

**`FAIL loudness … is not within ±1.5 of -14 LUFS`**
`make.ts` loudnorms automatically, so this usually means the file was produced by hand. Re-render
through `npm run studio`.

**`FAIL true peak … exceeds -1.0 dBTP`**
AAC overshoots PCM by ~0.3–0.5 dB; the pipeline targets −1.5 dBTP for this reason. If it still
fails, lower `mix.music`/`mix.sfx` in the story.

**`FAIL mean volume … mix is near-silent`**
`--no-tts` produces a silent render; that stage is skipped automatically by `studio`. If you see
this with TTS, narration synthesis failed — see the edge-tts entries above.

**`warn loudness range … outside 4..12`**
Not fatal. A short or very uniform mix lands outside the window.

---

## Timing

**`FAIL … non-monotonic word timing(s)`**
The provider returned overlapping marks. Delete `out/<slug>/narration.key` to force re-synthesis.

**`FAIL median word duration … — timings are not per word`**
The provider returned sentence-level marks. The pipeline falls back to estimated timings; captions
stay readable but `beats` land less precisely. Re-synthesize, or use a voice that emits
`WordBoundary` (the default does — verified on `en-US-AndrewMultilingualNeural`).

**`FAIL 7/37 sampled words sit on silence`**
Word marks drifted off the audio. Re-synthesize; if it repeats, the voice/rate combination is not
producing usable marks — switch voice.

---

## Visual QA

**`NOT REVIEWED YET`**
Open `out/<slug>/contact-sheet.png`, compare each still with its claim in
`out/<slug>/visual-review.md`, and write PASS/FAIL. No vision? Write `geometric-only` and say so in
the delivery report.

**`FAIL — a recorded claim FAILed`**
Fix that shot, re-render its still, and re-review.

---

## Platform notes (Windows / macOS / Linux)

- Use `python` on Windows, `python3` on macOS/Linux — every script is launched by
  `studio.ts`/`make.ts` with the right name automatically.
- Windows consoles are cp1252 by default; all Python gates reconfigure stdout to UTF-8. If you
  still see `UnicodeEncodeError`, set `PYTHONIOENCODING=utf-8`.
- No shell-specific syntax is used inside the engine; `install/install.ps1` and `install.sh` are the
  only OS-specific files.
