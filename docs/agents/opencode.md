# Agent playbook — OpenCode

## Where things live

| Thing | Location |
|---|---|
| Instructions | `AGENTS.md` (discovered automatically), plus an `instructions` key for extra files/globs/URLs |
| Config | `opencode.json(c)` (project) or `~/.config/opencode/opencode.json(c)` |
| Commands | **`.opencode/commands/*.md`** (plural; singular `command/` is legacy-but-read). Frontmatter: `description`, `agent`, `model`, `subagent` — **no `allowed-tools`** |
| Agents (subagents) | **`.opencode/agents/*.md`** — the markdown body becomes the agent's `system` prompt; frontmatter accepts `mode: primary|subagent|all`, `model` (`provider/model#variant`), `permissions` |

OpenCode supports real subagents with their own models. That is the main lever here: give the
cheap model the mechanical stages and the strong model the story.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Subagents with separate models** | This is the standout capability here: `.opencode/agents/fast.md` on a cheap model for gate runs and log triage, `.opencode/agents/smart.md` on a strong model for the script and Scene Spec. Biggest quality-per-cost win in the pipeline. `mode: subagent` + `subagent: true` runs the child in the background and reports when it goes idle. |
| **Commands** | `.opencode/commands/make-video.md` with `$ARGUMENTS`, resolving the language first, then deferring to SKILL.md. `$1`/`$2` are positional; no placeholder means the args are appended. |
| **Shell + background tool** | `subagent: true` gives a background child session (fresh context, reports back). For a render, start it detached and poll `out/<slug>/run.log`. `subagent_depth` defaults to **1**, so a child cannot spawn grandchildren. |
| **Vision** | Model-dependent. If the configured model reads images, do the contact-sheet review; otherwise state "geometric only". |
| **Web search** | Native `websearch.provider: "random"` picks an available provider. One search per claim. |
| **TUI with tabs** | Run the long render in one session and the documentation in another; they share the repo but not the JSON writer. |

## Order of operations

```
1  fast agent: resolve_language.ts --text "<user text>" --json
2  fast agent: npm run doctor
3  smart agent ∥ fast agent: script/format decision vs research → fact-check.md
4  smart: script.md → choose_voice --write voice-decision.md
5  smart: Scene Spec → story JSON
6  fast: qa_sync / qa_geometry / qa_commonsense loop until 0 errors
7  fast: stills → qa_stills → contact sheet
8  smart (vision): review the sheet, fill verdicts
9  fast: render (background) → qa_video → qa_audio → ffprobe
10 smart: delivery report
```

## Pitfalls specific to OpenCode

- **Two agents, one file.** Never let the fast agent and the smart agent both edit
  `stories/<slug>.json`. Assign the file to exactly one agent per run.
- **Model mismatch.** A small model writing the storyboard produces generic staging. Keep the story
  and the spec on the stronger model even if the gates run on the cheap one.
- **Config drift.** Keep command/agent files thin (description + one instruction block). The manual
  is SKILL.md.
- **No vision configured = no visual claim.** Say "geometric only" in the report.

## Verification line for the report

```
agent: OpenCode | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed | geometric only>
```
