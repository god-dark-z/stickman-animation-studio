# V4 Phase B — Language architecture and the trigger

Goal: make language a **data** concern (language packs) and resolve it **deterministically**
from the user's request, with English as the unchanged default.

## Files planned

### New

| File | Purpose |
|---|---|
| `engine/lang/types.ts` | `LanguagePack` type: id, display name, TTS provider + voice catalog, normalizer id, caption font stack + layout, sync lexicon path, script-craft reference, intent glossary, speech-rate & word-budget table, QA rules |
| `engine/lang/en/pack.json` | Serializable English pack: voices, rates, word budgets, caption font/layout, measured rates |
| `engine/lang/bn/pack.json` | Bangla pack: BD/IN × male/female voices, default, fallback order, fonts, layout (measured rates filled by Phase C) |
| `engine/lang/index.ts` | `getPack(lang)`, `isLang()`, `ENABLED_LANGS = ["en","bn"]`, tiny voices helpers |
| `engine/scripts/resolve_language.ts` | Deterministic resolver + CLI (`--text … [--lang …] [--voice …] [--json]`) |
| `engine/scripts/resolve_language.py` | Thin Python bridge so Python stages share the same logic |
| `engine/scripts/test_language.ts` | ≥40 resolver unit tests (phrasings, negations, false positives) |

### Changed

| File | Change |
|---|---|
| `engine/tsconfig.json` | add `lang` to `include` so the packs are typechecked |
| `engine/src/schema.ts` | `lang: "en" \| "bn"` default `"en"`; voice/provider defaults come from the pack; English values identical |
| `engine/scripts/make.ts` | `--lang`, `--voice auto\|male\|female\|<voice-id>`; pass language to TTS; write `lang` into output metadata |
| `engine/scripts/studio.ts` | accept `--lang` / `--voice`, forward to stages, persist in state |
| `engine/scripts/test.ts` | import and run the resolver tests so `npm test` covers them |
| `commands/make-video.md`, `SKILL.md`, `install/*` | pass the language request through; SKILL frontmatter triggers on Bangla |

## Resolver contract

```
input : { text: string, flag?: "en"|"bn"|null, voice?: string }
output: { lang: "en"|"bn", voice_pref: "auto"|"male"|"female"|"<voice-id>", evidence: [{rule, match, index}] }
```

Precedence (highest first):

1. `--lang` flag.
2. Explicit negation ("not in Bangla", "English only", "no Bangla", "ইংরেজিতে").
3. Explicit request in English / Bangla script / Banglish.
4. Topic-only Bangla script → `en` + one visible "Produced in English (default)…" line.

False-positive guard: "a story about Bangla literature", "the Bengali tiger", "Bangla language
movement" are topics, not requests. A topic noun after about/of/in/on does not count unless it also
asks for the video's language.

## Test plan (≥40 cases)

- 12 English phrasings ("in Bangla", "in Bengali", "Bangla narration", "make it in Bangla", …)
- 8 Bangla-script phrasings ("বাংলায়", "বাংলা ভাষায়", "বাংলা ন্যারেশন", "বাংলা ভয়েসে", …)
- 8 Banglish ("bangla te banao", "bangla bhashay", "bengali te chai", …)
- 6 negations ("not in Bangla", "English only", "no Bangla", "ইংরেজিতে", …)
- 6 false positives ("a story about Bangla literature", "the Bengali tiger", …)
- 2 flag-precedence cases (`--lang en` beats "in Bangla"; `--lang bn` beats "English only")
- 4 voice preference ("female voice", "মহিলা কণ্ঠে", "পুরুষ কণ্ঠে", `--voice female`)

## Exit criteria

- `npx tsx scripts/resolve_language.ts --text "…"` prints `{lang, voice_pref, evidence}`.
- ≥40 resolver tests pass through `npm test`.
- `--lang` reaches the story JSON metadata (`"lang": "bn"`) and every stage.
- English default unchanged (unit + gate checks here; golden re-render in Phase J).

## Risks

- False positives would silently change production language → the false-positive suite guards it,
  and topic-only Bangla script stays `en` with a visible note.
- Schema edits must not alter English defaults → `test.ts` asserts the exact defaults.
- `tsconfig` include omission would leave packs untypechecked → added in this phase.