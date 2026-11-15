# stickman-studio-engine

The render engine behind the **Stickman Animation Studio** skill. One story JSON file becomes a
narrated, captioned, sound-designed 1080×1920 MP4 — every frame drawn by code (SVG + three.js,
Remotion 4), every sound synthesized procedurally. No AI image/video generation, no paid APIs.

```bash
npm install                                     # first time
pip install edge-tts imageio-ffmpeg numpy scipy # first time

npm run make -- stories/my-story.json                # final render → out/<slug>/<slug>.mp4
npm run make -- stories/my-story.json --preview      # half-size draft
npm run make -- stories/my-story.json --stills       # one QA still per shot
npm run make -- stories/my-story.json --no-tts       # offline timing (silent voice)
npm run make -- stories/my-story.json --stills --no-tts   # fastest full check

npm test                    # 12 timeline/caption/schema unit tests
npm run typecheck           # tsc --noEmit
npm run assets              # (re)generate sfx/music/grain
npm run studio              # Remotion Studio: Story, EnvTest, SheetCast/Expr/Pose, LocationsPreview
npx tsx scripts/locations.ts --list               # 3D asset inventory
npx tsx scripts/locations.ts --stills --only=name # render a 3D location still
python scripts/qa_stills.py out/<slug>/stills     # pixel QA (lum/black/white/sat gates)
```

- Story JSON schema + every valid id: see the skill's `references/09-schema-reference.md`,
  or `src/catalog.ts` (the schema validates against it).
- A complete worked example ships at `stories/why-phone-gets-hot.json`.
- Output: `out/<slug>/<slug>.mp4` (H.264 + AAC, −14 LUFS), QA stills in `out/<slug>/stills/`,
  per-shot timeline in `out/<slug>/timeline.json`, narration + word timings cached per slug.
