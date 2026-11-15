# Install — Stickman Animation Studio (V2)

One repository, three installation routes, adapters for the major AI coding agents. After any of
them, `/make-video <topic>` (or any "make me a video about X" request) runs the full pipeline.

## Compatibility (honest status — verified means tested on this repo)

| Agent | `/make-video` invocation | How | Status |
|---|---|---|---|
| Claude Code | `/make-video <topic>` | `.claude/skills/…/SKILL.md` + `.claude/commands/make-video.md` | ✅ native — **verified** |
| ZCode | `/make-video <topic>` | same `.claude/…` layout + `.zcode/` conventions | ✅ native — **verified** |
| OpenCode | `/make-video <topic>` | `.opencode/command/make-video.md` custom command | ✅ command installed — native slot, per OpenCode docs |
| Cursor (1.6+) | `/make-video <topic>` | `.cursor/commands/make-video.md` | ✅ command installed — version-dependent |
| VS Code + GitHub Copilot | `/make-video` in chat | `.github/prompts/make-video.prompt.md` prompt file | ✅ prompt file installed — version-dependent |
| Gemini CLI | `/make-video <topic>` | `.gemini/commands/make-video.toml` custom command | ✅ command installed — per Gemini CLI docs |
| Codex CLI | "make a video about X" | `AGENTS.md` pointer → reads the skill files | ✅ by convention (AGENTS.md standard) |
| DeepSeek / OpenCode-agent / Antigravity / other AGENTS.md readers | "make a video about X" | `AGENTS.md` pointer | ✅ by convention |
| Windsurf | "make a video about X" | `.windsurf/rules/…` pointer | ✅ by convention |
| Aider | "make a video about X" | `CONVENTIONS.md` pointer | ✅ by convention |
| Chat-only agents (no filesystem) | paste prompt | `install/PASTE-THIS-PROMPT.md` — same pipeline; renders only via Mode A handoff | ✅ honest fallback |

Never a false claim: "verified" rows were actually exercised; convention rows rely on each
vendor's documented standard config file; the paste-prompt route is the designed fallback for
everything else. All routes converge on the same `SKILL.md` pipeline and the same executable
gates — quality does not depend on the agent.

## Route A — install script (recommended)

From a clone of this repository:

```bash
# macOS / Linux / Git Bash / WSL — inside your project folder:
/path/to/stickman-animation-studio/install/install.sh --with-engine

# Windows PowerShell:
\path\to\stickman-animation-studio\install\install.ps1 -WithEngine
```

What it does:

1. Copies `SKILL.md` + `references/` to `.claude/skills/stickman-animation-studio/` — the
   canonical skill location (native for Claude Code and ZCode; every pointer file routes other
   agents here).
2. Installs the `/make-video` command into each agent's native slot: `.claude/commands/`,
   `.opencode/command/`, `.cursor/commands/`, `.github/prompts/make-video.prompt.md`,
   `.gemini/commands/make-video.toml`.
3. Writes pointer sections into `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`,
   `.cursor/rules/stickman-animation-studio.mdc`, `.windsurf/rules/stickman-animation-studio.md`,
   and `CONVENTIONS.md`.
4. `--with-engine` also copies the render engine into `./engine` (dependencies excluded).

Re-running is safe (idempotent). `--dir` targets another project directory.

## Route B — manual install

1. Copy `SKILL.md` and `references/` into `.claude/skills/stickman-animation-studio/`.
2. Copy `commands/make-video.md` into whichever command slots your agent supports
   (`.claude/commands/`, `.opencode/command/`, `.cursor/commands/`, `.github/prompts/*.prompt.md`,
   or convert to `.gemini/commands/*.toml`).
3. Add one paragraph to the file your agent reads (AGENTS.md, `.cursor/rules/*.mdc`,
   `.github/copilot-instructions.md`, GEMINI.md, CONVENTIONS.md):

   > When the user asks to make a video/short/cartoon or types `/make-video <topic>`, read
   > `.claude/skills/stickman-animation-studio/SKILL.md` and follow it exactly.

4. Copy `engine/` into the project (or let the skill copy it on first run).

## Route C — GitHub one-liner for the user's agent

```text
Install the Stickman Animation Studio skill:
  git clone https://github.com/<you>/stickman-animation-studio .skill-tmp
  .skill-tmp/install/install.sh --with-engine
Then run: /make-video Why Does Your Phone Get Hot When Signal Is Weak?
```

(Windows: `powershell -File .skill-tmp\install\install.ps1 -WithEngine`.)

## One-time engine setup

```bash
cd engine
npm install                                        # Remotion + three + zod
pip install edge-tts imageio-ffmpeg numpy scipy pillow   # narration + procedural audio + QA gates
```

Requirements: Node 18+, Python 3.10+, and a Chromium-compatible browser for rendering (Remotion
downloads a headless one automatically). All 65 SFX, 6 music beds and the film grain are
generated procedurally on first render. English narration via edge-tts (free, no key, needs
internet); `--no-tts` works fully offline.

## Verify the install

```bash
cd engine
npm test                       # 14 unit tests (timeline/captions/schema, English)
npx tsx scripts/qa_sync.ts stories/why-phone-gets-hot.json    # sync gate → PASS, 0 errors
npm run make -- stories/demo.json --stills --no-tts
# → out/placeholder/stills/shot00.png exists
```

Then: `/make-video Why Does Your Phone Get Hot When Signal Is Weak?` — the fully worked example
ships at `engine/stories/why-phone-gets-hot.json`.
