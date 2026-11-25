# Blockers — V4

External or environment limits only. Everything else is worked around and recorded in
DECISIONS.md. Format: what was tried, why it stopped, the exact command that finishes it.

## B4-1 — `edge-tts` pin was broken (FIXED in-repo, tracked here for the audit trail)

**Found (Phase A):** `requirements.txt` pinned `edge-tts==7.0.2`, but `scripts/tts.py` passes
`boundary="WordBoundary"`, which only exists from **7.2.0**. On a clean install that pin would
raise `TypeError` and every narration would fail — English included. The machine's global
7.3.1 hid it.

**Status:** fixed by bumping the pin to `7.2.1` (minimum working version). See DECISIONS #V4-1.
Verified with a throwaway venv: 7.0.2/7.1.0 reject the kwarg, 7.2.0/7.2.1 accept it.

## B4-2 — Cross-agent / cross-model eval numbers — NOT MEASURED HERE

**Tried:** read every installed agent adapter; the only agent runtime in this environment is this
one session (one model family). V3 BLOCKERS B2/B4 recorded the same constraint.

**Why blocked:** measuring pass rates per agent/per model needs those runtimes (and per-model API
access, which is a paid API — forbidden by the product rules).

**Delivered instead:** the `evals/` harness (Phase G) that any operator can run locally against
whatever agent/model they have, plus the English and Bangla battery scores that exercise the
engine gates here. `evals/REPORT.md` will state exactly which rows were measured here and which
are "run this on your machine".

## B4-3 — Full-quality renders of every test story — PARTIAL

**Tried:** the 23-shot 3D demo at `--tier standard` (1080×1920) → PASS, 2 min 4 s. Test stories
and the battery run at draft tier in CI (their gates are resolution-independent).

**Why partial:** full-quality × 11 test stories × 2 languages is ~40+ min of CPU in one session;
the phase exit criteria only require gate results, which do not depend on resolution. Full-quality
renders are reserved for the golden baseline and the demo assets.

**Command to complete:**

```bash
cd engine
for f in stories/tests/*.json stories/why-phone-gets-hot.json; do npx tsx scripts/studio.ts "$f" --tier standard; done
```

## B4-4 — Bangla audio round-trip (ASR) check — NOT RUN

**Why:** no offline recognizer is installed and the brief forbids making one mandatory. The
Bangla audio gate (loudness/peak/voice-presence) does run and is tuned with evidence in Phase F.
The round-trip word-match check stays optional and will be reported as "not run".

## B4-5 — GitHub metadata / release / social preview — PREPARED, NOT PUBLISHED

**Why:** publishing is an outward-facing action on the owner's account; this run has no
authorisation to push, tag a release, or upload assets. Everything is prepared locally
(`README.bn.md`, `CONTRIBUTING.md`, `THIRD_PARTY.md`, `CHANGELOG.md`, issue templates, CI) and the
owner publishes with the commands in the final report.

## B4-6 — Bangla TTS repository license — NONE

**Why it matters:** no licence means no reuse grant. Nothing was copied; the logic was
re-implemented from the V3 engine. See BANGLA-TTS-REPO-NOTES.md and DECISIONS #V4-2.

## B4-7 — Visual QA of Bangla stills depends on the agent's vision

**Why:** this model has vision, so I will inspect Bangla caption/insert stills myself in Phase F.
Agents without vision must rely on the glyph-coverage script + pixel gates; the skill says so
explicitly rather than letting an agent claim a visual check it did not do.