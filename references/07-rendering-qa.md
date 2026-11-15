# 07 — Rendering, QA gates, verification

Pipeline: `scripts/make.ts` — one command, five stages: validate → narrate → timeline → render →
loudness-normalize. Every gate below is mandatory before delivery.

## Commands

```bash
npx tsx scripts/qa_sync.ts stories/<file>.json          # SYNC GATE: narration↔visual contract (0 errors required)
npm run make -- stories/<file>.json --stills            # QA stills only (fast, no video)
python scripts/qa_stills.py out/<slug>/stills           # pixel gate on the stills (exit 1 on fail)
npm run make -- stories/<file>.json --preview           # half-size, CRF 28 draft
npm run make -- stories/<file>.json                     # final: 1080×1920, CRF 18, 192k AAC, -14 LUFS
npm run make -- stories/<file>.json --no-tts            # offline: estimated word timings, silent voice
python scripts/qa_audio.py out/<slug>/<slug>.mp4        # AUDIO GATE: loudness/peak/voice presence
npx tsx scripts/locations.ts --list                     # asset inventory
npx tsx scripts/locations.ts --stills --only=<name>     # 3D asset still → out/locations/<name>.png
npm test                                                # timeline/caption/schema unit tests
npm run typecheck                                       # tsc --noEmit
```

Render runs in-process (concurrency 2 with 3D locations, ~n-2 CPUs otherwise) and prints a
progress bar. Narration is cached (`out/<slug>/narration.key`); audio regenerates only on change.

## Gate 0 — sync (narration ↔ visual, before any render)

`npx tsx scripts/qa_sync.ts stories/<file>.json` — deterministic lexicon checks: narrated places
vs the shot's world, time-of-day, actions as poses/beats/props, key objects on screen, quoted
lines with `quote` actors, continuity (time jumps, prop persistence, teleports), and shot-grammar
repetition. **0 errors required**; every remaining WARN must be fixed or recorded as accepted in
`stories/<slug>/sync-map.md`. See `05-storyboard-craft.md` § The sync contract.

## Gate 1 — validation (automatic, blocks on error)

Zod schema with per-id error messages; every actor must be in `cast`; every prop must exist in
PROPS (2D) or `_objects.json` (3D, only when the shot has a `location`).

## Gate 2 — stills (never skip)

`--stills` writes one PNG per shot at 60% of the shot → `out/<slug>/stills/shotNN.png`.

Inspect every still. If the runtime has vision, look. Otherwise (and additionally):

```python
# scripts/qa_stills.py — pixel stats: exposure, dead frames, duplicates
import sys, glob
import numpy as np
from PIL import Image  # or: ffmpeg -i still.png -f rawvideo - | numpy
for p in sorted(glob.glob("out/<slug>/stills/*.png")):
    a = np.asarray(Image.open(p).convert("L"), float) / 255
    print(p, f"lum={a.mean():.2f} black={np.mean(a<0.08):.2f} white={np.mean(a>0.97):.2f}")
```

- Mean luminance ≥ 0.16 (of 1.0) for non-night scenes (Beanman rule of thumb: ≥ 40/255).
- Two stills with ~0 mean abs difference = a dead shot — rewrite it.
- `black > 0.5` on a day scene = camera in a wall or actor out of frame — fix staging.
- Also read the engine's own warnings: shot < 0.8 s → merge; > 6 s → split (refs cut every 1.5–4 s).

Fix → re-run `--stills` → repeat until clean. **Never render video before this gate passes.**

## Gate 3 — video verification (ffprobe + frames)

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name -of csv=p=0 OUT.mp4   # expect 1080,1920,30/1,h264
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate -of csv=p=0 OUT.mp4                 # aac, 44100
ffprobe -v error -show_entries format=duration -of csv=p=0 OUT.mp4                                                  # ≈ words + 0.6s
ffmpeg -i OUT.mp4 -vf "fps=1/5" -q:v 2 qa_%03d.jpg                                                                  # 1 frame / 5 s
```

Check the pulled frames: first/middle/last not black; captions legible; no stuck shot.

## Common failures → fixes

| Symptom | Cause → fix |
|---|---|
| render hangs on first frame | Chromium/ANGLE issue → ensure `--no-tts` offline test passes; retry once (make.ts already retries 3×) |
| fonts fail offline | Google-fonts fetch needs network; run with network or accept fallback font |
| edge-tts fails | network → retry; sustained failure → `--no-tts` for stills, render voice later |
| 3D location renders black | location JSON error → `npx tsx scripts/locations.ts --check` equivalent: `--list` prints errors |
| actors cut off at edges | staging outside x 0.25–0.75, or two actors + `medium` → use `full`/`wide` |
| prop "floating" | `z` mismatch with actors, or `y` set on a floor prop → drop `y` |
| narration timing wrong | script text changed but cache hit → delete `out/<slug>/narration.key` |

## Long renders (interruption safety)

A 60–75 s video renders in minutes; run it in the background. For fragile sessions or >3 min
videos: render `--preview` first (fast full pass), then the final render; if a final render dies,
just re-run it — narration cache makes the retry cheap. Optionally render scene ranges as separate
stories and stitch with ffmpeg concat (same codec settings), but prefer the single-pass render.

## Gate 4 — audio (on the rendered MP4)

`python scripts/qa_audio.py out/<slug>/<slug>.mp4` — integrated loudness within −14 ±1.5 LUFS,
true peak ≤ −1.0 dBTP, loudness range 4–12 LU, and voice-presence floors. Failure modes and
fixes: silent mix → narration file missing (delete `out/<slug>/narration.key`, re-render);
peaks > −1 dBTP → lower `mix.sfx`/`mix.music` in the story, re-render.

## Repair loop

Gates run in order 0 → 1 → 2 → 3 → 4. Budget **up to 3 repair rounds per gate**: fix the root
cause (story JSON, staging, asset), re-run the failed gate plus the gates after it. Never deliver
a video that failed any gate silently; if a gate cannot be satisfied after 3 rounds, deliver with
an explicit note of what remains.

## Honesty rule for the final report

State exactly what was verified (stills inspected: yes/no + method; ffprobe outputs; frames
pulled) and what was not. Never claim a check that did not run.
