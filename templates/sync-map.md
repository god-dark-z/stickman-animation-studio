# Sync map — <story title>

The narration-to-visual synchronization contract. Generate the table with
`npx tsx scripts/qa_sync.ts stories/<file>.json --map` and paste it below. Keep it updated with
the storyboard — it is the document a reviewer (or a future you) uses to verify that the visuals
show exactly what the narration communicates.

| # | t | narration | world | actors(pose/expr) | props | camera | beats |
|---|---|-----------|-------|-------------------|-------|--------|-------|

## Gate results

- `qa_sync`: N errors, M warnings (date)
- `qa_stills`: pass/fail (method: vision / pixel-stats / agentvision)
- `qa_audio`: values (LUFS / true peak / mean volume)

## Accepted warnings

| shot | kind | why it is acceptable |
|---|---|---|
| | | |

## Story lexicon (sync-lexicon.json)

Optional sidecar next to the story for idioms and story-specific nouns. Keys merge into the
built-in lexicon; values are "acceptable visual evidence" ids:

```jsonc
{
  "place":   { "smithy": ["factory"] },            // narration word → acceptable bg/location ids
  "objects": { "wand": ["pencil", "stick"] },      // narration word → acceptable prop ids
  "poses":   { "kneel": ["cower", "sit"] },        // narration verb → acceptable poses/expressions/inserts
  "time":    { "high noon": ["day"] }
}
```
