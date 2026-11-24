# Plan — Phase 3 (make visuals provably match the narration)

**Goal:** the agent states *what* happens; the engine decides *where* it is drawn and proves it.

## Files
- `engine/src/scene/anchors.ts` (new) — one table of contact surfaces (`seat`, `mattress`,
  `pillow`, `top`) and drawing `extent` per prop.
- `engine/src/scene/layout.ts` (new) — pure geometry shared by renderer and gate: build metrics,
  `poseMetrics`, `stageOf`, prop world boxes, `resolvePlacement`, `resolveActors`, `cameraFor`.
- `engine/src/scene/Scene.tsx` — reads layout, replaces bg props at the same spot, draws blankets.
- `engine/src/character/Character.tsx` — `BUILD` moved to layout (single source), lying shadow fixed.
- `engine/src/character/poses.ts` — `sit` no longer lowers the body.
- `engine/src/schema.ts` — `action`, `on`, `underBlanket`, `inside` on actors.
- `engine/scripts/qa_geometry.ts` (new) — the scene-graph gate.
- `engine/scripts/test.ts` — contact regression tests.
- `stories/tests/*.json` — nine fixtures incl. seating and sleeping.

## Order of work
1. Write the failing test first: `pose: "sit"` + a chair must be an error.
2. Move geometry out of React so it is testable in Node.
3. Resolve actions onto anchors; keep raw coordinates as an override.
4. Gate the resolved graph: contact, sink/float, scale, layering, framing, facing, continuity.
5. Render stills, **look at them**, and fix what the numbers cannot see (occlusion, blanket).

## Risks and how they were handled
- **Two sources of truth** would recreate the bug → layout.ts is the only placement code.
- **Hand-measured anchors** can drift from `Props.tsx` → they live next to a comment pointing at
  the drawing, and the chair/bed are covered by numeric tests.
- **2D rig limits** cannot be solved by anchors → documented as a limit rather than faked.
- **Bed too narrow for a lying body** (407 units vs 340) → bed widened to 440 in the drawing *and*
  the anchor table, so head-on-pillow and feet-on-mattress both hold.
