---
description: Produce a complete professional stickman cartoon video in English (default) or Bangla from a topic, title, or TXT concept file
argument-hint: <topic | title | path/to/concept.txt> [in Bangla]
---

# /make-video

Input: `$ARGUMENTS`

Execute the **Stickman Animation Studio** pipeline end to end. The skill definition is at
`.claude/skills/stickman-animation-studio/SKILL.md` (installed by the stickman-animation-studio
repository); its reference library lives beside it in `references/`. If that file is missing,
locate the skill repository's SKILL.md and use it.

Rules of engagement:

1. **Resolve the language first, mechanically** — do not guess:
   ```bash
   npx tsx scripts/resolve_language.ts --text "<the user's exact request>" --json
   ```
   It returns `{lang, voice_pref, evidence}`. `en` is the default; `bn` only when the user asks
   for it ("in Bangla", "বাংলায়", "bangla te banao"). A topic that merely mentions Bangla
   (literature, cinema, the language movement) does **not** switch language. If the resolver
   returns a `note`, print that one line in the final report.
2. **Probe your capabilities first** (SKILL.md step 0): web search? vision on images? background
   execution? Adapt the workflow — but never skip the executable QA gates.
3. Read `SKILL.md` and follow it exactly, in order: resolve engine → resolve language → research
   + fact-check → script + voice direction → assets → storyboard + **sync gate** (`qa_sync`,
   0 errors) → stills gate → render → **audio gate** (`qa_audio`) → repair loop (≤3 rounds/gate)
   → deliver. For Bangla also run the gloss-faithfulness, glyph-coverage and Bangla timing gates.
4. Read only the `references/` files the current stage names. For Bangla use
   `references/12-bangla-voice-and-script.md`.
5. Work autonomously: no confirmation questions, no progress narration, creative decisions are
   yours. If a step is blocked, route around it (next tool, next asset, build it yourself) —
   never stop halfway to warn about possible problems.
6. One production language per video: the narration's language governs the captions, labels and
   inserts too. No mixed-language videos (say so if asked for one).
7. No AI image/video generation, no paid APIs; every frame and sound is produced by code.
8. Before declaring done, run every gate and report exactly what you checked, with the MP4 path,
   the script, the fact-check table, the sync map, the resolved language and voice with the
   reason, and honest limits.

Begin immediately with the input above.
