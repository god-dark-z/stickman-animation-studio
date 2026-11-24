# Plan — Phase 1 (clean-room audit)

**Goal:** prove where the skill fails in real use before changing behaviour.

## Read
`SKILL.md`, 10 `references/*.md`, `commands/make-video.md`, `install/*`, `templates/*`, all of
`engine/` (`src/`, `scripts/`, `stories/`, `locations/`, config), `docs/`, `.gitignore`.

## Reproduce
1. Mark the docs' install path (README + `install/INSTALL.md`) as the only allowed instructions.
2. Run `npm install`/`pip install` exactly as written; record every failure.
3. Run the pipeline on freshly written stories, including the seating and sleeping cases.
4. Inspect the stills myself (vision) at ≥1 fps equivalent — one still per shot plus the
   mid-shot frames — and score each shot against its narration.

## Verify the suspects S1–S13
Each one gets an evidence line: file:line, command output or frame. No verdict from memory.

## Risks
- No discrete GPU: three.js scenes may fail or render black under software WebGL.
- TTS is network-bound and flaky; word-boundary behaviour must be measured, not assumed.
- A full 1080×1920 render of every topic may exceed the session budget; if so, record it as a
  blocked item with the exact command the owner can run, never as a pass.

## Tests to add
- A failing reproduction for each blocker/major defect found (contact, gate blindness, paths).
- The chair and bed cases as numeric regression tests.
