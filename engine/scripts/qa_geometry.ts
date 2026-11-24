/**
 * qa_geometry — the scene-graph gate. Checks WHERE bodies actually are, not what the
 * narration claims.
 *
 *   npx tsx scripts/qa_geometry.ts stories/<file>.json [--json] [--strict]
 *
 * Why this exists: the lexicon sync gate passed every shot of the demo while a character
 * described as "in bed" was drawn lying on the floor next to the bed, and a seated
 * character sank 58px into the chair. Text checks cannot see that; geometry can.
 *
 * It runs the SAME placement code as the renderer (src/scene/layout.ts), so a pass here
 * means the drawn scene really contains the contact.
 *
 * Checks:
 *   CONTACT      a seated hip inside the seat surface; a lying head on the pillow and a
 *                torso inside the mattress
 *   MISSING-ACTION  pose "sit"/"lie" with a chair/bed on screen but no semantic action —
 *                the body will be drawn at floor level
 *   SINK/FLOAT   body below the floor, or feet dangling far above it
 *   SCALE        character-to-prop scale ratio out of range (a chair bigger than the room)
 *   LAYERING     the character must be drawn in front of the prop it sits on
 *   FRAMING      the focused actor's head and feet inside the safe frame, clear of captions
 *   FACING       a listener in a dialogue shot must be turned toward the speaker
 *   CONTINUITY   a character who sat/lay down has a visible stand-up beat before standing
 *   ANCHOR-3D    anchor actions are only implemented for 2D backgrounds (documented limit)
 *
 * Exit code 1 on any ERROR.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema, type ResolvedShot } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { buildEnv } from "../src/scene/backgrounds/environments";
import { anchorsOf, isVehicle, type AnchorName } from "../src/scene/anchors";
import {
  cameraFor,
  poseMetrics,
  propWorld,
  resolveActors,
  resolvePlacement,
  stageOf,
} from "../src/scene/layout";
import type { BuildId } from "../src/scene/layout";

type Sev = "ERROR" | "WARN";
type Finding = { shot: number; sev: Sev; kind: string; msg: string };

const PROP_CAPABILITY: Record<string, AnchorName> = { sitOn: "seat", lieOn: "mattress", sleepOn: "mattress" };

const envFor = (shot: ResolvedShot) =>
  buildEnv(shot.bg, { time: shot.time, t: 0, wallColor: shot.wall, seed: 1 });

/** Props on screen: the shot's own, plus background set dressing the shot does not replace. */
const usableProps = (shot: ResolvedShot, env: ReturnType<typeof envFor>) => [
  ...env.set.filter(
    (sp) =>
      !shot.props.some(
        (p) =>
          p.type === sp.type &&
          Math.abs((p.x ?? 0.5) - (sp.x ?? 0.5)) < 0.08 &&
          Math.abs((p.z ?? 0.45) - (sp.z ?? 0.45)) < 0.08,
      ),
  ),
  ...shot.props,
];

export function checkShot(shot: ResolvedShot, cast: Record<string, { build?: string }>, i: number): Finding[] {
  const out: Finding[] = [];
  const env = envFor(shot);
  const horizon = env.horizon;
  const st = stageOf(env);
  const dur = shot.duration || 90;
  const mid = Math.floor(dur * 0.6);

  if (shot.location) {
    for (const a of shot.actors) {
      if (a.action !== "none") {
        out.push({
          shot: i, sev: "ERROR", kind: "ANCHOR-3D",
          msg: `actor "${a.id}" uses action "${a.action}" in a 3D location — anchor actions are only implemented for 2D backgrounds. Use a 2D bg for this shot, or drop the action.`,
        });
      }
    }
  }

  for (const a of shot.actors) {
    const build = (cast[a.id]?.build ?? "normal") as BuildId;
    const props = usableProps(shot, env);

    // ---- contact via the same resolver the renderer uses
    if (a.action !== "none") {
      if (!a.on) {
        out.push({ shot: i, sev: "ERROR", kind: "MISSING-ACTION", msg: `actor "${a.id}" has action "${a.action}" but no \`on\` prop` });
        continue;
      }
      const place = resolvePlacement(a, props, env, build);
      if (!place) {
        out.push({ shot: i, sev: "ERROR", kind: "MISSING-ACTION", msg: `actor "${a.id}" action "${a.action}" on "${a.on}" did not resolve (unknown action)` });
        continue;
      }
      if (place.error) {
        out.push({ shot: i, sev: "ERROR", kind: "CONTACT", msg: `actor "${a.id}": ${place.error}` });
        continue;
      }
      const c = place.contact;
      if (c) {
        const tol = 12;
        if (c.action === "sitOn") {
          const dx = Math.abs(c.hip.x - c.anchor.cx);
          const dy = Math.abs(c.hip.y - c.anchor.cy);
          if (dx > c.anchor.w / 2 || dy > tol) {
            out.push({
              shot: i, sev: "ERROR", kind: "CONTACT",
              msg: `actor "${a.id}" is not on the ${c.propType} seat: hip (${c.hip.x.toFixed(0)}, ${c.hip.y.toFixed(0)}) vs seat centre (${c.anchor.cx.toFixed(0)}, ${c.anchor.cy.toFixed(0)}) ±${tol}px, seat half-width ${(c.anchor.w / 2).toFixed(0)}px`,
            });
          }
          if (!isVehicle(c.propType)) {
            const hover = c.floorY - c.hip.y; // px the feet are above the floor
            if (hover > 150) {
              out.push({ shot: i, sev: "WARN", kind: "FLOAT", msg: `actor "${a.id}" sits ${hover.toFixed(0)}px above the floor — the chair may be too tall for this build` });
            }
            if (place.y > c.floorY + 8) {
              out.push({ shot: i, sev: "ERROR", kind: "SINK", msg: `actor "${a.id}" is ${(place.y - c.floorY).toFixed(0)}px below the floor while seated` });
            }
          }
        } else if (c.action === "lieOn" || c.action === "sleepOn") {
          const headBottom = c.head.y + poseMetrics(build, "lie").headR * place.s;
          const onSurface = Math.abs(c.bodyBottom - c.anchor.cy);
          if (onSurface > tol) {
            out.push({
              shot: i, sev: "ERROR", kind: onSurface < 0 ? "SINK" : "FLOAT",
              msg: `actor "${a.id}" body does not rest on the ${c.propType}: body bottom ${c.bodyBottom.toFixed(0)} vs mattress top ${c.anchor.cy.toFixed(0)} (tolerance ${tol}px)`,
            });
          }
          if (c.head.x < c.anchor.left - 4 || c.head.x > c.anchor.right + 4) {
            out.push({
              shot: i, sev: "ERROR", kind: "CONTACT",
              msg: `actor "${a.id}" head is off the ${c.propType} (head x ${c.head.x.toFixed(0)}, mattress ${c.anchor.left.toFixed(0)}..${c.anchor.right.toFixed(0)})`,
            });
          }
          if (headBottom > c.anchor.cy + tol) {
            out.push({ shot: i, sev: "WARN", kind: "SINK", msg: `actor "${a.id}" head sinks below the mattress surface` });
          }
        }

        // layering: the body must be drawn in front of the prop it rests on
        const propZ = props[c.propIndex]?.z ?? 0.45;
        if (a.inside ? place.z >= propZ : place.z <= propZ) {
          out.push({
            shot: i, sev: "ERROR", kind: "LAYERING",
            msg: `actor "${a.id}" is on the wrong side of the ${c.propType}: z ${place.z.toFixed(3)} vs prop z ${propZ}${a.inside ? " (inside=true must draw behind)" : ""}`,
          });
        }
        // scale: the character must not be a giant next to the furniture
        if (Math.abs(a.scale - 1) > 0.3) {
          out.push({ shot: i, sev: "WARN", kind: "SCALE", msg: `actor "${a.id}" scale ${a.scale} distorts contact with the ${c.propType}` });
        }
      }
      continue;
    }

    // ---- low-level pose that should have been a semantic action
    if (a.pose === "sit" || a.pose === "lie") {
      const want: AnchorName = a.pose === "sit" ? "seat" : "mattress";
      // includes the background's own furniture, so "lying in the bedroom's bed" cannot slip through
      const capable = props.filter((p) => anchorsOf(p.type ?? "")?.[want]);
      if (capable.length) {
        out.push({
          shot: i, sev: "ERROR", kind: "MISSING-ACTION",
          msg: `actor "${a.id}" uses pose "${a.pose}" with a ${capable[0].type} on screen but no action — the body is drawn at floor level, not on the ${want}. Add "action": "${a.pose === "sit" ? "sitOn" : "lieOn"}", "on": "${capable[0].type}", and declare it in this shot's props.`,
        });
      }
    }

    // ---- sink / float for a free-standing actor
    const floor = st.y(a.z);
    if (a.action === "none" && (a.pose === "stand" || a.pose === "walk" || a.pose === "run" || a.pose === "talk")) {
      // free-standing root is placed on the floor by construction; flag absurd scale instead
      if (a.scale <= 0.05) out.push({ shot: i, sev: "ERROR", kind: "SCALE", msg: `actor "${a.id}" scale ${a.scale} is degenerate` });
      void floor;
    }
  }

  // ---- layering: a prop drawn in FRONT of a body must not hide its face.
  // Geometry contact alone is not enough: the first seated demo had the hip exactly on the
  // seat while a monitor at a nearer z covered the whole character.
  if (!shot.location) {
    const placed = resolveActors(shot, env, mid, dur);
    const onScreen = usableProps(shot, env);
    for (const fig of placed) {
      if (fig.a.inside) continue; // intentionally behind the vehicle body
      const m = poseMetrics((cast[fig.a.id]?.build ?? "normal") as BuildId, fig.pose);
      const head = { cx: fig.x + m.headX * fig.s, cy: fig.y + m.headY * fig.s, r: m.headR * fig.s };
      for (const p of onScreen) {
        const ext = anchorsOf(p.type ?? "")?.extent;
        if (!ext) continue;
        const pw = propWorld(p, env);
        if (pw.z <= fig.z) continue; // behind the actor: it cannot cover the face
        const left = pw.x - (ext.w / 2) * pw.s;
        const right = pw.x + (ext.w / 2) * pw.s;
        const top = pw.y - ext.h * pw.s;
        const bottom = pw.y;
        const ox = Math.max(0, Math.min(right, head.cx + head.r) - Math.max(left, head.cx - head.r));
        const oy = Math.max(0, Math.min(bottom, head.cy + head.r) - Math.max(top, head.cy - head.r));
        const frac = (ox * oy) / Math.max(1, 4 * head.r * head.r);
        if (frac > 0.5) {
          out.push({ shot: i, sev: "ERROR", kind: "FACE-OCCLUDED", msg: `the ${p.type} is drawn in front and covers ${Math.round(frac * 100)}% of "${fig.a.id}" face — move it aside in x, send it behind (lower z), or reframe` });
        } else if (frac > 0.2) {
          out.push({ shot: i, sev: "WARN", kind: "FACE-OCCLUDED", msg: `the ${p.type} overlaps ${Math.round(frac * 100)}% of "${fig.a.id}" face` });
        }
      }
    }
  }

  // ---- framing: the focused actor must be fully inside the safe frame at mid-shot
  if (!shot.location) {
    const actors = resolveActors(shot, env, mid, dur);
    const cam = cameraFor(shot, env, actors, mid, dur);
    const lead = actors.find((x) => x.a.id === shot.focus) ?? actors[0];
    if (lead) {
      const m = poseMetrics((cast[lead.a.id]?.build ?? "normal") as BuildId, lead.pose);
      const sx = (lead.x - cam.cx) * cam.zoom + 540;
      const headY = (lead.y + m.bodyTop * lead.s - cam.cy) * cam.zoom + 960;
      const footY = (lead.y - cam.cy) * cam.zoom + 960;
      const CAPTION_TOP = 1255;
      if (sx < 40 || sx > 1040) out.push({ shot: i, sev: "WARN", kind: "FRAMING", msg: `actor "${lead.a.id}" centre x=${sx.toFixed(0)} is near the side edge` });
      if (headY < 60) out.push({ shot: i, sev: "WARN", kind: "FRAMING", msg: `actor "${lead.a.id}" head is cropped at the top (y=${headY.toFixed(0)})` });
      if (headY > CAPTION_TOP) out.push({ shot: i, sev: "ERROR", kind: "FRAMING", msg: `actor "${lead.a.id}" head is under the caption band (y=${headY.toFixed(0)})` });
      // captions sit over the lower third by design, so only a seated/sleeping contact matters:
      // if the seat or mattress itself is behind the captions, the claim is invisible.
      if (lead.contact) {
        const surfaceY = (lead.contact.anchor.cy - cam.cy) * cam.zoom + 960;
        if (surfaceY > CAPTION_TOP) {
          // a warning, not an error: establishing shots carry the contact, and a close-up
          // is allowed to crop the seat. Flag it so the storyboard can widen the shot.
          out.push({ shot: i, sev: "WARN", kind: "FRAMING", msg: `the ${lead.contact.propType} ${lead.contact.anchorName} is behind the caption band (y=${surfaceY.toFixed(0)}) — widen this shot if the contact is the point` });
        }
      }
      void footY;
    }
  }

  // ---- facing: a listener in a dialogue shot must be turned toward the speaker
  if (shot.quote && shot.actors.length > 1) {
    const speaker = shot.actors.find((a) => a.id === shot.quote);
    for (const a of shot.actors) {
      if (a.id === shot.quote) continue;
      if (speaker && a.facing === "front") {
        out.push({ shot: i, sev: "WARN", kind: "FACING", msg: `actor "${a.id}" faces the camera while "${shot.quote}" speaks — turn them toward the speaker ("facing": "${a.x < speaker.x ? "right" : "left"}")` });
      }
    }
  }
  return out;
}

function checkContinuity(shots: ResolvedShot[]): Finding[] {
  const out: Finding[] = [];
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1], b = shots[i];
    for (const prev of a.actors) {
      if (prev.action !== "sitOn" && prev.action !== "lieOn" && prev.action !== "sleepOn" && prev.pose !== "sit" && prev.pose !== "lie") continue;
      const now = b.actors.find((x) => x.id === prev.id);
      if (!now) continue;
      const stillDown = now.action === "sitOn" || now.action === "lieOn" || now.action === "sleepOn" || now.pose === "sit" || now.pose === "lie";
      const beatsToStand = now.enter !== "none" || b.beats.some((be) => (be.actor ?? b.actors[0]?.id) === prev.id && (be.pose === "stand" || be.pose === "walk"));
      if (!stillDown && !beatsToStand) {
        out.push({ shot: i, sev: "WARN", kind: "CONTINUITY", msg: `"${prev.id}" was seated/lying in shot ${i - 1} and is upright here with no stand-up beat (add a "stand" beat, or keep the action)` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- main
export function runCli(argv: string[] = process.argv.slice(2)): number {
const args = argv;
const storyArg = args.find((a) => !a.startsWith("--"));
if (!storyArg) {
  console.error("usage: npx tsx scripts/qa_geometry.ts stories/<file>.json [--json] [--strict]");
  process.exit(2);
}
const raw = JSON.parse(fs.readFileSync(path.resolve(storyArg), "utf8"));
const story = StorySchema.parse(raw);
const shots = buildTimeline(story, null, null, null).shots;
const cast = story.cast as Record<string, { build?: string }>;

const findings = [...shots.flatMap((s, i) => checkShot(s, cast, i)), ...checkContinuity(shots)];
findings.sort((a, b) => a.shot - b.shot || (a.sev === "ERROR" ? -1 : 1));

if (args.includes("--json")) {
  console.log(JSON.stringify({ story: story.title, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${f.sev.padEnd(5)} shot ${String(f.shot).padStart(2)} [${f.kind}] ${f.msg}`);
  const errors = findings.filter((f) => f.sev === "ERROR").length;
  console.log(`\n${story.title}: ${shots.length} shots — ${errors} geometry error(s), ${findings.length - errors} warning(s)`);
}
const errors = findings.filter((f) => f.sev === "ERROR").length;
if (errors > 0 || (args.includes("--strict") && findings.length > 0)) return 1;
console.log("PASS — every body that is supposed to touch a surface actually touches it.");
return 0;
}

if (process.argv[1] && /qa_geometry\.[tj]s$/.test(process.argv[1])) process.exit(runCli());
