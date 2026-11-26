# Agent playbook — Aider

## Where things live

| Thing | Location |
|---|---|
| Conventions | `CONVENTIONS.md`, loaded with `aider --read CONVENTIONS.md` |
| Instructions (persistent) | `aider --read AGENTS.md` or a `.aider.conf.yml` with `read:` entries |
| Chat modes | `code`, `architect` (plan then edit), `ask` |

Aider has no agent loop and no subagents: it is a pair-programming editor with strong repo mapping.
Treat it as "you drive, Aider edits".

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Repo map** | Aider's strongest feature: let it read `engine/src/**` and `engine/scripts/**` so its edits to a story or a reference respect real ids and schema. |
| **Architect mode** | Use it for the script → Scene Spec → story JSON chain: plan in architect mode, then apply edits in code mode. |
| **Shell via `!`** | Run the gates yourself with `! npx tsx scripts/qa_sync.ts …` and paste the output into the chat. Aider reads it and proposes the fix. |
| **No subagents / no background** | Research and renders are yours. Run commands in a separate terminal and feed Aider the results. |
| **No vision** | Do not claim a visual review. Rely on `qa_geometry` and `qa_stills.py`; state that limitation in the report. |
| **Web** | None built in. Research elsewhere; keep the URLs. |

## Order of operations

```
1  ! npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  ! npm run doctor
3  (your own research) → write fact-check.md
4  architect: script.md plan → code: commit the file
5  ! npx tsx scripts/choose_voice.ts … --write voice-decision.md
6  architect: Scene Spec → code: stories/<slug>.spec.json → stories/<slug>.json
7  ! qa_sync → paste → fix → repeat; then qa_geometry, qa_commonsense
8  ! make --stills → qa_stills
9  ! render → qa_video → qa_audio → ffprobe
10 deliver (write the report yourself)
```

## Pitfalls specific to Aider

- **It edits what it is given.** `/add` exactly the file you want changed; an over-broad add set
  produces sprawling diffs.
- **No visual capability.** Never let the report imply a frame was seen.
- **Commit per fix.** Aider's auto-commit is a gift here: `git log` becomes the repair history, and
  a bad edit is one `git revert` away.
- **It cannot run long jobs.** Keep the render in your own terminal.

## Verification line for the report

```
agent: Aider | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: geometric only (no image input in this setup)
```
