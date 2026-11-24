# Blockers — what is not done and why

Nothing here is hidden in the code or the README. Each item has what was tried and the exact
command that finishes it.

## B1 — Full-quality 1080×1920 renders of all 8 topics — NOT RUN

**Tried:** draft-tier (540×960) renders of a 1-shot, a 4-shot and the 23-shot 3D demo all pass
every gate on this machine (108 s for the 56 s demo). The 2D path and the 3D path both work.

**Why blocked:** the session budget. Each 1080×1920 render of a ~60 s story at 2 workers is
several minutes of CPU, and the brief asks for 8 topics at full quality plus per-shot frame
inspection — that is roughly an hour of rendering plus inspection. Rendering the demo at
`--tier standard` alone is the next useful step.

**Command to finish:**

```bash
cd engine
for f in stories/tests/*.json stories/why-phone-gets-hot.json; do
  npx tsx scripts/studio.ts "$f" --tier standard
done
```

Then inspect `out/<slug>/contact-sheet.png` and fill `out/<slug>/visual-review.md`.

## B2 — Per-agent installs (Claude Code, Antigravity, ZCode) — NOT TESTED FOR REAL

**Tried:** read every installer and adapter file; the installer writes the same `SKILL.md` +
`commands/make-video.md` into each agent's documented folder and pointer rules elsewhere.

**Why blocked:** those products are not installed on this machine, and the brief forbids marking
anything "verified" that was not run. Their native skill/command locations may have changed since
the adapters were written.

**What is done instead:** `install/INSTALL.md` now separates routes that are exercised by the
script from routes that are convention-only, so no one reads a green check that does not exist.

## B3 — Anchor actions in 3D locations — DELIBERATELY UNSUPPORTED

`qa_geometry` raises `ANCHOR-3D` when a story uses `sitOn`/`lieOn`/`sleepOn` in a shot with a
3D `location`. The 3D path projects a 2D figure's feet through a three.js camera (`stage.ts`), so
there is no screen-space anchor to solve against, and a wrong guess would put a body inside a
chair mesh. Use a 2D background for contact shots.

## B4 — Lip-sync visemes — NOT IMPLEMENTED

Mouths are amplitude-driven from `timing.json`, not phoneme/viseme driven. Implementing visemes
would need per-phoneme timing, which the free TTS provider does not emit. Amplitude flaps are
honest about being amplitude flaps.

## B5 — Long-form (≈5 min) scene chunking — NOT IMPLEMENTED

The renderer is single-composition. A 5-minute story would hold the whole timeline in one render;
the RAM guard caps concurrency but does not chunk scenes and concatenate. Not attempted.

## B5b — Cross-model commonsense pass rates — NOT MEASURED

The brief asks for the 61-intent battery to be run by the largest, a mid-size and the smallest
available model, to show that the skill carries the result. **Only one model is reachable in this
environment**, and the harness would need a paid API key for the others, which the product rules
forbid. What *is* measured is the engine-side floor: every one of the 61 entries resolves and draws
as a human would picture it (`61/61`), so any failure in a weaker model's run is a *storyboard or
spec-writing* failure, not an engine gap — which is exactly what the SKILL decision tables and
`spec_check` are there to catch.

**To finish it:**

1. Add an `evals/` runner that, for each battery entry, asks a model for a Scene Spec + single-shot
   storyboard, writes it to a temp story, and runs `battery.ts --only`-style checks on the output.
2. Run it with each model adapter already configured for the user, recording pass rate per category
   per model in `out/battery/report.md`.
3. Tune the SKILL text (not the model choice) wherever a category lags.

The mechanism is in place — `runBattery()` in `engine/scripts/battery.ts` already takes a story
plan, checks it three ways and returns a per-category score; the missing piece is the model call.

## B6 — Golden-still SSIM suite and CI — NOT ADDED

`docs/dev/VERIFY-*.md` contains the measured baselines (still luminance/saturation, gate counts,
render times) but there is no `.github/workflows/ci.yml` and no perceptual-hash comparison in this
build. Adding CI without being able to run it here would repeat the original README's mistake.
The gates are all directly runnable, so wiring them into CI is mechanical:

```bash
cd engine
npx tsc --noEmit && npm test
for f in stories/tests/*.json; do npx tsx scripts/qa_sync.ts "$f"; npx tsx scripts/qa_geometry.ts "$f"; done
npx tsx scripts/studio.ts stories/tests/chair-office.json --tier draft --no-tts
python scripts/qa_video.py out/chair-test-office/chair-test-office-preview.mp4 --preview --silent
```
