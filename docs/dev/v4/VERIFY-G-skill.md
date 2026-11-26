# VERIFY-G — skill excellence for every agent

## 1. SKILL.md rewritten as a director's manual

374 lines, one read. Structure:

1. **Hard rules** (7, non-negotiable, all modal verbs)
2. **Probe yourself → choose a tier** (table with the adaptation per missing capability)
3. **The pipeline** — 13 stages in one table: what each *proves*, plus the single orchestrator command
4. **Stage direction** for every stage: exact command, what to record, self-checks, decision tables,
   common mistakes
5. **Failure playbook** — 14 symptom → cause → fix rows, including the real errors seen this round
   (403 handshake, `NoAudioReceived`, OOM, tofu captions, gloss drift)
6. **Quality bar** — countable (≤2 fx/shot, ≤1 insert per 8–10 shots, no 3 identical framings)
7. **If you are a particular agent** → `docs/agents/`
8. **Reference map** — one line per file, "read it for"

Written in plain imperatives with numbers, not adjectives. Every command in it was run in this
session, so no instruction refers to something that does not exist (`skill_lint` enforces that:
it extracts `npx tsx scripts/X.ts` / `python scripts/X.py` from SKILL.md and fails on a missing file).

## 2. New references

| File | Content |
|---|---|
| `references/13-format-library.md` | **10 formats** (explainer, true story, historical, myth vs fact, how it works, comedy, parable, tutorial, news recap, mini drama), each with beats / shot grammar / ending options / worked example; **hook bank** (6 patterns × EN+BN); title + first-3-seconds guide; emotional arc table; **repetition guard** (5 axes, change 3); beat-to-shot budget table |
| `references/14-model-tiers.md` | small / standard / max: what each attempts per dimension, the probes that pick a tier, and the rules that do **not** change by tier (all gates, no AI imagery, one language) |
| `references/12-bangla-voice-and-script.md` | (Phase E) Bangla craft, 22 sentence pairs, voices, screen rules |

## 3. Agent playbooks — 10 + index

`docs/agents/`: `claude-code.md`, `zcode.md`, `antigravity.md`, `codex-cli.md`, `opencode.md`,
`cursor.md`, `gemini-cli.md`, `github-copilot.md`, `windsurf.md`, `aider.md`, `chat-only.md`, plus
`README.md` with a comparison table.

Each playbook states: where the product reads instructions, what it can parallelise, how to use
that ability here, the pitfall specific to that product, and a copy-paste verification line.
Every playbook is explicit that the gates do not change.

**Honesty about verification** (the brief forbids claiming untested installs): the index marks only
the ZCode run as executed in this environment; all others are marked "by convention". The research
agent's findings on current layouts are folded in below.

## 4. Eval harness

`npx tsx scripts/eval.ts` → `evals/REPORT.md`:

```
overall 314/314 (100 %)

| suite | lang | pass | rate |
| commonsense battery | en | 61/61 | 100 % |
| commonsense battery | bn | 49/49 | 100 % |
| language resolver | all | 59/59 | 100 % |
| voice choice | all | 41/41 | 100 % |
| bangla normalizer | bn | 44/44 | 100 % |
| bangla timing | bn | 18/18 | 100 % |
| skill lint | all | 1/1 | 100 % |
| typecheck | all | 1/1 | 100 % |
| gate stack | en | 3/3 each | 100 % (9 stories) |
| gate stack | bn | 5/5 each | 100 % (2 stories) |

By language: en 91/91, bn 121/121, all 102/102
```

The report is explicit about what it cannot measure: per-model pass rates need each model's API,
which the product rules forbid. It prints an operator recipe to add their own numbers to
`evals/model-runs.json`, and the report merges those rows **with their source**, never into the
measured figures.

## 5. Skill-lint

`npx tsx scripts/skill_lint.ts` — the repository's own hygiene gate:

```
0 error(s), 0 warning(s); 8 JSON example(s) parsed
PASS — frontmatter, links, paths, JSON examples and file hygiene are clean.
```

It checks: SKILL.md frontmatter (name matches, description long enough and mentions Bangla and
video), command frontmatter, every relative path mentioned in SKILL/README/agent docs resolves,
every fenced JSON example parses (and story-shaped examples have `title` + `cast`), no stray files
(`.DS_Store`, logs, `.bak/.rej/.swp`, leftover captures), SKILL.md's reference map is complete, and
no TODO/TBD/FIXME left in shipped docs.

**Bugs the lint found in this repo, all fixed:**

1. `references/11-commonsense-intents.md` had a JSON "example" that was a bare fragment
   (`"intentExempt": […]`), which is not valid JSON — now wrapped in an object.
2. The linter's own description regex truncated multi-line YAML and produced a false "SKILL.md does
   not mention Bangla" — the regex was wrong, the file was right.
3. A Scene Spec example was misclassified as a story example because both have `shots` — the check
   now distinguishes by the shape of the shot objects.

## 6. Cross-agent research

A research pass read the current documentation for the ten products. Where it confirmed a layout,
the playbook uses it; where it could not be confirmed from an official source, the playbook says
"by convention" and the index marks it. No playbook claims a verified install that was not run.

## 7. Verification run

```
$ npm test                     → 108 passed
$ npm run eval                 → 314/314 (100 %)
$ npx tsc --noEmit             → clean
$ npx tsx scripts/skill_lint.ts → 0 errors, 0 warnings
$ python scripts/doctor.py --quick → 23 checks, 0 fail
```

## 8. What is not proven

- Per-agent installs were not executed for the nine products not installed on this machine. The
  playbooks are documentation, labelled as such; `install/INSTALL.md` keeps the same distinction.
- The `max` tier's richer staging was not measured against `standard` in a blind comparison; the
  tier table is a specification for the agent, not a measured result.
- Eval numbers are the engine's and this agent's: no second model was run (BLOCKERS B4-2).