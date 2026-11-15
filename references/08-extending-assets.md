# 08 — Extending the asset library

Assets are permanent library members: name them for what they are (`kitchen`, `fridge`), never for
a story. Check for an existing one first (`npx tsx scripts/locations.ts --list`); never make a
near-duplicate. **Always open the closest existing asset and match its level of detail before writing yours.**

## 1. 2D prop (an item, usually held)

1. Add the id to `PROPS` in `src/catalog.ts` (grouped comment at the end of the list).
2. Add a `case` in `drawProp` in `src/scene/props/Props.tsx`:
   - origin = **bottom-center**, drawn upward (negative y); a character is ≈ 370 px tall;
   - use the style helpers so it gets the show's ink look:
     `const s = (fill, w=5) => ({ fill, stroke: INK, strokeWidth: w, strokeLinejoin: "round", strokeLinecap: "round" })`
     and `ln(w=4)` for line details;
   - accept `{ color, label, t, seed }`; use `o.color` as the tintable main color; print
     `o.label` via the `Label` component on screens/signs/boards; animate with `o.t` (wheels,
     tails, flicker) seeded by `o.seed`.
3. If it's held, add a size to `HELD` in the same file: `{ s: 0.6, dy: 40 }` (scale, downward offset into the palm).
4. Nothing else — the schema validates from `PROPS` automatically.

## 2. 2D background (painted look, fantasy, horror, stylized places)

1. Add the id to `BACKGROUNDS` in `src/catalog.ts`.
2. Add a `case` in `buildEnv` in `src/scene/backgrounds/environments.tsx` using the helpers:
   - `interior(ctx, { wall, wallKind, floor, floorKind, windows, deco, ceiling, set, lights, warm, ambient, rim })`
   - `exterior(ctx, { ground, groundKind, far, mid, set, clouds, stars, lights, fore, sky, ambient, rim })`
   - `set` entries are ordinary props placed in the scene (`P("bed", 0.25, 0.12)`); they sort
     with actors by z and can be re-used free of charge.
   - Return an `Env`: `horizon`, `sky?`, `far?`, `wall?`, `floor`, `set[]`, `fore?`, `lights[]`,
     `ambient[]`, `rim`. Parallax and blur come free.
   - Primitive painters live in `parts.tsx`: `Sky, Skyline, Hills, Mountains, Sea, Floor, Wall,
     Window, Frame, Cloud, CeilingLights` + bounds `X0,X1,Y0,Y1`.
   - Light helpers: `lamp(x, y, color, a)` → glow+cone; `windowShaft(...)`; time grades via
     `timeGrade(ctx.time)`; night dims everything — set `rim` so silhouettes still read.
3. Follow the locked-palette pattern for a stylized episode (see `03`): constant colors, one warm
   light, heavy shadow — write the palette in a comment above the case.
4. Verify: put it in a one-shot story and run `--stills`.

## 3. 3D location (the default scene type)

Locations are **JSON, no code**: copy the closest reference from `locations/` to
`locations/<name>.json` (`name` inside must equal the file name). Three detail levels — getting
these right is the whole job:

| Level | What | Detail |
|---|---|---|
| Territory | ground, terrain, walls, sky | **low poly**, one surface pattern max |
| Key objects | cars, trees, desks, houses | 8–20 parts, inked, readable silhouette |
| Minor details | clock, mailbox, mushrooms, power lines | 1–5 parts each — these sell the place |

Shape vocabulary (one per part): `box [w,h,d]` (round/pattern/tile) · `cyl [r,h]` · `cone` ·
`ball r` · `rock r` · `blob r` (tree tops) · `roof [w,h,d]` · `wall [w,h,thick]` (with `holes`) ·
`profile [[x,y],…]` (extruded outlines: car bodies, mesas) · `tube [pts]` (wires, stems) ·
`leaf [l,w]` · `sign [w,h]` (with `text`) · `use "<object>"` (from `_objects.json`).
Common fields: `at [x,y,z]` (bottom center), `turn`, `scale`, `color` (required; `"main"` inside
objects), `glow`, `opacity`, `flat`, `ink`, `shadow:false`, `repeat {count, step, turn}`.
Top level: `sky`, `ground` or `terrain`, `haze`, `sun {dir, strength, color, range}` (12 indoors,
30–40 outdoors), `ambient`, `shade`, `camera {from, to, look, fov}`, `stage [x,y,z]`,
`scatter [{use, count, area, keepOut, scale}]`.

World rules: metres; a stickman ≈ 1.7 tall; doors 2.2; y up; +z toward camera; keep the stage
(x −2..2, z 0..3) and the 8 m before the camera clear; vertical FOV is narrow — visible width ≈
half the camera distance; tilt `look` down indoors (y ≈ 1); back wall at z −3 with side walls
past the camera; every view needs one depth line (path, fence, row of poles).

Verify: `npx tsx scripts/locations.ts --stills --only=<name>` → compare with a reference still in
`out/locations/` → iterate until it looks like the same show. Checklist: place readable from the
still alone; middle free for actors; territory low-poly; ≥3 minor details; crisp sun shadows;
saturated colors; nothing floating/sinking; nothing important clipped at edges.

## 4. 3D object

Add to `locations/_objects.json`: `"fridge": { "main": "#cfd6dd", "parts": [...] }`. Built at real
size (metres), origin on the ground at its center, **facing +z**. `"color": "main"` parts take the
color chosen where used. Build appliances/furniture as objects (not bare location parts) — objects
get ink outlines automatically. The name works immediately as a prop `type` in any 3D location
(`scale: 1` = real size). Copy detail level from `car`, `tree`, `desk`, `house`, `mailbox`.

## 5. Outfit

Add the id to `OUTFITS` in `src/catalog.ts`, then a `case` in the `Outfit` component in
`src/character/Character.tsx` (clipped to the torso: draw within `w`, `yT`, `yB`). For a garment
that must overhang the body (a long coat), return `null` from the switch and render it in the
body group next to `Longcoat` — see that component for the pattern.

## 6. Sound

See `06-sound-design.md` § Adding your own audio.

## 7. Facial expression / pose / fx / insert

Follow the same pattern everywhere: add the id to the catalog list, add a drawing case in the
matching module (`faces.tsx`, `poses.ts` = pure data, `Fx.tsx`, `Insert.tsx`), and it is
immediately validatable story JSON. Poses are data-only (arm/leg targets) — no drawing code.
