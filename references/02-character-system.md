# 02 — The character system (the rig)

One canonical 2D rig draws **every** character. Same proportions everywhere, so a character is
just a parameter set — and the parameter set is the character's identity. Full drawing code:
`src/character/Character.tsx`, faces in `faces.tsx`, hair/hats in `headwear.tsx`, poses in `poses.ts`.

## Proportions (world px, 1080×1920 frame)

| Part | normal | big | skinny | kid | tall |
|---|---|---|---|---|---|
| body w × h | 106 × 148 | 150 × 160 | 80 × 150 | 96 × 118 | 100 × 170 |
| legs | 100 | 92 | 112 | 78 | 140 |
| head r | 68 (×1.0) | ×1.05 | ×0.95 | ×1.12 | ×1.0 |
| overall scale | 1 | 1.06 | 1 | 0.74 | 1.05 |
| total height | ≈362 | ≈390 | ≈380 | ≈270 | ≈420 |

Kids are the only "small" build — use `build: "kid"` for children, not `scale`.

## Drawing language (the show's look)

- Bean-shaped torso: cubic bezier path, slight flare for dress/robe.
- Limbs: **quadratic curves with a bend** (no joints), stroke 8.5–9 px, round caps, ink `#2a1c15`.
- Everything gets ink outlines (`strokeWidth` 4–9); fills are flat with one gradient.
- Head: radial gradient (light from `light.side`, reddens toward `furious`), rim-light arc.
- Soft contact shadow ellipse under the character, always.
- Rim/back light per scene: characters get a `light` param `{ side, color, strength }` from the environment — that is how night scenes keep readable silhouettes.

## Identity fields (`cast` entry)

```jsonc
{
  "name": "Sam", "color": "#ff8a2a",          // outfit color = THE hero color
  "outfit": "hoodie", "build": "normal",
  "hair": "messy", "hairColor": "#4a2c14", "skin": "#ffffff",
  "hat": "none", "hatColor": "#…",
  "glasses": "none",                          // none | round | square | sunglasses
  "tie": "#…", "bowtie": "#…", "badge": false,
  "mustache": false, "beard": false, "lashes": false,
  "mask": false,                              // surgical mask (covers mouth)
  "hairOverFace": false,                      // hair curtain over the whole face
  "backpack": false, "backpackColor": "#b3202a"
}
```

- Outfits: shirt, suit, overalls, apron, uniform, dress, labcoat, prisoner, tshirt, hoodie, vest,
  sweater, spacesuit, robe, jersey, panjabi, sari, gakuran, longcoat, samurai.
- Hair: none, short, parted, spiky, curly, bob, long, ponytail, bun, mohawk, messy, old.
- Hats: none, cap, police, chef, bowler, cowboy, hardhat, tophat, beanie, straw, captain, pirate,
  crown, helmet, beret, headphones, graduation, nurse, astronaut, bandana.
- Builds: normal, big, skinny, kid, tall.

## Poses (23)

`stand talk point wave armsUp shrug think crossed hips hold holdUp facepalm sit walk run fall lie
cower push reach hammer type phone`

Pick poses that read in silhouette: `crossed` (skeptical), `hips` (authority), `think` (puzzle),
`holdUp` (show-and-tell — pair with `holding`), `facepalm` (defeat), `cower` (fear), `reach`
(awe), `push` (effort), `type`/`phone` (modern life). `hold` centers a held prop in both hands.

## Expressions (20)

`neutral smug happy laugh grin surprised shocked angry furious sad worried scared suspicious
determined sleepy crazy wink bored dead love`

Mechanics: brows are angle lines; eyes are dot / lid / round-white; mouths are bezier shapes with
teeth. `furious` reddens the head gradient automatically. Expression changes get a 7-frame scale
"pop" (`exprAge`). Reactions on beats are the cheapest laughs in the system — use them.

## Held props

`holding: "<2D prop id>"` + optional `holdingLabel`. Drawn at the active hand, scaled by the
`HELD` table (`src/scene/props/Props.tsx`). `hold` uses both hands. `hammer` swings it.
If a prop you need doesn't exist, add it (see `08-extending-assets.md`) rather than misusing a close one — unless the close one reads clearly.

## Consistency rules (the difference between a show and a mess)

1. **One cast entry per character for the whole video.** Never redefine mid-story.
2. Distinct hero colors; check them against the backgrounds' dominant colors.
3. Same build and hair across shots — the rig guarantees it if you don't touch `scale` per shot.
4. Two characters who look similar (same outfit, same build) must differ in hat or hair.
5. To eyeball a cast quickly: `npm run studio` → composition `SheetCast` (or `SheetExpr`,
   `SheetPose` for the full expression/pose boards).
6. Per-shot `scale` on actors: only for size gags or depth, not for identity.
