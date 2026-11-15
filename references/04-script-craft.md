# 04 — Script craft

The script is the product. Animation only illustrates it. Target **190–210 words ≈ 60–75 s**
(default voice ≈ 3 words/sec at `+22%`). For a different duration: words ≈ seconds × 3, shots ≈ seconds ÷ 3.

## The shape (six beats, learned from proven shorts)

1. **Hook — line 1, paradox as plain fact.** The stranger the true sentence, the better.
   - "Australia sent machine guns to fight twenty thousand emus. The soldiers gave up."
   - "They painted the jail cell pink."
   - "Your phone loses signal, and it gets hot."
   Never "Did you know", never "In this video", never a greeting.
2. **Setup + stakes.** "It all started when…", "Imagine you're…". Introduce a hero with a name
   and a want. Ground it in a place and time with a real detail.
3. **Escalation + the mock.** Someone dismisses the hero in a short quoted line. The quote is a
   beat target (`quote:` actor, `expression: laugh`).
4. **Turning point / rhetorical question.** "Wait — how does a bird outgun the army?" This is
   where the viewer's curiosity flips on.
5. **"You see," + the real explanation.** Concrete mechanism, then an **everyday analogy**:
   shouting in a loud room, soup cooling, a phone sliding off a table. Put an insert graphic here
   (chart / counter / versus / document) — inserts exist for exactly this beat.
6. **Twist on the last line**, linking back to the hook. End hard. No outro, no CTA, no credits.

## Voice rules

- Present tense. Short sentences. One idea per sentence.
- Concrete numbers: "exactly 15 minutes", "47 tiny scratches", "twenty thousand emus".
- Humor lives in asides, not in jokes that stop the story.
- Write for the ear: "five bucks" not "$5"; spell out numbers the way the voice should say them.
- Words a 14-year-old knows. Technical terms get an instant plain-language apposition.
- Everything is narrated in English (production rule) — direct the delivery with
  `10-english-voice-direction.md`.

## Fact discipline

- Every checkable claim goes in `fact-check.md` with a source URL before it enters the script.
- "Said to have happened" → either mark it in-narration ("legend says…") or cut it.
- Numbers you can't source: cut them or round honestly ("almost a million").
- Prefer the weirdest true detail over a smoother invented one.

## Word budget by duration (default voice)

| Duration | Words | Shots (1–3 s each) |
|---|---|---|
| 30 s | 85–100 | 10–16 |
| 60 s | 180–200 | 14–24 |
| 90 s | 270–300 | 24–34 |
| 3 min | 540–580 | split into scenes, re-hook every ~70 s |

## Worked example (the shipped `stories/why-phone-gets-hot.json`)

- Hook: "Your phone loses signal, and it gets hot." — paradox, present tense, no intro.
- Setup: Sam drives into a canyon, one call, four minutes, phone cooking, battery −20%.
- Mock: friend — "Phones don't run marathons in a canyon."
- Turn: "But wait — how can doing less cost more?"
- You see: phone talks to a tower even screen-off; whisper near, scream far; radio at maximum
  power, hundreds of power adjustments a second; analogy = shouting in a loud room.
- Twist: "The quieter the world gets for your phone, the harder it screams."

Notice: every line of that script is one shot or two; every shot's `say` is a verbatim slice.
