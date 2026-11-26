# Agent playbook — OpenCode

## Where things live

| Thing | Location |
|---|---|
| Instructions | `AGENTS.md` at the repo root (primary), plus `~/.config/opencode/AGENTS.md` for user scope |
| Config | `opencode.json` (project) or `~/.config/opencode/opencode.json` |
| Commands | `.opencode/command/*.md` (frontmatter: `description`, optionally `agent`, `model`) |
| Agents (subagents) | `.opencode/agent/*.md` — each with its own prompt, model and tools |

OpenCode supports real subagents with their own models. That is the main lever here: give the
cheap model the mechanical stages and the strong model the story.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Subagents with separate models** | Configure a `fast` agent (small/cheap model) for gate runs, file reads, and log triage, and a `smart` agent for the script, the Scene Spec and the storyboard. That split is the single biggest quality-per-cost win in this pipeline. |
| **Commands** | `.opencode/command/make-video.md` with `$ARGUMENTS`, resolving the language first, then deferring to SKILL.md. |
| **Shell + background tool** | Start the render in a background session, keep writing `sync-map.md`; poll the log. |
| **Vision** | Model-dependent. If the configured model reads images, do the contact-sheet review; otherwise state "geometric only". |
| **Web fetch/search** | Use a tool-enabled agent for research; one search per claim. |
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
