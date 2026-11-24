# Changelog

## 3.0.0 — 2026-11-24

The release that makes the picture provable.

### Added
- **Semantic action layer.** `action: "sitOn" | "lieOn" | "sleepOn" | "standAt"` plus `on` on an
  actor. The engine resolves the pose, root position, draw order and contact from a prop's anchors,
  so an agent no longer hand-writes coordinates for interaction shots (`references/05`).
- **`engine/src/scene/anchors.ts`** — contact surfaces (`seat`, `mattress`, `pillow`, `top`) and
  drawing extents for furniture, vehicles and screens.
- **`engine/src/scene/layout.ts`** — pure scene geometry shared by the renderer and the gates.
- **`qa_geometry.ts`** — the scene-graph gate: contact, sink/float, scale, layering, face
  occlusion, framing, facing, seated→standing continuity. Exit 1 on any error.
- **`qa_timing.py`** — per-word timing audit against the audio's energy envelope.
- **`qa_video.py`** — container/resolution/fps/duration/dead-frame gate.
- **`qa_visual_report.py`** — contact sheet + per-shot claim checklist (`visual-review.md`), and a
  reader for recorded verdicts. Replaces the never-shipped `agentvision` instruction.
- **`studio.ts` + `npm run studio`** — one state-machine entry point with
  `--tier draft|standard|studio`, `--resume`, `--from <stage>`, per-stage status, state in
  `stories/<slug>/.state.json`, log in `out/<slug>/run.log`.
- **`doctor`** (`npm run doctor`, `python scripts/doctor.py`) — PASS/WARN/FAIL with the fix command,
  including a real software-WebGL frame probe (`doctor_gl.ts`).
- **`validate.ts`** — cheap schema/cast/prop/location validation before any expensive stage.
- **`paths.ts`** — `resolvePaths`/`resolveStory`, `--engine <dir>` supported by every script.
- **`engine/requirements.txt`** — pinned Python dependencies.
- **9 story fixtures** in `engine/stories/tests/` (seating, sleeping, kitchen, driving, dialogue,
  science, history-with-quotes, chart + day→night, one-shot edge case).
- **8 new unit tests** (22 total), including numeric contact regression tests for the chair and bed.
- `docs/dev/{AUDIT,PLAN-*,VERIFY-*,DECISIONS,BLOCKERS}.md`, `docs/TROUBLESHOOTING.md`,
  `docs/showcase/` (seated / sleeping stills, demo contact sheet).

### Fixed
- A character described as sleeping is now **in the bed** (head on pillow, body on the mattress,
  blanket over the torso) instead of lying on the floor beside it.
- A seated character's hip now sits **on** the seat surface; `sit` no longer lowered the body 58 px
  into the chair.
- Lying shadow is horizontal (was a vertical smear).
- The bed drawing was widened to 440 units so a lying body fits between the boards.
- `agentvision` references removed from `SKILL.md` and `templates/sync-map.md`.
- Clone URL placeholder (`<you>`) fixed in `README.md` and `install/INSTALL.md`.
- Stray `agentvision-render.png` removed from the repository root.
- Windows `UnicodeEncodeError` in every Python gate (stdout is now UTF-8).
- Concurrency is capped by free RAM as well as core count; 3D shots render at 2 workers.
- Word-count guidance corrected from "190–210 words ≈ 60–75 s" to the measured **≈3.8–4.0 w/s**
  (≈50–57 s for 190–210 words) at the default `+22%`.
- `npm run studio` now runs the orchestrator; the Remotion preview is `npm run remotion`.

### Changed
- `BUILD` character metrics moved into `scene/layout.ts` (single source of truth).
- Background set dressing of the same type at the same position is replaced by the shot's own prop,
  so you can sit on "the" bed without drawing two.
- Geometry-gate verdicts: contact/layering/occlusion/framing-of-head are errors; a contact surface
  behind the caption band is a warning.

### Migration
- **Existing story JSON keeps working unchanged.** Every new field defaults to the old behaviour
  (`action: "none"`, `underBlanket: false`, `inside: false`).
- A story that used `pose: "sit"`/`"lie"` with furniture on screen now gets a `MISSING-ACTION`
  error, because that shot was drawing the body at floor level. Add `"action": "sitOn"` /
  `"lieOn"` and `"on": "<prop type>"`, and declare the prop in that shot. There is no automatic
  migration: the correct `on` prop cannot be inferred safely.
- Anchors are only defined for chair, stool, bench, couch, bed, desk, table, vehicle seats and
  a few screens. Add a prop's anchors in `src/scene/anchors.ts` before using `action` with it.
