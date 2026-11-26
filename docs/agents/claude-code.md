# Agent playbook — Claude Code

## Where things live

| Thing | Location |
|---|---|
| Skill | `.claude/skills/stickman-animation-studio/SKILL.md` (+ `references/`, `engine/`, `templates/`) |
| Command | `.claude/commands/make-video.md` → invoked as `/make-video` |
| Project memory | `CLAUDE.md` at the repo root (one pointer line to the skill) |
| Settings/permissions | `.claude/settings.json` |

Claude Code discovers skills by folder, so installing the repo under `.claude/skills/` is enough —
no registration step. The command file's frontmatter carries `description` and `argument-hint`;
`$ARGUMENTS` is the user's text.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Sub-agents / Task tool** | Run research and asset inventory in parallel: one agent per 2–3 sources, one agent running `locations.ts --list` and the glossary scan. Do **not** parallelise stages that share the story JSON (storyboard, gates) — they must be sequential. |
| **Background bash** | Start the full render with `run_in_background: true`, then write `sync-map.md` and the delivery report while it runs. Poll the log; do not start a second heavy job concurrently. |
| **Vision** | Read `out/<slug>/contact-sheet.png` and individual stills. This is the highest-value capability you have: fill the PASS/FAIL verdict column in `visual-review.md` yourself. |
| **Web search** | Required for `fact-check.md`. Search per claim, not per topic; record the URL you actually opened. |
| **Hooks** | Optional: a PostToolUse hook on `Write` that runs `npx tsc --noEmit` after story JSON edits catches schema mistakes early. |
| **Plan mode** | Use it for the story concept and format choice only. Do not plan the gate fixes — the gate output *is* the plan. |

## Order of operations that works

```
1  npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  npm run doctor                                  # once per machine
3  Task(research agent) ∥ Task(asset inventory agent)
4  write fact-check.md from what came back
5  write script.md (format, arc, hook, beats)
6  npx tsx scripts/choose_voice.ts … --write stories/<slug>/voice-decision.md
7  write stories/<slug>.spec.json (Scene Spec) then stories/<slug>.json
8  qa_sync → qa_geometry → qa_commonsense  (fix to zero errors)
9  make --stills → qa_stills → qa_visual_report
10 read contact-sheet.png, fill verdicts, re-run qa_visual_report
11 make (background) → qa_video → qa_audio
12 ffprobe + pull frames from the MP4, look at them
13 deliver
```

## Pitfalls specific to this product

- **Long renders are interrupted by context compaction.** Use `run_in_background` and record the
  output path; the engine caches narration, so a re-run resumes cheaply.
- **`Read` on a large PNG** costs context. Read the contact sheet (one image) before individual
  stills, and only open a still when the sheet is ambiguous.
- **Do not let a sub-agent edit the story JSON.** Two writers produce conflicting shots. Sub-agents
  research and report; you write the JSON.
- **`CLAUDE.md` should stay a pointer.** The substance lives in SKILL.md and `references/` so other
  agents get the same instructions.

## Verification line for the report

```
agent: Claude Code | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · pixels PASS · timing PASS · video PASS · audio PASS
visual QA: contact sheet reviewed by me (vision) — 14/14 PASS
```
