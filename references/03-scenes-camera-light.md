# 03 — Scenes, staging, camera, light

Rendering code: `src/scene/Scene.tsx` (2D), `src/location3d/` (3D), backgrounds in
`src/scene/backgrounds/`. A shot picks **one** world: `location: "<3D name>"` or `bg: "<2D name>"`.

## Staging coordinates

- `x` 0..1 across the 1080 width (0.5 = center). Keep actors in 0.25..0.75.
- `z` 0..1 depth: 0 = back wall, 1 = near camera. 2D mapping: screen y = horizon+40 + z·620,
  scale = 0.75 + z. Default 0.45.
- Actors are drawn **in front of 3D objects at the same depth** (2D-over-3D compositing); put
  solid objects beside/behind the stage, never between camera and actor.
- Prop `y` lifts in px (on a desk ≈ 196–230), `scale` relative to the prop's base size
  (a character is ≈ 370 px tall).

## Parallax (the 2D scenes are never flat)

Five layers, each transformed by the camera at a depth factor, with per-framing blur:

| Layer | depth | blur (medium shot) |
|---|---|---|
| sky | 0.15 | 0 px |
| far (skyline, hills) | 0.45 | 2.5 px |
| wall + floor | 1.0 | 1.2 px |
| actors + props | 1.0 | — |
| foreground silhouettes | 1.35 | 4 px |

Push-ins/pans therefore show real depth separation. When you build a background
(`08-extending-assets.md`), put something in `far` and something in `fore` — that's what makes it cinematic.

## Framings

| framing | zoom | aim (body fraction) | use |
|---|---|---|---|
| wide | 1.0 | 0.5 | establishing, groups, landscapes |
| full | 1.45 | 0.52 | full body action, entrances |
| medium | 2.0 | 0.64 | default for talk, two-shots |
| close | 2.9 | 0.84 | reactions, held objects |
| extreme | 4.2 | 0.87 | punchlines, shock |

Camera frames the `focus` actor (or the actors' centroid on wider framings, or `prop:N`), keeping
the subject slightly above center — the bottom third belongs to captions. Wider shots pull toward
frame center so groups stay inside.

## Camera moves (per shot, one)

`pushIn` (default, +12% over the shot) · `pullOut` · `panLeft/Right/Up/Down` · `drift` (handheld
float, good for deadpan lines) · `crashZoom` (+55% in 8 frames — punchlines) · `orbit` (real 3D
orbit in locations) · `static` (rarely; pair with fx).

Zoom punches from beats stack on top. The camera clamps to the world so it never shows past the
painted edges.

## Light (one source per scene, everything follows it)

- Environments declare `lights: [{kind: "glow"|"cone"|"shaft", …}]` rendered in `screen` blend:
  window shafts fall on the floor, lamps pool cones, fires glow.
- `ambient` grade stacks multiply/soft-light overlays by time of day:
  night `#1a2a6a · 0.42 multiply`, sunset `#ff9a5a · 0.28 soft-light`, dawn `#ffb0a0 · 0.2`.
- Characters receive `rim: { side, color, strength }` from the environment — silhouettes stay lit
  from the scene's light direction.
- `time: day|sunset|night|dawn` re-grades most backgrounds; `tint` adds a color grade;
  `wall` overrides interior wall color.
- **Horror/locked-palette pattern** (proven in delivered episodes): pick 3–4 colors for the whole
  episode — e.g. night blue `#0b1026`, moon silver `#c9d4e8`, fog grey `#6b7280`, and ONE warm
  color `#f5a623` reserved for the single dangerous/practical light. 60% of every frame is shadow.
  Build it as a dedicated 2D background, not with per-shot tints.
- PostFX on every frame: vignette, soft contrast overlay, animated film grain (tiled
  `public/grain.png`, re-scrambled per frame).

## Depth cues to spend deliberately

- `DOF`: tighter framing blurs the background more (automatic).
- Foreground silhouettes (`fore` in the env) at 4 px blur — free cinematic depth.
- `fog`/`dust`/`godrays` fx for atmosphere; `spotlight` to isolate a punchline.
- In 3D locations: real sun with crisp shadows (`sun.dir`, `strength`, `range`), distance haze,
  scatter for grass/pebbles.
