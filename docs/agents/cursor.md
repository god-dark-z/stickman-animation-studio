# Agent playbook — Cursor

## Where things live

| Thing | Location |
|---|---|
| Project rules | **`.cursor/rules/*.mdc`** — a plain `.md` in that folder is **ignored by the rules system**. Frontmatter: `description`, `globs`, `alwaysApply` |
| `AGENTS.md` | Supported at the repo root **and** in subdirectories, combining with parents (more specific wins) |
| User / team rules | Customize → Rules (not in the repo); precedence Team → Project → User |
| Sub-agents | `.cursor/agents/*.md` (frontmatter: `name`, `description`, `model`, `readonly`, `is_background`) |
| Chat/agent modes | Agent mode in the sidebar; Cmd/Ctrl-K for inline edits |

Cursor has no skill-folder concept. Install = a rule file pointing at SKILL.md + the repo.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Agent mode with terminal** | The pipeline is CLI: `npm run doctor`, then the gates, then the render. Give the agent the exact commands from SKILL.md; it iterates on real output. |
| **Sub-agents** | `.cursor/agents/*.md`; `is_background: true` returns immediately, otherwise the call blocks. Built-in `explore` and `browser` agents are auto-used. Launch several `Task` calls in one message to run them concurrently. |
| **Rules (`.mdc`)** | Put the non-negotiables in an `alwaysApply: true` rule (no AI imagery, one language, run the gates, never claim an unrun check) and a pointer to `SKILL.md`. Note `globs` is a **list**. Do **not** paste the manual into a rule — it bloats every request and drifts. |
| **Parallel editing** | Cursor's diff/apply flow is fast for the story JSON. Keep one file in focus; do not let it "helpfully" rewrite `engine/src`. |
| **Vision** | The `Read files` tool loads `.png/.jpg/.gif/.webp/.svg` into context for vision-capable models. Open `contact-sheet.png` to do the stills review. |
| **Web search** | The Agent `Web` tool generates queries and runs searches. Use it per claim for `fact-check.md`. |
| **Background terminal** | Supported in recent builds: start the render in a terminal tab and keep editing docs. |

## Order of operations

```
1  terminal: resolve_language.ts --text "<user text>" --json
2  terminal: npm run doctor
3  web research → fact-check.md
4  script.md → choose_voice --write voice-decision.md
5  Scene Spec → story JSON (one file, one focus)
6  terminal: qa_sync / qa_geometry / qa_commonsense (＋ bangla gates for bn)
7  terminal: stills → qa_stills → contact sheet; drag it into chat for the review
8  terminal: render → qa_video → qa_audio → ffprobe
9  deliver
```

## Pitfalls specific to Cursor

- **Rule bloat.** A 300-line always-on rule slows every request and competes with the real spec.
  Keep the rule short and let the agent read `SKILL.md`.
- **Auto-apply across files.** Cursor's "apply to all" can touch engine source. Watch the diff
  before accepting; the story is the input, the engine is not.
- **Terminal cwd.** Always `cd engine` (or pass `--engine`); paths resolve from the engine package.
- **No vision in some models.** If the model cannot see images, do not claim a visual review.

## Verification line for the report

```
agent: Cursor | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed in chat | geometric only>
```
