# Agent playbook — Claude Code

## Where things live

| Thing | Location |
|---|---|
| Skill | `.claude/skills/stickman-animation-studio/SKILL.md` (+ `references/`, `engine/`, `templates/`) — also `~/.claude/skills/` for user scope |
| Command | `.claude/commands/make-video.md` → `/make-video` (still supported; skills are the newer path) |
| Project memory | `CLAUDE.md` or `.claude/CLAUDE.md`; `AGENTS.md` is read **only when no CLAUDE.md exists** |
| Path-scoped rules | `.claude/rules/*.md` with a `paths:` frontmatter glob |
| Sub-agent definitions | `.claude/agents/*.md` (project) or `~/.claude/agents/*.md` (user) |
| Settings/permissions | `.claude/settings.json` |

Skill frontmatter is all-optional but `description` is what triggers it; `name` defaults to the
folder name. Frontmatter is parsed **only** when `---` is the file's first line.

Claude Code discovers skills by folder, so installing the repo under `.claude/skills/` is enough —
no registration step. The command file's frontmatter carries `description` and `argument-hint`;
`$ARGUMENTS` is the user's text.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Sub-agents (`Task` / `.claude/agents/`)** | Real concurrency: 20 concurrent sub-agents by default, each with its own context window, nesting to 3 layers. Run research and asset inventory in parallel — one agent per 2–3 sources. Do **not** parallelise stages that share the story JSON (storyboard, gates): two writers on one file produce conflicting shots. |
| **Background execution** | `claude --bg` starts a background agent and returns immediately; `claude agents` monitors/dispatches parallel sessions; `claude attach <id>` reattaches. For a render, start it detached and poll `out/<slug>/run.log`. Do not run two heavy renders at once on 16 GB. |
| **Vision** | `Read` returns PNG/JPEG/GIF/WebP as visual content with no permission needed inside the working dir. This is the highest-value capability you have: open `out/<slug>/contact-sheet.png`, fill the PASS/FAIL verdict column in `visual-review.md` yourself. |
| **Web search** | Built-in `WebSearch` + `WebFetch`, both **permission-prompted** (interactive terminals cap at 200 searches/session). Required for `fact-check.md`: search per claim, record the URL you actually opened. |
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

## Context hygiene

`SKILL.md` should stay under ~500 lines (it is ~374). Documented guidance: keep `CLAUDE.md` under
200 lines, and note that re-attached skills after compaction keep only the first ~5k tokens each —
which is another reason the manual is short and the detail lives in `references/`.

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
