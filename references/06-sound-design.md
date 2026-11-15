# 06 — Sound design

Code: `src/timeline.ts` (cue building), `src/Video.tsx` (ducking), `scripts/gen_audio_assets.py`
(all audio is generated procedurally with numpy — the engine ships zero third-party audio).

## The mix, by construction

- **Voice is always loudest.** Music and SFX duck to `1 − mix.duck` (default 0.35 → 65% volume)
  while narration words play, with a soft release so the bed "breathes" instead of pumping.
- Final master: `loudnorm I=-14 LUFS, TP=-1.0, LRA=7` — the loudness of the reference shorts.
  Applied automatically by `scripts/make.ts`.
- Levels (story `mix`): music 0.14, sfx 0.22, duck 0.35, autoSfx true.

## What is automatic (do not re-add by hand)

| Event | Auto sound |
|---|---|
| transition whip/zoom / flash / iris / every 2nd dissolve | swoosh / impact / magic / whoosh |
| fx sparkle, glow, flash, explosion, debris, cracks, rage, confetti, money, lightning, rain, speedlines, exclaim, question, hearts, zzz, stars, ripples, fire, smoke, shake | mapped sfx (sparkle, chime, whoosh, boom, crash, glass, rumble, success, cash, thunder, rain, swoosh, pop, boing, …) |
| actor enter pop / drop / walk-in | pop / thud / slide |
| prop enter pop / drop | pop / thud |
| insert (counter) / (others) | riser / paper |
| scared/surprised/shocked beats | pop |

## Manual `sfx` — for specific story moments only

54 ids in `src/catalog.ts` (SFX). Categories: impacts (boom, crash, glass, impact, thud, punch),
ui (click, beep, alarm, stamp, type, camera), ambient (wind, rain, crickets, crowd, engine, fire),
comic (boing, squeak, pop, slide, zaps), horror (whisper, breath, drone, heartbeat, suspense,
creak), music hits (bell, chime, magic, riser, success, fail, drop, gasp).

Rules: 0–2 manual sfx per shot; place on `beats` (`{ "at": "word", "sfx": "punch" }`) not shot
start when timing matters; horror mixes set `"mix": { "autoSfx": false }` and hand-place sparse
cues.

## Music moods (per video)

`curious` (default; plucky, safe) · `warm` (nostalgia, victories) · `mystery` (puzzles, heists) ·
`tense` (danger, deadlines) · `upbeat` (comedy, sports) · `sad` (loss) · `none`.
Music loops, fades in 15 frames, fades out at the end, ducks under voice. Choose ONE per video —
mood whiplash reads as amateur.

## Voice

- **English-only production.** Default: `edge` provider, `en-US-AndrewMultilingualNeural` at
  `rate: "+22%"` — warm male narrator, free, no key, per-word timestamps (that's what times every
  shot). Full catalog + direction: `10-english-voice-direction.md`.
- Offline fallback: `kokoro` (local ONNX, English voices, multiplier rate). No other backends are
  wired up by design.
- Voice per video via `voice`/`rate`/`provider` on the story. Narration re-synthesizes only when
  text+voice+rate+provider change (cache key in `out/<slug>/narration.key`).
- No narration for on-screen "calls" (`call:` field) — those render as text + whisper sfx.

## Comfort rules (the V2 sound bar)

Sound enhances storytelling; it never distracts, pierces, or fatigues:

- All 65 SFX are synthesized with soft attack/decay envelopes and normalized below clipping —
  there are no distorted or harsh samples by construction. Prefer these over any external download.
- Manual `sfx`: 0–2 per shot, placed on beats; never stack two loud cues on the same frame
  (the engine de-duplicates same-name cues within 4 frames).
- Don't reuse the same cue more than ~3× in a video for different meanings.
- The bed always ducks under the voice (0.35 → 65%); never set `mix.duck` below 0.3.
- Final master is normalized to −14 LUFS with true peak targeted at −1.5 dBTP in the pipeline
  (−1.0 measured in the delivered file — AAC encoding overshoots the PCM peak by ~0.3–0.5 dB;
  the audio gate measures the real file). No clipping, no spikes.

## The audio gate (mandatory before delivery)

```bash
python scripts/qa_audio.py out/<slug>/<slug>.mp4        # exit 1 on failure
```

Checks integrated loudness (−14 ±1.5 LUFS), true peak (≤ −1.0 dBTP), loudness range (4–12 LU),
and voice-presence floors (near-silent mixes fail). If it fails, fix the cause (usually a missing
voice file → delete `out/<slug>/narration.key` and re-render) — do not hand-adjust the MP4.

## Adding your own audio

- Override any sfx/music: drop a same-named `.wav` into `public/sfx/` or `public/music/`.
- Add a new procedural sfx: add a builder in `scripts/gen_audio_assets.py`, its name to `SFX` in
  `src/catalog.ts`, re-run `npm run assets`. Keep everything royalty-free-by-construction.
