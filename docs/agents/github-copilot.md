# Agent playbook — GitHub Copilot

## Where things live

| Thing | Location |
|---|---|
| Instructions | `.github/copilot-instructions.md` (repo-wide), plus `.github/instructions/*.instructions.md` with `applyTo` globs |
| Prompt files | `.github/prompts/*.prompt.md` (frontmatter: `mode`, `description`), invoked as `/name` in chat |
| Chat modes | `.github/chatmodes/*.chatmode.md` where supported |
| Agent mode | VS Code Copilot Chat → Agent (has terminal + file tools) |

Copilot has no skill-folder concept. Install = `copilot-instructions.md` pointing at SKILL.md +
the repo, and a prompt file for `/make-video`.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Agent mode with terminal** | Full pipeline is runnable: `npm run doctor` → gates → render. Give exact commands; Copilot iterates on output well. |
| **Prompt files** | `.github/prompts/make-video.prompt.md` forwards `$ARGUMENTS` to SKILL.md. Keep it a thin wrapper. |
| **Instructions with `applyTo`** | Scope the non-negotiables to the story files: an instruction with `applyTo: "engine/stories/**"` can state the Scene Spec rule, the sync contract and "one language per video". It fires when the agent edits a story, which is exactly when it matters. |
| **Vision in chat** | You can attach an image. Attach `contact-sheet.png` and ask for a per-shot PASS/FAIL against the claim column. That is the stills review. |
| **No background shell** | Renders run in the foreground. Use `--tier draft` first, then the final render, and budget the minutes. |
| **No web search in agent mode by default** | Research with a browsing tool or your own knowledge; if neither, mark every claim unverified in `fact-check.md`. |

## Order of operations

```
1  terminal: resolve_language.ts --text "<user text>" --json
2  terminal: npm run doctor
3  research → fact-check.md
4  script.md → choose_voice --write voice-decision.md
5  Scene Spec → story JSON
6  terminal: qa_sync / qa_geometry / qa_commonsense (＋ bangla gates for bn)
7  terminal: stills → qa_stills → contact sheet
8  chat: attach the contact sheet → per-shot verdicts
9  terminal: render → qa_video → qa_audio → ffprobe
10 deliver
```

## Pitfalls specific to Copilot

- **No background execution** means a full render blocks the session. Do the draft first to catch
  framing and timing errors cheaply.
- **Suggestions bleed into unrelated files.** Watch the diff; the story is the only input file.
- **Instruction files are injected into completions.** Keep them short and non-negotiables-only;
  the stage detail belongs in SKILL.md.
- **Vision only where enabled.** If image attach is unavailable in your setup, rely on the geometry
  gate and say so.

## Verification line for the report

```
agent: GitHub Copilot | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet attached and reviewed | geometric only>
```
