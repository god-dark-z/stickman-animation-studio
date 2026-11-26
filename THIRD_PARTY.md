# Third-party assets and licences

This repository produces every frame and every sound from code. It uses no AI image or video
generation, no paid services, and no API keys. The few third-party assets it does use are listed
here with their licences.

## Fonts (bundled in `engine/public/fonts/`)

All three families are licensed under the **SIL Open Font License 1.1** (OFL-1.1), which permits
bundling and redistribution with software, including commercial use. The OFL requires that the
font files are not sold on their own and that modified versions are not distributed under the
reserved font name. We redistribute them unmodified.

| Family | Files | Source | Licence |
|---|---|---|---|
| Noto Sans Bengali | `NotoSansBengali-bengali.woff2`, `NotoSansBengali-latin.woff2` | Google Fonts (Noto project) | SIL OFL 1.1 |
| Hind Siliguri | `HindSiliguri-bengali.woff2`, `HindSiliguri-latin.woff2` | Google Fonts (Indian Type Foundry) | SIL OFL 1.1 |
| Baloo Da 2 | `BalooDa2-bengali.woff2`, `BalooDa2-latin.woff2` | Google Fonts (Ek Type) | SIL OFL 1.1 |
| Montserrat | loaded by `@remotion/google-fonts` (English captions, cached into the render bundle) | Google Fonts (Julieta Ulanovsky) | SIL OFL 1.1 |

The Bangla subsets are fetched once by `engine/scripts/fetch_fonts.py` and committed, so rendering
never depends on a CDN. Full licence texts: <https://scripts.sil.org/OFL>.

## Fonts and text rendering

`fonttools` (MIT) and `brotli` (MIT) read the bundled woff2 character maps for the glyph-coverage
gate. They are Python dependencies, not assets.

## Voice

Narration uses **Microsoft Edge neural voices through `edge-tts`** (MIT-licensed client). The
voice audio is generated at run time; no voice model or audio sample is bundled. The Bangla voice
list was verified against the live service (`edge-tts --list-voices`), and the owner's
`parvez144/text-to-speech-with-edge-tts` repository was read for reference only — it carries no
licence, and **no code was copied from it** (see `docs/dev/v4/BANGLA-TTS-REPO-NOTES.md`).

## Audio

Every sound effect and music bed is synthesized by `engine/scripts/gen_audio_assets.py` (sine,
noise, envelopes, filters) on first run. No sample libraries.

## Code

| Package | Licence |
|---|---|
| Remotion (`remotion`, `@remotion/*`) | Remotion License (free for individuals and small teams; see their terms) |
| three.js | MIT |
| React | MIT |
| zod | MIT |
| tsx, TypeScript | MIT / Apache-2.0 |

## 3D locations and props

All geometry in `engine/locations/` and `engine/src/scene/` is authored for this project as code.
No third-party 3D models or textures.

## Attribution in the video

Nothing in the output video requires attribution: the fonts' OFL does not require on-screen
credit, the voice is service-generated, and the audio is original. If you redistribute a render,
crediting this project is welcome but not required by any of the above licences.
