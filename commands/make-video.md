---
description: Produce a complete professional English stickman cartoon video from a topic, title, or TXT concept file
argument-hint: <topic | title | path/to/concept.txt>
---

# /make-video

Input: `$ARGUMENTS`

Execute the **Stickman Animation Studio** pipeline end to end. The skill definition is at
`.claude/skills/stickman-animation-studio/SKILL.md` (installed by the stickman-animation-studio
repository); its reference library lives beside it in `references/`. If that file is missing,
locate the skill repository's SKILL.md and use it.

Rules of engagement:

1. **Probe your capabilities first** (SKILL.md step 0): web search? vision on images? background
   execution? Adapt the workflow — but never skip the executable QA gates.
2. Read `SKILL.md` and follow it exactly, in order: resolve engine → research + fact-check →
   English script + voice direction → assets → storyboard + **sync gate** (`qa_sync`, 0 errors) →
   stills gate → render → **audio gate** (`qa_audio`) → repair loop (≤3 rounds/gate) → deliver.
3. Read only the `references/` files the current stage names.
4. Work autonomously: no confirmation questions, no progress narration, creative decisions are
   yours. If a step is blocked, route around it (next tool, next asset, build it yourself) —
   never stop halfway to warn about possible problems.
5. English-only production. No AI image/video generation, no paid APIs; every frame and sound is
   produced by code.
6. Before declaring done, run every gate and report exactly what you checked, with the MP4 path,
   the script, the fact-check table, the sync map, and honest limits.

Begin immediately with the input above.
