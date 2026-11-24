# Verify — Phase 1 (audit)

Environment:

```
node --version   → v24.19.0
npm --version    → 11.17.0
python --version → Python 3.12.10
python -c "import numpy, PIL" → numpy + PIL ok
engine/node_modules → present
```

## Install as documented (before the fixes)

Following `README.md` → `install/INSTALL.md` verbatim:

1. `git clone https://github.com/<you>/stickman-animation-studio` → **fails**. Exit 128,
   "repository not found". This is S1, reproduced exactly as a new user would hit it.
2. `cd engine && npm install` → succeeded, but installed a dependency tree with no lockfile
   guarantee in the README's own instruction (the lockfile existed in the repo, the docs said
   `npm install`, not `npm ci`).
3. `pip install edge-tts imageio-ffmpeg numpy scipy pillow` → succeeded, installing
   `edge_tts 7.3.1`, `numpy 2.5.4`, `pillow 13.0.0` — none pinned, none of them the versions a
   later bug report would be reproduced against (S4).

## Baseline gate runs (before fixes)

`qa_sync` on the shipped demo: `23 shots checked: 0 error(s), 0 warning(s)` — **while shot 21 drew
a sleeping man on the floor next to an empty bed.** This single line is the strongest evidence for
S7/D3.

A hand-written seating story (`pose: "sit"`, chair prop) also produced `0 error(s)` from
`qa_sync`, and the rendered still showed the body roughly 80 px below the seat surface, half sunk
into it. Recorded numerically in the unit test that now fails such a story.

## TTS behaviour (S3)

```
$ python -c "…edge_tts 3-word probe…"
OK audio_bytes 11232 boundaries 3
```

The same probe from `doctor` a minute earlier raised `NoAudioReceived` on the first attempt and
succeeded on a retry — real intermittent provider failure. Word boundaries for
`en-US-AndrewMultilingualNeural` are present, so the "multilingual voices have no word marks"
hypothesis is refuted; the flakiness hypothesis is confirmed.

## What could not be completed in Phase 1

The 8-topic × full-quality render matrix. Reasons and the exact commands are in `BLOCKERS.md`.
The audit above therefore distinguishes **measured** facts (gate output, TTS probes, rendered
stills, timings) from **read** facts (code paths, documentation inconsistencies).
