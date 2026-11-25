# VERIFY-B — language architecture and the trigger

## 1. Resolver — 59 unit cases, all passing

```
$ npx tsx scripts/test_language.ts
  ok  en: in Bangla
  ok  en: in Bengali
  ok  en: Bangla narration
  ok  en: Bangla voice
  ok  en: make it in Bangla
  ok  en: with Bengali voiceover
  ok  en: narration in Bangla
  ok  en: everything in Bangla
  ok  en: create in Bangla
  ok  en: produce in Bangla
  ok  en: speak Bangla
  ok  en: Bangla captions
  ok  bn: বাংলায়
  ok  bn: বাংলা ভাষায়
  ok  bn: বাংলা ন্যারেশন
  ok  bn: বাংলা ভয়েসে
  ok  bn: বাংলায় বানাও
  ok  bn: অডিও বাংলায়
  ok  bn: ভিডিও বাংলায়
  ok  bn: বাংলা ভাষায় করো
  ok  bn: বাংলায় বলো
  ok  bn: বাংলা ন্যারেশন চাই
  ok  banglish: bangla te banao
  ok  banglish: bangla bhashay
  ok  banglish: bengali te chai
  ok  banglish: bangla e koro
  ok  banglish: bangla te bolo
  ok  banglish: bangla narration
  ok  banglish: bangla voice
  ok  banglish: bangla bhasha
  ok  banglish: bengali version
  ok  neg: not in Bangla
  ok  neg: English only
  ok  neg: no Bangla
  ok  neg: don't do it in Bangla
  ok  neg: বাংলা নয়
  ok  neg: ইংরেজিতে
  ok  neg: without Bangla
  ok  topic: Bangla literature
  ok  topic: Bengal tiger
  ok  topic: Bangla language movement
  ok  topic: Bangla music
  ok  topic: history of Bengali cinema
  ok  topic: Bangla new year
  ok  topic: Bengali food
  ok  topic: Bangla script history
  ok  flag: --lang en beats in Bangla
  ok  flag: --lang bn beats English only
  ok  flag: --lang bn on plain topic
  ok  flag: --lang en on plain topic
  ok  topic-only Bangla script stays en + note
  ok  topic-only Bangla script 2 stays en + note
  ok  plain English topic stays en
  ok  voice: female voice
  ok  voice: male narrator
  ok  voice: মহিলা কণ্ঠে
  ok  voice: পুরুষ কণ্ঠে
  ok  voice: --voice female flag
  ok  voice: explicit voice id

59 passed, 0 failed of 59
```

Groups: 12 English · 10 Bangla script · 9 Banglish · 7 negations · 8 topic false positives ·
4 flag precedence · 3 defaults · 6 voice preference. Exceeds the brief's 40-case minimum.

Three bugs the tests caught and fixed during the phase:

1. "The origin of the Bangla **script**" was read as a production request because `script` was in
   the production-noun list — removed (it means the writing system).
2. Directing in Bangla script ("গল্পটা **বলো**") fell through to the topic-only default → added
   a Bangla-instruction rule (a directive verb in Bangla script = explicit request).
3. "ইংরেজিতে করো" ("do it in English") lost to that new rule → the Bangla-script negation now
   precedes it.

## 2. CLI contract

```
$ npx tsx scripts/resolve_language.ts --text "Why does your phone get hot? in Bangla" --voice female
{
  "lang": "bn",
  "voice_pref": "female",
  "evidence": [
    { "rule": "flag:voice", "match": "female", "index": 0 },
    { "rule": "en:in-bangla", "match": "in Bangla", "index": 29 }
  ]
}

$ npx tsx scripts/resolve_language.ts --text "a story about Bangla literature"
{ "lang": "en", "voice_pref": "auto", "evidence": [{ "rule": "default:en", "match": "", "index": 0 }] }

$ python scripts/resolve_language.py --text "…" --json     # same result (bridge → TS)
```

## 3. Language packs

- `engine/lang/en/pack.json` — 6 voices, default `en-US-AndrewMultilingualNeural` @ `+22%`,
  measured 3.9 w/s (from the Phase A baseline's 188-word narration), budgets 150/200/250 words.
- `engine/lang/bn/pack.json` — 4 voices (BD/IN × M/F), default `bn-BD-NabanitaNeural` @ `+22%`,
  measured **2.75 w/s**, budgets **120/165/205** words for 45/60/75 s.
- Loader `engine/lang/index.ts`: `getPack`, `isLang`, `resolveVoice`, `wordsForSeconds`,
  `secondsForWords`, `allPacks`.

## 4. Measured Bangla speech rates (real synthesis, 35-word sample, 4 sentences)

| Voice | +0% | +10% | +22% |
|---|---|---|---|
| bn-BD-PradeepNeural | 2.244 w/s | 2.468 | **2.736** |
| bn-BD-NabanitaNeural | 2.254 | 2.480 | **2.752** |
| bn-IN-BashkarNeural | 2.009 | 2.206 | 2.447 |
| bn-IN-TanishaaNeural | 1.984 | 2.183 | 2.418 |

Chars/s at +22%: BD 13.06–13.13, IN 11.54–11.68. Bangla reads **~30 % fewer words per second**
than the English default (3.9), which is why the pack has its own word budget rather than a copy.

## 5. Schema and flag plumbing

```
$ npm test            → 93 passed (27 V3 + 59 resolver + 7 pack/schema)
$ npx tsc --noEmit    → clean
```

- `StorySchema.lang` defaults to `en`; a Bangla story defaults to the Bangla voice.
- `"lang"` participates in the narration cache key, so switching language re-synthesizes instead
  of reusing an English MP3.
- `make.ts --lang/--voice` validate against the pack catalog (a typo lists the real voices and
  exits before any network call).
- `studio.ts --lang/--voice` forward to narration/timeline/stills/render.
- `tts.py --lang bn` calls the Bangla normalizer; English path unchanged when `--lang` is absent.

## 6. English did not regress

```
$ npx tsx scripts/qa_sync.ts stories/why-phone-gets-hot.json
PASS — no narration↔visual contradictions detected by the lexicon gate.
$ npx tsx scripts/qa_geometry.ts stories/why-phone-gets-hot.json
23 shots — 0 geometry error(s), 0 warning(s)
$ npx tsx scripts/qa_commonsense.ts stories/why-phone-gets-hot.json
23 shots, 56 glossary intents — 0 commonsense error(s), 1 warning(s), coverage 24%
```

Identical to the Phase A baseline numbers.

## 7. Not yet done in this phase (moved deliberately)

- Automatic voice selection scoring (the `auto` case) → Phase D.
- Bangla script craft reference, gloss-faithfulness gate, Bangla battery → Phase E.
- Bangla fonts and glyph coverage → Phase F.
- Bangla sync lexicon / intent glossary → Phase E.