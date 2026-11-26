# Agent playbook — OpenAI Codex CLI

## Where things live

| Thing | Location |
|---|---|
| Project instructions | `AGENTS.md` (+ `AGENTS.override.md`, which wins) — Codex walks from the git root down to your cwd, at most one file per directory, concatenated so nearer wins. Hard cap `project_doc_max_bytes`, **32 KiB** default |
| Global instructions | `$CODEX_HOME/AGENTS.md` (default `~/.codex/`) |
| Skills | **`.agents/skills/<name>/SKILL.md`** — *not* `.codex/skills`. Searched from cwd up to the repo root, plus `~/.agents/skills` and `/etc/codex/skills`. Frontmatter is exactly `name` + `description` |
| Config | `~/.codex/config.toml`; project `.codex/config.toml` loads **only when you trust the project** |
| Sub-agents | `~/.codex/agents/*.toml` (personal) or `.codex/agents/*.toml` (project) — **TOML, not markdown**: `name`, `description`, `developer_instructions` are required |

Two corrections worth knowing: the skill folder is `.agents/skills`, and sub-agent files are TOML.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Shell-first workflow** | The whole pipeline is CLI. Run `npm run doctor`, then the gates, then the render. Codex is strongest here: give it exact commands and it will iterate on real output. |
| **Sub-agents (TOML)** | `codex/agents/*.toml` with their own model and instructions; concurrency via `agents.max_concurrent_threads_per_session` (excluding the primary). Use one for research, one for gate triage — never two on the story JSON. |
| **`/goal` and worktrees** | `/goal` holds a long-running objective with a progress row; parallel chats are meant to use **git worktrees**, and the docs say "avoid letting two chats change the same files" — the one-writer rule again. |
| **Approval modes** | Use an auto-approve/sandbox mode that permits `bash` inside the repo but not network writes. Narration needs outbound HTTPS to the TTS endpoint; everything else is local. |
| **Background/streaming output** | Long renders: run with output redirected to a file and poll it (`npx tsx scripts/studio.ts … > out/run.log 2>&1 &`) if your build supports backgrounding; otherwise budget the minutes in the foreground. |
| **Vision** | `-i screenshot.png` / `--image a.png,b.png`, or paste into the composer / Shift+drag in the IDE. Whether the configured model understands images is separate — if it does not, say "geometric only". |
| **Web search** | `--search`, or `web_search = "live"` in `config.toml`. Fact-check per claim; record the URL you opened. |
| **Patch-based edits** | Codex applies diffs well. Ask for one file at a time; never let it rewrite the whole engine. |

## Order of operations

```
1  npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  npm run doctor
3  research → fact-check.md
4  script.md → choose_voice --write voice-decision.md
5  Scene Spec → story JSON
6  qa_sync / qa_geometry / qa_commonsense (＋ bangla gates for bn)
7  stills → qa_stills → contact sheet → verdicts (if vision)
8  render → qa_video → qa_audio → ffprobe
9  deliver
```

## Pitfalls specific to Codex

- **Sandbox blocks the network by default in some modes.** Narration will fail with a connection
  error. Either allow outbound HTTPS or run with `--no-tts` for staging and re-render with TTS.
- **Codex likes to "fix" code it was not asked to touch.** Tell it explicitly: do not modify
  `engine/src/**` unless the gate error names an engine bug; the story is the input.
- **Long context, weak summarisation.** Keep the story JSON as the single source of truth and
  re-read the gate output rather than the conversation history.
- **No vision → do not fake the review.** Write "visual QA was geometric only" in the report.

## Verification line for the report

```
agent: Codex CLI | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed | geometric only>
```
