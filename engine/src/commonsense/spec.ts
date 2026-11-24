/**
 * The Director's Brief — a Scene Spec per shot.
 *
 * Before storyboarding, the agent writes down what a human pictures: where the scene is,
 * who is in it, what holds each body up, which props the sentence implies, and which
 * relations hold between things. The spec is small enough to fill in from a sentence and
 * explicit enough that a validator can disagree with it.
 *
 * `templates/scene-spec.md` is the fill-in form; `scripts/spec_check.ts` validates a file.
 */
import { z } from "zod";
import type { PropSpec, ResolvedShot } from "../schema";
import { buildEnv } from "../scene/backgrounds/environments";
import { checkRelation, type RelationName, RELATIONS, VISUAL_ONLY } from "./relations";

export const SUPPORTS = [
  "floor",
  "chair_seat",
  "sofa_seat",
  "bench_seat",
  "bed_mattress",
  "bed_edge",
  "ground",
  "wall_lean",
  "car_seat",
  "ladder",
  "air",
] as const;

export const WEATHER = ["clear", "rain", "snow", "fog", "wind", "heat"] as const;

const WhereSchema = z.object({
  bg: z.string().optional().describe("2D background id for this shot"),
  location: z.string().optional().describe("3D location name, if this shot uses one"),
  otherRoom: z.boolean().default(false).describe("the narration puts this somewhere other than the previous shot"),
  transitionPlan: z
    .string()
    .optional()
    .describe("how the film shows the change of place: establishing shot, cut on a door, split screen, camera move"),
  note: z.string().optional(),
});

const WhoSchema = z
  .object({
    id: z.string().describe("actor id (a key in story.cast)"),
    support: z.enum(SUPPORTS).describe("what holds the body up — never leave blank"),
    whyAir: z.string().optional().describe("only for support: \"air\" — why (falling, flying, jumping)"),
    at: z.enum(["left", "center", "right"]).default("center"),
    posture: z.string().optional().describe("standing, sitting, lying, crouching, walking, kneeling, climbing…"),
    note: z.string().optional(),
  })
  .refine((w) => w.support !== "air" || (w.whyAir ?? "").trim().length > 3, {
    message: 'support "air" needs whyAir ("falling", "flying", "jumping") — a body in mid-air must have a reason',
  });

const PropSchema = z.object({
  type: z.string(),
  role: z.enum(["required", "used", "background"]).default("used"),
  note: z.string().optional(),
});

const RelationSchema = z.object({
  subject: z.string().describe("actor id or prop type"),
  relation: z.enum(RELATIONS),
  object: z.string().describe("actor id, prop type, or background id for inside_room"),
});

const WorldSchema = z.object({
  time: z.enum(["day", "sunset", "night", "dawn"]).optional(),
  weather: z.enum(WEATHER).optional(),
  states: z.array(z.string()).default([]).describe('world states, e.g. "door open", "lights off", "screen on"'),
});

const NegationSchema = z.object({
  kind: z.enum(["empty", "absent", "noOne", "noMotion"]),
  target: z.string().optional().describe("prop type for empty/absent"),
});

export const ShotSpecSchema = z.object({
  shot: z.number().int().min(1).describe("1-based index into story.shots"),
  where: WhereSchema.default({}),
  who: z.array(WhoSchema).default([]),
  props: z.array(PropSchema).default([]),
  relations: z.array(RelationSchema).default([]),
  world: WorldSchema.default({}),
  emotion: z.string().optional().describe("what face and body must communicate"),
  cameraPurpose: z.string().optional().describe("what the viewer must notice in one second"),
  negations: z.array(NegationSchema).default([]),
});

export const SpecSchema = z.object({
  title: z.string(),
  shots: z.array(ShotSpecSchema).min(1),
});

export type ShotSpec = z.infer<typeof ShotSpecSchema>;
export type Spec = z.infer<typeof SpecSchema>;

export type Finding = { shot: number; sev: "ERROR" | "WARN"; kind: string; msg: string };

/** Props visible in a shot: declared props plus background set dressing it does not replace. */
export function propsVisible(shot: ResolvedShot): PropSpec[] {
  const env = buildEnv(shot.bg, { time: shot.time, t: 0, wallColor: shot.wall, seed: 1 });
  const set = env.set
    .filter(
      (sp) =>
        !shot.props.some(
          (p) =>
            p.type === sp.type &&
            Math.abs((p.x ?? 0.5) - (sp.x ?? 0.5)) < 0.08 &&
            Math.abs((p.z ?? 0.45) - (sp.z ?? 0.45)) < 0.08,
        ),
    )
    .map((sp) => sp as unknown as PropSpec);
  return [...shot.props, ...set];
}

export function propsOnScreen(shot: ResolvedShot): string[] {
  return [...new Set(propsVisible(shot).map((p) => p.type))];
}

export function validateSpec(spec: Spec, shots: ResolvedShot[], cast: Record<string, { build?: string }>): Finding[] {
  const out: Finding[] = [];
  if (spec.shots.length !== shots.length) {
    out.push({
      shot: 0,
      sev: "WARN",
      kind: "SPEC-COUNT",
      msg: `spec has ${spec.shots.length} shot(s), story has ${shots.length} — every shot needs a spec`,
    });
  }
  for (const s of spec.shots) {
    const shot = shots[s.shot - 1];
    if (!shot) {
      out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-INDEX", msg: `spec.shot ${s.shot} does not exist in the story` });
      continue;
    }
    const onScreen = propsOnScreen(shot);

    // a body always has a support, and every body is accounted for
    const declared = new Set(s.who.map((w) => w.id));
    for (const a of shot.actors) {
      if (!declared.has(a.id)) {
        out.push({
          shot: s.shot,
          sev: "ERROR",
          kind: "SPEC-ACTOR",
          msg: `actor "${a.id}" is drawn but has no spec entry — write down what supports the body ("support": "chair_seat")`,
        });
      }
    }
    for (const w of s.who) {
      if (!shot.actors.some((a) => a.id === w.id)) {
        out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-ACTOR", msg: `spec declares "${w.id}" but the shot does not draw them` });
      }
      // the declared support must match what the shot actually resolved to
      const actor = shot.actors.find((a) => a.id === w.id);
      if (actor && w.support === "chair_seat" && actor.action !== "sitOn" && actor.pose !== "sit") {
        out.push({
          shot: s.shot,
          sev: "ERROR",
          kind: "SPEC-SUPPORT",
          msg: `spec says "${w.id}" is on a chair seat, but the shot has no sitOn action — the body will be drawn on the floor`,
        });
      }
      if (actor && w.support === "bed_edge" && actor.action !== "sitOn") {
        out.push({
          shot: s.shot,
          sev: "ERROR",
          kind: "SPEC-SUPPORT",
          msg: `spec says "${w.id}" sits on the edge of the bed, but the shot has no sitOn action on the bed`,
        });
      }
      if (actor && w.support === "bed_mattress" && actor.action !== "lieOn" && actor.action !== "sleepOn" && actor.pose !== "lie") {
        out.push({
          shot: s.shot,
          sev: "ERROR",
          kind: "SPEC-SUPPORT",
          msg: `spec says "${w.id}" is on a mattress, but the shot has no lieOn/sleepOn action`,
        });
      }
      if (actor && w.support === "floor" && (actor.action === "lieOn" || actor.action === "sleepOn") && s.props.some((p) => p.type === "bed")) {
        out.push({
          shot: s.shot,
          sev: "WARN",
          kind: "SPEC-SUPPORT",
          msg: `"${w.id}" is on a mattress but the spec says floor — a human would expect the bed (only draw floor-sleeping if the prompt says so)`,
        });
      }
    }

    // required props must be visible
    for (const p of s.props) {
      if (!onScreen.includes(p.type)) {
        out.push({
          shot: s.shot,
          sev: p.role === "required" ? "ERROR" : "WARN",
          kind: "SPEC-PROP",
          msg: `${p.role} prop \`${p.type}\` is declared in the spec but is not on screen — declare it in the shot's props`,
        });
      }
    }

    // other room needs a way to show it
    if (s.where.otherRoom && !(s.where.transitionPlan ?? "").trim()) {
      out.push({
        shot: s.shot,
        sev: "ERROR",
        kind: "SPEC-ROOM",
        msg: `"another room" without a plan: name the new bg/location and say how the film shows the change (transitionPlan)`,
      });
    }
    if (s.where.bg && shot.bg !== s.where.bg) {
      out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-ROOM", msg: `spec background \`${s.where.bg}\` but the shot uses \`${shot.bg}\`` });
    }

    // relations, numerically
    const env = buildEnv(shot.bg, { time: shot.time, t: 0, wallColor: shot.wall, seed: 1 });
    const ctx = { shot, env, cast, props: shot.props };
    for (const r of s.relations) {
      if (!(RELATIONS as readonly string[]).includes(r.relation)) {
        out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-RELATION", msg: `unknown relation "${r.relation}"` });
        continue;
      }
      const res = checkRelation(r as { subject: string; relation: RelationName; object: string }, ctx);
      if (!res.ok) {
        out.push({
          shot: s.shot,
          sev: "ERROR",
          kind: "RELATION",
          msg: `${r.subject} ${r.relation} ${r.object} is false: ${res.detail}`,
        });
      } else if (res.visualOnly) {
        out.push({ shot: s.shot, sev: "WARN", kind: "RELATION", msg: `${r.subject} ${r.relation} ${r.object}: ${res.detail}` });
      }
    }

    // negations and absences
    for (const n of s.negations) {
      if (n.kind === "absent") {
        if (!n.target) {
          out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `negation "absent" needs a target prop` });
        } else if (onScreen.includes(n.target)) {
          out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `the sentence says there is no \`${n.target}\`, but one is on screen` });
        }
      }
      if (n.kind === "empty") {
        if (!n.target) {
          out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `negation "empty" needs a target prop` });
        } else {
          if (!onScreen.includes(n.target)) {
            out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `the \`${n.target}\` must be shown empty, so it must be visible — declare it` });
          }
          if (shot.actors.some((a) => a.action && a.on === n.target)) {
            out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `the \`${n.target}\` is supposed to be empty, but an actor is placed on it` });
          }
        }
      }
      if (n.kind === "noOne" && shot.actors.length > 0) {
        out.push({ shot: s.shot, sev: "ERROR", kind: "SPEC-NEG", msg: `the sentence says no one is there; ${shot.actors.length} actor(s) are drawn` });
      }
      if (n.kind === "noMotion" && shot.beats.length > 0) {
        out.push({ shot: s.shot, sev: "WARN", kind: "SPEC-NEG", msg: `the sentence says nothing moves; the shot has ${shot.beats.length} beat(s)` });
      }
    }

    // the camera has a job
    if (!(s.cameraPurpose ?? "").trim()) {
      out.push({ shot: s.shot, sev: "WARN", kind: "SPEC-CAMERA", msg: `no cameraPurpose: write what the viewer must notice in one second` });
    }
    if (s.emotion && !shot.actors.some((a) => a.expression !== "neutral")) {
      out.push({ shot: s.shot, sev: "WARN", kind: "SPEC-EMOTION", msg: `spec says the emotion is "${s.emotion}" but every face is neutral` });
    }
    if (s.world.time && s.world.time !== shot.time) {
      out.push({ shot: s.shot, sev: "WARN", kind: "SPEC-TIME", msg: `spec time \`${s.world.time}\` vs shot \`${shot.time}\`` });
    }
  }
  void VISUAL_ONLY;
  return out;
}
