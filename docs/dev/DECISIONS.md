# Decisions

Every judgement call made without asking, with the reason. Reversible ones are marked.

| # | Decision | Why |
|---|---|---|
| 1 | `sit` pose keeps `drop: 0`; the hip is anchored to the seat instead of lowering the body | The old `drop: 58` was the sink. Contact must come from the anchor, not a per-pose magic number. |
| 2 | The bed drawing was widened from 360 to **440** units | A lying stickman is ~407 units head-to-toe; on a 340-wide mattress the head or feet must overhang. Widening the *drawing* (and its anchors together) keeps the body inside the boards. |
| 3 | Anchor actions are **2D-only**; 3D raises `ANCHOR-3D` | The 3D path projects feet through a perspective camera; there is no screen-space seat to solve against. Refusing beats a silently misplaced body. |
| 4 | A shot prop replaces a background prop of the **same type at the same x/z** | Lets a character sit on "the" bedroom bed without drawing two beds, and without a global set-dressing refactor. Proximity (0.08) keeps the second office desk. |
| 5 | `underBlanket` draws an overlay instead of putting the body behind the bed | Behind the whole bed hides the character entirely. A blanket rect from `mattress_top − 40·scale` down covers the torso and leaves the head above it. |
| 6 | Framing: a contact surface behind the caption band is a **WARN**, not an ERROR | Close-ups legitimately crop the seat; the establishing shot carries the contact. A head under the captions *is* an ERROR. |
| 7 | Face occlusion is an ERROR above 50 % of the head box, WARN above 20 % | Measured from the real defect: a monitor at a nearer z covered the whole character. Below 20 % (a passing shoulder) is normal staging. |
| 8 | Timing audibility uses the **p90** energy in a word window | Mean energy punishes short quiet words ("a", "he") for the silence around them — it failed 7/37 correct words. Peak presence is the honest test of "is this word audible". |
| 9 | The `doctor` TTS probe retries and reports **WARN** on failure | First probe on this machine raised `NoAudioReceived`; a retry seconds later returned 3 word boundaries. A flaky network is not a broken install. |
| 10 | `npm run studio` now owns the orchestrator; the Remotion preview moved to `npm run remotion` | The brief wants one entry point. `studio` is the natural name; breaking the preview alias is cheap and documented here. |
| 11 | Kept every old individual command working | `make`, `qa:sync`, `qa:audio`, `still`, `locations` are still the debugging surface. The orchestrator calls the same scripts. |
| 12 | Added `validate` as a separate stage instead of folding it into `make` | Cheap failure first: no TTS spend, no bundle, before anything expensive. |
| 13 | Pose `sit` widened (`out: 46`, `tilt: -3`) | The 2D rig has no separate thigh; a wider stance plus a slight backward lean is the clearest seated silhouette available. Recorded as a limitation, not a fix. |
| 14 | Vehicle seats (`car`, `truck`, …) skip the feet-on-floor check | A driver's feet are inside the body; sinking into the chassis is correct. |
| 15 | `inside: true` draws the actor **behind** the vehicle | "In a car" reads as the body occluded by the car, head above the roof. |
| 16 | Python scripts reconfigure stdout to UTF-8 | Windows cp1252 consoles crashed on `→` / `≤` in gate output — a real cross-platform bug, fixed at the source. |
