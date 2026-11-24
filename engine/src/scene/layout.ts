// Pure scene geometry: where every body, prop and contact point lands on screen.
//
// This module has no React import on purpose. The renderer (scene/Scene.tsx) and the
// geometry gate (scripts/qa_geometry.ts) both call it, so the gate is checking the same
// numbers that get drawn — not a second, independent guess about them.
import { clamp, ease, easeOut, easeOutBack, hashStr, lerp, rand } from "../theme";
import type { Actor, PropSpec, ResolvedShot } from "../schema";
import type { Expression } from "../character/faces";
import { POSE_DEFS, type Pose } from "../character/poses";
import { anchorOf, type AnchorName, type AnchorRect } from "./anchors";

export const CHAR_H = 362;
const TRANS = 7;

export const BUILD = {
  normal: { bw: 106, bh: 148, leg: 100, head: 1, scale: 1 },
  big: { bw: 150, bh: 160, leg: 92, head: 1.05, scale: 1.06 },
  skinny: { bw: 80, bh: 150, leg: 112, head: 0.95, scale: 1 },
  kid: { bw: 96, bh: 118, leg: 78, head: 1.12, scale: 0.74 },
  tall: { bw: 100, bh: 170, leg: 140, head: 1, scale: 1.05 },
} as const;

export type BuildId = keyof typeof BUILD;

/** Character.tsx draws a lying body as `translate(0,-60) rotate(-90)`. */
export const LIE = { rotate: -90, translateY: -60 } as const;

export type PoseMetrics = {
  /** hip joint, y relative to the character origin at its feet (negative = above) */
  hip: number;
  feet: number;
  /** head circle: centre and radius, in the character's drawn space */
  headX: number;
  headY: number;
  headR: number;
  /** outline of the whole body: used for bed/blanket contact and framing */
  bodyTop: number;
  bodyBottom: number;
  bodyLeft: number;
  bodyRight: number;
  rotated: boolean;
  leg: number;
  width: number;
  height: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Where a pose puts the important joints. Mirrors character/Character.tsx:
 *   yB = -leg + 8 + drop;  hipY = yB - 6;  headY = yB - bh - headR*0.68
 */
export const poseMetrics = (build: BuildId | string, pose: Pose): PoseMetrics => {
  const b = BUILD[(build as BuildId) in BUILD ? (build as BuildId) : "normal"];
  const pd = POSE_DEFS[pose] ?? POSE_DEFS.stand;
  const yB = -b.leg + 8 + pd.drop;
  const yT = yB - b.bh;
  const headR = 68 * b.head;
  const headY = yT - headR * 0.68;
  if (pose === "lie") {
    // (x,y) -> (y,-x), then translate down by 60
    const cy = LIE.translateY;
    return {
      hip: 0,
      feet: 0,
      headX: headY,
      headY: cy,
      headR,
      bodyTop: cy - headR,
      bodyBottom: cy + headR,
      bodyLeft: headY - headR,
      bodyRight: b.bw * 0.5,
      rotated: true,
      leg: b.leg,
      width: b.bw,
      height: b.bh,
    };
  }
  return {
    hip: yB - 6,
    feet: 0,
    headX: 0,
    headY,
    headR,
    bodyTop: yT - headR * 1.68,
    bodyBottom: 8,
    bodyLeft: -b.bw * 0.5,
    bodyRight: b.bw * 0.5,
    rotated: false,
    leg: b.leg,
    width: b.bw,
    height: b.bh,
  };
};

// ---------------------------------------------------------------- the 2D stage
export const stageOf = (env: { horizon: number }) => {
  const hz = Math.min(env.horizon, 1250);
  return {
    y: (z: number) => hz + 40 + z * 620,
    s: (z: number) => 0.75 + z * 1.0,
  };
};

export const FRAMING = {
  wide: { z: 1, k: 0.5 },
  full: { z: 1.45, k: 0.52 },
  medium: { z: 2.0, k: 0.64 },
  close: { z: 2.9, k: 0.84 },
  extreme: { z: 4.2, k: 0.87 },
} as const;

export const DOF = { wide: [0, 0, 0], full: [1, 0.5, 0], medium: [4, 2.5, 1.2], close: [7, 5, 3], extreme: [9, 7, 4.5] } as const;

/** World placement of a prop drawn at bottom-centre. */
export const propWorld = (p: Partial<PropSpec>, env: { horizon: number }) => {
  const st = stageOf(env);
  const z = p.z ?? 0.45;
  const s = st.s(z) * (p.scale ?? 1);
  return { x: (p.x ?? 0.5) * 1080, y: st.y(z) - (p.y ?? 0) * st.s(z), s, z };
};

export const propBox = (p: Partial<PropSpec>, env: { horizon: number }) => propWorld(p, env);

/** An anchor in world/screen pixels. */
export const anchorWorld = (prop: Partial<PropSpec>, env: { horizon: number }, name: AnchorName) => {
  const a = anchorOf(prop.type ?? "", name);
  if (!a) return undefined;
  const w = propWorld(prop, env);
  return {
    cx: w.x + a.x * w.s,
    cy: w.y + a.y * w.s,
    w: a.w * w.s,
    h: a.h * w.s,
    left: w.x + (a.x - a.w / 2) * w.s,
    right: w.x + (a.x + a.w / 2) * w.s,
    top: w.y + a.y * w.s,
    bottom: w.y + (a.y + a.h) * w.s,
    s: w.s,
  };
};

// ---------------------------------------------------------------- semantic actions
export type Contact = {
  action: string;
  propType: string;
  propIndex: number;
  anchorName: AnchorName;
  anchor: ReturnType<typeof anchorWorld> & object;
  hip: { x: number; y: number };
  head: { x: number; y: number };
  bodyBottom: number;
  bodyTop: number;
  floorY: number;
  /** signed gap between the body/feet and the surface it should touch (px, + = floating) */
  gap: number;
};

export type Placement = {
  x: number;
  y: number;
  s: number;
  z: number;
  pose: Pose;
  contact: Contact | null;
  error?: string;
};

/** Resolve `on` ("chair", "prop:1") to an index into this shot's props. */
export const propIndexOf = (on: string, props: Partial<PropSpec>[]): number => {
  if (on.startsWith("prop:")) return Number.parseInt(on.slice(5), 10);
  return props.findIndex((p) => p.type === on);
};

/**
 * Turn a semantic action into concrete screen coordinates.
 *
 * The agent says `action: "sitOn", on: "chair"`. The engine decides the hip's position,
 * the root offset, the draw order and the pose. When the prop cannot support the action
 * (no anchor, no prop) this returns an error instead of guessing.
 */
/** Poses a seated body can hold without breaking hip contact (all have drop 0). */
export const SEATED_POSES = new Set<Pose>(["sit", "type", "phone", "talk", "think", "hold", "holdUp", "crossed", "facepalm", "shrug"]);

export const resolvePlacement = (
  a: Actor,
  props: Partial<PropSpec>[],
  env: { horizon: number },
  build: BuildId | string = "normal",
  pose?: Pose,
): Placement | null => {
  if (!a.action || a.action === "none" || !a.on) return null;
  const index = propIndexOf(a.on, props);
  if (index < 0 || !props[index]) {
    return { x: a.x * 1080, y: 0, s: 1, z: a.z, pose: a.pose, contact: null, error: `no prop called "${a.on}" in this shot's props` };
  }
  const prop = props[index];
  const type = prop.type ?? "";
  const floorY = stageOf(env).y(prop.z ?? 0.45);
  const s = stageOf(env).s(prop.z ?? 0.45) * (prop.scale ?? 1) * a.scale;

  if (a.action === "sitOn") {
    const seat = anchorWorld(prop, env, "seat");
    if (!seat) return { x: a.x * 1080, y: floorY, s, z: prop.z ?? 0.45, pose: "sit", contact: null, error: `"${type}" has no seat anchor — a character cannot sit on it` };
    const sitPose: Pose = pose && SEATED_POSES.has(pose) ? pose : "sit";
    const m = poseMetrics(build, sitPose);
    const y = seat.cy - m.hip * s;
    return {
      x: seat.cx,
      y,
      s,
      z: (prop.z ?? 0.45) + (a.inside ? -0.002 : 0.002),
      pose: sitPose,
      contact: {
        action: a.action, propType: type, propIndex: index, anchorName: "seat", anchor: seat,
        hip: { x: seat.cx, y: y + m.hip * s }, head: { x: seat.cx, y: y + m.headY * s },
        bodyBottom: y, bodyTop: y + m.bodyTop * s, floorY, gap: y - floorY,
      },
    };
  }

  if (a.action === "lieOn" || a.action === "sleepOn") {
    const mat = anchorWorld(prop, env, "mattress");
    if (!mat) return { x: a.x * 1080, y: floorY, s, z: prop.z ?? 0.45, pose: "lie", contact: null, error: `"${type}" has no mattress anchor — a character cannot lie on it` };
    const m = poseMetrics(build, "lie");
    const pillow = anchorWorld(prop, env, "pillow");
    // head on the pillow when the prop has one, otherwise centre the body on the mattress
    const x = pillow
      ? pillow.cx - m.headX * s
      : mat.cx - ((m.bodyLeft + m.bodyRight) / 2) * s;
    const y = mat.cy - m.bodyBottom * s;
    return {
      x,
      y,
      s,
      z: (prop.z ?? 0.45) + 0.002,
      pose: "lie",
      contact: {
        action: a.action, propType: type, propIndex: index, anchorName: "mattress", anchor: mat,
        hip: { x: x + m.hip * s, y }, head: { x: x + m.headX * s, y: y + m.headY * s },
        bodyBottom: y + m.bodyBottom * s, bodyTop: y + m.bodyTop * s, floorY, gap: y + m.bodyBottom * s - mat.cy,
      },
    };
  }

  if (a.action === "standAt") {
    const pw = propWorld(prop, env);
    const side = a.x < pw.x / 1080 ? -1 : 1;
    return { x: pw.x + side * 150 * pw.s, y: stageOf(env).y(prop.z ?? 0.45), s: pw.s * a.scale, z: prop.z ?? 0.45, pose: "stand", contact: null };
  }
  return null;
};

// ---------------------------------------------------------------- actors
export type ActorState = {
  a: Actor;
  pose: Pose;
  prevPose?: Pose;
  poseAge: number;
  expression: Expression;
  exprAge: number;
  x: number;
  y: number;
  z: number;
  s: number;
  opacity: number;
  walking: number;
  facing: "left" | "right" | "front";
  yOff: number;
  sMul: number;
  contact: Contact | null;
  placementError?: string;
};

const easeOutClamped = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export const resolveActors = (
  shot: ResolvedShot,
  env: { horizon: number },
  frame: number,
  durFrames: number,
  opts: { anchors?: boolean } = {},
): ActorState[] => {
  const st = stageOf(env);
  const p = clamp(frame / Math.max(1, durFrames));
  return shot.actors.map((a) => {
    let pose: Pose = a.pose;
    let prevPose: Pose | undefined;
    let poseAge = 999;
    let expression: Expression = a.expression;
    let exprAge = 999;
    for (const b of shot.beatsResolved) {
      const target = b.actor ?? shot.actors[0]?.id;
      if (target !== a.id || b.frame > frame) continue;
      if (b.pose && b.pose !== pose) { prevPose = pose; pose = b.pose; poseAge = frame - b.frame; }
      if (b.expression && b.expression !== expression) { expression = b.expression; exprAge = frame - b.frame; }
    }
    let x = a.x;
    let walking = 0;
    let facing = a.facing;
    const enterF = 16, exitF = 16;
    if (a.moveTo !== undefined) {
      x = lerp(a.x, a.moveTo, ease(p));
      walking = Math.abs(a.moveTo - a.x) > 0.02 && p < 0.98 ? 1 : 0;
      if (walking) facing = a.moveTo > a.x ? "right" : "left";
    }
    let opacity = 1;
    let yOff = 0;
    let sMul = 1;
    if (a.enter === "left" || a.enter === "right") {
      const q = clamp01(frame / enterF);
      const from = a.enter === "left" ? -0.35 : 1.35;
      x = lerp(from, x, easeOutClamped(q));
      if (q < 1) { walking = 1.4; facing = a.enter === "left" ? "right" : "left"; }
    } else if (a.enter === "pop") sMul = easeOutBack(clamp01(frame / 10));
    else if (a.enter === "drop") {
      const q = clamp01(frame / 12);
      yOff = -(1 - q * q) * 900;
      if (q >= 1) sMul = 1 + 0.08 * Math.sin(clamp01((frame - 12) / 8) * Math.PI) * -1;
    } else if (a.enter === "fade") opacity = clamp01(frame / 10);
    const exitStart = durFrames - exitF;
    if (a.exit !== "none" && frame > exitStart) {
      const q = clamp01((frame - exitStart) / exitF);
      if (a.exit === "fade") opacity *= 1 - q;
      else {
        x = lerp(x, a.exit === "left" ? -0.4 : 1.4, q * q);
        walking = 1.6;
        facing = a.exit;
      }
    }
    if (a.pose === "walk" || a.pose === "run") walking = Math.max(walking, a.pose === "run" ? 1.8 : 1);

    let s = st.s(a.z) * a.scale * Math.max(0.01, sMul);
    let y = st.y(a.z);
    let z = a.z;
    let contact: Contact | null = null;
    let placementError: string | undefined;

    // semantic layer: the engine decides where the body goes
    if (opts.anchors !== false) {
      const place = resolvePlacement(a, shot.props, env, undefined, pose);
      if (place) {
        placementError = place.error;
        if (!place.error) {
          x = place.x / 1080;
          y = place.y;
          z = place.z;
          s = place.s * Math.max(0.01, sMul);
          pose = place.pose;
          walking = 0;
          contact = place.contact;
          prevPose = undefined;
          poseAge = 999;
        }
      }
    }

    return {
      a,
      pose: walking && pose === "stand" ? "walk" : pose,
      prevPose,
      poseAge,
      expression,
      exprAge,
      x: x * 1080,
      y: y + yOff,
      z,
      s,
      opacity,
      walking,
      facing,
      yOff,
      sMul: Math.max(0.01, sMul),
      contact,
      placementError,
    };
  });
};

/** The camera for one frame of a shot. */
export const cameraFor = (
  shot: ResolvedShot,
  env: { horizon: number },
  actors: ActorState[],
  frame: number,
  durFrames: number,
) => {
  const fr = FRAMING[shot.framing];
  let fx = 540, fy = 960;
  const focusId = shot.focus ?? (shot.actors[0]?.id ?? (shot.props.length ? "prop:0" : undefined));
  if (focusId?.startsWith("prop:")) {
    const pr = shot.props[Number.parseInt(focusId.slice(5), 10) || 0];
    if (pr) {
      const b = propWorld(pr, env);
      fx = b.x; fy = b.y - 130 * b.s;
    }
  } else if (focusId) {
    const a = actors.find((x) => x.a.id === focusId) ?? actors[0];
    if (a) {
      const st = stageOf(env);
      fx = a.a.moveTo !== undefined ? lerp(a.a.x, a.a.moveTo, 0.5) * 1080 : a.x;
      fy = (a.contact ? a.y : st.y(a.a.z)) - CHAR_H * a.s * fr.k;
      if (actors.length > 1 && (shot.framing === "wide" || shot.framing === "full" || shot.framing === "medium")) {
        const cxs = actors.map((o) => (o.a.moveTo !== undefined ? lerp(o.a.x, o.a.moveTo, 0.5) : o.x));
        const mid = (Math.min(...cxs) + Math.max(...cxs)) / 2;
        fx = lerp(fx, mid, shot.framing === "medium" ? 0.45 : 0.85);
      }
    }
  }
  let zoom = fr.z;
  if (shot.framing === "wide") { fx = lerp(540, fx, 0.35); fy = lerp(960, fy, 0.25); }
  fy += 120 / zoom;

  const p = ease(clamp(frame / Math.max(1, durFrames + TRANS)));
  const seed = hashStr(shot.say);
  let dx = 0, dy = 0, dz = 1;
  switch (shot.camera) {
    case "pushIn": dz = 1 + 0.12 * p; break;
    case "pullOut": dz = 1.14 - 0.14 * p; break;
    case "panLeft": dx = (140 * (0.5 - p) * 2) / zoom; dz = 1.04; break;
    case "panRight": dx = (-140 * (0.5 - p) * 2) / zoom; dz = 1.04; break;
    case "panUp": dy = (200 * (0.5 - p) * 2) / zoom; dz = 1.04; break;
    case "panDown": dy = (-200 * (0.5 - p) * 2) / zoom; dz = 1.04; break;
    case "drift": dx = Math.sin(frame / 40 + seed * 6) * 30 / zoom; dz = 1.03 + 0.04 * p; break;
    case "crashZoom": dz = 1 + 0.55 * easeOut(clamp(frame / 8)); break;
    case "orbit": dx = (260 * (0.5 - p) * 2) / zoom; dz = 1.06; break;
    case "static": dz = 1.01; break;
  }
  for (const b of shot.beatsResolved) {
    if (b.zoom && frame >= b.frame) dz *= 1 + (b.zoom - 1) * easeOut(clamp((frame - b.frame) / 6));
  }
  zoom *= dz;
  const hx = Math.sin(frame / 23 + seed * 10) * 3 + Math.sin(frame / 11 + seed) * 1.5;
  const hy = Math.cos(frame / 29 + seed * 7) * 3;
  let sx = 0, sy = 0;
  const shakeAt = [
    ...(shot.fx.includes("shake") ? [0] : []),
    ...shot.beatsResolved.filter((b) => b.fx === "shake" || b.fx === "explosion" || b.sfx === "boom" || b.sfx === "impact" || b.sfx === "crash").map((b) => b.frame),
  ];
  for (const f0 of shakeAt) {
    const age = frame - f0;
    if (age >= 0 && age < 14) {
      const k = (1 - age / 14) * 22;
      sx += (rand(frame * 1.7 + f0) - 0.5) * k;
      sy += (rand(frame * 3.1 + f0) - 0.5) * k;
    }
  }
  const X0 = -400, X1 = 1480, Y0 = -400, Y1 = 2320;
  let cx = fx + dx, cy = fy + dy;
  const hw = 540 / zoom, hh = 960 / zoom;
  cx = clamp(cx, X0 + hw, X1 - hw);
  cy = clamp(cy, Y0 + hh, Y1 - hh);
  return { cx: cx + (hx + sx) / zoom, cy: cy + (hy + sy) / zoom, zoom };
};

export const layerTransform = (cam: { cx: number; cy: number; zoom: number }, d: number) => {
  const z = 1 + (cam.zoom - 1) * d;
  const cx = 540 + (cam.cx - 540) * d;
  const cy = 960 + (cam.cy - 960) * d;
  return `translate(540 960) scale(${z}) translate(${-cx} ${-cy})`;
};

/** True when the shot uses a 3D location, where the 2D anchor maths does not apply. */
export const is3D = (shot: ResolvedShot) => Boolean(shot.location);

export const anchorRectOf = anchorOf;
export type { AnchorRect };
