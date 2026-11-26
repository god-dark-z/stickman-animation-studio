import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { H, W, clamp, ease, easeOut, easeOutBack, hashStr, lerp, rand } from "../theme";
import type { Character as CharDef, ResolvedShot, PropSpec } from "../schema";
import { Character } from "../character/Character";
import { drawProp, HELD, type PropType } from "./props/Props";
import { buildEnv, type Env, type Light } from "./backgrounds/environments";
import { X0, X1, Y0, Y1 } from "./backgrounds/parts";
import { Fx } from "../fx/Fx";
import { InsertGraphic } from "../fx/Insert";
import type { LangId } from "../../lang";
import {
  CHAR_H,
  DOF,
  anchorWorld,
  cameraFor,
  layerTransform,
  propWorld,
  resolveActors,
  stageOf,
  type ActorState,
} from "./layout";

// Kept re-exported so the 3D scene and dev tools keep their old import paths.
export { cameraFor, resolveActors, stageOf, CHAR_H } from "./layout";

type Placed = { kind: "actor"; z: number; node: React.ReactNode } | { kind: "prop"; z: number; node: React.ReactNode };

const propBox = (p: Partial<PropSpec>, env: Env) => propWorld(p, env);

const Layer: React.FC<{ children: React.ReactNode; blur?: number; blend?: React.CSSProperties["mixBlendMode"]; opacity?: number }> = ({ children, blur = 0, blend, opacity }) => (
  <AbsoluteFill style={{ filter: blur > 0.2 ? `blur(${blur}px)` : undefined, mixBlendMode: blend, opacity }}>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ overflow: "visible" }}>
      {children}
    </svg>
  </AbsoluteFill>
);

let lid = 0;
export const LightShape: React.FC<{ l: Light; t: number }> = ({ l, t }) => {
  const id = React.useMemo(() => `lt${++lid}`, []);
  const flick = 1 + Math.sin(t * 7 + lid) * 0.03;
  if (l.kind === "glow")
    return (
      <g>
        <defs>
          <radialGradient id={id}>
            <stop offset="0" stopColor={l.color} stopOpacity={l.a * flick} />
            <stop offset="0.35" stopColor={l.color} stopOpacity={l.a * 0.45} />
            <stop offset="1" stopColor={l.color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={l.x} cy={l.y} r={l.r} fill={`url(#${id})`} />
      </g>
    );
  if (l.kind === "cone") {
    const a = (l.dir * Math.PI) / 180, sp = (l.spread * Math.PI) / 360;
    const p1 = [l.x + Math.cos(a - sp) * l.len, l.y + Math.sin(a - sp) * l.len];
    const p2 = [l.x + Math.cos(a + sp) * l.len, l.y + Math.sin(a + sp) * l.len];
    return (
      <g>
        <defs>
          <radialGradient id={id} cx={l.x} cy={l.y} r={l.len} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={l.color} stopOpacity={l.a * flick} />
            <stop offset="0.6" stopColor={l.color} stopOpacity={l.a * 0.35} />
            <stop offset="1" stopColor={l.color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <polygon points={`${l.x - 10},${l.y} ${l.x + 10},${l.y} ${p2[0]},${p2[1]} ${p1[0]},${p1[1]}`} fill={`url(#${id})`} />
      </g>
    );
  }
  const [a0, a1, a2, a3] = l.pts;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1={a0[0]} y1={a0[1]} x2={(a2[0] + a3[0]) / 2} y2={(a2[1] + a3[1]) / 2} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={l.color} stopOpacity={l.a * 1.2} />
          <stop offset="1" stopColor={l.color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={[a0, a1, a2, a3].map((q) => q.join(",")).join(" ")} fill={`url(#${id})`} />
    </g>
  );
};

export const Scene: React.FC<{ shot: ResolvedShot; cast: Record<string, CharDef>; frame: number; fps: number; lang?: LangId }> = ({ shot, cast, frame, fps, lang = "en" }) => {
  const t = frame / fps;
  const seed = hashStr(shot.say + shot.index);
  const E = buildEnv(shot.bg, { time: shot.time, t, wallColor: shot.wall, seed });
  const dur = shot.duration;
  const actors = resolveActors(shot, E, frame, dur);
  const cam = cameraFor(shot, E, actors, frame, dur);
  const dof = DOF[shot.framing];

  // A shot prop replaces the background's decorative prop of the same type, so a
  // character can sit on the chair they are drawn on instead of a second chair.
  const setProps = E.set.filter(
    (sp) =>
      !shot.props.some(
        (p) =>
          p.type === sp.type &&
          Math.abs((p.x ?? 0.5) - (sp.x ?? 0.5)) < 0.08 &&
          Math.abs((p.z ?? 0.45) - (sp.z ?? 0.45)) < 0.08,
      ),
  );

  // ------------------------------------------------ world items
  const items: Placed[] = [];
  const allProps: Partial<PropSpec>[] = [...setProps, ...shot.props];
  const extraLights: Light[] = [];
  allProps.forEach((p, pi) => {
    const count = p.count ?? 1;
    for (let i = 0; i < count; i++) {
      const perRow = Math.min(count, 6);
      const row = Math.floor(i / perRow), col = i % perRow;
      const dx = count > 1 ? (col - (Math.min(count - row * perRow, perRow) - 1) / 2) * 0.13 : 0;
      const pp = { ...p, x: (p.x ?? 0.5) + dx * (p.scale ?? 1), z: clamp((p.z ?? 0.45) - row * 0.06, 0, 1) };
      const b = propBox(pp, E);
      let sMul = 1, yOff = 0, op = 1, xOff = 0;
      const ent = p.enter ?? "none";
      const delay = i * 2;
      if (ent === "pop") sMul = easeOutBack(clamp((frame - delay) / 10));
      else if (ent === "drop") { const q = clamp((frame - delay) / 12); yOff = -(1 - q * q) * 1000; }
      else if (ent === "fade") op = clamp((frame - delay) / 10);
      else if (ent === "left") xOff = -(1 - easeOut(clamp(frame / 14))) * 900;
      else if (ent === "right") xOff = (1 - easeOut(clamp(frame / 14))) * 900;
      if (p.float) yOff += Math.sin(t * 2.4 + i) * 14;
      const node = (
        <g key={`p${pi}-${i}`} opacity={op} transform={`translate(${b.x + xOff} ${b.y + yOff}) scale(${b.s * Math.max(0.001, sMul)}) rotate(${p.rotate ?? 0})`}>
          {drawProp(p.type as PropType, { color: p.color, label: p.label, t, seed: rand(pi * 13 + i) })}
        </g>
      );
      items.push({ kind: "prop", z: pp.z, node });
      if (p.glow) extraLights.push({ kind: "glow", x: b.x + xOff, y: b.y + yOff - 110 * b.s, r: 380 * b.s, color: p.color ?? "#ffe28a", a: 0.65 + 0.15 * Math.sin(t * 5) });
    }
  });

  actors.forEach((s, i) => {
    const ch = cast[s.a.id];
    if (!ch) return;
    const lightSide = clamp(E.rim.side + (s.x < W / 2 ? 0.25 : -0.25), -1, 1);
    let held: React.ReactNode = null;
    if (s.a.holding) {
      const h = HELD[s.a.holding as PropType] ?? { s: 0.6, dy: 40 };
      held = <g transform={`scale(${h.s}) translate(0 ${h.dy})`}>{drawProp(s.a.holding as PropType, { label: s.a.holdingLabel, t, seed: i })}</g>;
    }
    const talking = s.a.talking ?? shot.quote === s.a.id;
    const node = (
      <g key={`a${i}`} opacity={s.opacity} transform={`translate(${s.x} ${s.y}) scale(${s.s}) ${s.a.flip ? `rotate(${t * 400})` : ""}`}>
        <Character
          ch={ch} id={s.a.id} pose={s.pose} prevPose={s.prevPose} poseT={s.poseAge / 7}
          expression={s.expression} exprAge={s.exprAge} facing={s.facing} talking={talking}
          t={t} frame={frame} walking={s.walking} held={held}
          light={{ side: lightSide, color: E.rim.color, strength: E.rim.strength }}
        />
      </g>
    );
    items.push({ kind: "actor", z: s.z, node });
  });
  items.sort((a, b) => a.z - b.z);

  // A blanket drawn over a sleeping body: the character is still a full figure, but
  // reads as "in bed" instead of "on top of the covers".
  const blankets: React.ReactNode[] = [];
  shot.actors.forEach((a) => {
    if (!a.underBlanket || !a.on) return;
    const idx = a.on.startsWith("prop:") ? Number.parseInt(a.on.slice(5), 10) : shot.props.findIndex((p) => p.type === a.on);
    const prop = shot.props[idx];
    if (!prop) return;
    const mat = anchorWorld(prop, E, "mattress");
    if (!mat) return;
    const fig = actors.find((x) => x.a.id === a.id);
    if (!fig) return;
    blankets.push(
      <g key={`blanket-${a.id}`}>
        <path
          d={`M ${mat.left} ${mat.top - 40 * mat.s} L ${mat.right} ${mat.top - 40 * mat.s} L ${mat.right + 6} ${mat.top + 96 * mat.s} L ${mat.left - 6} ${mat.top + 96 * mat.s} Z`}
          fill={prop.color ?? "#4f78c9"}
          stroke="#2a1c15"
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d={`M ${mat.left + 10} ${mat.top + 2} L ${mat.right - 10} ${mat.top + 2}`} stroke="#ffffff" strokeWidth={6} opacity={0.35} strokeLinecap="round" />
        {/* the blanket edge that the sleeper's head rests above */}
        <path d={`M ${mat.left} ${mat.top - 40 * mat.s} L ${mat.right} ${mat.top - 40 * mat.s}`} stroke="#2a1c15" strokeWidth={5} strokeLinecap="round" />
      </g>,
    );
  });

  // soft back-light behind the subject so characters pop off the background (like a rim/key light pass)
  {
    const fa = actors.find((a) => a.a.id === shot.focus) ?? actors[0];
    if (fa) extraLights.push({ kind: "glow", x: fa.x, y: fa.y - CHAR_H * fa.s * 0.75, r: 560 * fa.s, color: E.rim.color, a: 0.2 });
  }

  // focus point in screen space for fx
  const focusWorld = (() => {
    const fa = actors.find((a) => a.a.id === shot.focus) ?? actors[0];
    if (shot.focus?.startsWith("prop:")) {
      const pr = shot.props[parseInt(shot.focus.slice(5), 10) || 0];
      if (pr) { const b = propBox(pr, E); return { x: b.x, y: b.y - 120 * b.s, head: b.y - 200 * b.s }; }
    }
    if (fa) return { x: fa.x, y: fa.y - CHAR_H * fa.s * 0.55, head: fa.y - CHAR_H * fa.s * 1.05 };
    return { x: W / 2, y: H / 2, head: H / 2 - 300 };
  })();
  const toScreen = (x: number, y: number) => ({ x: (x - cam.cx) * cam.zoom + W / 2, y: (y - cam.cy) * cam.zoom + H / 2 });
  const fScreen = toScreen(focusWorld.x, focusWorld.y);
  const hScreen = toScreen(focusWorld.x, focusWorld.head);

  const T1 = layerTransform(cam, 1);
  const hasInsert = shot.insert && shot.insert.type !== "none";

  return (
    <AbsoluteFill>
    <AbsoluteFill style={{ backgroundColor: "#000", filter: `saturate(1.14) contrast(1.06)${hasInsert ? " blur(9px) brightness(0.8)" : ""}` }}>
      {E.sky && <Layer blur={dof[0]}><g transform={layerTransform(cam, 0.15)}>{E.sky}</g></Layer>}
      {E.far && <Layer blur={dof[1]}><g transform={layerTransform(cam, 0.45)}>{E.far}</g></Layer>}
      <Layer blur={dof[2]}>
        <g transform={T1}>
          {E.wall}
          {E.floor}
        </g>
      </Layer>
      <Layer>
        <g transform={T1}>{items.map((it) => it.node)}{blankets}</g>
      </Layer>
      {E.fore && <Layer blur={4}><g transform={layerTransform(cam, 1.35)}>{E.fore}</g></Layer>}
      <Layer blend="screen">
        <g transform={T1}>
          {[...E.lights, ...extraLights].map((l, i) => <LightShape key={i} l={l} t={t} />)}
        </g>
      </Layer>
      {E.ambient.map((a, i) => (
        <AbsoluteFill key={i} style={{ backgroundColor: a.color, opacity: a.a, mixBlendMode: a.mode }} />
      ))}
      {shot.tint && <AbsoluteFill style={{ backgroundColor: shot.tint, opacity: 0.22, mixBlendMode: "soft-light" }} />}
      <Fx shot={shot} frame={frame} fps={fps} focus={fScreen} head={hScreen} zoom={cam.zoom} />
    </AbsoluteFill>
      {hasInsert && <InsertGraphic insert={shot.insert!} frame={frame} fps={fps} lang={lang} />}
    </AbsoluteFill>
  );
};

export const PostFX: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {/* vignette */}
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 62% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.42) 100%)" }} />
    {/* soft glow / contrast */}
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(255,240,220,0.05), rgba(0,0,0,0.06))", mixBlendMode: "overlay" }} />
    {/* film grain (Img makes Remotion wait for the texture; the div tiles it) */}
    <Img src={staticFile("grain.png")} style={{ display: "none" }} />
    <AbsoluteFill style={{
      opacity: 0.08, mixBlendMode: "overlay",
      backgroundImage: `url(${staticFile("grain.png")})`, backgroundRepeat: "repeat",
      backgroundPosition: `${-Math.floor(rand(frame * 1.3) * 512)}px ${-Math.floor(rand(frame * 2.7) * 512)}px`,
    }} />
  </>
);

