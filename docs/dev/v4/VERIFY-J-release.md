# VERIFY-J — release verification

## 1. Clean-room install (the brief's hardest check)

Cloned the `v4` branch into an empty directory and installed **from the README alone**.

```
$ git clone --branch v4 <repo> cleanroom && cd cleanroom/engine
$ ls public/fonts/          → 6 woff2 files present (fonts are committed, not fetched)
$ npm ci                    → ok
$ python scripts/doctor.py --quick
  …
  23 checks: 0 fail, 1 warn
  WARN chromium  not downloaded yet (first render downloads it)
  Ready.
```

No manual step was needed. The one WARN is expected and self-healing (Chromium downloads on the
first render).

### First English video

```
$ npx tsx scripts/studio.ts stories/why-phone-gets-hot.json --tier draft
✓ validate · bangla(skip) · glyphs(skip) · narration · timeline · sync · geometry · commonsense
✓ stills · pixels · timing · render (68.5s) · video · audio · visual · rubric
PASS — container, length and picture are inside spec.
PASS — loudness, peaks and voice presence are inside the professional window.
PASS — no narration↔visual contradictions detected by the lexicon gate.
PASS — every shot is at least 3/5 (average 3.81/5)
```

### First Bangla video

```
$ npx tsx scripts/studio.ts stories/tests/bangla-tea-stall.json --tier draft
✓ every stage, including bangla and glyphs
PASS — Bangla text is single-script, glossed, and cast in Bangla script.
PASS — every character on screen has a glyph in the bundled font.
PASS — container, length and picture are inside spec.
PASS — loudness, peaks and voice presence are inside the professional window.
```

A frame pulled from that clean-room render shows the Bangla caption শাথী বলল আজ with correct
conjuncts, in the committed fonts, with no tofu — so the Bangla path works from a fresh clone with
no extra install.

**Result: clean-room install = PASS for both languages.**

## 2. CI

`.github/workflows/ci.yml` — Ubuntu **and** Windows, Node 20, Python 3.12, no secrets, no GPU:

typecheck · `npm test` · Python tests · skill lint · doctor · both batteries · the English demo's
sync/geometry/commonsense/rubric · all three Bangla stories (text, gloss, glyphs, sync, geometry,
commonsense, rubric) · every test story's contract and geometry · a draft-tier silent render in
both languages · the eval report · artifacts.

`shell: bash` is set for the whole job so the gate loops behave identically on both runners.
YAML validated with a parser.

## 3. English regression against the Phase A baseline

The baseline (Phase A) is stored in `docs/dev/v4/golden-en/`. The English story was re-rendered at
`--tier standard` and compared.

| Measure | Baseline (Phase A) | Now | Delta |
|---|---|---|---|
| Resolution / fps / codec | 1080×1920, 30, h264+aac | identical | none |
| Gates | 0 geometry, 0 commonsense error, timing PASS | identical | none |
| Loudness | −14.7 LUFS | −14.8 LUFS | within tolerance |
| True peak | −1.5 dBTP | −1.5 dBTP | none |
| Narration | 188 words | 188 words | same script |
| Duration | 56.5 s | 55.9 s | **−0.6 s** |

**Why the duration moved.** The narration cache key gained `lang` in Phase B, so the English track
was synthesized once more. edge-tts returned slightly different word timings (same 188 words, same
voice, same rate) — the audio itself is service-generated, not bit-reproducible. This is a
*measurement* change, not a behaviour change: no English default, gate or code path changed.

**Visual identity, measured.** The two contact sheets (all 23 shots, same stills, same code):

```
baseline sheet: 1320×2160   current sheet: 1320×2160
mean absolute difference: 0.39 / 255
pixels differing by more than 8/255: 1.13 %
```

A whole-frame comparison at the same frame index: mean 1.06/255, 2.9 % of pixels above 8. The
differences are caption text at the sampled frames (the 0.6 s timeline shift), not the picture.

**Conclusion: English composition is unchanged.** The 0.6 s timing delta is recorded here, not
hidden.

## 4. Skill-lint and eval

```
$ npx tsx scripts/skill_lint.ts
0 error(s), 0 warning(s); 8 JSON example(s) parsed
PASS — frontmatter, links, paths, JSON examples and file hygiene are clean.

$ npm run eval
overall 332/332 (100 %)
```

## 5. Cross-agent research corrections

A research pass read the official documentation for nine products. Several playbooks were **wrong**
and are now corrected — which is exactly why the brief said not to guess:

| Playbook | What was wrong | Corrected to |
|---|---|---|
| Codex CLI | "no skill-folder convention" | skills load from **`.agents/skills/`** (not `.codex/skills`); sub-agents are **TOML** in `.codex/agents/`; `AGENTS.md` has a 32 KiB cap |
| Cursor | "`.md` rules work" | a plain `.md` in `.cursor/rules` is **ignored**; only `.mdc`. `AGENTS.md` is supported; agents in `.cursor/agents/` |
| OpenCode | `command/` singular, "no per-agent models" | `.opencode/commands/` (plural); subagents **are** per-model via `.opencode/agents/` with `mode: subagent`; no `allowed-tools` field |
| Gemini CLI | implied frontmatter commands | commands are **TOML** with `prompt` and `{{args}}` (not `$ARGUMENTS`); skills and `.gemini/agents/` exist |
| Copilot | "has prompt files, maybe skills" | **no skill system at all**; repo-wide + path-specific instructions + `AGENTS.md`; cloud agent runs in the background with a 59-minute ceiling |
| Claude Code | "AGENTS.md + CLAUDE.md" | `AGENTS.md` is read **only when no `CLAUDE.md` exists**; sub-agents in `.claude/agents/`, 20 concurrent |
| Antigravity | skill root assumed | rule files are `AGENTS.md` **and** `GEMINI.md` with a **silently enforced size limit**; skill root unverified |
| Windsurf / Aider | presented as known | explicitly marked **by convention / unverified** |

The ZCode playbook also gained the discovery order and the frontmatter constraints that actually
matter: a skill is **dropped** if its description exceeds 1024 chars, and the description is
truncated to ~250 chars when the model sees it. Our `SKILL.md` description is 998 chars, and its
first ~250 characters already carry "stickman cartoon video … English (default) or in Bangla /
Bengali (বাংলা) when the user asks for it" — so the Bangla trigger survives truncation. That is now
written down in the playbook.

## 6. What is still not proven (and is not claimed in the README)

- Nine of the ten agents were not installed or run here. Their playbooks say which facts come from
  documentation and which are convention.
- Per-model eval rows are empty. The harness accepts operator-recorded rows with a source and
  refuses to infer them.
- The craft-rubric average on the English demo is 3.81, below the aspirational 4. The report names
  the weak axes (specificity, automatic-only sound) instead of adjusting the rubric.
- `--tier studio` (CRF 16) was not rendered in this release run; `standard` and `draft` were.