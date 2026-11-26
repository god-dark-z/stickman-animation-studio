# VERIFY-F — Bangla on screen: fonts, shaping, glyph QA

## 1. Fonts are bundled, not fetched

`engine/public/fonts/` — 6 files, 329 KB, committed:

| Family | Files |
|---|---|
| Noto Sans Bengali | bengali + latin subsets |
| Hind Siliguri | bengali + latin subsets |
| Baloo Da 2 | bengali + latin subsets |

All SIL OFL 1.1 → `THIRD_PARTY.md`. `scripts/fetch_fonts.py` re-downloads them if missing and
`--check` verifies the bundle; `doctor` reports them:

```
PASS  bangla fonts   6 files, 329 KB, bundled (no CDN)
PASS  glyph reader   fontTools + brotli available (woff2 character maps readable)
```

**Rendering blocks on the fonts.** `StoryVideo` calls `delayRender("loading Bangla fonts")`, awaits
`document.fonts.load("900 40px …")` for every family and `document.fonts.ready`, then
`continueRender`. Captions are not rendered until `fontsReady` is true, so the opening frames can
never use a fallback face and jump.

## 2. Shaping and layout rules (enforced in code)

`engine/lang/bn/pack.json` caption layout, applied by `Captions.tsx`:

| Rule | Value | Why |
|---|---|---|
| `letterSpacing` | **0** | letter-spacing splits conjuncts apart |
| `lineHeight` | **1.45** (EN 1.05) | matras and conjuncts extend above and below the Latin box |
| `fontSize` | 74 (EN 82) | Bangla glyphs are wider; 82 overflowed the safe width |
| `width` | 960 | wider band for longer Bangla words |
| `highlight` | `current-word` | the spoken word brightens, never splitting a grapheme (split on spaces only) |
| `digits` | `bengali` | inserts show ০–৯ by default |
| `textTransform` | none | never uppercase a complex script |

Chunking is language-aware: Bangla allows 24 chars / 3 words (English 14 / 3), and both break on
the Bangla danda `।`:

```
$ npm test
  ok  Bangla caption chunks allow longer words than an English 14-char limit
  ok  a Bangla caption chunk breaks on the Bangla danda
  ok  Bangla captions never letter-space (it breaks conjuncts)
  ok  Bangla captions have a taller line height than English for matras
```

## 3. Glyph coverage gate

`python scripts/qa_glyphs.py stories/<file>.json` — reads the **combined stack's** character maps
(a codepoint passes if any font in the stack has it, exactly like browser fallback) and checks
every narration line, call, insert title/line and prop label.

```
$ python scripts/qa_glyphs.py stories/tests/bangla-insert-test.json
bangla-insert-test.json: 13 strings checked against the bundled Bangla font
PASS — every character on screen has a glyph in the bundled font.
```

Negative test (CJK characters injected into a Bangla line):

```
ERROR shot 1 say: '字' U+5B57, '漢' U+6F22 — not in any bundled font (stack: NotoSansBengali-bengali.woff2, …)
FAIL — a missing glyph renders as an empty box; fix the text or add the glyph's font.
```

Wired into the orchestrator as the `glyphs` stage (skipped for English): a Bangla video cannot
render without passing it. Bangla text policy is also enforced by the `bangla` stage
(`qa_bangla.py`): one script per video, an English line is an ERROR, a stray Latin word is named.

## 4. Stills inspected (rendered output, not aspirations)

Two Bangla stories rendered end to end at draft tier; frames pulled **from the actual MP4** and
inspected:

| Frame | What I see | Verdict |
|---|---|---|
| dialogue shot 1 | Two seated characters at a table on a sunset street; caption সন্ধ্যায় চায়ের দোকানে with correct conjuncts (ন্ধ্যা, চা), matras attached, no tofu, no letter-spacing | PASS |
| dialogue shot 2 | Maya talking (mouth open), Rahim surprised on the beat, caption আজ বৃষ্টি পড়েছিল with the spoken word highlighted | PASS |
| chart insert | Card title সমস্যায় ভুগেছে, bars labelled ৩/৫/৭/৯, years ২০২০…২০২৩ in **Bangla digits**, card raised so the caption band no longer collides | PASS |
| bigtext insert | সহজ / মাত্র একটা বদল in the display face, current word highlighted, caption below the card | PASS |

## 5. Three real rendering bugs found by looking at those frames

Fixing these was the point of the phase — all were invisible to the gates before I inspected pixels:

**(a) Two actors on one chair.** With two chairs in a shot, `on: "chair"` resolved to the *first*
chair for both actors: Rahim was drawn exactly on top of Maya (invisible, empty chair beside her).
Fixed `resolvePlacement` to use `nearestPropIndex(on, props, actor.x)`. A regression test locks it:

```
ok  two actors sitting on 'chair' take two different chairs
ok  an explicit prop:N index still wins over proximity
```

**(b) Caption collided with the insert card.** Bangla cards are taller and their axis labels sit
low; at the English card position the caption text overlapped the year labels. The card is now
raised for Bangla (H·0.37 vs H·0.44), verified numerically:

```
caption band: 1229 to 1498
chart card bottom (bn): 1190  → no overlap
```

and locked by a test (`the Bangla caption band does not cover the raised insert card`).

**(c) Latin digits inside a Bangla chart.** Years rendered as `2020` in a Bangla video. `fmt()` now
converts to Bangla digits per the pack (`digits: "bengali"`), giving ২০২০ / ২০২৩.

## 6. Inserts and prop labels are language-aware

`InsertGraphic` takes `lang`, uses `displayFamilyFor(lang)` (Baloo Da 2 for Bangla), removes
negative letter-spacing, and sizes text with a Bangla-aware width factor (1.25 vs 1.8 chars per
box unit). `Scene` and `Scene3D` thread `timeline.story.lang` through.

## 7. Tests and gates

```
$ npm test                                        → 108 passed  (101 + 7 Bangla layout)
$ npx tsc --noEmit                                → clean
$ python scripts/doctor.py --quick                → 23 checks, 0 fail, 0 warn
$ python scripts/qa_glyphs.py  <bn story>         → PASS
$ python scripts/qa_bangla.py --with-gloss <bn>   → PASS (both gates)
$ npx tsx scripts/studio.ts <bn story> --tier draft → 15/15 stages ✓
```

## 8. Not proven / limitations

- I inspected 4 frames per story, not every frame. The pixel gate (`qa_stills.py`) and the contact
  sheet cover the rest geometrically; a human eye should still watch a final cut.
- The Bangla audio voice-presence threshold is set to 30.0 (English 38.5) from one measurement;
  the gate passed at −14.3 LUFS / −1.9 dBTP on the real render, but the threshold deserves a wider
  sample across voices in a longer run.
- No offline ASR round-trip (no recognizer installed) — recorded in BLOCKERS B4-4.
- Shaping is Chromium's HarfBuzz; the font choices were verified visually on conjuncts
  (ন্ধ্যা, বৃষ্টি, পড়েছিল) but not audited glyph-by-glyph against the font's GSUB tables.