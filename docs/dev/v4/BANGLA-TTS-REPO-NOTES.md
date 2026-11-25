# BANGLA-TTS-REPO-NOTES — `parvez144/text-to-speech-with-edge-tts`

Read 2026-11-26 via GitHub page fetch (repo has no LICENSE file). Source:
https://github.com/parvez144/text-to-speech-with-edge-tts

## What it is

A minimal script that converts a hard-coded Bangla `text` string into an MP3 using Microsoft
Edge TTS (edge-tts Python library, which wraps the free Edge neural voices — no API key).
README title: "Bengali Text-to-Speech (TTS)".

## Repository contents

1. `README.md`
2. `main.py`
3. `requirements.txt`
4. `.gitignore`

One commit, 0 stars/0 forks.

## How it is called

- Edit `text` (and optionally `voice`) variables in `main.py`, run `python main.py`.
- Output: `output.mp3` in the same directory; auto-plays on Windows.
- Suggested venv setup in README; not enforced by code.

## Voices / locales it uses

Four Bengali voices (matches the edge-tts `bn-` list we probed independently):

| Voice | Locale | Gender | Repo's note |
|---|---|---|---|
| `bn-IN-TanishaaNeural` | bn-IN | Female | "Default & Highly Stable" |
| `bn-IN-BashkarNeural` | bn-IN | Male | — |
| `bn-BD-NabanitaNeural` | bn-BD | Female | "Occasionally faces API issues" |
| `bn-BD-PradeepNeural` | bn-BD | Male | — |

## Text preprocessing

None documented; no normalization, digit conversion, or pronunciation dictionary.

## Chunking

None. The whole `text` string is sent in one shot (edge-tts handles it).

## Dependencies

`requirements.txt` exists; contents were not visible in the fetched page (README only says
"pip install -r requirements.txt"). The tool obviously depends on `edge-tts`.

## Error handling

One documented error: `NoAudioReceived` — voice temporarily unavailable or network issue.
README workaround: switch to `bn-IN-TanishaaNeural` (the "stable" default).
No retry/backoff logic documented.

## License

**No LICENSE file and no license text anywhere in the repo.** Per the V4 brief rule ("If its
license requires attribution or restricts reuse, comply … or re-implement the useful logic
cleanly"):

- There is nothing to copy for reuse: no license grants reuse, and the script itself is a
  20-line edge-tts wrapper with no distinct logic.
- **Decision:** re-implement the useful behaviour (per-chunk synthesis, retry/backoff,
  word-boundary timing, cache) cleanly in `engine/scripts/tts_bn.py` / `tts.py` as part of the
  V4 Bangla engine. No attribution is owed (nothing was copied); the repo is credited in
  docs and the final report as the inspiration/source of the voice list, which is free
  Microsoft data anyway. Recorded in DECISIONS.md.

## What V4 reuses vs. builds

| Item | Source | Plan |
|---|---|---|
| Voice list | edge-tts `--list-voices` (verified independently) | V4 voice catalog in `engine/lang/bn/` |
| `bn-IN-TanishaaNeural` as the stable default | repo README hint | V4 default Bangla female voice candidate; verify via our own timing/quality probe |
| Fallback-on-`NoAudioReceived` | repo README workaround | V4 `tts_bn` retry + fallback order (BD→IN, and gender-based) |
| Everything else (normalizer, pronunciation dict, chunking, timing, cache, offline mode) | V3 engine (`tts.py`) extended | New V4 code |

## Notes for the V4 Bangla engine

- Word-boundary timing works on all four `bn-` voices with edge-tts 7.3.1 (probe in VERIFY-A):
  the V3 forced-alignment fallback stays as contingency/offline mode, not the primary path.
- Bangla grapheme clusters: edge-tts returns per-word text intact (conjuncts and vowel signs
  stay attached) in the probe — verify against a wider sample in Phase C and keep the
  grapheme segmenter test.