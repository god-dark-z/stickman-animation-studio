# Verify — Phase 2 (reliability foundation)

All commands from `engine/` unless noted. Machine: Windows 11, 16 cores, 15 GB RAM, no GPU.

## `npm run doctor -- --quick`

```
Stickman Animation Studio - doctor

PASS node                   v24.19.0 (need >= 18)
PASS npm                    C:\Program Files\nodejs\npm.CMD
PASS python                 3.12.10 on Windows (need >= 3.10)
PASS python deps            edge_tts=7.3.1, imageio_ffmpeg=0.8.1, numpy=2.5.4, scipy=1.18.1, PIL=13.0.0
PASS node_modules           12/12 packages present
PASS lockfile               package-lock.json present
PASS ffmpeg                 ...\imageio_ffmpeg\binaries\ffmpeg-win-x86_64-v9.0.2.exe
PASS out/ writable          ...\engine\out
PASS disk                   111.2 GB free (3 GB recommended)
PASS ram                    15 GB (16 GB is the reference target)
PASS internet               reached speech.platform.bing.com:443
WARN edge-tts words         probe failed (NoAudioReceived) - the pipeline will fall back...
PASS chromium               ...\node_modules\.remotion

14 checks: 0 fail, 1 warn
Ready.
```

The WARN is a genuine intermittent provider failure, not a misconfiguration: a direct retry
immediately afterwards returned `OK audio_bytes 11232 boundaries 3`. The doctor probe now retries
and reports a hint instead of a hard failure.

A later run of the same command, after adding the `ffprobe` check, on a session where the provider
answered:

```
$ python scripts/doctor.py --quick
… PASS ffprobe   C:\…\ffprobe.exe
15 checks: 0 fail, 0 warn
Ready.
```

Full (non-`--quick`) doctor adds a real WebGL frame render via `scripts/doctor_gl.ts`.

## Full draft pipeline, one silent story

```
$ npx tsx scripts/studio.ts stories/tests/edge-short.json --tier draft --no-tts
✓ validate · ✓ narration (skipped) · ✓ timeline · ✓ sync · ✓ geometry
✓ stills (4.8s) · ✓ pixels (0.2s) · ✓ timing (skipped) · ✓ render (6.0s)
✓ video  ok 540x960 · 30.00 fps · h264 · no audio (--no-tts) · 1.6s · 0 dead frames
Done. out/edge-test-very-short/edge-test-very-short-preview.mp4
EXIT=0  WALL=18s
```

## Full draft pipeline with real TTS

```
$ npx tsx scripts/studio.ts stories/tests/bed-sleep.json --tier draft
✓ narration · ✓ timeline · ✓ sync (0 errors, 1 warning) · ✓ geometry (0 errors, 1 warning)
✓ stills (7.3s) · ✓ pixels 4/4
✗ timing  FAIL  7/37 sampled words sit on silence
          resume: ... --from timing --resume
```

That failure was a real defect **in the gate**, not the video: the audibility test used the *mean*
energy across a word window, so short quiet words ("a", "he") were dragged below the threshold by
the silence around them. Fixed to use the p90 peak inside the window. Resumed:

```
$ npx tsx scripts/studio.ts stories/tests/bed-sleep.json --tier draft --from timing --resume
ok    37 words, median duration 113 ms
ok    mean |word → nearest speech onset| = 48 ms (target <=120 ms, max <=300 ms)
PASS — word timings are per-word, monotonic and land on audible speech.
✓ timing (0.3s)
✓ video   ok 540x960 · 30.00 fps · h264 · aac · 9.2s · 0 dead frames
✓ audio   -15.1 LUFS · -1.5 dBTP · mean -18.1 dB · peak -1.5 dB   PASS
✓ visual  contact sheet + visual-review.md written
Done. out/bed-test-sleep/bed-test-sleep-preview.mp4
EXIT=0  WALL=19s
```

The `--from timing --resume` path is exactly the "fix one stage and continue" workflow the
orchestrator exists for, and it was exercised for real.

## Full 23-shot demo, 3D locations, software WebGL

```
$ npx tsx scripts/studio.ts stories/why-phone-gets-hot.json --tier draft
✓ validate · ✓ narration · ✓ timeline · ✓ sync 23 shots 0E/0W · ✓ geometry 23 shots 0E/0W
✓ stills 23/23 · ✓ pixels 23/23 · ✓ timing 188 words PASS
▸ render: 3D (gl=angle) concurrency 2 of 16 cores, 5.5 GB free
✓ render
✓ video  ok 540x960 · 30.00 fps · h264 · aac · 56.5s · 0 dead-frame runs ≥0.6 s
✓ audio  -14.7 LUFS · -1.5 dBTP · PASS
✓ visual contact-sheet + checklist written
Done. out/why-does-your-phone-get-hot-when-signal-is-weak/…-preview.mp4
EXIT=0  WALL=108s
```

Output: 3.8 MB, 56.5 s, 540×960. This is the answer to S2: **three.js on software WebGL (ANGLE)
renders the 3D locations on a CPU-only machine with no black frames.**

## Known gaps

- A 1080×1920 (`--tier standard`) render was not completed in this session. The concurrency/RAM
  guard is in place; the command is in `BLOCKERS.md`.
- `qa_video.py` needs `ffprobe` on PATH (it is on this machine). `doctor` now checks for it.
