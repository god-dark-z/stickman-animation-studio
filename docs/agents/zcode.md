# Agent playbook — ZCode

## Where things live

| Thing | Location |
|---|---|
| Skill (user scope) | `~/.zcode/skills/stickman-animation-studio/SKILL.md` (+ `references/`, `engine/`) |
| Command (user scope) | `~/.zcode/commands/make-video.md` → `/make-video` |
| Project instructions | `AGENTS.md` at the repo root (the installer appends a pointer block) |
| MCP servers | configured at user or workspace scope |

ZCode also loads plugin skills from a marketplace; this project does **not** require one — the
skill folder + `AGENTS.md` pointer is the whole install.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Sub-agents (Agent tool)** | Parallelise research and asset inventory. Independent work only — never two agents editing `stories/*.json`. |
| **Background bash** | `run_in_background: true` for the render; the task notifies you when it exits, so you can write docs meanwhile. |
| **Vision** | This model can read images: open `out/<slug>/contact-sheet.png` and fill `visual-review.md` verdicts. Also pull frames from the final MP4 with ffmpeg and look at them — that is the check that catches real defects. |
| **WebFetch / WebSearch** | Fact-check per claim. Keep the URL you actually read. |
| **TodoWrite** | Useful for the 13-stage pipeline: one todo per stage, so a long run never silently stalls. |
| **Skills / commands** | `/make-video <topic>` is the entry point; the command file resolves the language first and then defers to SKILL.md. |

## Order of operations that works

```
1  npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  npm run doctor
3  research (parallel agents) ∥ advance-check `locations.ts --list`
4  fact-check.md → script.md (format/arc/hook) → voice-decision.md
5  Scene Spec json → story json
6  qa_sync / qa_geometry / qa_commonsense (+ qa_bangla, qa_gloss, qa_glyphs for bn)
7  stills → pixels → contact sheet → your verdicts
8  render (background) → qa_video → qa_audio → ffprobe → frames from the MP4
9  deliver
```

## Pitfalls specific to ZCode

- **The workspace `AGENTS.md` block is a pointer, not the manual.** Do not duplicate the pipeline
  into it; duplication drifts. Keep the substance in SKILL.md.
- **Long renders + context compaction.** Start the render in the background, record the log path
  (`out/<slug>/run.log`), and read the log rather than re-running stages you already passed.
- **`--no-tts` is not a delivery mode.** It is for staging. A Bangla silent render will not prove
  timing; say so if you used it.
- **Draft tier is not delivery.** `--tier draft` is 540×960. The delivery bar is `standard`
  (1080×1920). Record the tier you actually rendered.
- **Do not run two renders at once** on a 16 GB CPU box; concurrency is capped by free RAM and two
  jobs will thrash.

## Verification line for the report

```
agent: ZCode | model: <name> | tier: <small|standard|max>
language: <en|bn> (resolver evidence: <rule>)
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
bangla gates: qa_bangla PASS · qa_gloss 0 err · qa_glyphs PASS   (bn only)
visual QA: frames pulled from the MP4 and inspected — <n> frames, <verdict>
```
