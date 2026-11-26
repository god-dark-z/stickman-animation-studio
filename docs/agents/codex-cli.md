# Agent playbook — OpenAI Codex CLI

## Where things live

| Thing | Location |
|---|---|
| Project instructions | `AGENTS.md` at the repo root (Codex reads it automatically) |
| Extra instruction files | `AGENTS.md` in subdirectories, merged from the root down |
| Config | `~/.codex/config.toml` (model, approval mode, sandbox) |
| Prompts (if supported) | `~/.codex/prompts/*.md`, invoked as `/name` |

Codex has no skill-folder convention. The install is: `AGENTS.md` pointer + the repo itself —
the agent reads SKILL.md and `references/` as ordinary files.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Shell-first workflow** | The whole pipeline is CLI. Run `npm run doctor`, then the gates, then the render. Codex is strongest here: give it exact commands and it will iterate on real output. |
| **Approval modes** | Use an auto-approve/sandbox mode that permits `bash` inside the repo but not network writes. Narration needs outbound HTTPS to the TTS endpoint; everything else is local. |
| **Background/streaming output** | Long renders: run with output redirected to a file and poll it (`npx tsx scripts/studio.ts … > out/run.log 2>&1 &`) if your build supports backgrounding; otherwise budget the minutes in the foreground. |
| **Vision** | Depends on the configured model. If it can read images, review `contact-sheet.png`; if not, rely on `qa_geometry` + `qa_stills.py` and say so. |
| **Web search** | If available (or via a tool), fact-check per claim. If not, write from knowledge and mark the table unverified. |
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
