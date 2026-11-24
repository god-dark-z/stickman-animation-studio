# 09 — Story JSON schema reference

Validated by zod (`src/schema.ts`); id lists in `src/catalog.ts` produce self-explanatory errors.
A minimal story is `title` + `cast` + `shots[1]`. **Production is English-only** — narration,
quotes, `call` texts, labels, insert copy.

## Story

| field | default | notes |
|---|---|---|
| `title` | — | also makes the output slug `out/<slug>/` |
| `provider` | `edge` | `edge` (edge-tts, online, best quality) \| `kokoro` (local ONNX, offline fallback) |
| `voice` | per provider | edge: `en-US-AndrewMultilingualNeural` default; see `10-english-voice-direction.md` |
| `rate` | `"+22%"` | edge: percent; kokoro: multiplier like `"0.82"` |
| `music` | `curious` | curious warm mystery tense upbeat sad none |
| `mix` | see 06 | `{ music: 0.14, sfx: 0.22, duck: 0.35, autoSfx: true }` |
| `cast` | — | map of actor id → character (below) |
| `shots` | — | 1..n; each timed by its first spoken word; must pass `scripts/qa_sync.ts` |

## Character (cast entry)

`name?`, `color` (required hex), `outfit` (default shirt), `hair` (short), `hairColor` (#8a4b24),
`hat` (none), `hatColor?`, `skin` (#ffffff), `tie?`, `bowtie?`, `badge`, `mustache`, `beard`,
`lashes`, `glasses` (none round square sunglasses), `build` (normal big skinny kid tall),
`mask`, `hairOverFace`, `backpack`, `backpackColor` (#b3202a). Full gallery: `npm run studio` → `SheetCast`.

## Actor (in `shot.actors`)

| field | default | notes |
|---|---|---|
| `id` | — | must exist in cast |
| `x` | 0.5 | 0..1 across frame; keep 0.25–0.75 |
| `z` | 0.45 | 0 back wall .. 1 near camera |
| `pose` | stand | 23 poses, see catalog |
| `expression` | neutral | 20 expressions |
| `facing` | front | left right front |
| `holding` | — | a 2D prop id; `holdingLabel` prints on it; `heldHand` her-right/her-left |
| `talking` | auto | mouth flaps; auto-true for the `quote` actor |
| `enter` | none | none left right pop drop fade |
| `exit` | none | none left right fade |
| `moveTo` | — | x to walk to (real walk cycle + auto facing) |
| `scale` | 1 | use sparingly (gags/depth), never for identity |
| `flip` | false | tumbling |

## Prop (in `shot.props`)

`type` (2D prop id or 3D object name), `x` 0.5, `z` 0.45, `y?` (px lift; desk ≈ 196–230),
`scale` 1, `rotate` 0, `color?`, `label?` (text on signs/screens/boards), `glow` (false; adds a
light), `enter` (none pop drop fade left right), `float` (false), `count` 1 (rows of up to 6,
rows recede in z), `open` 0..1 (doors/lids), `lit` 0..1 (lamps).

## Shot

| field | default | notes |
|---|---|---|
| `say` | — | narration slice; `"…"` = silent shot (≥ 2 s hold). Slices must reconstruct the script |
| `call?` | — | on-screen flickering text + whisper (horror pattern): `{ text, at?, whispered? }` |
| `bg` | void | 2D background id (ignored when `location` set) |
| `location?` | — | 3D location name from `locations/` |
| `time` | day | day sunset night dawn |
| `tint?` | — | color grade (soft-light 0.22) |
| `wall?` | — | interior wall color override |
| `actors` | [] | see above |
| `props` | [] | see above |
| `framing` | medium | wide full medium close extreme |
| `focus?` | first actor | actor id or `prop:N` |
| `camera` | pushIn | pushIn pullOut panLeft panRight panUp panDown drift static crashZoom orbit |
| `fx` | [] | 0–2; see catalog FX |
| `beats` | [] | see below |
| `sfx` | [] | shot-start sounds (prefer beats) |
| `insert?` | — | full/partial-screen graphic; scene blurs behind it |
| `transition` | dissolve | dissolve cut iris whip flash zoom |
| `quote?` | — | actor id speaking a quoted line (gets the flapping mouth) |

## Beat

`at` (word of this shot's `say`, or seconds) · `actor?` (default first) · `pose?` ·
`expression?` · `fx?` · `sfx?` · `zoom?` (camera punch, e.g. 1.2) · `prop` + `propOpen?` /
`propLit?` (animate a prop's `open`/`lit` from this beat).

## Insert

`type` (document phone chart map counter bigtext versus timeline list) · `title?` · `lines[]` ·
`value/from/prefix/suffix` (counter) · `data[]` (chart bars) · `highlight?` (index) · `color?`.
All have built-in reveal animations and auto-sfx.

## Resolved timeline (what the engine builds — read-only)

`fps: 30` · every shot gets `from` (absolute frame), `duration`, `words[]` (TTS timestamps),
`beatsResolved[]` (frames), auto-sfx cues, voice-aware ducking envelope, −14 LUFS master.
Duration = last word + 0.6 s tail. Composition id: `Story` (also `EnvTest`, `SheetCast/Expr/Pose`,
`LocationsPreview` in `npm run remotion`).

## Actor fields added in v3 (semantic actions)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `action` | `none` \| `sitOn` \| `lieOn` \| `sleepOn` \| `standAt` \| `hold` \| `use` \| `face` \| `pointAt` \| `react` \| `handOver` | `none` | high-level behaviour; placement actions override `x`, `z` and `pose` |
| `on` | string | — | the prop the action uses: a prop `type` declared in this shot, or `prop:<index>` |
| `underBlanket` | boolean | `false` | sleeping: draw the bed's blanket over the body, head above the edge |
| `inside` | boolean | `false` | driving/riding: draw the body behind the vehicle body |

Placement actions resolve against `src/scene/anchors.ts`:

```ts
chair: { seat: { x: 0, y: -108, w: 124, h: 22 } }
bed:   { mattress: { …, y: -108, w: 436 }, pillow: { x: -145, y: -116 }, seat: { x: 176, … } }
desk:  { top: { y: -194, w: 336 } }
```

A prop without the anchor the action needs is an **error**, never a guess. To make new furniture
interactive, add its surface in `anchors.ts` (measure it from `Props.tsx` — origin is bottom-centre,
y grows negative upward) and run the geometry gate.

`pose: "sit"` / `"lie"` remain valid as low-level values, but using them next to a chair/bed
without an `action` is a `MISSING-ACTION` error: the body would be drawn on the floor line.
