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

| # | Decision | Why |
|---|---|---|
| V4-15 | One Bangla request handles the whole script up to **900 chars**; chunking is the exception | Measured: a 102-word / 37 s / 588-char script synthesizes in one request with all 102 word boundaries. Chunking costs intonation continuity and adds join arithmetic, so it only earns its place beyond what one request can do. |
| V4-16 | Chunk placement uses **byte offset ÷ bytes-per-second**, not the previous word's end | The first implementation shifted by the last word end and silently lost 2.8 s across four chunks (timings ended at 8.87 s in an 11.66 s file). The MP3 is fixed-bitrate, so the byte clock is exact; a test cross-checks header-derived bytes/sec against ffprobe on a real file. |
| V4-17 | Forced alignment anchors sentence boundaries on the **longest quiet runs near the proportional estimate**, monotonically | Measured on real audio: proportional split averaged 306 ms; "quietest nearby frame" averaged 400+ ms (it locks onto a comma pause); longest-run anchoring reached **mean 107 ms, max 147 ms**. The proportional estimate stays as the fallback-within-the-fallback. |
| V4-18 | Voice fallback keeps **gender before accent**: same gender other locale beats other gender same locale | A male narrator turning female mid-story is a casting change; turning Indian-accented is a soft change. Nabanita → Tanishaa → Pradeep → Bashkar. |
| V4-19 | `--estimate-only` writes a silent MP3 placeholder and prints `ESTIMATED` | `--no-tts` at the orchestrator level skips narration entirely; the Bangla engine also needs to answer "how long would this read?" offline. The label keeps an estimate from being mistaken for measured timing. |
| V4-20 | The normalizer's number words use South-Asian grouping (হাজার / লক্ষ / কোটি) and years read in the 1000–1999 two-digit form | That is how Bangla speakers say these numbers; a literal digit-by-digit or Western-grouped reading sounds machine-translated. 1990 → উনিশশো নব্বই, not এক হাজার নয়শো নব্বই. |
| V4-21 | The pronunciation dictionary is **generated by a checked-in script**, not hand-edited JSON | 392 entries are reproducible and reviewable as a diff; `doctor` verifies ≥200 are present. |

## Phase D

| # | Decision | Why |
|---|---|---|
| V4-22 | Voice scoring lives in `lang/<id>/voice-scoring.json`; the chooser is code | The table is editorial judgement ("war stories lean male"), so the owner must be able to edit it without a build step. The code only adds weights and explains them. |
| V4-23 | Interrogatives ("why do", "how does", `কেন`, `কীভাবে`) are **not** tone signals | First test run: "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন" scored tech +2 and gentle +2 → tie → female default for a tech topic. A question is a format; the subject carries the tone. |
| V4-24 | Tests expect the **gender**, not the voice id | Voice ids are catalog data that can legitimately change when a voice is replaced; the narrative decision ("male-leaning") must not. Id-pinned tests break on catalog edits without any behaviour change. |
| V4-25 | Multi-voice narration is a **speaker plan** (one run per shot), joined on the byte clock | It reuses the proven single-track contract: captions, beats, lip-sync and loudness do not need to know several voices exist. |
| V4-26 | The single-voice path is untouched; multi-voice activates only for ≥2 distinct voice+rate+pitch combinations | Zero regression risk for existing stories and the golden baseline; character voices are opt-in per cast member. |
| V4-27 | Same-voice speakers must differ by **≥8 % rate** | Below that the ear hears one person. 8 % is audible on these voices and stays inside natural prosody; the error names the alternative voices in the pack. |
| V4-28 | `bangla` is a fixed stage in the orchestrator that **skips** for English | One fixed stage list beats branching: a Bangla story can never skip its text gate, and the state file, resume and `--from` keep working unchanged. |
| V4-29 | The voice-decision file is written **before** narration, skipped when the cast sets voices explicitly | The record must exist even if a later stage fails; with every voice explicitly chosen there is no automatic decision to justify. |
| V4-30 | The Bangla text gate treats a line that is >60 % Latin letters as an ERROR, isolated Latin words as WARN | A whole English sentence in a Bangla film is a wrong-language bug; one brand name is a style choice the writer can resolve with the pronunciation dictionary. |

## Phase E

_(to be filled as the phase proceeds)_