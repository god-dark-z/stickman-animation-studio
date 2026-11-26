# Agent playbook — chat-only agents (and humans without a shell)

Some surfaces have no filesystem, no terminal and no tools: a bare chat window. This project cannot
render there — but a chat-only model can still do the part that matters most, and hand it off.

## What you can do without tools

| Task | Possible? | How |
|---|---|---|
| Resolve the language | yes, by hand | apply the rules below, no tool needed |
| Research and fact-check | yes | your knowledge + any browsing your surface has; mark every unverified claim |
| Write the script (beats, hook, arc) | **yes — this is your whole value** | use `references/13-format-library.md` and the language's craft reference |
| Write the Scene Spec blocks | yes | `templates/scene-spec.md`, one block per shot |
| Write the story JSON | yes | follow `references/09-schema-reference.md` exactly; you cannot validate it, so be literal |
| Render, gate, verify | **no** | hand off |

## Language rules, applied by hand

- Default English. Bangla only if the user explicitly asks ("in Bangla", "বাংলায়", "bangla te banao").
- Negations win: "not in Bangla", "English only", "ইংরেজিতে" → English.
- A topic that merely mentions Bangla ("a story about Bangla literature", "the Bengal tiger") is
  still English.
- If the topic is written in Bangla script but nothing asks for Bangla narration, produce English
  and say: *"Produced in English (default). Add 'in Bangla' to produce Bangla."*

## What to hand off, and to whom

Give the user a single message they can paste into a coding agent, containing:

1. The topic/title and the resolved language.
2. The finished script, with beats marked.
3. The Scene Spec blocks (copy `templates/scene-spec.md`'s shape).
4. The story JSON draft.
5. The voice preference and the reason.
6. The exact commands the coding agent must run, in order.

`install/PASTE-THIS-PROMPT.md` in this repository is a ready-made version of exactly that handoff —
point the user at it.

## What you must not do

- **Do not invent gate results.** You cannot run `qa_sync`; never write "all gates pass".
- **Do not claim a rendered video.** You cannot render.
- **Do not write Bangla by machine-translating an English script.** Write it in Bangla from the
  start, in চলিত register, following `references/12-bangla-voice-and-script.md`. A translated
  script is obvious to a native viewer and is the single most common failure in this language.
- **Do not promise a word budget you cannot measure.** Use the pack's table (English 200 / Bangla
  165 words for 60 s) and say it is an estimate until the real audio exists.

## Honest delivery line for a chat-only run

```
Language: <en|bn> — resolved by hand from: "<the user's words>"
Script: <n> words, <n> shots planned (no timing measured — no shell available)
Story JSON + Scene Spec: drafts, NOT validated
Rendered video: none — this surface cannot run the engine
Handoff: paste install/PASTE-THIS-PROMPT.md plus the drafts into Claude Code / ZCode / Codex / Cursor
```
