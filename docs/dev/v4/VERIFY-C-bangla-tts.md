# VERIFY-C — built-in Bangla voice engine

## 1. Normalizer — 44 unit tests, all passing

```
$ python -I scripts/test_bn_normalize.py
  ok  number 0 / 7 / 19 / 21 / 99 / 100 / 250 / 1000 / 2500
  ok  number 100000 (লক্ষ)      ok  number 10000000 (কোটি)
  ok  year 1990 → উনিশশো নব্বই     ok  year 1952 → উনিশশো বায়ান্ন
  ok  year 1900 / 2024 / 2000
  ok  bn digits from western       ok  western digits from bn
  ok  percent western              ok  percent bangla digits
  ok  decimal (2.5 → দুই দশমিক পাঁচ)
  ok  ordinal (২য় → দুইতম)
  ok  currency bd symbol           ok  currency word
  ok  currency no duplicate        ok  year in context
  ok  time reads as words          ok  phone run digit by digit
  ok  unit km
  ok  zero width stripped          ok  devanagari danda fixed
  ok  space before danda removed   ok  no double spaces
  ok  dictionary: phone / wifi / longest match / bengal
  ok  two sentences                ok  question sentence stays whole
  ok  chunks never exceed the limit  ok  chunk count keeps every sentence
  ok  safe cut before a plain consonant
  ok  unsafe cut before a vowel sign
  ok  unsafe cut after a virama

44 passed, 0 failed
```

Two bugs the tests caught:

1. `১৯৯০` read as "নয়শো নব্বই" — the hundreds digit was taken from the last two digits.
   A year 1000–1999 reads its **first two digits** as a number: 19 → উনিশ → উনিশশো নব্বই.
2. `৳৫০০ টাকা` produced "পাঁচশো টাকা টাকা" — the ৳ pattern emitted টাকা and left the written
   word in place. The pattern now consumes an optional trailing টাকা.

Real output:

```
IN : আজ সকালে ৪০% মানুষ বৃষ্টিতে ভিজেছে।
OUT: আজ সকালে চল্লিশ শতাংশ মানুষ বৃষ্টিতে ভিজেছে।

IN : ১৯৯০ সালে তার জন্ম। এখন ৳৫০০ টাকা দাম।
OUT: উনিশশো নব্বই সালে তার জন্ম। এখন পাঁচশো টাকা দাম।

IN : ফোনের চার্জ 100% থেকে 2.5 ঘণ্টায় 15% হয়ে গেল।
OUT: ফোনের চার্জ একশো শতাংশ থেকে দুই দশমিক পাঁচ ঘণ্টায় পনেরো শতাংশ হয়ে গেল।

IN : সে 12/05/2024 তারিখে এসেছিল, সকাল 7:30 এ।
OUT: সে বারো মে দুই হাজার চব্বিশ তারিখে এসেছিল, সকাল সাতটা ত্রিশ মিনিট এ।
```

## 2. Pronunciation dictionary

```
$ python -I scripts/gen_bn_pronunciation.py --check
…lang\bn\pronunciation.json: 392 entries
```

392 entries (brief asks ≥200), covering tech/device loanwords, brands, science, history and
place names, culture/daily life, media/abstract vocabulary, acronyms and units. Longest-match,
case-insensitive for Latin keys. The generator is in-repo so the list is reproducible.

## 3. End-to-end Bangla narration (real synthesis)

```
$ python scripts/tts.py sample.txt out.mp3 words.json bn-BD-NabanitaNeural +22% +0Hz --lang bn
tts: bn 30 words, 10.88s
$ ffprobe out.mp3 → duration 11.664 s
$ python scripts/qa_timing.py words.json out.mp3
ok    30 words, median duration 241 ms
ok    mean |word → nearest speech onset| = 76 ms (target ≤120 ms, max ≤300 ms)
ok    energy floor 0.0, speech 171.9, threshold 43.0
PASS — word timings are per-word, monotonic and land on audible speech.
```

The 0.78 s difference between the last word end (10.88 s) and the file duration (11.66 s) is
trailing silence: measured −49.6 dB mean in the tail vs −20.8 dB in the body.

## 4. Timing method

**Primary: real word boundaries.** All four Bangla voices return per-word boundaries
(19/19 tokens on the probe, 30/30 and 102/102 on longer scripts). English path unchanged.

**Fallback: forced alignment**, implemented in `scripts/tts_bn.py::align_timing`:

- quiet-run detection on the audio envelope (±0.16 of peak, ≥60 ms),
- the 2k+2 longest runs become pause candidates,
- each sentence boundary takes the candidate nearest its syllable-weighted proportional estimate,
  monotonically, inside a bounded window,
- inside each sentence, words split by syllable weight (virama counts as part of a cluster,
  vowel signs count as half — Bangla grapheme aware).

Measured on **real Bangla audio with known word boundaries** (4 voices, 4 sentences, 3 internal
sentence boundaries each):

| Voice | proportional split | energy-anchored |
|---|---|---|
| bn-BD-NabanitaNeural | 342 / 214 / 306 ms | **128 / 102 / 105 ms** |
| bn-BD-PradeepNeural | 361 / 188 / 323 ms | **130 / 147 / 142 ms** |
| bn-IN-TanishaaNeural | 420 / 147 / 283 ms | **60 / 62 / 45 ms** |
| bn-IN-BashkarNeural | 384 / 297 / 268 ms | **100 / 140 / 125 ms** |

**Overall: mean 107 ms, max 147 ms** (target: mean ≤120, max ≤300). The anchor more than halves
the error and meets the same audit as English.

## 5. Chunked synthesis and the audio clock

- One request handles 102 Bangla words / 37 s / 588 chars with all 102 boundaries — so the chunk
  threshold is high (900 chars) and the common case is a single exact request.
- When chunking does happen, each chunk is placed by **byte offset ÷ bytes-per-second** (the MP3
  is fixed-bitrate, 48 kbps/24 kHz → 6000 B/s). Verified against a real cached narration:
  header-derived bytes/sec reproduces the file duration to <1 %.
- Bug found and fixed during the phase: the first version shifted each chunk by the previous
  chunk's last word end, which lost 2.8 s over four chunks (timings ended at 8.87 s in an 11.66 s
  file). The byte clock is exact; the regression test locks it.
- Voice fallback keeps gender first, then accent: Nabanita (BD female) → Tanishaa (IN female) →
  Pradeep (BD male) → Bashkar (IN male). A failing voice is retried 4× with backoff before the
  next voice is tried.

## 6. Offline mode

```
$ python scripts/tts.py sample.txt est.mp3 est.json bn-BD-NabanitaNeural +22% +0Hz --lang bn --estimate-only
tts: bn ESTIMATED 30 words, 10.91s (silent placeholder, no TTS)
```

Uses the pack's measured 2.75 w/s, syllable-weighted word allocation, a silent MP3 placeholder,
and prints **ESTIMATED** so nobody mistakes it for real timing.

## 7. Doctor

```
$ python scripts/doctor.py --quick
PASS  bangla pack    4 voices, default bn-BD-NabanitaNeural
PASS  bangla text    normalizer ok, pronunciation dictionary 392 entries
PASS  bangla voices  all 4 bn voices listed
PASS  bangla tts     1-sentence synthesis: 2 word boundaries, 11232 bytes
…
19 checks: 0 fail, 0 warn
```

## 8. Tests

```
$ python -I scripts/test_bn_normalize.py   → 44 passed
$ python -I scripts/test_bn_tts.py         → 18 passed
   (fallback order, chunking, alignment structure + accuracy, pause-free signal,
    synthetic 48 kbps header, real-file bytes/sec cross-check)
```

## 9. What is not proven

- The aligner was measured on 4 voices × 1 script. It is a fallback used only when a voice
  returns no boundaries, which did not happen in any probe on this machine.
- The 102-word single-request ceiling is measured, not a documented service limit. Longer scripts
  chunk automatically and the byte clock keeps their timings exact.
- Bangla audio round-trip ASR is not run (no offline recognizer installed; recorded in
  BLOCKERS B4-4). The loudness/peak/voice-presence gate does run (Phase F).