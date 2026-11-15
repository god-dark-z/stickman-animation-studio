# Paste-this-prompt — universal invocation

For agents that cannot load skill files or run installers (chat-only models, restricted IDEs,
"ChatGPT-compatible" wrappers with no filesystem): paste the block below as your message. It
routes the agent through the same pipeline.

- If the agent **has** shell + file access: it clones the repo and runs the real engine.
- If the agent **cannot** run code: it produces the full pre-production package (script,
  fact-check, synced storyboard JSON, sync map) that any coding agent can render verbatim with
  `npm run make -- stories/<file>.json`. No pretending — the package is clearly marked as
  "needs a coding agent to render".

---

You are executing the **Stickman Animation Studio** pipeline for this input:

> **INPUT:** ⟨paste the topic / title / concept here⟩

Mode A — you have a terminal and filesystem:
1. `git clone https://github.com/YOUR-USERNAME/stickman-animation-studio .skill-tmp`
2. `.skill-tmp/install/install.sh --with-engine` (Windows: `powershell -File .skill-tmp\install\install.ps1 -WithEngine`)
3. `cd engine && npm install && pip install edge-tts imageio-ffmpeg numpy scipy pillow`
4. Read `.claude/skills/stickman-animation-studio/SKILL.md` and execute it end to end for the
   INPUT above. It is self-contained: research → English script → synced storyboard JSON →
   `npx tsx scripts/qa_sync.ts` (0 errors) → `npm run make -- stories/<file>.json --stills` →
   fix → `npm run make -- stories/<file>.json` → `python scripts/qa_audio.py <mp4>` → deliver
   the MP4 path + script + fact-check + sync map.

Mode B — no terminal (pre-production package only; say so honestly):
1. Research the topic; produce `fact-check.md` (claim | source | URL; mark unverified claims).
2. Write the English script, 190–210 words, 6-beat structure: paradox hook as line 1 → setup →
   escalation with a mocking quote → turning point → "You see," + everyday analogy → twist on the
   last line. No greetings, no outro.
3. Storyboard it as one JSON file using this exact schema sketch: `{"title","music","voice",
   "cast":{"<id>":{"color","outfit","hair","hat","build","glasses","mustache"}},"shots":[
   {"say":"<verbatim script slice>","location":"<3D place or omit>","bg":"<2D id>",
   "time":"day|sunset|night|dawn","framing":"wide|full|medium|close|extreme",
   "camera":"pushIn|pullOut|panLeft|panRight|drift|crashZoom|orbit|static",
   "actors":[{"id","x":0..1,"z":0..1,"pose","expression","facing","holding","enter","moveTo"}],
   "props":[{"type","x","z","y","scale","label"}],
   "beats":[{"at":"<word in say>","actor","pose","expression","fx","zoom"}],
   "fx":[],"sfx":[],"insert":{"type":"document|phone|chart|counter|bigtext|versus|map|timeline|list",...},
   "transition":"dissolve|cut|flash|iris|whip|zoom"}]}` — every shot's `say` slices must
   concatenate into the full script; every narrated place/action/object must be visible in the
   shot (sync contract); bind mid-line actions with `beats.at` on the spoken word.
4. Deliver: `script.md`, `fact-check.md`, the story JSON, and a sync map table
   (#, narration, world, actors+poses, props, camera, beats) — clearly labeled
   "READY TO RENDER with the stickman-animation-studio engine: npm run make -- stories/<file>.json".

Rules for both modes: English only; no AI image/video generation, no paid APIs; 1 shot per 1–3
seconds; vary framing and camera; ≤2 fx per shot; music mood `curious|warm|mystery|tense|upbeat|sad`
chosen once; do not ask me questions — make reasonable creative decisions and deliver.
