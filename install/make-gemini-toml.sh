#!/usr/bin/env bash
# Converts commands/make-video.md into a Gemini CLI custom command (TOML).
# usage: make-gemini-toml.sh <make-video.md> <out.toml>
set -euo pipefail
IN="$1"; OUT="$2"
{
  printf 'description = "Produce a complete professional English stickman cartoon video (Stickman Animation Studio)"\n'
  printf 'prompt = """\n'
  # strip the YAML frontmatter (between the first two --- lines), keep the body,
  # and translate the argument placeholder to Gemini's {{args}}
  awk 'NR==1 && $0=="---"{fm=1; next} fm==1 { if ($0=="---") { fm=2; next }; next } { print }' "$IN" \
    | sed -e 's/"""/"""""/g' -e 's/\$ARGUMENTS/{{args}}/g'
  printf '\n"""\n'
} > "$OUT"
