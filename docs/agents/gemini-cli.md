# Agent playbook — Gemini CLI

## Where things live

| Thing | Location |
|---|---|
| Context file | `GEMINI.md` — global `~/.gemini/GEMINI.md`, workspace, and JIT files as tools touch directories. Concatenated (not overridden); `context.fileName` can list several names |
| Skills | `SKILL.md` per folder (Agent Skills standard): `~/.gemini/skills/` or `<repo>/.gemini/skills/` (`.agents/skills/` also works). Frontmatter `name` + `description`; activation asks the user for consent |
| Custom commands | `.gemini/commands/*.toml` — **TOML with `prompt` and optional `description`, invoked as `/name`**. Subdirs join with `:` |
| Sub-agents | `.gemini/agents/*.md` or `~/.gemini/agents/*.md` — frontmatter `name`, `description`, `kind: local`, `tools`, `model`, `max_turns`; the body is the system prompt |
| Settings | `.gemini/settings.json` (tools, approval, MCP servers) |

Gemini CLI reads `GEMINI.md` as its instruction file and discovers commands from TOML files. This
repo ships `install/make-gemini-toml.sh`, which writes a `/make-video` TOML command that forwards
to SKILL.md. **The argument placeholder in a Gemini command is `{{args}}`, not `$ARGUMENTS`** — a
common porting mistake.

## What this product gives you, and how to use it

| Ability | How to use it here |
|---|---|
| **Shell tools** | Run the whole pipeline from the CLI. Gemini CLI is shell-first; give it the exact gate commands and iterate on output. |
| **Sub-agents** | "Specialists the main agent can hire": each has its own context window and a restricted tool set, invoked automatically or forced with `@name` (`@generalist`). Use `@generalist` for research, and keep the story JSON to the main thread. |
| **Long context** | A large window makes it tempting to read everything. Resist: read the one reference the stage names and keep the story JSON as the single source of truth. |
| **Web search / grounding** | Where enabled, use it for `fact-check.md`, one search per claim. Record the URL actually opened. |
| **Vision** | The `read_file` tool loads images, audio and PDF. If the configured model understands them, review `contact-sheet.png`; otherwise say "visual QA was geometric only". |
| **Limits are quotas, not tokens** | Documented per-day request caps (1,000/day on the individual free tier, higher on paid plans) rather than a context number. A long gate-fix loop burns them — fix the cause, do not brute-force. |
| **Non-interactive mode** | `gemini -p "<prompt>"` is useful for a scripted run: feed it the topic and let it execute the pipeline. Keep approval prompts on for writes. |

## Order of operations

```
1  npx tsx scripts/resolve_language.ts --text "<user text>" --json
2  npm run doctor
3  research → fact-check.md
4  script.md → choose_voice --write voice-decision.md
5  Scene Spec → story JSON
6  qa_sync / qa_geometry / qa_commonsense (＋ qa_bangla, qa_gloss, qa_glyphs for bn)
7  stills → qa_stills → contact sheet → verdicts (if vision)
8  render → qa_video → qa_audio → ffprobe
9  deliver
```

## Pitfalls specific to Gemini CLI

- **`GEMINI.md` must stay a pointer.** Put the manual in SKILL.md so every agent reads the same
  words. A divergent copy is worse than no copy.
- **Command TOML needs `prompt` and `description`.** The installer generates it; if `/make-video`
  does not appear, check the TOML parsed (see `zcode-guide:diagnosing-commands` for the shape of
  command frontmatter problems).
- **Large context ≠ careful.** Do not let it "read the whole repo"; staged reading keeps quality up.
- **Approval on writes.** Keep file-write approval on for the first run; the engine's generated
  files can be large.

## Verification line for the report

```
agent: Gemini CLI | model: <name> | tier: <small|standard|max>
gates: doctor PASS · sync 0 err · geometry 0 err · commonsense 0 err · timing PASS · video PASS · audio PASS
visual QA: <contact sheet reviewed | geometric only>
```
