# Decisions — V4

Judgement calls made without asking, with the reason. Numbering continues V3's list
(`docs/dev/DECISIONS.md` #1–16); V4 entries are prefixed to stay greppable.

## Phase A

| # | Decision | Why |
|---|---|---|
| V4-1 | Bump `engine/requirements.txt` from `edge-tts==7.0.2` to **`edge-tts==7.2.1`** | `boundary="WordBoundary"` (used by `scripts/tts.py`) only exists from 7.2.0; the old pin raises `TypeError` on a clean install. 7.2.1 is the minimum tested version, so it stays a tight pin. Verified in a throwaway venv: 7.0.2 and 7.1.0 reject the kwarg, 7.2.0/7.2.1 accept it, and 7.3.1 (this machine) returns Bangla word boundaries. |
| V4-2 | Do **not** copy anything from `parvez144/text-to-speech-with-edge-tts`; re-implement the useful behaviour in `tts.py`/`tts_bn.py` | The repo has **no LICENSE**, so there is no reuse grant, and its content is a ~20-line edge-tts wrapper with no unique logic. Voice list is free Microsoft data verified independently with `edge-tts --list-voices`. Credit it in docs as inspiration only. |
| V4-3 | Bangla timing uses edge-tts word boundaries as the **primary** path, forced alignment as fallback | Verified all four `bn-` voices return 19/19 boundaries on a 2-sentence sample. Building forced alignment as the primary would be strictly worse. Fallback still implemented for offline mode and for a voice that stops returning boundaries. |
| V4-4 | English golden baseline = `stories/why-phone-gets-hot.json` at `--tier standard` | It is the shipped demo (23 shots, 2D+3D mix, inserts, night grade) — the widest coverage in one render. Stored in `docs/dev/v4/golden-en/` with frames + contact sheet for the Phase J regression. |
| V4-5 | `--tier standard` for baseline, `draft` for CI/test-story gate runs | Gate results are resolution-independent (sync/geometry/commonsense/timing read the JSON, audio/video read the MP4 at whatever size). Full-quality renders are reserved for the baseline, demos and release assets — saves ~30 min of CPU per CI run. |
| V4-6 | Keep `.freebuff/` untouched and gitignored | It is Freebuff Desktop's project state (its own `.gitignore` forbids editing/committing). Not repo content, not a stray file to clean. |
| V4-7 | Visual QA of the baseline done by the model's own eyes on extracted frames, recorded as such | The machine has vision in this session. The frames (opening/middle/end) are stored so a reviewer can re-check the same evidence; agents without vision must fall back to geometric QA and say so. |

## Phase B

| # | Decision | Why |
|---|---|---|
| V4-8 | Language packs are **JSON data** (`engine/lang/<id>/pack.json`) with a thin TS loader, not TS modules | The Python side (`resolve_language.py`, `tts.py`, `doctor`) must read the same voice catalog and budgets without a Node runtime. Data also means "add a language" really is a data task. |
| V4-9 | Resolver is TypeScript with a **Python bridge that shells out to the TS CLI** | One implementation, two entry points. Re-implementing the heuristics in Python would guarantee divergence over time; the bridge costs one process spawn per decision. |
| V4-10 | A directive verb written in Bangla script ("…বলো / …বানাও / …করো") counts as an explicit Bangla request | If the user is instructing the agent in Bangla and telling it to say/make the video, the language intent is unambiguous. Treating it as "topic only" would produce an English video for a Bangla-speaker's request. |
| V4-11 | `"script"` removed from the production-noun trigger list | "The origin of the Bangla script" is a topic about the writing system; including the word caused a false positive in the first test run. Explicit request words remain (narration/voice/voiceover/audio/video/captions/version). |
| V4-12 | The narration cache key includes `lang` | A story switched from en→bn must never reuse the English MP3 and its word timings — a silent, near-invisible class of bug. |
| V4-13 | `--voice male\|female` maps to the **first voice of that gender in the default locale**, falling back to any locale | Deterministic and documented; Bangla's default locale is BD, so a male narrator is Pradeep (BD) before Bashkar (IN). Explicit ids always pass through unchanged. |
| V4-14 | `tts.py` keeps one entry point for both languages; `--lang` selects the normalizer | Duplicating the whole edge-tts path for Bangla would double the surface for regressions. The English path is the same code as V3 (normalize returns the text unchanged). |

## Phase C

_(to be filled as the phase proceeds)_