/**
 * The relation graph checker.
 *
 * A Scene Spec states relations in words a human uses — "he is ON the bed", "she HOLDS the
 * cup", "they FACE each other". This module turns each relation into a numeric test on the
 * resolved scene (the same placement the renderer uses), so "on the bed" is 3 px of error,
 * not a sentence in a JSON file.
 *
 * Relations that cannot be measured (wearing, part_of) say so instead of passing silently.
 */
import type { ResolvedShot, PropSpec } from "../schema";
import { anchorsOf } from "../scene/anchors";
import { propWorld, resolveActors, stageOf } from "../scene/layout";

export const RELATIONS = [
  "on",
  "in",
  "inside",
  "under",
  "behind",
  "in_front_of",
  "beside",
  "holding",
  "wearing",
  "facing",
  "looking_at",
  "touching",
  "inside_room",
  "part_of",
] as const;

export type RelationName = (typeof RELATIONS)[number];

/** Relations with no numeric test — accepted, but reported as visual-only. */
export const VISUAL_ONLY: RelationName[] = ["wearing", "part_of"];

export type Relation = { subject: string; relation: RelationName; object: string };
export type RelationResult = { ok: boolean; detail: string; visualOnly?: boolean };

type Env = ReturnType<typeof import("../scene/backgrounds/environments").buildEnv>;

export type SceneCtx = {
  shot: ResolvedShot;
  env: Env;
  cast: Record<string, { build?: string }>;
  props: PropSpec[];
};

type Fig = ReturnType<typeof resolveActors>[number];

const actorNode = (name: string, ctx: SceneCtx): Fig | undefined =>
  resolveActors(ctx.shot, ctx.env, Math.floor((ctx.shot.duration || 90) * 0.6), ctx.shot.duration || 90).find(
    (f) => f.a.id === name,
  );

const propNode = (name: string, ctx: SceneCtx): { p: PropSpec; w: ReturnType<typeof propWorld> } | undefined => {
  const idx = name.startsWith("prop:") ? Number(name.slice(5)) : -1;
  if (idx >= 0 && ctx.shot.props[idx]) return { p: ctx.shot.props[idx], w: propWorld(ctx.shot.props[idx], ctx.env) };
  const p = ctx.props.find((x) => x.type === name) ?? ctx.shot.props.find((x) => x.type === name);
  return p ? { p, w: propWorld(p, ctx.env) } : undefined;
};

const typeOf = (name: string, ctx: SceneCtx): string | undefined => propNode(name, ctx)?.p.type;

export function checkRelation(rel: Relation, ctx: SceneCtx): RelationResult {
  const { shot } = ctx;
  if ((VISUAL_ONLY as string[]).includes(rel.relation)) {
    return { ok: true, visualOnly: true, detail: `${rel.relation} is checked by eye, not numerically` };
  }
  if (rel.relation === "inside_room") {
    // object is a background id: the shot must actually be that room
    const ok = shot.bg === rel.object || shot.location === rel.object;
    return { ok, detail: `shot room \`${shot.bg}${shot.location ? `/${shot.location}` : ""}\` vs expected \`${rel.object}\`` };
  }

  const fig = actorNode(rel.subject, ctx);
  if (!fig) return { ok: false, detail: `subject "${rel.subject}" is not an actor in this shot` };

  if (rel.relation === "holding") {
    const t = typeOf(rel.object, ctx);
    const ok = !!t && fig.a.holding === t;
    return { ok, detail: `"${rel.subject}" holds \`${fig.a.holding ?? "nothing"}\`, expected \`${rel.object}\`` };
  }

  if (rel.relation === "on" || rel.relation === "in" || rel.relation === "inside" || rel.relation === "under") {
    const obj = propNode(rel.object, ctx);
    if (!obj) return { ok: false, detail: `object "${rel.object}" is not a prop in this shot` };
    const t = obj.p.type;
    if (rel.relation === "under") {
      // "under the blanket" is a named state, not geometry
      const ok = t === "bed" ? fig.a.underBlanket : false;
      return { ok, detail: t === "bed" ? `underBlanket=${fig.a.underBlanket}` : `\`${t}\` has no under-surface; use a prop with one` };
    }
    if (fig.contact && fig.contact.propType === t) {
      return {
        ok: true,
        detail: `${rel.relation} \`${t}\` by contact (${fig.contact.anchorName} at ${fig.contact.anchor.cy.toFixed(0)}px)`,
      };
    }
    // an actor without an anchor action can still be inside a vehicle body
    if ((rel.relation === "in" || rel.relation === "inside") && fig.a.inside && (t === "car" || t === "truck" || t === "boat" || t === "plane" || t === "train")) {
      return { ok: true, detail: `inside \`${t}\` with inside=true` };
    }
    const ext = anchorsOf(t)?.extent;
    if (ext) {
      const left = obj.w.x - (ext.w / 2) * obj.w.s;
      const right = obj.w.x + (ext.w / 2) * obj.w.s;
      const insideX = fig.x >= left && fig.x <= right;
      return {
        ok: insideX && (rel.relation !== "on"),
        detail: `no contact with \`${t}\`; actor x ${fig.x.toFixed(0)} vs prop ${left.toFixed(0)}..${right.toFixed(0)} — add "action": "${t === "bed" ? "lieOn" : "sitOn"}", "on": "${t}"`,
      };
    }
    return { ok: false, detail: `\`${t}\` has no anchor for "${rel.relation}" — add an anchor in scene/anchors.ts, or choose another prop` };
  }

  if (rel.relation === "facing" || rel.relation === "looking_at") {
    const other = actorNode(rel.object, ctx);
    if (other) {
      const want = other.x > fig.x ? "right" : other.x < fig.x ? "left" : "front";
      const ok = fig.a.facing === want || fig.a.facing === "front";
      return { ok, detail: `"${rel.subject}" faces ${fig.a.facing}, partner is ${want}` };
    }
    const obj = propNode(rel.object, ctx);
    if (!obj) return { ok: false, detail: `object "${rel.object}" is neither an actor nor a prop in this shot` };
    const want = obj.w.x > fig.x ? "right" : obj.w.x < fig.x ? "left" : "front";
    const ok = fig.a.facing === want;
    return { ok, detail: `"${rel.subject}" faces ${fig.a.facing}, \`${obj.p.type}\` is ${want}` };
  }

  if (rel.relation === "beside") {
    const other = actorNode(rel.object, ctx) ?? propNode(rel.object, ctx);
    if (!other) return { ok: false, detail: `object "${rel.object}" is not in this shot` };
    const ox = "x" in other ? other.x : other.w.x;
    const dx = Math.abs(ox - fig.x);
    return { ok: dx <= 380, detail: `distance ${dx.toFixed(0)}px (conversational/near range is <= 380px)` };
  }

  if (rel.relation === "behind" || rel.relation === "in_front_of") {
    const obj = propNode(rel.object, ctx);
    if (!obj) return { ok: false, detail: `object "${rel.object}" is not a prop in this shot` };
    const ok = rel.relation === "behind" ? fig.z < obj.w.z : fig.z > obj.w.z;
    return { ok, detail: `actor z ${fig.z.toFixed(2)} vs \`${obj.p.type}\` z ${obj.w.z.toFixed(2)}` };
  }

  if (rel.relation === "touching") {
    const obj = propNode(rel.object, ctx);
    if (!obj) return { ok: false, detail: `object "${rel.object}" is not a prop in this shot` };
    const ok = fig.a.holding === obj.p.type || fig.contact?.propType === obj.p.type;
    return { ok, detail: fig.a.holding === obj.p.type ? "held in hand" : fig.contact?.propType === obj.p.type ? "body contact" : "no contact" };
  }

  return { ok: false, detail: `unknown relation "${rel.relation}"` };
}

/** The floor line at the subject's depth — used by the spec validator's support check. */
export const groundY = (ctx: SceneCtx) => stageOf(ctx.env).y(0.45);
