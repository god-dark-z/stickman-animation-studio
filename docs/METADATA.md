# Repository metadata

Copy-paste values for the GitHub settings page. Nothing here is applied automatically — the owner
publishes, this file records exactly what to publish.

## Description (the one-line "About")

```
A skill for AI coding agents that turns one prompt into a finished stickman cartoon — English or Bangla. Every frame and sound is code: no AI image/video generation, no paid APIs.
```

Shorter fallback (GitHub truncates at ~160 chars in some views):

```
A skill for AI agents: one prompt → a finished stickman cartoon, English or Bangla. Every frame and sound drawn by code. No AI imagery, no paid APIs.
```

## Topics

```
ai-agent, claude-code, zcode, codex, cursor, skill, remotion, three-js, animation, cartoon,
text-to-speech, edge-tts, bangla, bengali, procedural-animation, video-generation, no-ai-images,
storyboard, creative-coding
```

Trim to the first 12 if the owner prefers fewer; all are accurate.

## Social preview

Use `docs/banner-dark.svg` (1200×360) or a 1280×640 crop of `docs/showcase/bangla-tea-stall.png`
beside `docs/demo/01-hook.png`. GitHub wants a raster image (PNG/JPG) for the social preview:

```bash
# 1280x640 social card from the two best stills
ffmpeg -y -i docs/showcase/bangla-tea-stall.png -i docs/demo/01-hook.png \
  -filter_complex "[0:v]scale=-1:640[a];[1:v]scale=-1:640[b];[a][b]hstack=inputs=2,scale=1280:640" \
  docs/social-preview.png
```

## Release v4.0.0

**Title:** `v4.0.0 — Bangla, built in`

**Body:** paste the `## 4.0.0` section from `CHANGELOG.md`.

Assets to attach (keeps the repo light):

- `docs/demo/demo.mp4` (English demo, 1080×1920)
- the Bangla demo render (`out/bangla-tea-stall-morning/*.mp4` at `--tier standard`)
- optionally `docs/social-preview.png`

```bash
git tag -a v4.0.0 -m "v4.0.0 — Bangla, built in"
git push origin v4.0.0
gh release create v4.0.0 --title "v4.0.0 — Bangla, built in" --notes-file docs/RELEASE-v4.0.0.md \
  docs/demo/demo.mp4 docs/social-preview.png
```

## Migration notes (v3 → v4)

- **Story JSON is backward compatible.** Every v3 story loads unchanged; `lang` defaults to `en`,
  and the English voice/rate defaults are identical (frozen by tests).
- `requirements.txt` now pins `edge-tts==7.2.1` (was 7.0.2, which could not run the engine's own
  `boundary="WordBoundary"` call). Re-run `pip install -r requirements.txt`.
- New optional fields: `lang`, `shot.gloss` (required for Bangla), `cast.<id>.voice`,
  `cast.<id>.voiceRate`, `cast.<id>.voicePitch`.
- New required gate in the orchestrator: `bangla`, `glyphs`, `rubric` stages. English runs skip
  `bangla` and `glyphs` automatically; `rubric` runs for both.
- `npm run studio` still works; `--lang` and `--voice` are new flags.

## What NOT to claim in the About or the release

- Do not say "verified on Claude Code / Cursor / …" — only ZCode was executed here.
- Do not say "Bangla and English tested on N models" — model rows are not measured here.
- Do not say "studio grade" as a fact; say what the rubric enforces (no shot below 3/5) and link the
  report.
