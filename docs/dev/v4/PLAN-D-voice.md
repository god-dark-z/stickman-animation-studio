# V4 Phase D — automatic voice choice and character voices

Goal: when the user names no voice, choose one from the topic with a **score an auditor can
recompute**, record why, and give dialogue characters distinct voices.

## Files planned

| File | Status | Purpose |
|---|---|---|
| `engine/lang/bn/voice-scoring.json` | new | Editable scoring table (genre/tone → gender weight), Bangla + English keys |
| `engine/lang/en/voice-scoring.json` | new | Same shape for English (so `auto` works in both languages) |
| `engine/scripts/choose_voice.ts` | new | Scoring + decision file writer + CLI |
| `engine/scripts/test_voice_choice.ts` | new | ≥30 topics with expected choices, both languages |
| `engine/src/schema.ts` | changed | `cast.<id>.voice` + `cast.<id>.voiceRate` for character voices |
| `engine/scripts/make.ts` | changed | per-character narration segments (dialogue) |
| `references/12-bangla-voice-and-script.md` | new (Phase E) | documents the scoring table for humans |

## Scoring model

```
score(male)    = Σ weight(genre matches)
score(female)  = Σ weight(genre matches)
ties / no matches → pack default voice
```

Weights are per matched keyword group, so a two-group story accumulates evidence. The table is
data (`voice-scoring.json`), the resolver is code. **Genre defaults, not claims about people** —
the file says so and the reference says so.

Signals, in precedence:

1. **User preference** (already resolved in Phase B → `voice_pref` ≠ `auto`): absolute.
2. **First-person / single-character account**: match the narrator's gender to that character.
3. **Tone + genre scoring** from the topic text.
4. **Tie / no evidence**: pack default, and the decision file says "default".

## Character voices

- `cast.<id>.voice` — an explicit voice id (validated against the pack).
- `cast.<id>.voiceRate` — a rate override within safe limits (`±30%`).
- Distinctness rule: two same-gender characters must differ in voice **or** rate **or** pitch;
  the checker fails if two speakers in one video resolve to the same voice at the same rate.
- Dialogue rendering: each line is synthesized with its speaker's voice, then placed on the
  timeline at that shot's start (the shot owns the line, so captions and beats already follow).
- Lip-sync reads each character's own timing track — the existing `quote` actor mechanism, with
  the actor's voice timings attached to the shot.

## Test plan

- 30 topic → expected-gender cases (15 Bangla, 15 English), covering authority/history/war/tech
  (male-leaning) and gentle/health/family/children/poetry (female-leaning) and ambiguous ones.
- 6 first-person cases.
- 4 distinctness failures (two characters, same voice+rate → must fail).
- 3 precedence cases (user preference beats scoring).
- Decision file is generated with the score breakdown and one-line reason.

## Exit criteria

- `npx tsx scripts/choose_voice.ts --text "<topic>" --lang bn --json` returns
  `{voice, gender, score, reason, breakdown}`.
- 30+ tests pass.
- `stories/<slug>/voice-decision.md` written by the pipeline (studio stage).
- A two-character Bangla dialogue story renders with two distinct voices (Phase D verification).

## Risks

- Scoring tables can encode bias; mitigated by (a) treating them as genre defaults,
  (b) user preference always wins, (c) the reason line is visible in the delivery report.
- Per-character voices multiply TTS calls; cache keys include the voice so re-renders are cheap.