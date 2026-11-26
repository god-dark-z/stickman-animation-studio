# Contributing

Thanks for wanting to make this better. This project has an unusual constraint set, so a few rules
come before code style.

## The non-negotiables

1. **No AI imagery, ever.** No image generation, no video generation, no stock footage, no paid
   APIs, no API keys. Every frame and sound is code. A pull request that adds an image model will be
   closed, however good the picture.
2. **English must not regress.** `npm test` freezes the English defaults, voice and rate. A change
   that alters them needs a very good reason and a version note.
3. **Never weaken a gate to pass a run.** If a validator fires on a correct story, the validator is
   wrong — fix the validator, not the story, and add the case to the tests.
4. **One language per video.** Mixed-language output is out of scope.

## Before you open a pull request

```bash
cd engine
npm install
pip install -r requirements.txt

npm test                        # unit + resolver + voice + layout suites
npm run eval                    # the full measured report (writes evals/REPORT.md)
npx tsc --noEmit                # types
npx tsx scripts/skill_lint.ts   # frontmatter, links, JSON examples, stray files
python scripts/doctor.py --quick
python scripts/test_all.py      # Bangla normalizer + TTS timing
```

All of them must be clean, and `evals/REPORT.md` must show no category going **down**. A change that
raises one suite and lowers another is not a win here.

## Adding things

### A prop

1. Add the id to `engine/src/catalog.ts` (`PROPS`).
2. Draw it in `engine/src/scene/props/Props.tsx` (`switch (type)`), using the existing `s()` helper
   for fills so outlines and shading match.
3. **Measure its anchors** and add them to `engine/src/scene/anchors.ts`. A seat that a character can
   sit on needs `seat`; a bed needs `mattress` and `pillow`; a table needs `top`.
4. Run `npx tsx scripts/locations.ts --stills --only=<prop>` (or a story that uses it) and check the
   geometry gate reports no `SINK` / `FLOAT`.

Anchors are measured from the drawing, not guessed. If the gate says a hip is 38 px under the floor,
the anchor is wrong — or the drawing is; make them agree.

### An intent (commonsense rule)

- **English:** add an entry to `engine/data/intent-glossary.json`, with `phrases`, `requires`,
  `good` and `bad`.
- **Bangla:** add it to `engine/scripts/gen_bn_glossary.py` and regenerate
  (`python scripts/gen_bn_glossary.py`), so the JSON stays reproducible.

Then add a battery entry in `engine/data/commonsense-battery.json` (or
`engine/scripts/gen_bn_battery.py`) that fails without your rule. A rule with no failing case is
untested.

**Cue on collocations, not bare words.** The Bangla battery taught this the hard way: `পড়ছে` alone
means both *reading* and *falling* (বৃষ্টি পড়ছে); `অনেক` alone is *very*, not *many*.

### A language

This is meant to be a data task:

1. `engine/lang/<id>/pack.json` — voices, fonts, caption layout, measured rates, word budgets, QA
   policy. Copy `en` or `bn` and change the values; **measure the speech rate** on the real voices
   rather than copying another language's number.
2. Add the id to `engine/lang/index.ts` (`LANGS`) and `engine/lang/types.ts` (`LangId`).
3. A normalizer in Python if the script needs one (`scripts/bn_normalize.py` is the model), wired
   through `tts.py --lang`.
4. A script-craft reference and a voice-direction reference in `references/`.
5. A pronunciation dictionary if the voice misreads loanwords.
6. An intent glossary and a battery, same as `bn`.
7. Bundled fonts with a licence note in `THIRD_PARTY.md`.
8. Resolver phrases in `engine/scripts/resolve_language.ts` **and** cases in
   `engine/scripts/test_language.ts` — including the false positives (a topic word is not a
   request).

If any step needs a code change outside `lang/`, that is a design bug in the language layer — say so
in the pull request rather than special-casing.

### A story format

Add it to `references/13-format-library.md`: beats, shot grammar, ending options, and one worked
example in English **and** Bangla. Formats are reference data, not code.

## Code style

- TypeScript is strict; no `any` in new code.
- Python: standard library first. The only third-party deps are in `requirements.txt`, pinned.
- Comments explain **why**, not what. A comment that restates the line is noise.
- Files stay small; one concern per module.
- No new dependency without a licence entry in `THIRD_PARTY.md`.

## Commit messages

Conventional-ish, specific, in the imperative: `fix(bangla): cue the dawn intent on সকালটা, not just
ভোর`. Say what was wrong and why the fix is the fix.

## Reporting a bug

Include the story JSON (or the smallest one that reproduces it), the exact command, the full gate
output, and whether you could see the frames. "The video looks wrong" cannot be acted on; "shot 7
draws the hand 40 px above the cup" can.
