#!/usr/bin/env bash
# Stickman Animation Studio — installer for AI coding agents.
#
#   ./install.sh                      install skill + /make-video command into the current project
#   ./install.sh --with-engine        also copy the render engine into ./engine
#   ./install.sh --dir /path/to/proj  install into another project directory
#
# Installs the skill files to .claude/skills/stickman-animation-studio/ (native for Claude Code
# and ZCode) and writes pointer rules for Cursor, Codex, Copilot, Gemini CLI, Windsurf and Aider
# so every agent finds the skill. Idempotent — safe to re-run.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${TARGET:-$PWD}"
WITH_ENGINE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-engine) WITH_ENGINE=1 ;;
    --dir) TARGET="$2"; shift ;;
    -h|--help) grep '^#' "$0" | head -8; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

SKILL_DIR="$TARGET/.claude/skills/stickman-animation-studio"
mkdir -p "$SKILL_DIR" "$TARGET/.claude/commands"
cp "$SRC/SKILL.md" "$SKILL_DIR/SKILL.md"
cp -r "$SRC/references" "$SKILL_DIR/references"
cp "$SRC/commands/make-video.md" "$TARGET/.claude/commands/make-video.md"
echo "✓ skill  → $SKILL_DIR"
echo "✓ command → $TARGET/.claude/commands/make-video.md"

# --- per-agent command adapters (same body, each agent's native slot) -------------
# OpenCode: .opencode/command/*.md   (invoked as /make-video)
if mkdir -p "$TARGET/.opencode/command" 2>/dev/null; then
  cp "$SRC/commands/make-video.md" "$TARGET/.opencode/command/make-video.md"
  echo "✓ command → $TARGET/.opencode/command/make-video.md"
fi
# Cursor (1.6+): .cursor/commands/*.md
if mkdir -p "$TARGET/.cursor/commands" 2>/dev/null; then
  cp "$SRC/commands/make-video.md" "$TARGET/.cursor/commands/make-video.md"
  echo "✓ command → $TARGET/.cursor/commands/make-video.md"
fi
# VS Code GitHub Copilot: .github/prompts/*.prompt.md (invoked as /make-video in chat)
if mkdir -p "$TARGET/.github/prompts" 2>/dev/null; then
  cp "$SRC/commands/make-video.md" "$TARGET/.github/prompts/make-video.prompt.md"
  echo "✓ prompt  → $TARGET/.github/prompts/make-video.prompt.md"
fi
# Gemini CLI: .gemini/commands/*.toml (invoked as /make-video)
if mkdir -p "$TARGET/.gemini/commands" 2>/dev/null; then
  "$SRC/install/make-gemini-toml.sh" "$SRC/commands/make-video.md" "$TARGET/.gemini/commands/make-video.toml"
  echo "✓ command → $TARGET/.gemini/commands/make-video.toml"
fi

if [[ $WITH_ENGINE -eq 1 ]]; then
  mkdir -p "$TARGET/engine"
  tar -C "$SRC/engine" --exclude=node_modules --exclude=out -cf - . | tar -C "$TARGET/engine" -xf -
  echo "✓ engine → $TARGET/engine  (run: cd engine && npm install && pip install edge-tts imageio-ffmpeg numpy scipy)"
fi

MARKER="<!-- stickman-animation-studio:v1 -->"
POINTER="$MARKER
## /make-video — Stickman Animation Studio

When the user asks to make/create/generate a video, short, cartoon or animated explainer (or
types \`/make-video <topic>\`): read \`.claude/skills/stickman-animation-studio/SKILL.md\` and
follow it exactly. It researches and fact-checks the topic, writes a 190–210 word script,
storyboards it as JSON, renders it with the bundled programmatic stickman engine, QA-gates every
shot, and delivers a verified 1080×1920 MP4. No AI image/video generation, no paid APIs.
Reference material lives beside SKILL.md in \`references/\`."

write_pointer() { # file
  local f="$1"
  mkdir -p "$(dirname "$f")"
  if [[ -f "$f" ]] && grep -q "$MARKER" "$f"; then
    # replace the previous block (marker .. end of file/next marker)
    awk -v m="$MARKER" 'BEGIN{skip=0} index($0,m){skip=1; exit} {print}' "$f" > "$f.tmp"
    mv "$f.tmp" "$f"
  fi
  printf '%s\n\n' "$POINTER" >> "$f"
  echo "✓ pointer → ${f#$TARGET/}"
}

write_pointer "$TARGET/AGENTS.md"                                # Codex CLI, ZCode, opencode, …
write_pointer "$TARGET/GEMINI.md"                                # Gemini CLI
write_pointer "$TARGET/.github/copilot-instructions.md"          # GitHub Copilot
write_pointer "$TARGET/.cursor/rules/stickman-animation-studio.mdc" # Cursor
write_pointer "$TARGET/.windsurf/rules/stickman-animation-studio.md" # Windsurf
write_pointer "$TARGET/CONVENTIONS.md"                           # Aider

cat <<'EOF'

Done. Next:
  - Claude Code / ZCode: type  /make-video Why Does Your Phone Get Hot When Signal Is Weak?
  - Other agents: just ask for a video — the pointer rules route them to the skill.
  - First render in a new project copies ./engine (or use --with-engine), then:
      cd engine && npm install && pip install edge-tts imageio-ffmpeg numpy scipy
EOF
