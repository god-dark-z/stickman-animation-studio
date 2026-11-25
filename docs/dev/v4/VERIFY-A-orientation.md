# VERIFY-A — orientation and baseline (real command output)

Machine: Windows 10.0.26300, Git Bash, 16 cores, ~5 GB free RAM at render time.
Date: 2026-11-26.

## 1. Toolchain

```
$ python --version            → Python 3.12.10
$ node --version              → v24.19.0
$ npm --version               → 11.17.0
$ python -m pip show edge-tts → Version: 7.3.1 (global interpreter)
$ which ffmpeg                → C:/Users/black/AppData/Local/Microsoft/WinGet/Packages/
                                Gyan.FFmpeg_.../ffmpeg-9.0.2-full_build/bin/ffmpeg
```

## 2. Bangla voices present (edge-tts 7.3.1)

```
$ python -m edge_tts --list-voices | grep bn
bn-BD-NabanitaNeural              Female    General    Friendly, Positive
bn-BD-PradeepNeural               Male      General    Friendly, Positive
bn-IN-BashkarNeural               Male      General    Friendly, Positive
bn-IN-TanishaaNeural              Female    General    Friendly, Positive
```

All four expected voices exist: Bangladeshi + Indian, male + female each.

## 3. Bangla word-boundary probe (edge-tts 7.3.1)

Sample text (2 sentences, 19 tokens):

```
আজ সকালে বৃষ্টি পড়ছিল। ছেলেটি জানালার পাশে দাঁড়িয়ে ছিল, আর মনে মনে ভাবছিল — কেন আকাশ এত দ্রুত রং বদলায়?
```

Result — **word boundaries returned by all four voices**, 19/19 tokens each, e.g.
`bn-BD-PradeepNeural`:

```
{'text': 'আজ',       'offset_ms': 122.7, 'dur_ms': 215.9}
{'text': 'সকালে',    'offset_ms': 372.7, 'dur_ms': 340.9}
{'text': 'বৃষ্টি',    'offset_ms': 725.0, 'dur_ms': 295.5}
{'text': 'পড়ছিল',    'offset_ms': 1031.8, 'dur_ms': 409.1}
{'text': 'ছেলেটি',   'offset_ms': 2345.5, 'dur_ms': 409.1}
{'text': 'জানালার',  'offset_ms': 2754.5, 'dur_ms': 397.7}
{'text': 'পাশে',      'offset_ms': 3163.6, 'dur_ms': 250.0}
{'text': 'দাঁড়িয়ে',  'offset_ms': 3413.6, 'dur_ms': 261.4}
```

Per-voice: Pradeep 19, Nabanita 19, Bashkar 19, Tanishaa 19 boundaries; audio bytes
46,800 / 47,520 / 52,704 / 54,432. Sample audio files written to
`C:\Users\black\Downloads\v4probe\bn-*.mp3` (outside the repo).

**Conclusion:** Bangla gets per-word timing from edge-tts itself. The V3 forced-alignment
fallback is a contingency (offline mode / voice fallback), not the primary Bangla path.
Grapheme clusters arrive intact in the boundary text (conjuncts and vowel signs unsplit).

## 4. Pinned-version check — CRITICAL

The repo pinned `edge-tts==7.0.2`. Probing each version's `Communicate.__init__` signature:

```
$ python -c "inspect.signature(edge_tts.Communicate.__init__)"
edge-tts 7.0.2: boundary kwarg = False
edge-tts 7.1.0: boundary kwarg = False
edge-tts 7.2.0: boundary kwarg = True
edge-tts 7.2.1: boundary kwarg = True
```

`engine/scripts/tts.py` passes `boundary="WordBoundary"`, so **7.0.2 raises
`TypeError: Communicate.__init__() got an unexpected keyword argument 'boundary'`**. The
existing pin was stale/broken for the code that ships with it (the machine's global 7.3.1
masked it). Minimum working pin = **7.2.1** (see DECISIONS #V4-1).

Retry/backoff evidence: one probe run returned
`WSServerHandshakeError: 403 … speech.platform.bing.com`; a later attempt succeeded — exactly
the transient failure class `tts.py`'s retry loop exists for.

## 5. Unit test baseline

```
$ npm test
  ok  tokenize keeps English words
  … (27 tests)
  ok  a reasoned intent exemption is accepted by the schema and keeps its reason

27 passed
```

## 6. English golden baseline — full-quality render

```
$ npx tsx scripts/studio.ts stories/why-phone-gets-hot.json --tier standard
▸ timeline: 56.4s, 36 sound cues
▸ render: 3D (gl=angle) concurrency 2 of 16 cores, 4.7 GB free
PASS — no narration↔visual contradictions detected by the lexicon gate.        (sync)
Why Does Your Phone Get Hot When Signal Is Weak: 23 shots — 0 geometry error(s), 0 warning(s)
why-phone-gets-hot.json: 23 shots, 56 glossary intents — 0 commonsense error(s), 1 warning(s), coverage 24%
PASS — word timings are per-word, monotonic and land on audible speech.        (timing)
ok    resolution 1080x1920 (want 1080x1920)                                   (video)
ok    frame rate 30.00 fps (want 30)
ok    codec h264 (want h264)   ok  audio aac (want aac)
ok    duration 56.5s (narration + tail ≈ 56.4s)
ok    dead-frame scan: 0 run(s) ≥0.6 s
PASS — container, length and picture are inside spec.
ok    loudness -14.7 LUFS (target -14 ±1.5)                                    (audio)
ok    true peak -1.5 dBTP (<= -1.0)
PASS — loudness, peaks and voice presence are inside the professional window.
```

Render wall time: **≈2 min 4 s** (20:26:24 → 20:28:28) for 56.5 s at 1080×1920.
Peak/free RAM logged at start: 4.7 GB free, concurrency 2.

Timing audit detail (English):

```
$ python scripts/qa_timing.py out/.../words.json public/voice/....mp3
ok    188 words, median duration 205 ms
ok    mean |word → nearest speech onset| = 55 ms (target ≤120 ms, max ≤300 ms)
ok    energy floor 0.3, speech 153.1, threshold 38.5
PASS
```

Artifacts stored in `docs/dev/v4/golden-en/`:

- `why-does-your-phone-get-hot-when-signal-is-weak.mp4` — 64.3 MB, h264/aac, 1080×1920, 30 fps
- `contact-sheet.png` — all 23 stills
- `frame-01/02/03.png` — frames at n=30, 840, 1650 (opening, middle, end)

## 7. Visual check performed (frames inspected by eye)

| Frame | What I see | Verdict |
|---|---|---|
| frame-01 | Stickman with orange hoodie, brown spiky hair, wide-eyed surprised face, phone prop beside his head, caption "loses signal," fully inside safe frame, legible | PASS |
| frame-03 | Same character, night/purple grade, winking smile, phone prop at hand height, caption "the harder it" legible against dark bg | PASS |

Character design, palette and caption legibility are consistent across the two grades; no
clipping, no tofu, no floating props. This is the English baseline that Phases B–J must not
regress.

## 8. Known non-blocking warnings at baseline (recorded, not fixed — English must not change)

- `shots [8, 15] are very dark — check the time-of-day grade` (offline CV, visual stage).
- `loudness range 2.7 LU outside 4..12` (audio stage WARN) — compressed mix, review only.
- `visual: NOT REVIEWED YET` — the checklist verdict column needs the human/vision pass; frame
  inspection above covers this run.
- commonsense coverage 24 % on this story — the demo narration uses few glossary phrases; the
  battery covers the intent vocabulary separately.

## 9. Bangla TTS repo

See `BANGLA-TTS-REPO-NOTES.md`. Summary: 4 files, no license, no preprocessing/chunking, only
`NoAudioReceived` handled; nothing copied, useful behaviour re-implemented (DECISIONS #V4-2).