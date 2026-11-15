# 10 — English voice direction

Production is **English-only**. Two TTS backends are wired into the engine, chosen by quality:

| provider | engine | quality | offline | word timestamps |
|---|---|---|---|---|
| `edge` (default) | Microsoft edge-tts neural voices | high — natural prosody, correct pronunciation | no (needs internet) | yes (exact per-word, drives every shot) |
| `kokoro` (fallback) | local Kokoro ONNX + faster-whisper | good, slightly flatter | yes | yes (whisper-derived) |

Anything else was evaluated and deliberately excluded: local Bengali/Coqui VITS checkpoints
(robotic mispronunciation — and non-English anyway), and paid cloud voices (rule: no paid APIs).
Do not re-introduce them.

## The voice catalog (edge-tts, all free)

| Genre | voice | rate | pitch | Read it as |
|---|---|---|---|---|
| Punchy storytelling (default) | `en-US-AndrewMultilingualNeural` | `+22%` | +0Hz | energetic narrator, the engine's calibrated default |
| Calm documentary | `en-US-ChristopherNeural` | `+6%`..`+10%` | `−2Hz` | measured, grave, authoritative |
| Bright educational | `en-US-AriaNeural` | `+12%` | +0Hz | clear, friendly, classroom pace |
| Warm storytelling | `en-US-AnaNeural` (playful) / `en-US-JennyNeural` | `+10%` | +0Hz | softer, family-friendly |
| Dramatic recitation | `en-US-GuyNeural` | `+8%` | `−3Hz` | weight for history/tragedy |

Set on the story: `"provider": "edge", "voice": "…", "rate": "…"` (rate is a percentage; kokoro
takes a multiplier like `"0.82"`). Listen to the hook line before committing: synthesize, measure
the duration (words ÷ seconds ≈ 2.6–3.4 w/s is the professional band), and re-pick if it drones.

## Direction rules (what makes it sound directed, not generated)

- **Pace for the ear:** short sentences get natural punch from the voice; long mechanism
  sentences ("You see, …") should be the slowest lines in the video. If a line reads rushed,
  split it into two shots.
- **Numbers spelled the way they should be spoken** ("twenty percent", "five bucks") — the voice
  reads text literally.
- **Emphasis by structure, not markup:** put the emphasized word first or last in the sentence;
  the neural voices stress edges naturally. edge-tts supports no reliable emphasis tags — don't fake it.
- **Quoted dialogue:** the narrator voices quotes; the on-screen actor mouth-flaps via `quote:`.
  Keep quotes short (≤ 12 words) so the mouth animation reads.
- **No mid-sentence lists:** three-item lists become three shots or an insert; the voice rushes lists.

## Word timestamps = the timing backbone

edge-tts returns a timestamp per word (`engine/scripts/tts.py`). The engine aligns them to the
script and starts each shot 2 frames before its first word — narration-to-visual sync is physical
truth here, not a hope. Consequences:

- Changing the script re-times everything automatically; changing `voice`/`rate` invalidates the
  narration cache and re-synthesizes.
- If a rendered video's sync feels off, delete `out/<slug>/narration.key` and re-render to force
  a clean re-synthesis.

## Offline path (kokoro)

`"provider": "kokoro"` with voices like `am_michael` / `af_heart`. Slightly flatter delivery —
use `rate` ~`0.78`–`0.85` (multiplier) and prefer shorter sentences. Still English; still local;
still timestamped. Use when the session has no internet, never as a "second-class English voice"
for online runs.
