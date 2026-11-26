# Agent playbooks — index

Ten products plus a chat-only fallback. Each playbook states where that product reads instructions
from, what it can parallelise, and how to use its specific abilities for speed and quality. **The
work and the gates are identical in every case** — the playbook changes how you run it, never what
the video must prove.

| Agent | Instructions live in | Sub-agents | Background | Vision | Status |
|---|---|---|---|---|---|
| [Claude Code](claude-code.md) | `.claude/skills/`, `.claude/commands/`, `CLAUDE.md` | yes (Task) | yes | yes | layout exercised by `install.sh`; full pipeline run not verified here |
| [ZCode](zcode.md) | `~/.zcode/skills/`, `~/.zcode/commands/`, `AGENTS.md` | yes (Agent) | yes | yes (this model) | **this repository's reference run** |
| [Google Antigravity](antigravity.md) | `AGENTS.md` + agent skills folder | yes | yes | model-dependent | by convention |
| [Codex CLI](codex-cli.md) | `AGENTS.md`, `~/.codex/config.toml` | no | shell `&` | model-dependent | by convention |
| [OpenCode](opencode.md) | `AGENTS.md`, `opencode.json`, `.opencode/agent/` | **yes, with per-agent models** | yes | model-dependent | by convention |
| [Cursor](cursor.md) | `.cursor/rules/*.mdc`, `.cursor/commands/` | no | terminal tabs | yes in chat | by convention |
| [Gemini CLI](gemini-cli.md) | `GEMINI.md`, `.gemini/commands/*.toml` | no | shell `&` | model-dependent | by convention |
| [GitHub Copilot](github-copilot.md) | `.github/copilot-instructions.md`, `.github/prompts/` | no | no | yes (attach) | by convention |
| [Windsurf](windsurf.md) | `.windsurf/rules/`, `.windsurf/workflows/` | no | partial | model-dependent | by convention |
| [Aider](aider.md) | `CONVENTIONS.md` / `--read AGENTS.md` | no | no | no | by convention |
| [Chat-only](chat-only.md) | the conversation | no | no | maybe | scripts + handoff only |

"Status" is honest about this repository's verification: only the ZCode run in
`docs/dev/v4/` was actually executed end to end here. "By convention" means the layout follows the
product's documented model of instructions/skills; it has **not** been executed in this
environment. `install/INSTALL.md` keeps that distinction visible, and the CI cannot verify a product
it cannot install.

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
