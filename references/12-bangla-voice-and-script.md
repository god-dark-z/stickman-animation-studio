# 12 — Bangla voice, script craft and on-screen rules

Read this instead of `04-script-craft.md` + `10-english-voice-direction.md` when the video's
language is `bn`. Everything here is Bangla-specific; the pipeline structure, gates and story JSON
schema are identical to English.

## 1. Register: চলিত ভাষা, spoken, not literary

Write the way a good narrator **talks** on a Bangladeshi YouTube channel, not the way a textbook
is written.

| Do | Don't |
|---|---|
| চলিত ভাষা (spoken register): "মনে আছে?" | সাধু/লিটেরারি register: "স্মরণ আছে কি?" |
| short, breath-sized sentences | 30-word sentences with three clauses |
| one idea per sentence | a sentence that carries cause + effect + conclusion |
| natural connectors: "তাই", "কিন্তু", "আসলে", "মজার ব্যাপার হলো" | formal connectors: "অতএব", "সুতরাং", "তদনুসারে" |

Pick **one** address level and keep it: `তুমি` (friendly, most YouTube) or `আপনি` (formal
explainer, health/finance). Never mix `তুমি` and `আপনি` in one video.

## 2. Word budgets come from the measured Bangla rate — not from English

Measured on the real voices (2026-11-26, `bn-BD-NabanitaNeural` / `bn-BD-PradeepNeural` @ `+22%`):

- **2.75 words per second** (BD voices), 2.42 (IN voices) — Bangla words are longer than English.
- The same 60-second video therefore needs **≈165 Bangla words**, not 200.

| Target length | Bangla words | English words (for comparison) |
|---|---|---|
| 45 s | **120** | 150 |
| 60 s | **165** | 200 |
| 75 s | **205** | 250 |

Count the words **after** the normalizer would convert numbers ("৪০%" becomes দুই words). If you
are unsure, synthesize the hook line and measure; the engine's own timeline is the truth.

## 3. Structure (the same six beats, Bangla execution)

1. **Hook as a plain fact**, no greeting, no "আজ আমরা জানব".
   `আপনার ফোন সিগন্যাল কম পেলে আরও জোরে খোঁজে।` — not `আজকে আমরা ফোন নিয়ে আলোচনা করব`।
2. **Setup and stakes** — who, where, what they want, in two or three short sentences.
3. **Escalation + one quoted line** where someone mocks the hero: `"এটা তো শুধু ফোন, এতে কীই-বা
   হবে?"` Keep quotes ≤ 12 words so the mouth animation reads.
4. **Turning point** — a rhetorical question works well in Bangla: `কিন্তু আসল ব্যাপারটা কী?`
5. **"আসলে" + the mechanism**, with one everyday analogy from Bangladeshi life (a rickshaw puller
   looking for a passenger, a tube-well losing suction, a fan on low voltage).
6. **Twist, last line**, short. End on a concrete image, not a moral.

## 4. Numbers, names and loanwords — write them so the voice reads them well

The normalizer handles digits automatically (৪০% → চল্লিশ শতাংশ, ৳৫০০ → পাঁচশো টাকা,
১৯৯০ → উনিশশো নব্বই). What the **writer** must do:

- **Loanwords**: use the common Bangla spelling, not the English letters. `ফোন`, `ব্যাটারি`,
  `সিগন্যাল`, `ইন্টারনেট`. If a word must stay Latin (a brand), add it to
  `stories/<slug>/pronunciation.json`; the engine warns with the exact leftover list.
- **Acronyms**: spell how they are said — `এআই` not `AI`, `জিপিএস` not `GPS`, unless the brand
  must be visible on screen.
- **English tech phrases in speech** are normal in Bangla TV ("চার্জ দিতে হবে"), but write them in
  Bangla script so captions and voice agree.
- **Names**: use the spelling a Bangladeshi viewer expects (ঢাকা, চট্টগ্রাম, মুজিব, নজরুল); add
  unusual names to the story dictionary.

## 5. The meaning layer: `say_bn` + `gloss` (mandatory)

Every spoken shot carries two strings:

```json
{ "say": "ছেলেটি অন্য ঘরে বিছানায় ঘুমিয়ে আছে।", "gloss": "The boy is asleep in bed in the other room." }
```

- `say` is what the voice speaks and the captions show.
- `gloss` is a plain-English statement of the same meaning. The Scene Spec, claim extraction and
  relation checks run on the gloss and the spec fields, so a Bangla video gets the **same**
  commonsense scrutiny as an English one.
- **Gloss faithfulness is machine-checked** (`scripts/qa_gloss.ts`): every claim found in the
  Bangla text (via `engine/lang/bn/sync-lexicon.json`) must appear in the gloss and vice versa. A
  mismatch is an ERROR — it means the picture is validated against a meaning the narration does
  not carry.
- The gloss is **not** a translation to be shown on screen. It never appears in the video.

## 6. Settings and cultural context

Use familiar Bangladeshi/Bengali settings when the story fits them — but never force them:

- **Available and encouraged**: tea stall (চায়ের দোকান), rickshaw, village house with a tin roof,
  city street with signboards, school classroom, bazaar, rain on a window, monsoon sky, rooftop at
  dusk, kitchen with a clay stove.
- **Avoid**: a story that has nothing to do with Bangladesh wearing a "Bengali costume" — a phone
  overheating is a phone story, and a generic street is fine.
- Names, currency (৳ / টাকা), months (বৈশাখ, আষাঢ়) and festivals (ঈদ, পূজা, পহেলা বৈশাখ) should
  be accurate when used. If you are unsure of a cultural detail, leave it out rather than invent
  it.

## 7. Good and bad sentence pairs (the edit test)

| # | Bad | Why | Good |
|---|---|---|---|
| 1 | আজ আমরা আলোচনা করব ফোন কেন গরম হয় সে সম্পর্কে। | greeting + nominal style + "সে সম্পর্কে" | আপনার ফোন সিগন্যাল কম পেলে আরও জোরে খোঁজে। |
| 2 | ফোনের তাপমাত্রা বৃদ্ধির কারণ হলো অ্যামপ্লিফায়ারের কর্মক্ষমতা বৃদ্ধি। | literary register, machine-translated | ফোনটা বেশি খোঁজে, তাই বেশি গরম হয়। |
| 3 | এটি একটি অত্যন্ত গুরুত্বপূর্ণ বিষয় যা আমাদের সকলের জানা উচিত। | empty, no information | এটা জানলে আপনি অনেক টাকা বাঁচাতে পারবেন। |
| 4 | তিনি বললেন যে তিনি আসবেন না। | double "তিনি", stiff reported speech | সে বলল, "আমি আসব না।" |
| 5 | বৃষ্টি হচ্ছে এবং আমি ছাতা আনিনি এবং আমি ভিজে যাচ্ছি। | "এবং" chain | বৃষ্টি নামল, আর আমি ছাতা আনিনি। |
| 6 | ৪০% মানুষ এটি ব্যবহার করে। | digits spoken fine, but caption reads cold | প্রতি দশজনে চারজন এটি ব্যবহার করে। |
| 7 | দয়া করে ভিডিওটি লাইক করুন এবং সাবস্ক্রাইব করুন। | begging, not storytelling | (leave it out — the story earns it) |
| 8 | এটি আসলে কীভাবে কাজ করে তা আমরা দেখব। | passive future, no hook | কীভাবে? ব্যাপারটা আশ্চর্য রকম সহজ। |
| 9 | আমি মনে করি যে এটি সম্ভবত সঠিক হতে পারে। | hedge stack | এটাই আসল কারণ। |
| 10 | তারপর সে চলে গেল। তারপর সে ফিরে এল। তারপর… | "তারপর" chain | সে চলে গেল। ফিরল তিন বছর পরে। |
| 11 | গাড়িটি অত্যন্ত দ্রুতগতিতে চলছিল। | literary | গাড়িটা প্রাণপণে ছুটছিল। |
| 12 | এটি একটি বিড়াল। বিড়ালটি ছোট। | primer style, no rhythm | একটা ছোট বিড়াল, যার লেজ নেই। |
| 13 | সমস্যাটি সমাধান করার জন্য আমাদের উদ্যোগ গ্রহণ করতে হবে। | bureaucratic | সমাধানটা আমাদের হাতেই। |
| 14 | ফোনের ব্যাটারি শেষ হয়ে যাওয়ার সম্ভাবনা রয়েছে। | noun-heavy | ফোনটা কিন্তু মরে যাবে। |
| 15 | তিনি অত্যন্ত দুঃখিত ছিলেন। | tells, does not show | তার চোখে পানি এসে গেল। |
| 16 | এই ভিডিওতে আমরা দেখব… | throat-clearing | (cut — start with the fact) |
| 17 | এটি বিশ্বের সবচেয়ে বড় প্রযুক্তিগত আবিষ্কার। | unsupported superlative | এটা ১৯৯০-এর দশকে সবকিছু বদলে দিয়েছিল। |
| 18 | অনেক মানুষ অনেক দিন ধরে এটা নিয়ে ভাবছে। | vague, no number | পঞ্চাশ বছর ধরে কেউ প্রশ্নটা করেনি। |
| 19 | চেয়ারটি খালি ছিল না। | double negative, confusing | চেয়ারটা খালি ছিল। |
| 20 | ছেলেটি ঘুমাচ্ছিল কারণ সে ক্লান্ত ছিল। | explains the obvious | ছেলেটি ঘুমাচ্ছিল—শার্ট পরে, জুতো পায়ে। |
| 21 | আমরা সবাই জানি যে পানি জরুরি। | obvious | পানি ছাড়া তিন দিন। ব্যস। |
| 22 | এটি একটি চমকপ্রদ তথ্য। | tells the emotion | শুনলে অবাক হবেন — এই মাছ পায়ে হাঁটে। |

Edit pass: read the script aloud (or run it through the voice) and **cut** every sentence that
survives only because it connects two others. Bangla tolerates a harder cut than English: a
full stop costs nothing.

## 8. The voice direction (which voice, and why)

Four built-in voices. The pipeline picks one from the topic (see `voice-scoring.json`) unless the
user asks for one.

| Voice | Gender | Locale | Reads best as |
|---|---|---|---|
| `bn-BD-NabanitaNeural` | female | BD | warm storytelling, family, children, emotional, gentle explainer — **the default** |
| `bn-BD-PradeepNeural` | male | BD | authority, history, war, tech, finance, sport, investigation |
| `bn-IN-TanishaaNeural` | female | IN | calm educational, health, lifestyle (Indian Bengali accent) |
| `bn-IN-BashkarNeural` | male | IN | drama, history, gravitas (Indian Bengali accent) |

Direction rules:

- **Rate** `+22%` is the calibrated default; `+10…14%` for calm documentary, `+26…30%` for comedy
  or a punchy hook (never above +30 %, it clips phrasing).
- **Pitch** keep within ±4 Hz; more sounds synthetic.
- **Dialogue**: give each character their own voice by gender; two same-gender characters need a
  different voice or ≥8 % rate difference. `dialogue_tts.py` builds the multi-voice track.
- **Listen to the hook line before committing.** Bangla prosody varies more than English between
  voices; a line that reads well in Nabanita can drone in Tanishaa.

## 9. On-screen Bangla rules (captions, inserts, labels)

- **One script on screen**: Bangla everywhere, except an intentional brand logo the story marks.
  The `qa_bangla` gate fails an English line in a Bangla story.
- **Digits in inserts**: Bangla digits (`০১২৩৪৫৬৭৮৯`) are the default in Bangla mode; Western
  digits are an explicit option. Be consistent within one video.
- **Never** letter-space, uppercase, or synthetic-bold Bangla — it breaks conjuncts. The caption
  component is already configured for Bangla (line height 1.45, no letter spacing, larger safe
  area).
- **Fonts are bundled** (Noto Sans Bengali, Hind Siliguri, Baloo Da 2 bold) and loaded before the
  first frame. Every string is checked against the font's character map; a missing glyph is a
  gate failure, never a tofu box on screen.
- Line-break only at word boundaries (the grapheme segmenter guarantees no split inside a conjunct
  or a vowel sign).

## 10. Delivery checklist for a Bangla video

1. `qa_bangla` PASS (single script, every spoken shot glossed).
2. `qa_gloss` PASS (Bangla claims and English gloss agree).
3. Scene Spec written for every shot, from the **gloss**.
4. `qa_sync`, `qa_geometry`, `qa_commonsense` PASS.
5. Timing audit PASS (median ≤120 ms — real boundaries are available for all four voices).
6. Glyph coverage PASS, caption stills inspected.
7. Audio gate PASS (−14 LUFS, true peak ≤−1.0).
8. `voice-decision.md` present with a readable reason.