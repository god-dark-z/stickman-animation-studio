# Agent playbook — GitHub Copilot

## Where things live

| Thing | Location |
|---|---|
| Instructions | `.github/copilot-instructions.md` (repo-wide, does **not** cascade), plus `.github/instructions/**/NAME.instructions.md` with an `applyTo` glob |
| `AGENTS.md` | Supported anywhere in the repo; **the nearest one wins** (an alternative to the repo-wide file) |
| Prompt files | `.github/prompts/*.prompt.md`, invoked as `/name` in chat |
| Skill system | **None.** There is no `SKILL.md` / skill folder. The nearest equivalents are instruction files, prompt files and chat modes |

Copilot has no skill-folder concept, and that is the honest answer: install =
`copilot-instructions.md` pointing at SKILL.md + the repo, and a prompt file for `/make-video`.
Do not tell a user to install a "skill" here.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Agent mode with terminal** | Full pipeline is runnable: `npm run doctor` → gates → render. Give exact commands; Copilot iterates on output well. Copilot's docs also ask that instruction files stay "no longer than 2 pages" and "not task specific" — one more reason the manual lives in SKILL.md. |
| **Cloud agent** | On github.com the Copilot cloud agent works **in the background** in a sandbox and opens one PR per task, with a **59-minute** ceiling per session. Good for a full render + gate loop; not interactive. |
| **Prompt files** | `.github/prompts/make-video.prompt.md` forwards `$ARGUMENTS` to SKILL.md. Keep it a thin wrapper. |
| **Instructions with `applyTo`** | Scope the non-negotiables to the story files: an instruction with `applyTo: "engine/stories/**"` can state the Scene Spec rule, the sync contract and "one language per video". It fires when the agent edits a story, which is exactly when it matters. |
| **Vision in chat** | Add Context → **Screenshot Window** (mark up a region) or attach a file; the **selected model must support images**. Attach `contact-sheet.png` and ask for a per-shot PASS/FAIL against the claim column. That is the stills review. |
| **Local agent runs are foreground** | In the editor, renders block. Use `--tier draft` first, then the final. For unattended work use the cloud agent or a remote/cloud session. |
| **Web** | VS Code chat has `#fetch` (retrieves a URL, confirms external ones before visiting). That is fetching, not search. Research accordingly, and mark anything unverified in `fact-check.md`. |

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
