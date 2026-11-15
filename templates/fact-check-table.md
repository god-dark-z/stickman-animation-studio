# Fact-check — <story title>

Every narrated claim gets a row before it enters the script. "Verified" = a source you actually
opened states it. "Legend/anecdote" = keep only if the narration marks it as such.

| # | Claim (as narrated) | Verdict | Source (name + URL) | Notes |
|---|---|---|---|---|
| 1 | Phones transmit at maximum radio power when the signal is weak | Verified | e.g. 3GPP uplink power control / FCC SAR background — <url> | uplink caps ≈ 23 dBm (200 mW) for LTE |
| 2 | Battery drains noticeably faster in low-signal areas | Verified | <url> | mechanism: repeated reconnection + TX power |
| 3 | … | Legend | <url> | phrase in-narration as "legend has it…" |

Rules:
- One row per checkable claim — dates, numbers, names, mechanisms.
- Cut any claim you cannot source; a shorter true script beats a longer shaky one.
- Keep the table next to the story: `engine/stories/<slug>/fact-check.md`, and deliver it with the video.
