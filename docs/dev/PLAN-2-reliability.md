# Plan — Phase 2 (reliability foundation)

**Goal:** a new user gets from clone to a green draft render without manual fixes, and every
failure says what to do.

## Files
- `engine/requirements.txt` — pinned Python deps (new).
- `engine/package.json` — `doctor`, `studio`, `validate`, `qa:geometry`, `qa:video`, `qa:timing`,
  `qa:visual`; the Remotion preview renamed to `remotion` so `studio` can own the name.
- `engine/scripts/paths.ts` — `resolvePaths` / `resolveStory`, used by every script (new).
- `engine/scripts/doctor.py` + `doctor_gl.ts` — environment checks incl. a real WebGL frame (new).
- `engine/scripts/studio.ts` — the single state-machine entry point (new).
- `engine/scripts/validate.ts` — schema/cast/prop/location checks before expensive work (new).
- `engine/scripts/qa_video.py`, `qa_timing.py`, `qa_visual_report.py` (new).
- `README.md`, `install/INSTALL.md`, `templates/sync-map.md` — placeholders and the missing tool.

## Approach
1. Pin first, so the environment stops drifting.
2. `doctor` before anything else: PASS/WARN/FAIL with the fix command, non-zero on FAIL.
3. One orchestrator that stores state, refuses to advance past a failed gate, and supports
   `--resume`/`--from`. Keep every individual command working for debugging.
4. CPU profile: ANGLE/SwiftShader GL, concurrency derived from cores *and* free RAM, a memory
   guard, one retry of a failed render.

## Risks
- A WebGL probe adds 30–60 s to `doctor`; it is skippable with `--quick` and skipped automatically
  when offline.
- The orchestrator duplicates the CLI surface; both paths must be tested (done: `--from` resume
  was used to recover a failed timing stage).

## Tests
- `doctor --quick` on a working machine → 0 FAIL.
- Full `studio --tier draft --no-tts` run → all stages green.
- `studio --tier draft` with real TTS → timing + audio + video gates green.
