# Agent playbook — Google Antigravity

> Verification status: **partially verified.** Rule files (`AGENTS.md`, `GEMINI.md`), the skills
> panel, `SKILL.md` with `name`/`description`, subagents and a Background Tasks panel are documented
> by the product. The exact on-disk skill root and per-file precedence are **unverified** (the docs
> site was unreachable during this research). `install/INSTALL.md` lists it as convention-only.

## Where things live

| Thing | Location |
|---|---|
| Rule files | **`AGENTS.md` and `GEMINI.md`** — both are rule files; `/learn` appends to them |
| Skill | a `SKILL.md` folder, loaded via the `/skills` panel; `agy plugin validate` checks it. Frontmatter: `name` + `description`; a skill with no `name` takes its folder's name |
| Commands | no documented command-folder convention verified — invoke by prompt, or import Claude-style skills with `agy plugin install` / `agy plugin import` |

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Multiple agents / parallel work** | Subagents appear as tabs, in the Overview Panel (`Ctrl+Alt+O`), and in the Remote Control browser view; `run_workflow` fans work out to many in parallel or in stages and combines results. Give research, fact-check and asset inventory to separate subagents; keep storyboard + gates in one sequential task so only one writer touches `stories/*.json`. |
| **Background Tasks panel** | First-class: long commands are tracked (`run_command` + `NotificationTimeoutSeconds` so the agent is woken instead of polling), with a countdown ("59m left") and daemon vs non-daemon tasks. Start a render there, not in a blocking terminal call. |
| **Claude-skill import** | This repo's skill is Claude-compatible (folder + `SKILL.md` + `references/`), so `agy plugin import` is the intended path rather than copying files by hand. |
| **Long-running renders** | Start `npx tsx scripts/studio.ts …` as a background task and keep working on docs; the engine caches narration, so an interrupted render resumes cheaply. |
| **Vision** | If your session can read images (many Antigravity surfaces can), open `out/<slug>/contact-sheet.png` and fill the verdict column. If it cannot, say "visual QA was geometric only". |
| **Browser surface** | Do **not** try to render through the built-in browser. Remotion's renderer is driven from the shell; the browser adds nothing and risks a WebGL mismatch. |
| **Web search** | Required for `fact-check.md`. One search per claim. |

## Order of operations

```
1  npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  npm run doctor
3  research tasks (parallel) → fact-check.md
4  script.md (format/arc/hook) → choose_voice → voice-decision.md
5  Scene Spec → story JSON
6  qa_sync → qa_geometry → qa_commonsense (→ qa_bangla, qa_gloss, qa_glyphs for bn)
7  stills → qa_stills → contact sheet → verdicts
8  render (background) → qa_video → qa_audio → ffprobe
9  deliver
```

## Pitfalls

- **Rule files have a documented size limit, and the cut-off is silent.** `/learn` notes that a
  `GEMINI.md`/`AGENTS.md` beyond the limit had its ending "silently cut off". Keep the pointer file
  short (product nouns, the command, the gates) and leave the manual in `SKILL.md`.
- **Don't trust a "done" from a sub-agent.** Sub-agents return summaries; the gates are the truth.
  Re-run the gate yourself on the story JSON.
- **One writer per file.** Parallel agents must not both edit the story JSON or the spec.
- **The engine is a subproject.** Always `cd engine` (or pass `--engine`) — paths resolve from the
  engine's `package.json`, and a wrong cwd produces confusing "no story called …" errors.
- **Draft tier is not delivery.**

## Verification line for the report

```
agent: Google Antigravity | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed | geometric only>
```
