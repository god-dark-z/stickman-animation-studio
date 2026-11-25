# VERIFY-D — automatic voice choice and character voices

## 1. Voice scoring — 41 cases, all passing

```
$ npx tsx scripts/test_voice_choice.ts
  ok  [en] The trench warfare of world war one and the soldiers who survived → male
  ok  [en] How the Roman empire built roads that still exist → male
  ok  [en] Why your phone gets hot when the signal is weak → male
  ok  [en] How a computer chip is actually made → male
  ok  [en] The 2008 financial crash and the market that learned nothing → male
  ok  [en] The detective who solved a crime with a single hair → male
  ok  [en] How the boxing champion trained in secret → male
  ok  [en] The heist that almost worked → male
  ok  [en] A gentle explainer for beginners: why do we dream → female
  ok  [en] How to sleep better, explained simply → female
  ok  [en] What a baby hears in the first month → female
  ok  [en] A mother's letters to her daughter → female
  ok  [en] Cooking rice the way my grandmother taught me → female
  ok  [en] Self-care and meditation for a busy week → female
  ok  [en] A children's story about a lost kitten → female
  ok  [en] A poem about longing and memory → female
  ok  [bn] ১৯৭১ সালের যুদ্ধের এক সৈনিকের গল্প → male
  ok  [bn] সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন → male
  ok  [bn] মোগল সাম্রাজ্যের ইতিহাস → male
  ok  [bn] ক্রিকেট ম্যাচে শেষ ওভারের রহস্য → male
  ok  [bn] অর্থনীতি ও বাজারের ওপর একটি থ্রিলার → male
  ok  [bn] একজন গোয়েন্দার তদন্তের গল্প → male
  ok  [bn] মায়ের চিঠি ও স্মৃতির গল্প → female
  ok  [bn] শিশুদের জন্য একটি মজার গল্প → female
  ok  [bn] রান্নাঘরে দাদির রেসিপি → female
  ok  [bn] স্বাস্থ্য নিয়ে সহজভাবে জানুন → female
  ok  [bn] ঘুমিয়ে পড়ার আগে একটি কবিতা → female
  ok  [bn] পরিবার ও মায়ের ভালোবাসার গল্প → female
  ok  [en] A video about tides → any
  ok  [bn] একটি ভিডিও নদী নিয়ে → any
  ok  user preference beats the genre score
  ok  an explicit voice id is honoured exactly
  ok  first-person story follows its narrator
  ok  multiple groups accumulate evidence
  ok  a signal-free topic scores zero
  ok  two speakers on one identical voice are rejected
  ok  the same voice at a clearly different rate is accepted
  ok  different voices are accepted
  ok  bangla has at least one voice per gender for dialogue
  ok  decision file names the voice, the source and the score
  ok  decision file lists the evidence groups

41 passed, 0 failed of 41
```

30 topic cases (8 male-leaning EN, 8 female-leaning EN, 6 male-leaning BN, 6 female-leaning BN,
2 with no signal), plus precedence, first-person, distinctness and decision-file checks.

**Bug the tests caught:** "কেন" (why) was listed as a *gentle-explainers* signal, so
"সিগন্যাল দুর্বল হলে ফোন গরম হয় **কেন**" scored tech +2 and gentle +2 → tie → default (female).
Interrogatives are a **format**, not a tone; "why does my phone get hot" is as likely a
tech/history topic as a gentle one. Removed `কেন / কীভাবে / কিভাবে / why do / how does / how to`
from the tone table.

## 2. What the chooser returns

```
$ npx tsx scripts/choose_voice.ts --text "সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন" --lang bn --write …/voice-decision.md
bn-BD-PradeepNeural (male, bn-BD) — scored: the topic reads as male-leaning: tech-finance-sport (+2)
```

The decision file:

```markdown
# Voice decision — সিগন্যাল দুর্বল হলে ফোন গরম হয় কেন

- **Language:** bn
- **Voice:** `bn-BD-PradeepNeural` (male, bn-BD)
- **Chosen by:** scored
- **Why:** the topic reads as male-leaning: tech-finance-sport (+2)
- **Score:** male 2 / female 0

| Signal group | Weight (male−female) | Evidence |
|---|---|---|
| tech-finance-sport | +2 | ফোন, সিগন্যাল |
```

Precedence implemented and tested: user preference → first-person narrator → genre score → pack
default. Weak margins (<25 %) say so in the reason line.

## 3. Two-character Bangla dialogue — renders with two voices

Story: `engine/stories/tests/bangla-dialogue-two.json` (3 shots, Maya + Rahim at a tea stall).

```
$ npx tsx scripts/studio.ts stories/tests/bangla-dialogue-two.json --tier draft --force
▸ bangla
PASS — Bangla text is single-script, glossed, and cast in Bangla script.
▸ narration
▸ narration: 2 voices (narrator, maya, rahim) — bn
dialogue_tts: narrator → bn-BD-NabanitaNeural @ +22% (7 words)
dialogue_tts: maya → bn-BD-NabanitaNeural @ +22% (6 words)
dialogue_tts: rahim → bn-BD-PradeepNeural @ +18% (8 words)
dialogue_tts: 3 run(s), 21 words, 8.57s
▸ timeline: 8.4s, 2 sound cues
sync      PASS
geometry  PASS — every body that is supposed to touch a surface actually touches it
commonsense PASS
video     ok resolution 540x960 · 30 fps · h264 · aac · 8.6s · 0 dead frames — PASS
audio     ok -14.3 LUFS · -1.9 dBTP — PASS
```

**Both voices are in the soundtrack**, each character speaks its own lines, the narrator keeps the
story voice, and every gate still passes — so lip-sync, captions and beats read the same timing
track as a single-voice film.

## 4. Schema and validation

- `cast.<id>.voice`, `cast.<id>.voiceRate`, `cast.<id>.voicePitch` (validated patterns).
- `make.ts` validates every character voice against the language pack catalog **before** any
  network call, and rejects two speakers that resolve to the same voice + rate:

```
$ (two characters both on bn-BD-NabanitaNeural @ +22%)
Dialogue speakers are not distinct:
  • "maya" and "rahim" both use bn-BD-NabanitaNeural at +22% — give one of them another voice
    (bn-IN-TanishaaNeural) or a rate at least 8% apart
```

- `dialogue_tts.py` builds one audio track from a speaker plan, placing each run on an exact byte
  clock, so a multi-voice film is a drop-in replacement for the single-voice track.
- Single-voice stories still take the V3 path (one request, own boundaries) — zero regression.

## 5. The Bangla text gate (new pipeline stage)

`python scripts/qa_bangla.py stories/<file>.json` → studio stage `bangla`, skipped for English.

```
$ python scripts/qa_bangla.py stories/tests/bangla-dialogue-two.json
bangla-dialogue-two.json: 3 shots — 0 error(s), 0 warning(s)
PASS — Bangla text is single-script, glossed, and cast in Bangla script.
```

Negative test (an English line and a missing gloss in a Bangla story):

```
ERROR shot 3: no English `gloss` — the scene spec and claim checks run on it
ERROR shot 3 (say): mostly Latin text in a Bangla story — this line is English: 'Rahim laughed and said he forgot his umbrella entirely.'
```

**Bug this gate caught in my own test story:** I had written `ছাতা তো আমি forgot করেছিলাম` — a
Latin word in Bangla narration. The gate flagged it, the line was rewritten in Bangla
(`ভুলে গিয়েছিলাম`), and the story now passes. The engine also warns at synthesis time with the
exact leftover list, and a story can ship `stories/<slug>/pronunciation.json` to respell its own
proper nouns.

## 6. Tests

```
$ npm test → 99 passed  (93 + 6 voice-choice contract tests)
$ npx tsx scripts/test_voice_choice.ts → 41 passed
$ python -I scripts/test_all.py → 62 passed
$ npx tsc --noEmit → clean
$ python scripts/doctor.py --quick → 19 checks, 0 fail, 0 warn
```

## 7. Not proven here

- The scoring table's Bangla keywords were chosen from common usage, not from a labelled corpus
  of viewer expectations. They are editable data, and user preference always wins; the delivery
  report states the choice and its score, so a mismatch is visible and correctable.
- Distinctness is enforced for voice+rate pairs. Pitch differences are supported and used for
  same-voice characters, but the naturalness of ±3 Hz on the neural voices was not listened to by
  a human in this run.
- The dialogue render is draft tier (540×960) so the check is about voices and gates, not final
  resolution; Phase J renders the release assets at full quality.