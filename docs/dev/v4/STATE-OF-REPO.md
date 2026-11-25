# STATE-OF-REPO — what V3 delivered and what V4 must finish

Audited 2026-11-26 against the V3 brief's Definition of Done. Claims below are verified by
reading the code and running the stated commands, not by trusting the README.

## 1. What exists (V3 ship)

| Area | Evidence (code, not claims) | State |
|---|---|---|
| Orchestrator entry point | `engine/scripts/studio.ts` — 13 stages (`validate→narration→timeline→sync→geometry→commonsense→stills→pixels→timing→render→video→audio→visual`), `.state.json` resume, `--tier draft\|standard\|studio`, `--resume`, `--from` | Done |
| Scene Spec layer | `engine/src/commonsense/spec.ts` (ShotSpecSchema: where/who/support/props/relations/world/negations), `engine/scripts/spec_check.ts`, `templates/scene-spec.md` | Done |
| Semantic action layer | `ActorSchema.action` (`sitOn/lieOn/sleepOn/standAt/hold/use/face/pointAt/react/handOver`) + `on`; anchors in `engine/src/scene/anchors.ts`; geometry gate `qa_geometry.ts` runs the same placement code as the renderer | Done |
| Commonsense glossary | `engine/data/intent-glossary.json` — 56 entries, each with `category/phrases/requires/good/bad` | Done |
| Commonsense battery | `engine/data/commonsense-battery.json` — 60 micro-stories (self-described 14 categories) + `engine/scripts/battery.ts` | Done |
| Intent gate | `engine/scripts/qa_commonsense.ts` (GLOSSARY + SCENE SPEC, exits 1 on ERROR, coverage counter, `--min-coverage`); `engine/src/commonsense/glossary.ts` | Done |
| Relation graph | `engine/src/commonsense/relations.ts` (`RELATIONS`, `checkRelation`, `VISUAL_ONLY`), numeric checks inside `validateSpec` | Done |
| Timing audit | `engine/scripts/qa_timing.py`; per-word `WordBoundary` timing from edge-tts; `engine/scripts/tts.py` retries with backoff; V3 targets: median ≤120 ms, max ≤300 ms (VERIFY-2/3 record passing runs) | Done |
| Stills + pixel gate | `make.ts --stills`, `qa_stills.py` (exposure/dead-frame), `qa_visual_report.py` (contact sheet + per-shot claim checklist) | Done |
| Audio gate | `qa_audio.py` (loudness −14 LUFS ±1.5, true peak ≤−1.0 dBTP, voice-presence) | Done |
| Video gate | `qa_video.py` (container, spec, dead frames) | Done |
| Doctor | `engine/scripts/doctor.py` — node/python/deps/WebGL/network/tts probes, PASS/WARN/FAIL + fix command | Done |
| English voice direction | `references/10-english-voice-direction.md`; default `en-US-AndrewMultilingualNeural` @ `+22%` | Done |
| Offline TTS fallback | `engine/scripts/tts_kokoro.py` (local Kokoro ONNX + faster-whisper timings) | Done |
| Installers/adapters | `install/INSTALL.md`, `install/install.sh`, `install/install.ps1`, `install/make-gemini-toml.sh`, `install/PASTE-THIS-PROMPT.md` | Done |

## 2. Verified environment facts (2026-11-26)

- Windows 10.0.26300, Git Bash; Python 3.12.10; Node v24.19.0; npm 11.17.0.
- `edge-tts` **7.3.1** installed globally; repo pins **7.0.2** in `engine/requirements.txt`
  (Phase A must verify 7.0.2 behaves identically — see BLOCKERS).
- ffmpeg 9.0.2 present (WinGet Gyan build); engine scripts use `imageio-ffmpeg` themselves.
- `engine/out/` already has draft-tier outputs from V3 sessions
  (`why-does-your-phone-get-hot-when-signal-is-weak/`, `battery/`, test-story dirs).
- `engine/stories/bed-test-sleep/` and `engine/stories/edge-test-very-short/` contain `.state.json`
  from V3 → orchestrator resume works across sessions.
- `.freebuff/` is Freebuff Desktop state (gitignored); do not touch.

## 3. Against the V3 Definition of Done — the gaps V4 must close

| V3 DoD item | Status | V4 action |
|---|---|---|
| "A person typing `/make-video …` gets a verified 1080×1920 MP4" | Works (draft-tier verified in V3; full tier = BLOCKERS B1: not all 8 topics rendered full-quality) | Phase A baseline: render demo full-quality once; leave tests at draft where phase needs only gates |
| "Eval harness across agents and models" | **Missing** — no `evals/` dir. V3 BLOCKERS B4: per-model eval needs paid APIs → out of scope; only gate + battery tests on one model | Phase G: build `evals/` harness that runs batteries + craft rubric on any agent/model the operator can access; do not require paid APIs by default |
| "Craft rubric (avg ≥4, no shot <3)" | `references/07-rendering-qa.md` references the rubric but **no executable rubric scorer exists** — check: `scripts/*.ts` has no `rubric` script; verify in Phase G | Phase G/H: implement `qa_rubric.ts` (per-shot scoring from spec+geometry+pixel signals, human verdict hook) |
| "Skill text direction-complete for every stage; agent playbooks for each supported agent" | SKILL.md covers a core loop well and is model-agnostic; **no per-agent playbooks** (`docs/agents/` absent), **no model-tier profiles** | Phase G: rewrite SKILL.md as director's manual + `docs/agents/*` playbooks + tier profiles |
| "English + Bangla commonsense batteries pass on ≥2 agents and 2 model sizes" | English battery runs (one model here, no other agent installed) | Phase G/H: extend battery to Bangla (40+ stories) — same engine gates; cross-agent numbers recorded where the operator runs them |
| "CI green" | **No CI config in repo** (`ls .github` → absent). `npm run qa` script exists locally | Phase J: add `.github/workflows/ci.yml` |
| "Release v4.0.0" | Not done | Phase J |

Also noted (Phase I material): README is 261 lines with 10+ badges, inline image tables, and a
self-reported "Verified on" list — replace with the short professional landing page. `docs/demo/`
has 12 PNG stills + demo.mp4 + 2 GIFs; `docs/banner.svg` exists.

## 4. Bangla gap (whole new work)

Nothing in `engine/` speaks Bangla: TTS is English-only (`tts.py` default en voice, `schema.ts`
`PROVIDER_VOICES` en-only), the glossary/battery/script craft are English, fonts are
Montserrat via CDN, no `engine/lang/`, no `--lang`, no `resolve_language`. All of Phases B–F.

## 5. What V4 must NOT regress

- English default behaviour + golden output (Phase A stores the baseline; Phase J re-runs it).
- The gate stack: nobody weakens a gate to pass; Bangla enters the same gates with its own
  lexicon/gloss wiring.
- The "no AI imagery / no paid APIs / CPU-16GB" constraints.

## 6. First actions taken in this session

- Probing edge-tts Bangla voices and word-boundary timing (see VERIFY-A).
- Reading the owner's Bangla TTS repo (see BANGLA-TTS-REPO-NOTES.md).
- Rendering the English golden baseline (VERIFY-A).