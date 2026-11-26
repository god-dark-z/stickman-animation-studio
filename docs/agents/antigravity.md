# Agent playbook — Google Antigravity

> Verification status: **by convention.** Written from the product's documented model of
> agent-first IDE + skills/instructions; native support for this repo's exact folder layout is
> not confirmed here. `install/INSTALL.md` lists it as convention-only. If the layout differs in
> your build, drop the skill folder wherever that build reads agent instructions and keep the
> pointer.

## Where things live (expected)

| Thing | Location |
|---|---|
| Agent instructions | `AGENTS.md` at the repo root (the installer's `install.sh --target antigravity`) |
| Skill folder | `.agent/skills/stickman-animation-studio/` (mirrors the `.claude/skills` layout) |
| Command | `.agent/commands/make-video.md` where the build supports commands; otherwise the user types the prompt and the agent follows AGENTS.md |

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Multiple agents / parallel work** | Antigravity's model is multi-agent with a task view. Give research, fact-checking and asset inventory to separate tasks; keep storyboard + gates in one sequential task so only one writer touches `stories/*.json`. |
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
