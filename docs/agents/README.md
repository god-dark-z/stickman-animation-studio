# Agent playbooks — index

Ten products plus a chat-only fallback. Each playbook states where that product reads instructions
from, what it can parallelise, and how to use its specific abilities for speed and quality. **The
work and the gates are identical in every case** — the playbook changes how you run it, never what
the video must prove.

| Agent | Instructions live in | Sub-agents | Background | Vision | Status |
|---|---|---|---|---|---|
| [Claude Code](claude-code.md) | `CLAUDE.md` / `.claude/CLAUDE.md`; `.claude/skills/`; `.claude/commands/` (still supported); `.claude/agents/` | yes — 20 concurrent default, 3 nesting layers | yes (`claude --bg`, `claude agents`) | yes (`Read` on images) | layout verified against docs; pipeline not run there |
| [ZCode](zcode.md) | `~/.zcode/skills/`, `~/.zcode/commands/`, `AGENTS.md` | yes (`~/.zcode/agents/*.md`) | yes | model-dependent | **this repository's reference run** |
| [Google Antigravity](antigravity.md) | `AGENTS.md` **and** `GEMINI.md` (size-limited); skill folder via `/skills` | yes (tabs, `run_workflow`) | yes (Background Tasks panel) | yes | partly verified; skill root unverified |
| [Codex CLI](codex-cli.md) | `AGENTS.md` (+`.override`, 32 KiB cap); skills in **`.agents/skills/`**; agents in `.codex/agents/*.toml` | yes (TOML agents) | yes (`/subagents`, `/goal`) | yes (`-i`, paste) | verified against docs |
| [OpenCode](opencode.md) | `AGENTS.md` + `instructions`; `.opencode/commands/`; `.opencode/agents/` | **yes, per-agent models** | yes (`subagent: true`) | yes (`read` tool) | verified against docs |
| [Cursor](cursor.md) | `.cursor/rules/*.mdc` (**`.md` ignored**), `AGENTS.md`, `.cursor/agents/` | yes (`.cursor/agents/`) | yes (`is_background`) | yes (`Read files`) | verified against docs |
| [Gemini CLI](gemini-cli.md) | `GEMINI.md`; skills in `.gemini/skills/`; commands `.gemini/commands/*.toml` (`{{args}}`); agents `.gemini/agents/` | yes (`@name`) | not documented | yes (`read_file`) | verified against docs |
| [GitHub Copilot](github-copilot.md) | `.github/copilot-instructions.md`, `.github/instructions/`, `AGENTS.md`; **no skill system** | parallel sessions; cloud agent | yes (cloud agent, 59 min) | yes (attach, model must support) | verified against docs |
| [Windsurf](windsurf.md) | `.windsurf/rules/`, `.windsurf/workflows/` | unverified | unverified | model-dependent | by convention |
| [Aider](aider.md) | `CONVENTIONS.md` / `--read AGENTS.md` (no auto-discovery) | no | no | no | by convention |
| [Chat-only](chat-only.md) | the conversation | no | no | maybe | scripts + handoff only |

"Status" is honest about verification. Only the ZCode run in `docs/dev/v4/` was executed end to end
here. "Verified against docs" means the layouts and capabilities below were read from each
product's official documentation in this research pass — not that an install was run.
"By convention" / "unverified" means exactly that.

## The three things every playbook says

1. **Keep the product's instruction file a pointer.** The manual is `SKILL.md`; a divergent copy in
   `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` is worse than no copy.
2. **One writer per story file.** Parallel agents may research and run gates; only one agent edits
   `stories/<slug>.json` and its spec.
3. **Never claim a check the product could not run.** No vision → "geometric only". No shell → no
   gate results, no render.

## Choosing between them for this pipeline

| Need | Best fit | Why |
|---|---|---|
| Highest quality on the story, cheap on the gates | OpenCode (subagents with separate models) | different model per agent type |
| Long unattended render while you write | Claude Code / ZCode | real background execution |
| Strict CLI iteration on gate errors | Codex CLI / Gemini CLI | shell-first, promptable non-interactively |
| Reviewing stills in the chat window | Claude Code / Cursor / Copilot | image attach is part of the flow |
| No shell at all | chat-only handoff | the script is still worth having |
