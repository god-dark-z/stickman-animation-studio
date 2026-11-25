# V4 Phase A — Orientation and baseline

Scope: read the repository, verify the environment, probe Bangla TTS capability, establish the
English golden baseline, and write the three notes files required by the V4 brief.

## Inputs

| Work area | Path |
|---|---|
| Repo | `C:\Users\black\Downloads\stickman-animation-studio` (clone of `god-dark-z/stickman-animation-studio`, branch `main`) |
| Engine | `engine/` (Remotion + three.js + edge-tts; package `stickman-studio-engine` v3.1.0) |
| Skill | `SKILL.md` (332 lines) |
| References | `references/01..11-*.md` (English voice direction, commonsense intents, …) |
| V3 dev docs | `docs/dev/PLAN-1..3-*.md`, `VERIFY-1..4-*.md`, `AUDIT.md`, `BLOCKERS.md`, `DECISIONS.md` |
| Demo assets | `docs/demo/*.png`, `docs/demo/demo.mp4`, `docs/showcase/*.png` |
| Bangla TTS repo | `https://github.com/parvez144/text-to-speech-with-edge-tts` (owner's repo) |

## Files to produce (Phase A exit criteria)

1. `docs/dev/v4/STATE-OF-REPO.md` — what V3 delivered vs. its own Definition of Done, what is
   missing, and what V4 must finish.
2. `docs/dev/v4/BANGLA-TTS-REPO-NOTES.md` — the owner's Bangla TTS repo: what it does, voices,
   preprocessing, chunking, deps, error handling, license.
3. `docs/dev/v4/BLOCKERS.md` — anything that stops a phase, with the command that finishes it.
4. `docs/dev/v4/DECISIONS.md` — judgement calls made without asking, with reasons.
5. `docs/dev/v4/VERIFY-A-orientation.md` — real command output for: Bangla voice list, Bangla
   word-boundary probe, English baseline render + gates, timing audit.

## Phase A tasks

### A1. Repository audit (STATE-OF-REPO.md)

Walk the repo and record, against the V3 brief's Definition of Done:

- What V3 shipped (verify by reading code, not the README):
  - `scripts/studio.ts` orchestrator with 13 stages & `.state.json` resume.
  - Scene Spec layer: `src/commonsense/spec.ts`, `templates/scene-spec.md`, `scripts/spec_check.ts`.
  - Semantic action layer: `action` (`sitOn`/`lieOn`/`sleepOn`/`standAt`/…), `qa_geometry.ts`
    scene-graph gate, `references/05-storyboard-craft.md`.
  - Commonsense: `data/intent-glossary.json` (56 entries), `data/commonsense-battery.json`
    (60 micro-stories, 14 categories), `qa_commonsense.ts`, `battery.ts`, `references/11-*.md`.
  - Timing audit: `qa_timing.py`, per-word edge-tts boundaries.
  - Craft rubric: `references/07-rendering-qa.md` (battery + verify claim: rubric = 0? record).
  - Eval harness: check `evals/` — absent (V3 BLOCKERS B2/B4 note per-model eval impossible:
    paid APIs forbidden). Confirm.
- Gaps to finish in V4: `docs/dev/v4/STATE-OF-REPO.md` lists them (from the brief: skill
  excellence, eval harness, studio finish, README redesign, Bangla).

### A2. Environment verification

| Tool | Version found | Notes |
|---|---|---|
| Python | 3.12.10 | OK (need ≥3.10) |
| Node | v24.19.0 | OK (need ≥18) |
| npm | 11.17.0 | OK |
| edge-tts | 7.3.1 installed | repo pins `edge-tts==7.0.2` in `requirements.txt`. **Check:** does 7.0.2 also return WordBoundary for `bn-` voices? If not, decide (record in DECISIONS.md): bump pin to a 7.x tested version. |
| ffmpeg | 9.0.2 (WinGet Gyan build) | present; engine uses `imageio-ffmpeg` |
| git identity | Night Stalker | set |

### A3. Bangla voice probe (real command output → VERIFY-A)

- `python -m edge_tts --list-voices | grep bn-` → confirm the four voices:
  `bn-BD-PradeepNeural` (M), `bn-BD-NabanitaNeural` (F), `bn-IN-BashkarNeural` (M),
  `bn-IN-TanishaaNeural` (F).
- Synthesize a 2-sentence Bangla sample per voice with `boundary="WordBoundary"` and record:
  boundaries present? word text quality (grapheme clusters intact?), offsets/durations.
- Result so far (2026-11-26, edge-tts 7.3.1): **word boundaries present** on all four voices —
  19/19 tokens returned. So the V3 forced-alignment fallback is only a contingency, not the
  primary path. Still implement it (offline mode / voice fallback) — Phase C.

### A4. Bangla TTS repo notes (BANGLA-TTS-REPO-NOTES.md)

- Repo: 4 files (`README.md`, `main.py`, `requirements.txt`, `.gitignore`), 1 commit.
- Does: converts Bangla text to MP3 via edge-tts; multiple voices (4 BN voices);
  autoplay on Windows. No preprocessing, no chunking. Only documented error:
  `NoAudioReceived` → switch voice.
- **License: none present.** → No code to comply with; do NOT copy `main.py` (it is trivial
  anyway). Re-implement useful logic (per-chunk synthesis, retry/backoff, word-boundary timing,
  cache) cleanly inside `engine/scripts/tts_bn.py` / `tts.py`. Record this in the notes + DECISIONS.md.
- `requirements.txt` of that repo: edge-tts (version unverified from WebFetch — the page did not
  show contents; try API later if needed).

### A5. English golden baseline

- Render the English demo story (`engine/stories/why-phone-gets-hot.json`) at
  `--tier standard` (full 1080×1920) and store:
  - gates output (validate, sync, geometry, commonsense, pixels, timing, video, audio),
  - render time, peak RSS (estimate from `os.freemem` log line — record), 
  - golden stills from the final MP4 (first/middle/last frames + the 12 demo PNGs already in
    `docs/demo/`), into `docs/dev/v4/golden-en/`.
- Run `docs` cleanliness check: README claims vs. reality (see Phase I).

### A6. Risk register (BLOCKERS.md initial)

- edge-tts 7.0.2 vs 7.3.1 WordBoundary for Bangla (verify at Phase C).
- No vision in some agents → Bangla visual QA must rely on geometric + pixel gates (documented).
- `@remotion/google-fonts` is a CDN at render time → **Phase F must bundle fonts locally**
  (Noto Sans Bengali + Hind Siliguri + Baloo Da 2, open licence → THIRD_PARTY.md).
- `immutable`/`estimateWords` speech rates are English-calibrated — Bangla pack must measure its
  own (Phase C5).

## Verification (exit criteria)

- [ ] `docs/dev/v4/PLAN-A-orientation.md` exists (this file).
- [ ] `STATE-OF-REPO.md`, `BANGLA-TTS-REPO-NOTES.md` exist.
- [ ] VERIFY-A has real output: `--list-voices` BN lines; per-voice probe (boundaries, sample
      word texts); English baseline render + gates.
- [ ] BLOCKERS.md and DECISIONS.md exist.

## Risks

- Long full-quality renders (minutes each) — do draft/standard tier where the phase only needs
  gate results; full tier only for the golden baseline and demo assets.
- edge-tts flakiness (NoAudioReceived) — retry with backoff already in `tts.py`; record evidence.