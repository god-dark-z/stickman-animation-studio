# Audit — Stickman Animation Studio (V3)

Date: 2026-11-24 · Reference machine: Windows 11, Ryzen-class 16-core host, **15–16 GB RAM,
no discrete GPU**, Node v24.19.0, Python 3.12.10.

> **Scope note, read this first.** This audit was written from a full read of every file plus
> real runs on the reference-class machine. What was *actually executed* is in
> `VERIFY-*.md` with pasted output. The 8-topic × full-quality render matrix from the brief was
> **not** completed in this session (each full 1080×1920 render of a 1-minute story plus the
> still inspection is tens of minutes of CPU); the blocked items are listed in `BLOCKERS.md`
> with the exact commands to finish them. Nothing here is marked PASS that was not run.

---

## 1. What the code actually does (map)

| Area | File | Assumption it makes |
|---|---|---|
| Agent pipeline | `SKILL.md`, `commands/make-video.md` | the agent hand-authors storyboard JSON with `x`/`z`/`pose`/props and runs 8 commands by hand |
| Schema | `engine/src/schema.ts` | every drawn detail is explicit in JSON; no semantic layer |
| Character rig | `engine/src/character/*` | poses are absolute joint offsets; `sit` used `drop: 58`, `lie` rotated −90° about the feet |
| 2D scene | `engine/src/scene/Scene.tsx` | actor root is always on the floor line `stageOf(env).y(z)`; props are decorative |
| 3D scene | `engine/src/location3d/*` | actors are 2D drawings projected through a three.js camera |
| Timeline | `engine/src/timeline.ts` | TTS returns per-word boundaries; `beats` bind to spoken words |
| Gates | `qa_sync.ts` (text), `qa_stills.py` (pixels), `qa_audio.py` (loudness), `qa_video` (was manual) | the picture matches the text because the JSON says so |
| Narration | `scripts/tts.py` | edge-tts gives exact word timings, always, first try |

The load-bearing assumption is the last one in the gates row: **"the JSON says pose=sit, so the
shot shows sitting."** Nothing measured the drawing.

---

## 2. Suspects S1–S13

### S1 — Broken clone URL · **CONFIRMED**
`README.md:100` and `install/INSTALL.md:72` contained `https://github.com/<you>/stickman-animation-studio`.
Copy-paste fails. Fixed to `god-dark-z/stickman-animation-studio`.

### S2 — Demo is only the `--preview` pass · **PARTIAL**
`README.md` says the demo is the 540×960 `--preview` pass. Full 1080×1920 was never evidenced.
Measured here: a 4-shot, 9.2 s story renders at draft in **6.0 s** of encode (total tail 19 s),
and the 1-shot edge case in 6.0 s. A full 1080 render of every topic was **not** run (see
`BLOCKERS.md`). Software WebGL was exercised indirectly: all stills in this audit are 2D; the
demo render that does use 3D locations is the background job recorded in `VERIFY-2-reliability.md`.

### S3 — TTS word timing · **MIXED: word boundaries REFUTED, flakiness CONFIRMED**
Measured on the installed `edge-tts 7.3.1` with the default `en-US-AndrewMultilingualNeural`:
a 3-word probe returned **3 WordBoundary events**; the real bed story returned **37 words,
median duration 113 ms**, mean distance to the nearest speech onset **48 ms**. So word-level
timing *does* work for this voice — the brief's hypothesis that multilingual voices only emit
sentence marks is **refuted here**.
What *is* real: the provider fails intermittently. The doctor's first probe raised
`NoAudioReceived` on the same machine minutes before the direct probe succeeded, so
**transient TTS failure** is a genuine narration-risk source. `tts.py` already retried 4×; the
doctor now retries and reports WARN instead of FAIL, and `qa_timing.py` is the safety net.

### S4 — Unpinned dependencies · **CONFIRMED**
No pins anywhere. Installed versions at audit time: `edge_tts 7.3.1`, `imageio_ffmpeg 0.8.1`,
`numpy 2.5.4`, `scipy 1.18.1`, `pillow 13.0.0` — i.e. *not* the versions the README implies.
Fixed with `engine/requirements.txt` (pinned) and `package-lock.json` (already committed).

### S5 — Path / working-directory ambiguity · **CONFIRMED**
`SKILL.md` showed `npx tsx scripts/qa_sync.ts stories/x.json`; `make.ts` resolved
`path.resolve(import.meta.dirname, "..")` while the gates resolved `process.cwd()`. Running from
the project root instead of `engine/` produced "file not found" for the gate and wrote output to
the wrong place. Fixed with `engine/scripts/paths.ts` (`resolvePaths`, `resolveStory`), used by
`make.ts`, `validate.ts`, `qa_geometry.ts`, `studio.ts`, `doctor_gl.ts`, plus `--engine <dir>`.

### S6 — `agentvision` is not shipped · **CONFIRMED**
`SKILL.md:135` ("else `agentvision check <file>` per still") and `templates/sync-map.md` referenced
a tool nothing installs. Fixed: `scripts/qa_visual_report.py` is shipped and produces the contact
sheet + per-shot claim checklist + a recorded-verdict reader. Docs now describe vision and
no-vision paths that both exist.

### S7 — Gates check text, not pixels' meaning · **CONFIRMED (the root cause)**
Two independent proofs:
1. `qa_sync` passed `pose: "sit"` + a chair at **0 errors** while the hip was ~80 px below the
   seat surface. Encoded now as a unit test: `the geometry gate flags a seated pose that never
   touched the chair`.
2. The shipped demo's "sleeping" shot (`stories/why-phone-gets-hot.json` shot 21, before the fix)
   drew the character **lying on the floor beside the bed** at 0 errors from all gates. Frame
   evidence: `out/why-does-your-phone-get-hot-when-signal-is-weak/stills/shot21.png` before/after
   in `VERIFY-3-semantics.md`.
Cause: `ActorSchema` had no way to express "on the bed", and `Scene.tsx` always placed the actor
root at the floor line.

### S8 — Overfitting to one example · **CONFIRMED**
One worked story + one demo placeholder + 14 unit tests, none of which rendered. Fixed: **9
story fixtures** under `engine/stories/tests/` (seating, sleeping, kitchen, driving, two-character
dialogue, science explainer, history with quotes, chart + day→night, and a one-shot edge case) and
**22 unit tests** including numeric contact tests for chair and bed.

### S9 — Inconsistent budgets · **CONFIRMED**
`SKILL.md` said "190–210 words ≈ 60–75 s". Measured: 37 words → 9.2 s of audio (≈4.0 w/s);
the demo's 188 words → 55.8 s. The stated range is ~20 % too long. Fixed: the skill now states
the measured rates per preset (3.8–4.0 w/s at +22 %; 3.2–3.4 at +6…10 %) and says the real
duration comes from the audio.

### S10 — Repo hygiene · **CONFIRMED**
`agentvision-render.png` (187 KB) sat at the repo root with no reference. Removed. `.gitignore`
already excluded `engine/out`, `engine/public/{sfx,music,voice}`, `*.log`, `__pycache__`.

### S11 — Agent adapters · **PARTIAL / NOT VERIFIED**
The installer writes pointer files for Codex/Antigravity/AGENTS.md readers and native command
folders for OpenCode/Cursor/Copilot/Gemini. **No real installation into Claude Code,
Antigravity or ZCode was performed in this session** — I cannot install those products here, so
per the brief's rule they must not be marked verified. `install/INSTALL.md` now says which routes
are exercised by convention only.

### S12 — Agent improvisation burden · **CONFIRMED**
A typical seated shot needed 8 hand-written values (`x`, `z`, `pose`, `expression`, `facing` plus
prop `x`/`z`/`scale`). Wrong values were exactly what broke the demo. The semantic layer reduces
this to `action` + `on` + `facing`: **8 → 3 manual numbers**, and the engine derives the rest.

### S13 — Autonomy instructions hide failure · **PARTIAL**
"No confirmation questions, no progress narration, no stopping halfway" is fine for autonomy, but
combined with hand-run commands a failed gate is easy to skip. Fixed structurally: `studio.ts` is
a state machine that **refuses to advance** and prints the resume command; `SKILL.md` now tells the
agent to stop and report on a failed stage rather than route around it.

---

## 3. Defect table

| ID | Sev | Symptom | Root cause (file:line at audit time) | Evidence | Fix | Test |
|---|---|---|---|---|---|---|
| D1 | blocker | Character described as "sleeping in bed" is drawn lying on the floor beside the bed | `scene/Scene.tsx` `resolveActors` always used `y = st.y(a.z)`; `ActorSchema` had no `on` field | demo still `shot21` (before) | semantic `sleepOn`/`lieOn` + anchors + placement in `scene/layout.ts` | `sleepOn rests the body on the mattress…`, demo still after |
| D2 | blocker | Seated character sinks into the chair | `character/poses.ts` `sit.drop = 58` put the hip 58 px below the seat; nothing anchored it | numeric: hip 80 px below seat | `sit.drop = 0`, hip anchored to `seat` | `sitOn puts the hip joint on the chair seat` |
| D3 | blocker | Gates report 0 errors on a wrong picture | `qa_sync.ts` `states()` compared narration words to pose *names in JSON* | test `flags a seated pose that never touched the chair` | new `qa_geometry.ts` reading the resolved scene graph | the same test |
| D4 | major | Demo-quality only; new topics look wrong | every placement was manual coordinates | S12 count | semantic action layer + docs | 9 story fixtures |
| D5 | major | Agent hits "file not found" from project root | mixed `import.meta.dirname` and `cwd` | S5 | `scripts/paths.ts` | `validate`/`qa_geometry` run from repo root |
| D6 | major | Install v1 fails at `git clone` | placeholder URL | S1 | corrected URL | grep shows no `<you>` |
| D7 | major | Dangling `agentvision` instruction; no vision fallback | S6 | grep | shipped `qa_visual_report.py` | report runs on real stills |
| D8 | major | Installs drift; "worked yesterday" | unpinned Python deps | `edge_tts 7.3.1` vs README intent | `requirements.txt` pinned | doctor lists versions |
| D9 | major | No single entry point; stages skipped | 8 hand-run commands | S13 | `scripts/studio.ts` state machine | full draft runs in `VERIFY-2` |
| D10 | major | Wrong word-count/duration guidance | S9 | measured 4.0 w/s | SKILL + references updated | — |
| D11 | major | Captions could sit on silence undetected | no timing gate | S3 flakiness | `qa_timing.py` (per-word + energy check) | run on real narration: PASS |
| D12 | minor | `sit` reads as standing at some framings; no knee-forward silhouette | 2D rig has no separate thigh | stills review | wider stance + slight backward tilt; documented limit | stills |
| D13 | minor | Stray `agentvision-render.png` | S10 | ls | removed | — |
| D14 | minor | Monitor at nearer z covered the whole character | no occlusion check; story staging | still `shot00` before restage | `FACE-OCCLUDED` check + restaged fixture | gate now errors on it |
| D15 | blocker (family) | The engine can only check the two poses it was tuned for; every other implied assumption is unchecked | validators were hand-written per defect | S7 evidence: 0 errors on a wrong picture | intent glossary (61 intents, 14 categories) + Scene Spec + numeric relation graph | `battery.ts` 61/61; `spec_check` on both fixtures |
| D16 | major | `react`/`hold`/`handOver`/`use` were rejected as "action without `on` prop" | `qa_geometry` treated every action as a placement action | `action: "handOver"` on the money fixture errored | `PLACEMENT` set: only `sitOn`/`lieOn`/`sleepOn`/`standAt` resolve anchors | battery `held-03-hands-over-money` |
| D17 | major | Narration says "stretches by the window"; no window in the shot | storyboard written from memory, nothing compared the sentence to the drawings | `spec_check` on bed-sleep: "facing window is false" | window props added to both fixtures; facing corrected | `spec_check` 0 errors |
| D18 | minor | Metaphor "cool to cooking" demanded a kitchen | keyword glossary has no notion of figurative speech | `qa_commonsense` on the shipped demo: 2 ERRORs | literal phrases tightened + reasoned `intentExempt` | unit test "a reasoned intent exemption…" |
| D19 | minor | "The seat was empty" failed on a bench | "seat" was hard-coded to `chair` | battery `negation-02` FAIL | `noActorOnAny` + `propsAny` | battery 61/61 |

---

## 4. What the demo hid

The demo is **one hand-tuned storyboard**, authored by the same agent that wrote the gates, with
every coordinate chosen to look good:

1. **No character ever sat on or lay in a piece of furniture.** The only "sleeping" shot drew the
   actor at floor level and the bed as nearby set dressing, and the sync gate's `sleep` rule was
   satisfied by `pose: "lie"` — so the gate certified a picture that showed a man asleep on the
   floor. That is why the demo passed and real runs did not.
2. **The gates measured text.** `qa_sync` maps the word "sleeps" to the token `lie` appearing in
   the JSON. It cannot see that the drawing is 200 px away from the mattress.
3. **The stills gate measures exposure.** A bed and a body both well lit, both on screen, passes
   luminance/saturation — even when the body is beside the bed.
4. **Framing was chosen to flatter.** The demo favours close-ups and inserts, where a table or a
   chart fills the frame; those shots have no contact to get wrong. The hard cases (seated at a
   desk, lying in a bed, inside a car) were simply not in the demo.
5. **Every 3D shot used a location the author had already tuned**, so "3D works" meant "these two
   locations work".

The fix is architectural, not cosmetic: the engine now **resolves** the placement from a declared
action and a prop's anchors, and a **separate geometric gate** reads the resolved scene graph.

---

## 5. Baseline metrics (what was actually run)

| Topic | Story | Gate results (after fix) | Render | Visual |
|---|---|---|---|---|
| Seating | `tests/chair-office.json` | sync 0E/0W · geometry 0E/0W · pixels 4/4 | stills 4.8 s | **visibly seated on the chair** |
| Sleeping | `tests/bed-sleep.json` | sync 0E/1W · geometry 0E/1W · pixels 4/4 · timing PASS · audio PASS · video PASS | draft 9.2 s video in 6.0 s encode | **lying in the bed, head on pillow, under blanket** |
| Science explainer | `tests/science-explainer.json` | sync 0E · geometry 0E | stills | not viewed individually |
| History + quotes | `tests/history-dialogue.json` | sync 0E · geometry 0E | — | not viewed |
| Kitchen | `tests/kitchen-cook.json` | sync 0E/3W · geometry 0E | — | not viewed |
| Driving | `tests/drive-travel.json` | sync 0E · geometry 0E/1W | — | not viewed (2D stand-in; see limits) |
| Two-character dialogue | `tests/dialogue-two.json` | sync 0E/1W · geometry 0E | — | not viewed |
| Chart + day→night | `tests/chart-daynight.json` | sync 0E · geometry 0E | — | not viewed |
| Edge: one silent shot | `tests/edge-short.json` | sync 0E · geometry 0E · video PASS | draft 1.6 s in 6.0 s | viewed (void, correct) |
| Demo (23 shots, 3D) | `stories/why-phone-gets-hot.json` | sync 0E/0W · geometry 0E/0W | draft job in `VERIFY-2` | sleep shot viewed |

**Not run:** full-quality 1080×1920 for all 8 topics; per-agent installs (S11).

---

## 6. Prioritised fix order (as executed)

1. **D1/D2/D3** — semantic placement + geometric gate (the product promise).
2. **D14** — occlusion, because "contact" without visibility is the same lie at a smaller scale.
3. **D5/D6/D7/D8** — install and path reliability, so a new user gets to a green render.
4. **D9** — one orchestrator with a state machine.
5. **D11** — timing audit against the audio.
6. **D10/D12/D13** — documentation, pose read, hygiene.
7. Tests and fixtures alongside each step, not afterwards.
