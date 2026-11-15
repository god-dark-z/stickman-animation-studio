# 01 — Animation principles as this engine implements them

Every frame is a **pure function of the frame number**. Nothing is cached between frames, nothing
is randomized without a seed. That is what makes stills QA meaningful: still 14 looks exactly like
video frame 14. All motion below is procedural math in `src/character/Character.tsx`,
`src/scene/Scene.tsx` and `src/fx/Fx.tsx` — read them when you need a new motion pattern.

## The life that is always on (never animate these by hand)

| Motion | Where | Numbers |
|---|---|---|
| Breathing | body height | `sin(t·2.4)·1.2%` of torso, phase from character seed |
| Blinking | eyelids | period `96 + seed·50` frames, closed for 4 frames |
| Talk flap | mouth | layered sines (6.5 Hz × 1.7 Hz + 31 Hz jitter) → 0..1 openness |
| Head micro-motion | head tilt | `sin(t·1.9 + seed)·1.5°` |
| Walk cycle | feet + arms | step `sin(phase)·26px` (40 run), lift `max(0,−cos(phase))`, body bob `|sin|·5px`, arm swing `±24px`, phase `t·2π·1.7` (2.6 run) |
| Camera drift/handheld | camera | noise `sin(frame/23)·3px + sin(frame/11)·1.5px` |
| Idle float (props) | props with `float` | `sin(t·2.4)·14px` |

Because of this table, **something moves in every second of footage** as long as a character or
prop is on screen. Your storyboard job is to add *intentional* motion on top: `moveTo` walks,
`enter`/`exit`, pose beats, camera moves, fx.

## Poses are data, not drawings

A pose is one small object (`src/character/poses.ts`):

```ts
point: { l: hang, r: { out: 104, dy: -14, bend: 4 }, ...legs, tilt: 4, drop: 0, headTilt: 0 }
```

- arms: `out` (px away from body, mirrored), `dy` (px down), `bend` (elbow bow; negative = inward),
  or snap the hand to `chin`/`face`/`ear`.
- legs: `out`, `dx`, `lift`, `bend`.
- body: `tilt` (lean degrees, + toward facing), `drop` (px down: crouch/sit), `headTilt`.

When a beat switches pose, the rig **blends all 11 numbers** over 7 frames with ease-out
(`poseT = framesSinceBeat / 7`). That interpolation is the animation — you never keyframe.
Consequence: beats read best when the new pose contrasts with the old one (crossed → armsUp).

## Easing vocabulary

| Function | Shape | Use for |
|---|---|---|
| `ease` (cubic in-out) | S-curve | full-shot moves: `moveTo` walks, pans, push-ins |
| `easeOut` | fast start, soft landing | pose blends, transitions, fx growth |
| `easeOutBack` | overshoots ~10% then settles | `pop` entrances (actors, props), inserts, captions |
| quadratic `q·q` | accelerating | `drop` entrance falls, `exit` walk-offs |

Reuse these; do not invent new curves for standard moves. Overshoot = life. Linear = cheap.

## Anticipation, impact, follow-through (built-in patterns to reuse)

- **Drop entrance**: falls 900 px in 12 frames (quadratic), then a squash — scale dips `0.08·sin(π)` over 8 frames. A thud SFX is queued automatically at frame 11.
- **Pop entrance**: `easeOutBack` over 10 frames + auto pop SFX.
- **Impact shake**: any beat with `fx: shake/explosion` or `sfx: boom/impact/crash` kicks a 14-frame decaying random shake (±22 px→0) on both 2D and 3D cameras.
- **Beat zoom punch**: `zoom: 1.2` on a beat multiplies camera zoom, eased in over 6 frames.
- **Hammer/tool swing**: pose `hammer` drives a `sin(t·9)` cycle that also rotates the held prop −60°..+50° — swing follows the arm, that's follow-through for free.

## FX with built-in physics

`src/fx/Fx.tsx` — all effects take `age` (frames since triggered) and animate themselves:
debris has gravity (`0.9·age²`), explosion has a flash→fireball→smokeball sequence, rain/snow
wrap around the screen, fog banks drift at three speeds (parallax), ripples expand quadratically.
Trigger them on **beats** (the word they belong to), not shot start, when timing matters.

## Checklist: does a shot feel animated or like a slide?

- [ ] At least one of: actor enters/exits, `moveTo`, a pose beat, a camera move (never `static` twice in a row)
- [ ] A beat changes face or posture on a keyword of the line
- [ ] If the line lands a punchline: `zoom` beat or `crashZoom` or `flash`
- [ ] Inserts pop with `easeOutBack` and reveal lines stepwise (automatic)
- [ ] No two consecutive shots with identical framing + camera
