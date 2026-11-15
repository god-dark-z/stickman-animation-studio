import React from "react";
import { INK, W, mix, rand, shade } from "../../theme";
import type { BACKGROUNDS } from "../../catalog";
import type { PropSpec } from "../../schema";
import { CeilingLights, Cloud, Floor, Frame, Hills, Mountains, Sea, Sky, Skyline, Wall, Window, X0, X1, Y0, Y1, type Time } from "./parts";

export type BgId = (typeof BACKGROUNDS)[number];

export type Light =
  | { kind: "glow"; x: number; y: number; r: number; color: string; a: number }
  | { kind: "cone"; x: number; y: number; dir: number; spread: number; len: number; color: string; a: number }
  | { kind: "shaft"; pts: [number, number][]; color: string; a: number };

export type Env = {
  horizon: number;
  sky?: React.ReactNode; // depth 0.15
  far?: React.ReactNode; // depth 0.4
  wall?: React.ReactNode; // depth 0.75
  floor: React.ReactNode; // depth 0.9 (drawn under actors)
  set: Partial<PropSpec>[]; // set dressing props (sorted with actors by z)
  fore?: React.ReactNode; // depth 1.35 (in front of actors)
  lights: Light[];
  ambient: { color: string; a: number; mode: "multiply" | "soft-light" | "screen" | "overlay" }[];
  rim: { side: number; color: string; strength: number };
};

const P = (type: PropSpec["type"], x: number, z: number, extra: Partial<PropSpec> = {}): Partial<PropSpec> => ({ type, x, z, ...extra });

const timeGrade = (time: Time): Env["ambient"] =>
  time === "night"
    ? [{ color: "#1a2a6a", a: 0.42, mode: "multiply" }]
    : time === "sunset"
      ? [{ color: "#ff9a5a", a: 0.28, mode: "soft-light" }]
      : time === "dawn"
        ? [{ color: "#ffb0a0", a: 0.2, mode: "soft-light" }]
        : [];

// light shaft from a window down to the floor
const windowShaft = (x: number, y: number, w: number, h: number, horizon: number, color: string, a: number, dx = 260): Light => ({
  kind: "shaft",
  pts: [[x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2 + dx, horizon + 420], [x - w / 2 + dx - 120, horizon + 520]],
  color, a,
});

type Ctx = { time: Time; t: number; wallColor?: string; seed: number };

const interior = (ctx: Ctx, o: {
  horizon?: number; wall: string; wallKind: Parameters<typeof Wall>[0]["kind"]; floor: string; floorKind: Parameters<typeof Floor>[0]["kind"];
  wainscot?: string; windows?: { x: number; w: number; h: number; y?: number; view?: "sky" | "city" | "trees" | "sea"; bars?: boolean; blinds?: boolean }[];
  deco?: React.ReactNode; ceiling?: number; set?: Partial<PropSpec>[]; lights?: Light[]; warm?: boolean; fore?: React.ReactNode; ambient?: Env["ambient"]; rim?: Env["rim"];
}): Env => {
  const horizon = o.horizon ?? 1180;
  const wallC = ctx.wallColor ?? o.wall;
  const night = ctx.time === "night";
  const wins = o.windows ?? [];
  const sunCol = night ? "#9fb6ff" : ctx.time === "sunset" ? "#ffb070" : "#fff2c8";
  const lights: Light[] = [
    ...wins.map((w) => windowShaft(w.x, w.y ?? horizon - 420, w.w, w.h, horizon, sunCol, night ? 0.12 : 0.22)),
    ...(o.lights ?? []),
  ];
  return {
    horizon,
    wall: (
      <g>
        <Wall horizon={horizon} kind={o.wallKind} color={wallC} wainscot={o.wainscot} />
        {wins.map((w, i) => (
          <Window key={i} x={w.x} y={w.y ?? horizon - 420} w={w.w} h={w.h} time={ctx.time} view={w.view} bars={w.bars} blinds={w.blinds} />
        ))}
        {o.deco}
        {o.ceiling !== undefined && <CeilingLights y={o.ceiling} count={4} />}
      </g>
    ),
    floor: <Floor horizon={horizon} kind={o.floorKind} color={o.floor} />,
    set: o.set ?? [],
    fore: o.fore,
    lights,
    ambient: [...(night ? [{ color: "#24306a", a: 0.3, mode: "multiply" as const }] : []), ...(o.warm ? [{ color: "#ffb05a", a: 0.18, mode: "soft-light" as const }] : []), ...(o.ambient ?? [])],
    rim: o.rim ?? { side: wins.length ? (wins[0].x < W / 2 ? -1 : 1) : -0.6, color: night ? "#9fb6ff" : "#fff1d0", strength: 0.8 },
  };
};

const exterior = (ctx: Ctx, o: {
  horizon?: number; far?: React.ReactNode; mid?: React.ReactNode; ground: string; groundKind: Parameters<typeof Floor>[0]["kind"];
  set?: Partial<PropSpec>[]; clouds?: boolean; stars?: boolean; lights?: Light[]; fore?: React.ReactNode; sky?: React.ReactNode;
  ambient?: Env["ambient"]; rim?: Env["rim"];
}): Env => {
  const horizon = o.horizon ?? 1150;
  const night = ctx.time === "night";
  return {
    horizon,
    sky: o.sky ?? <Sky time={ctx.time} horizon={horizon} t={ctx.t} clouds={o.clouds} stars={o.stars} />,
    far: o.far,
    wall: o.mid,
    floor: <Floor horizon={horizon} kind={o.groundKind} color={night ? shade(o.ground, -0.15) : o.ground} t={ctx.t} />,
    set: o.set ?? [],
    fore: o.fore,
    lights: [
      ...(night ? [{ kind: "glow" as const, x: 820, y: 260, r: 700, color: "#9fb6ff", a: 0.25 }] : ctx.time === "day" ? [{ kind: "glow" as const, x: 240, y: 180, r: 900, color: "#fff4c8", a: 0.3 }] : [{ kind: "glow" as const, x: 540, y: horizon - 120, r: 1000, color: "#ffb070", a: 0.4 }]),
      ...(o.lights ?? []),
    ],
    ambient: o.ambient ?? timeGrade(ctx.time),
    rim: o.rim ?? { side: night ? 0.6 : ctx.time === "day" ? -0.8 : 0, color: night ? "#a8c0ff" : ctx.time === "day" ? "#fff6d8" : "#ffc080", strength: 1 },
  };
};

const lamp = (x: number, y: number, color = "#ffd27a", a = 0.55): Light[] => [
  { kind: "glow", x, y, r: 420, color, a },
  { kind: "cone", x, y, dir: 90, spread: 70, len: 900, color, a: a * 0.6 },
];

export const buildEnv = (bg: BgId, ctx: Ctx): Env => {
  const { time, t } = ctx;
  const night = time === "night";
  switch (bg) {
    case "office":
      return interior(ctx, {
        wall: "#cfd9e4", wallKind: "paint", floor: "#3a5fae", floorKind: "carpet", ceiling: -120,
        windows: [{ x: 200, w: 300, h: 420, view: "city", blinds: false }, { x: 880, w: 300, h: 420, view: "city" }],
        deco: <g><Frame x={540} y={760} w={160} h={110} seed={1} /><rect x={470} y={560} width={140} height={60} rx={6} fill="#ffffff" stroke={INK} strokeWidth={4} /><circle cx={540} cy={590} r={22} fill="#d8342c" /></g>,
        set: [P("desk", 0.2, 0.15), P("chair", 0.2, 0.1, { color: "#2a2d36" }), P("computer", 0.2, 0.15, { y: 196, scale: 0.8 }), P("plant", 0.93, 0.12), P("desk", 0.82, 0.15), P("computer", 0.82, 0.15, { y: 196, scale: 0.8 })],
      });
    case "bedroom":
      return interior(ctx, {
        wall: night ? "#3a4f7a" : "#e8c9a8", wallKind: "stripes", floor: "#b07a4a", floorKind: "wood", warm: true,
        windows: [{ x: 780, w: 320, h: 380, view: night ? "city" : "trees", blinds: true }],
        deco: <Frame x={260} y={720} w={200} h={150} seed={4} />,
        set: [P("bed", 0.25, 0.12), P("lamp", 0.62, 0.05, { y: 120 }), P("table", 0.62, 0.05, { scale: 0.5 }), P("rug", 0.5, 0.5, { color: "#7a4fd6" })],
        lights: night ? lamp(700, 950) : [],
      });
    case "livingroom":
      return interior(ctx, {
        wall: "#9fc4a8", wallKind: "paint", wainscot: "#f1ead8", floor: "#a8703f", floorKind: "wood", warm: true,
        windows: [{ x: 230, w: 300, h: 380, view: "trees" }],
        deco: <g><Frame x={700} y={700} w={240} h={160} seed={2} /></g>,
        set: [P("couch", 0.62, 0.12), P("floorlamp", 0.9, 0.08), P("tv", 0.15, 0.3, { scale: 0.8 }), P("rug", 0.5, 0.45)],
        lights: lamp(970, 690, "#ffd27a", night ? 0.6 : 0.3),
      });
    case "kitchen":
      return interior(ctx, {
        wall: "#f4f0e4", wallKind: "tile", floor: "#d8d2c4", floorKind: "checker",
        windows: [{ x: 540, w: 300, h: 260, y: 820, view: "trees" }],
        deco: (
          <g>
            {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={X0 + 120 + i * 300} y={360} width={260} height={220} rx={8} fill="#9fc4d8" stroke={INK} strokeWidth={4} />)}
            <rect x={X0} y={960} width={X1 - X0} height={30} fill="#e9e6de" stroke={INK} strokeWidth={4} />
            <rect x={X0} y={990} width={X1 - X0} height={190} fill="#7fa8c0" stroke={INK} strokeWidth={4} />
          </g>
        ),
        set: [P("table", 0.5, 0.45)],
      });
    case "classroom":
      return interior(ctx, {
        wall: "#e8dcc0", wallKind: "paint", wainscot: "#a8703f", floor: "#c48a50", floorKind: "wood",
        windows: [{ x: 960, w: 240, h: 420, view: "trees" }],
        deco: (
          <g>
            <rect x={140} y={520} width={620} height={360} rx={8} fill="#2f4a3a" stroke="#8a5a32" strokeWidth={18} />
            <path d="M 200 600 L 420 600 M 200 660 L 560 660 M 200 720 L 360 720" stroke="#e8f0e8" strokeWidth={6} strokeLinecap="round" opacity={0.75} />
            <circle cx={460} cy={420} r={50} fill="#ffffff" stroke={INK} strokeWidth={5} />
          </g>
        ),
        set: [P("desk", 0.18, 0.62, { scale: 0.7 }), P("desk", 0.82, 0.62, { scale: 0.7 })],
      });
    case "lab":
      return interior(ctx, {
        wall: "#dfe8ee", wallKind: "tile", floor: "#c9d2da", floorKind: "tile", ceiling: -60,
        deco: (
          <g>
            {[0, 1].map((r) => (
              <g key={r}>
                <rect x={X0 + 200} y={560 + r * 200} width={X1 - X0 - 400} height={16} fill="#9aa3ae" stroke={INK} strokeWidth={4} />
                {Array.from({ length: 14 }).map((_, i) => (
                  <g key={i} transform={`translate(${X0 + 260 + i * 110} ${560 + r * 200}) scale(0.4)`}>
                    <path d="M -16 -170 L -16 -110 L -70 -10 Q -74 0 -60 0 L 60 0 Q 74 0 70 -10 L 16 -110 L 16 -170 Z" fill="rgba(220,240,255,0.85)" stroke={INK} strokeWidth={8} />
                    <path d="M -46 -50 L 46 -50 L 70 -10 Q 74 0 60 0 L -60 0 Q -74 0 -70 -10 Z" fill={["#4fd07a", "#ff4fa8", "#4fb3e8", "#f2c230"][(i + r) % 4]} />
                  </g>
                ))}
              </g>
            ))}
          </g>
        ),
        set: [P("table", 0.5, 0.3, { color: "#e8eaee", scale: 1.3 }), P("flask", 0.4, 0.3, { y: 190, scale: 0.6, color: "#4fd07a" }), P("flask", 0.58, 0.3, { y: 190, scale: 0.5, color: "#ff4fa8" })],
        lights: [{ kind: "glow", x: 540, y: 300, r: 900, color: "#e8f8ff", a: 0.25 }],
      });
    case "store":
      return interior(ctx, {
        wall: "#f4f4f2", wallKind: "paint", floor: "#e8e6e0", floorKind: "tile", ceiling: -80,
        deco: (
          <g>
            {Array.from({ length: 7 }).map((_, i) => (
              <g key={i} transform={`translate(${X0 + 180 + i * 300} 1170) scale(1.1)`}>
                <rect x={-130} y={-500} width={260} height={500} fill="#d6dbe3" stroke={INK} strokeWidth={4} />
                {[0, 1, 2, 3].map((r) => (
                  <g key={r}>
                    {Array.from({ length: 8 }).map((__, k) => (
                      <rect key={k} x={-120 + k * 30} y={-480 + r * 120} width={24} height={90} fill={["#d8342c", "#2a6fd6", "#f2c230", "#2fa84f", "#ff8a2a", "#7a4fd6"][(k + r + i) % 6]} stroke={INK} strokeWidth={2} />
                    ))}
                    <rect x={-130} y={-388 + r * 120} width={260} height={10} fill="#9aa3ae" />
                  </g>
                ))}
              </g>
            ))}
          </g>
        ),
        set: [P("table", 0.75, 0.55, { color: "#3a3f4a", scale: 1.2, label: "" })],
      });
    case "prison":
      return interior(ctx, {
        wall: night ? "#5a6a80" : "#9fb0c4", wallKind: "cinder", floor: "#b8c2cc", floorKind: "concrete", ceiling: -140,
        deco: (
          <g>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <rect x={X0 + 120 + i * 380} y={720} width={240} height={460} fill="#5a6a80" stroke={INK} strokeWidth={5} />
                {Array.from({ length: 6 }).map((_, k) => <line key={k} x1={X0 + 140 + i * 380 + k * 40} y1={720} x2={X0 + 140 + i * 380 + k * 40} y2={1180} stroke="#2e3542" strokeWidth={10} />)}
                <rect x={X0 + 200 + i * 380} y={680} width={80} height={30} fill="#e8eaee" stroke={INK} strokeWidth={3} />
              </g>
            ))}
            <rect x={X0} y={420} width={X1 - X0} height={30} fill="#6a7480" stroke={INK} strokeWidth={4} />
            {Array.from({ length: 40 }).map((_, i) => <line key={i} x1={X0 + i * 50} y1={300} x2={X0 + i * 50} y2={430} stroke="#4a525e" strokeWidth={6} />)}
            <rect x={X0} y={1150} width={X1 - X0} height={14} fill="#f2c230" />
          </g>
        ),
        lights: [{ kind: "glow", x: 540, y: 200, r: 1000, color: "#dff0ff", a: 0.25 }],
      });
    case "cell":
      return interior(ctx, {
        wall: ctx.wallColor ?? "#8a96a6", wallKind: "cinder", floor: "#9aa3ae", floorKind: "concrete", horizon: 1250,
        windows: [{ x: 540, w: 260, h: 160, y: 620, bars: true, view: "sky" }],
        set: [P("bench", 0.25, 0.1, { color: "#7d8a96" })],
        lights: [windowShaft(540, 620, 260, 160, 1250, "#fff6d8", 0.3, 120)],
      });
    case "hospital":
      return interior(ctx, {
        wall: "#dff1ee", wallKind: "paint", wainscot: "#9fd6cc", floor: "#e8eef0", floorKind: "tile", ceiling: -100,
        windows: [{ x: 860, w: 300, h: 380, view: "city", blinds: true }],
        deco: <path d={`M ${X0 + 300} 400 Q ${X0 + 360} 800 ${X0 + 300} 1180 L ${X0 + 650} 1180 Q ${X0 + 600} 800 ${X0 + 650} 400 Z`} fill="#bfe3f0" stroke={INK} strokeWidth={4} />,
        set: [P("bed", 0.35, 0.15, { color: "#9fd6cc" })],
      });
    case "courtroom":
      return interior(ctx, {
        wall: "#8a5a32", wallKind: "panel", floor: "#7a4a2a", floorKind: "wood", warm: true,
        deco: (
          <g>
            <rect x={240} y={700} width={600} height={480} fill="#6a3f22" stroke={INK} strokeWidth={6} />
            <rect x={220} y={680} width={640} height={40} fill="#8a5a32" stroke={INK} strokeWidth={5} />
            <circle cx={540} cy={460} r={120} fill="#c9963a" stroke={INK} strokeWidth={6} />
            <circle cx={540} cy={460} r={80} fill="#e8c46a" stroke={INK} strokeWidth={4} />
          </g>
        ),
        set: [P("flag", 0.12, 0.05, { color: "#2a5bb8" })],
        lights: [{ kind: "glow", x: 540, y: 300, r: 800, color: "#ffd8a0", a: 0.3 }],
      });
    case "factory":
      return interior(ctx, {
        wall: "#5fa8b8", wallKind: "metal", floor: "#8a929e", floorKind: "concrete", ceiling: -100,
        windows: [{ x: 300, w: 420, h: 260, y: 600, view: "sky" }, { x: 820, w: 420, h: 260, y: 600, view: "sky" }],
        deco: <g><rect x={X0} y={1050} width={X1 - X0} height={60} fill="#f2c230" stroke={INK} strokeWidth={4} />{Array.from({ length: 30 }).map((_, i) => <path key={i} d={`M ${X0 + i * 70} 1050 l 30 60`} stroke={INK} strokeWidth={10} />)}</g>,
        set: [P("gear", 0.15, 0.1, { scale: 1.3 }), P("pipe", 0.92, 0.05), P("barrel", 0.8, 0.3, { color: "#d8342c" })],
      });
    case "bar":
      return interior(ctx, {
        wall: "#7a4a2a", wallKind: "wood", floor: "#8a5a32", floorKind: "wood", warm: true,
        deco: (
          <g>
            {[0, 1].map((r) => (
              <g key={r}>
                <rect x={X0 + 300} y={640 + r * 170} width={X1 - X0 - 600} height={14} fill="#5a3a22" stroke={INK} strokeWidth={4} />
                {Array.from({ length: 16 }).map((_, i) => <rect key={i} x={X0 + 330 + i * 75} y={560 + r * 170} width={26} height={80} rx={6} fill={["#3f9a4a", "#8a3a2a", "#d9a520", "#5a7ad8"][(i + r) % 4]} stroke={INK} strokeWidth={3} />)}
              </g>
            ))}
            <rect x={X0} y={980} width={X1 - X0} height={40} fill="#b9844a" stroke={INK} strokeWidth={5} />
            <rect x={X0} y={1020} width={X1 - X0} height={160} fill="#6a3f22" stroke={INK} strokeWidth={5} />
          </g>
        ),
        lights: [...lamp(300, 420, "#ffc870", 0.45), ...lamp(800, 420, "#ffc870", 0.45)],
      });
    case "street":
      return exterior(ctx, {
        groundKind: "road", ground: "#7d838c",
        mid: (
          <g>
            {Array.from({ length: 8 }).map((_, i) => {
              const x = X0 + i * 260;
              const h = 380 + rand(i * 7) * 300;
              const c = ["#d8a07a", "#c9673a", "#e8c48a", "#9fb0c8", "#b8473a"][i % 5];
              return (
                <g key={i}>
                  <rect x={x} y={1150 - h} width={250} height={h} fill={c} stroke={INK} strokeWidth={5} />
                  {Array.from({ length: Math.floor(h / 120) }).map((_, r) => [0, 1].map((k) => (
                    <rect key={`${r}${k}`} x={x + 40 + k * 110} y={1150 - h + 40 + r * 120} width={60} height={70} fill={night ? (rand(i + r + k) > 0.4 ? "#ffd77a" : "#2a3a66") : "#bfe6ff"} stroke={INK} strokeWidth={4} />
                  )))}
                  <rect x={x + 90} y={1050} width={70} height={100} fill="#6a3f22" stroke={INK} strokeWidth={4} />
                </g>
              );
            })}
            <rect x={X0} y={1150} width={X1 - X0} height={40} fill="#c9ced6" stroke={INK} strokeWidth={4} />
          </g>
        ),
        lights: night ? [...lamp(150, 760, "#ffd27a", 0.5), ...lamp(930, 760, "#ffd27a", 0.5)] : [],
      });
    case "city":
      return exterior(ctx, {
        groundKind: "road", ground: "#6d737c",
        far: <Skyline horizon={1150} night={night} color={night ? "#1d2a4f" : "#7f98bc"} tall={1.6} />,
      });
    case "suburb":
      return exterior(ctx, {
        groundKind: "grass", ground: "#6cbf5a",
        far: <Hills horizon={1150} colors={["#9fd68a", "#7cc46a"]} />,
        set: [P("house", 0.12, 0.05, { color: "#e8c48a" }), P("house", 0.85, 0.05, { color: "#9fc4e8" }), P("tree", 0.5, 0.0, { scale: 0.8 }), P("fence", 0.15, 0.2, { scale: 0.7 }), P("fence", 0.85, 0.2, { scale: 0.7 })],
      });
    case "field":
      return exterior(ctx, {
        groundKind: "grass", ground: "#6cbf5a",
        far: <Hills horizon={1150} colors={["#a8dc8a", "#8acd70", "#73bd5c"]} />,
        set: [P("tree", 0.9, 0.02, { scale: 0.7 })],
      });
    case "farm":
      return exterior(ctx, {
        groundKind: "dirt", ground: "#c9a46a",
        far: <Hills horizon={1150} colors={["#a8dc8a", "#8acd70"]} />,
        mid: (
          <g transform="translate(230 1150)">
            <rect x={-200} y={-360} width={400} height={360} fill="#c0392b" stroke={INK} strokeWidth={6} />
            <path d="M -230 -350 L 0 -520 L 230 -350 Z" fill="#8a2a22" stroke={INK} strokeWidth={6} />
            <rect x={-90} y={-220} width={180} height={220} fill="#f4f0e4" stroke={INK} strokeWidth={5} />
            <path d="M -90 -220 L 90 0 M 90 -220 L -90 0" stroke={INK} strokeWidth={6} />
          </g>
        ),
        set: [P("fence", 0.75, 0.1), P("cow", 0.8, 0.25, { scale: 0.8 })],
      });
    case "forest":
      return exterior(ctx, {
        groundKind: "grass", ground: "#5aa04a",
        far: <g>{Array.from({ length: 16 }).map((_, i) => <g key={i} transform={`translate(${X0 + i * 130} ${1160}) scale(${0.8 + rand(i) * 0.5})`}><path d="M -110 0 L 0 -420 L 110 0 Z" fill={mix("#2f6a3a", "#9fd6a0", 0.35)} /></g>)}</g>,
        set: [P("pinetree", 0.05, 0.05, { scale: 1.3 }), P("pinetree", 0.95, 0.08, { scale: 1.2 }), P("tree", 0.7, 0.02, { scale: 0.9 }), P("rock", 0.3, 0.3, { scale: 0.6 })],
      });
    case "desert":
      return exterior(ctx, {
        groundKind: "sand", ground: "#e8c47a",
        far: <Hills horizon={1150} colors={["#f2d49a", "#e8c07a"]} seed={4} />,
        set: [P("cactus", 0.15, 0.1), P("cactus", 0.88, 0.03, { scale: 0.7 }), P("rock", 0.7, 0.3, { scale: 0.5, color: "#c9925a" })],
      });
    case "western":
      return exterior(ctx, {
        groundKind: "dirt", ground: "#d8a86a",
        far: <Mountains horizon={1150} color="#c9825a" snow={false} />,
        mid: (
          <g>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const x = X0 + 40 + i * 330;
              const h = 420 + (i % 2) * 120;
              const c = ["#b9844a", "#a0683a", "#c9965a"][i % 3];
              return (
                <g key={i}>
                  <rect x={x} y={1150 - h} width={300} height={h} fill={c} stroke={INK} strokeWidth={5} />
                  <rect x={x - 10} y={1150 - h - 60} width={320} height={70} fill={shade(c, -0.15)} stroke={INK} strokeWidth={5} />
                  <text x={x + 150} y={1150 - h - 22} textAnchor="middle" fontFamily="Georgia, serif" fontWeight={900} fontSize={40} fill="#f4ecd0">{["SALOON", "BANK", "HOTEL", "SHERIFF", "STORE", "BARBER"][i]}</text>
                  <rect x={x + 110} y={1150 - 200} width={80} height={200} fill="#5a3a22" stroke={INK} strokeWidth={4} />
                  <rect x={x} y={1150 - 260} width={300} height={16} fill="#6a3f22" stroke={INK} strokeWidth={3} />
                </g>
              );
            })}
          </g>
        ),
      });
    case "mountain":
      return exterior(ctx, {
        groundKind: "snow", ground: "#eef4fa",
        far: <Mountains horizon={1150} color="#7f98bc" />,
        set: [P("pinetree", 0.1, 0.1, { color: "#2f6a4a" }), P("pinetree", 0.88, 0.06, { color: "#2f6a4a", scale: 0.8 })],
      });
    case "beach":
      return exterior(ctx, {
        horizon: 1000, groundKind: "sand", ground: "#f2d49a",
        far: <g><Sea horizon={1000} time={time} t={t} /><rect x={X0} y={1150} width={X1 - X0} height={Y1 - 1150} fill="#f2d49a" /><path d={`M ${X0} 1150 Q 300 ${1120 + Math.sin(t * 2) * 12} 600 1150 T ${X1} 1150`} stroke="#ffffff" strokeWidth={14} fill="none" /></g>,
        set: [P("palm", 0.12, 0.2), P("palm", 0.92, 0.1, { scale: 0.8 })],
      });
    case "sea":
      return {
        ...exterior(ctx, { groundKind: "water", ground: "#3f9ad8" }),
        floor: <Sea horizon={1150} time={time} t={t} stormy={night} />,
      };
    case "shipdeck":
      return exterior(ctx, {
        horizon: 1000, groundKind: "deck", ground: "#c98a4a",
        far: <Sea horizon={1000} time={time} t={t} stormy={night} />,
        mid: (
          <g>
            <rect x={X0} y={900} width={X1 - X0} height={120} fill="#8a3a2a" stroke={INK} strokeWidth={6} />
            <rect x={X0} y={880} width={X1 - X0} height={30} fill="#6a3f22" stroke={INK} strokeWidth={5} />
            {Array.from({ length: 22 }).map((_, i) => <rect key={i} x={X0 + 20 + i * 90} y={910} width={22} height={100} fill="#6a3f22" stroke={INK} strokeWidth={3} />)}
            <rect x={760} y={-700} width={60} height={1720} fill="#8a5a32" stroke={INK} strokeWidth={6} />
            <path d={`M 820 -200 Q ${1200 + Math.sin(t * 2) * 20} 100 820 500 Z`} fill="#f4ecd0" stroke={INK} strokeWidth={6} />
            <path d="M 760 -100 L 200 300 M 760 0 L 140 500" stroke={INK} strokeWidth={4} />
          </g>
        ),
        set: [P("barrel", 0.12, 0.2), P("cannon", 0.88, 0.25, { scale: 0.8 })],
      });
    case "space":
      return {
        horizon: 2200,
        sky: (
          <g>
            <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="#070a1e" />
            <ellipse cx={300} cy={600} rx={700} ry={300} fill="#3a1f6a" opacity={0.35} />
            <ellipse cx={900} cy={1400} rx={600} ry={260} fill="#1f3a8a" opacity={0.3} />
            {Array.from({ length: 220 }).map((_, i) => <circle key={i} cx={X0 + rand(i * 3.1) * (X1 - X0)} cy={Y0 + rand(i * 7.7) * (Y1 - Y0)} r={1 + rand(i) * 3} fill="#fff" opacity={0.4 + 0.6 * Math.abs(Math.sin(t + i))} />)}
          </g>
        ),
        far: <g><circle cx={780} cy={1500} r={420} fill="#4f8ae8" stroke={INK} strokeWidth={6} /><path d="M 520 1300 Q 640 1240 700 1360 Q 760 1480 900 1420 Q 1000 1380 1060 1500" stroke="#5fbf5a" strokeWidth={70} fill="none" strokeLinecap="round" /></g>,
        floor: null,
        set: [],
        lights: [{ kind: "glow", x: 780, y: 1500, r: 700, color: "#7fb0ff", a: 0.3 }],
        ambient: [],
        rim: { side: 1, color: "#9fc4ff", strength: 1 },
      };
    case "moon":
      return exterior(ctx, {
        groundKind: "moon", ground: "#b8b8c0", stars: true, clouds: false,
        sky: <g><rect x={X0} y={Y0} width={X1 - X0} height={1300} fill="#05081a" />{Array.from({ length: 160 }).map((_, i) => <circle key={i} cx={X0 + rand(i * 3.1) * (X1 - X0)} cy={Y0 + rand(i * 7.7) * 1700} r={1 + rand(i) * 2.5} fill="#fff" />)}<circle cx={780} cy={420} r={150} fill="#4f8ae8" stroke={INK} strokeWidth={5} /><path d="M 680 360 Q 760 330 800 420 Q 830 480 900 460" stroke="#5fbf5a" strokeWidth={34} fill="none" strokeLinecap="round" /></g>,
      });
    case "cave":
      return interior(ctx, {
        wall: "#4a3f4a", wallKind: "stone", floor: "#5a4f52", floorKind: "dirt", warm: true,
        deco: <g>{Array.from({ length: 14 }).map((_, i) => <path key={i} d={`M ${X0 + i * 150} ${Y0 + 600} l 60 ${200 + rand(i) * 260} l 60 ${-200 - rand(i) * 260} Z`} fill="#3a2f3a" stroke={INK} strokeWidth={4} />)}</g>,
        set: [P("campfire", 0.5, 0.35)],
        lights: [{ kind: "glow", x: 540, y: 1300, r: 800, color: "#ff9a3a", a: 0.55 }],
      });
    case "stage":
      return {
        horizon: 1250,
        wall: <g><rect x={X0} y={Y0} width={X1 - X0} height={1950} fill="#2a1a3a" />{Array.from({ length: 14 }).map((_, i) => <path key={i} d={`M ${X0 + i * 140} ${Y0} q 40 900 0 1950`} stroke="#4a2050" strokeWidth={60} fill="none" />)}<path d={`M ${X0} ${Y0} L ${X1} ${Y0} L ${X1} 200 Q 540 420 ${X0} 200 Z`} fill="#b8263a" stroke={INK} strokeWidth={6} /></g>,
        floor: <Floor horizon={1250} kind="wood" color="#8a5a32" />,
        set: [],
        lights: [{ kind: "cone", x: 540, y: -400, dir: 90, spread: 15, len: 2200, color: "#fff6d8", a: 0.22 }, { kind: "glow", x: 540, y: 1560, r: 360, color: "#fff6d8", a: 0.35 }],
        ambient: [{ color: "#1a1030", a: 0.42, mode: "multiply" }],
        rim: { side: 0, color: "#fff6d8", strength: 1.2 },
      };
    case "void":
      return {
        horizon: 2400,
        wall: <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill={ctx.wallColor ?? "#22283a"} />,
        floor: null,
        set: [],
        lights: [{ kind: "glow", x: 540, y: 900, r: 900, color: "#ffffff", a: 0.15 }],
        ambient: [],
        rim: { side: -0.5, color: "#ffffff", strength: 0.6 },
      };
    // ---------------------------------------------------------------- Nishi episode
    // One locked palette: night blue #0b1026, moonlight silver #c9d4e8, fog grey #6b7280,
    // lantern warm #f5a623 (the ONLY warm light). Nothing bright ever enters the frame.
    case "village_night":
      return {
        horizon: 1240,
        sky: (
          <g>
            <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="#0b1026" />
            {Array.from({ length: 90 }).map((_, i) => (
              <circle key={i} cx={X0 + rand(i * 3.1 + 2) * (X1 - X0)} cy={Y0 + rand(i * 7.7 + 5) * 620} r={1 + rand(i * 5) * 2} fill="#c9d4e8" opacity={0.25 + 0.5 * Math.abs(Math.sin(t * 0.6 + i))} />
            ))}
            <circle cx={840} cy={220} r={78} fill="#c9d4e8" />
            <circle cx={810} cy={205} r={72} fill="#0b1026" />
          </g>
        ),
        far: (
          <g>
            {Array.from({ length: 7 }).map((_, i) => {
              const x = X0 + i * 180;
              return (
                <g key={i}>
                  <path d={`M ${x - 100} 1240 L ${x} 960 L ${x + 100} 1240 Z`} fill="#131a33" />
                  {/* tin roof */}
                  <path d={`M ${x - 118} 968 L ${x} 892 L ${x + 118} 968 Z`} fill="#3a4358" />
                </g>
              );
            })}
          </g>
        ),
        wall: (
          <g>
            <rect x={X0} y={1060} width={X1 - X0} height={Y1 - 1060} fill="#151b30" />
            {Array.from({ length: 4 }).map((_, i) => (
              <g key={i} transform={`translate(${X0 + 90 + i * 300} 1240)`}>
                <rect x={-120} y={-330} width={240} height={330} fill="#1a2140" stroke="#0a0e1c" strokeWidth={4} />
                <path d="M -140 -330 L 0 -396 L 140 -330 Z" fill="#3a4358" />
                <line x1={-80} y1={-330} x2={-80} y2={0} stroke="#131933" strokeWidth={3} />
                <line x1={80} y1={-330} x2={80} y2={0} stroke="#131933" strokeWidth={3} />
              </g>
            ))}
            {/* the one lit window */}
            <g>
              <rect x={X0 + 90 + 3 * 300 - 40} y={1240 - 330 + 90} width={80} height={70} fill="#f5a623" />
              <rect x={X0 + 90 + 3 * 300 - 40 + 38} y={1240 - 330 + 90} width={4} height={70} fill="#0b1026" />
              <rect x={X0 + 90 + 3 * 300 - 40 + 4} y={1240 - 330 + 90 + 32} width={72} height={4} fill="#0b1026" />
            </g>
          </g>
        ),
        floor: <Floor horizon={1240} kind="dirt" color="#1c2238" t={t} />,
        set: [P("tree", 0.06, 0.02, { scale: 1.15, color: "#0d1428" }), P("tree", 0.93, 0.02, { scale: 1.3, color: "#0d1428" }), P("fence", 0.2, 0.16, { scale: 0.8 }), P("fence", 0.8, 0.16, { scale: 0.8 })],
        fore: <g opacity={0.55}>{Array.from({ length: 6 }).map((_, i) => <ellipse key={i} cx={X0 - 200 + i * 340 + Math.sin(t * 0.2 + i) * 60} cy={1500} rx={260} ry={42} fill="#6b7280" opacity={0.28} />)}</g>,
        lights: [
          { kind: "glow", x: 840, y: 210, r: 620, color: "#9fb6ff", a: 0.22 },
          { kind: "glow", x: X0 + 90 + 3 * 300, y: 1240 - 240, r: 380, color: "#f5a623", a: 0.3 },
        ],
        ambient: [
          { color: "#0b1026", a: 0.5, mode: "multiply" },
          { color: "#1a2a6a", a: 0.35, mode: "multiply" },
        ],
        rim: { side: 0.6, color: "#9fb6ff", strength: 0.75 },
      };
    case "village_dawn":
      return {
        horizon: 1240,
        sky: (
          <g>
            <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="#232c48" />
            <circle cx={760} cy={300} r={54} fill="#c9d4e8" opacity={0.5} />
            {Array.from({ length: 40 }).map((_, i) => (
              <circle key={i} cx={X0 + rand(i * 3.1 + 9) * (X1 - X0)} cy={Y0 + rand(i * 7.7 + 1) * 460} r={1 + rand(i) * 2} fill="#c9d4e8" opacity={0.2} />
            ))}
          </g>
        ),
        far: (
          <g>
            {Array.from({ length: 7 }).map((_, i) => {
              const x = X0 + i * 180;
              return (
                <g key={i}>
                  <path d={`M ${x - 100} 1240 L ${x} 960 L ${x + 100} 1240 Z`} fill="#2a3352" />
                  <path d={`M ${x - 118} 968 L ${x} 892 L ${x + 118} 968 Z`} fill="#4a5470" />
                </g>
              );
            })}
          </g>
        ),
        wall: <g><rect x={X0} y={1060} width={X1 - X0} height={Y1 - 1060} fill="#2c3450" /></g>,
        floor: <Floor horizon={1240} kind="dirt" color="#39425e" t={t} />,
        set: [P("tree", 0.06, 0.02, { scale: 1.15, color: "#26304a" }), P("tree", 0.93, 0.02, { scale: 1.3, color: "#26304a" }), P("fence", 0.2, 0.16, { scale: 0.8 }), P("fence", 0.8, 0.16, { scale: 0.8 })],
        fore: <g opacity={0.4}>{Array.from({ length: 5 }).map((_, i) => <ellipse key={i} cx={X0 - 200 + i * 380} cy={1450 - i * 30} rx={280} ry={38} fill="#8d99ad" opacity={0.3} />)}</g>,
        lights: [{ kind: "glow", x: 760, y: 300, r: 900, color: "#c9d4e8", a: 0.18 }],
        ambient: [{ color: "#c9d4e8", a: 0.12, mode: "screen" }],
        rim: { side: 0.6, color: "#c9d4e8", strength: 0.5 },
      };
    case "room_night":
      return interior(ctx, {
        horizon: 1180, wall: "#141b33", wallKind: "paint", floor: "#1a2038", floorKind: "wood",
        windows: [{ x: 300, w: 300, h: 340, y: 500, view: "sky" }],
        deco: <g><rect x={X0 + 620} y={420} width={180} height={620} fill="#0e1122" stroke="#0a0d1a" strokeWidth={5} /><circle cx={X0 + 750} cy={730} r={9} fill="#4a5470" /></g>,
        set: [P("bed", 0.62, 0.12, { color: "#2a3152" }), P("lantern", 0.12, 0.3, { y: 150, scale: 0.7 })],
        lights: [
          { kind: "cone", x: X0 + 120, y: 940, dir: 90, spread: 60, len: 700, color: "#f5a623", a: 0.3 },
          windowShaft(300, 500, 300, 340, 1180, "#9fb6ff", 0.14, 120),
        ],
        ambient: [{ color: "#0b1026", a: 0.45, mode: "multiply" }],
      });
    case "room_warm":
      return interior(ctx, {
        horizon: 1180, wall: "#3a3026", wallKind: "wood", floor: "#4a3a2a", floorKind: "wood", warm: true,
        windows: [],
        deco: <g><rect x={X0 + 60} y={520} width={200} height={300} rx={6} fill="#241a12" stroke="#1a120a" strokeWidth={4} /></g>,
        set: [P("stool", 0.32, 0.25, { color: "#6a4a2a" }), P("lantern", 0.78, 0.3, { y: 160, scale: 0.9 })],
        lights: [...lamp(X0 + 800, 700, "#ffd27a", 0.6)],
        ambient: [{ color: "#ffb05a", a: 0.16, mode: "soft-light" }, { color: "#1a1020", a: 0.28, mode: "multiply" }],
      });
    case "pond_bank":
      return {
        horizon: 1180,
        sky: <g><rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="#232c48" /><circle cx={780} cy={260} r={44} fill="#c9d4e8" opacity={0.55} /></g>,
        far: (
          <g>
            <rect x={X0} y={940} width={X1 - X0} height={240} fill="#2a3350" />
            {Array.from({ length: 5 }).map((_, i) => (
              <g key={i} transform={`translate(${X0 + 120 + i * 250} 1180)`}>
                <rect x={-80} y={-240} width={160} height={240} fill="#1c2340" stroke="#121834" strokeWidth={4} />
                <path d="M -95 -240 L 0 -290 L 95 -240 Z" fill="#3a4358" />
              </g>
            ))}
            {Array.from({ length: 4 }).map((_, i) => (
              <ellipse key={`m${i}`} cx={X0 - 100 + i * 380} cy={1000 - i * 40} rx={240} ry={26} fill="#8d99ad" opacity={0.35} />
            ))}
          </g>
        ),
        wall: <g><rect x={X0} y={1060} width={X1 - X0} height={Y1 - 1060} fill="#2f3a52" /></g>,
        floor: <Floor horizon={1180} kind="dirt" color="#39425e" t={t} />,
        set: [
          P("pond", 0.5, 0.1, { scale: 1.0 }),
          P("rock", 0.14, 0.35, { scale: 0.6, color: "#3d475e" }),
          P("tree", 0.9, 0.02, { scale: 1.1, color: "#26304a" }),
        ],
        lights: [{ kind: "glow", x: 780, y: 260, r: 800, color: "#c9d4e8", a: 0.16 }],
        ambient: [
          { color: "#2c3a58", a: 0.22, mode: "multiply" },
          { color: "#0b1026", a: 0.12, mode: "multiply" },
        ],
        rim: { side: 0.6, color: "#c9d4e8", strength: 0.55 },
      };
    // ---------------------------------------------------------------- Kuchisake-onna episode (Japan)
    // Locked palette:
    // - Dusk blue: #1a2340 (sky, deepening to black at top)
    // - Sodium lamp orange: #f5a623 (ONLY warm light in the whole episode)
    // - Mask white: #f8fafc (for the woman's mask when seen)
    // - Fog grey: #6b7280 (layered fog planes)
    // - Scissors silver: #c9d4e8 (for catchlights)
    // - No bright colors anywhere. 60% of every frame is shadow.
    case "jp_street": {
      // Japanese town street at dusk (the primary outdoor location)
      const sunset = time === "sunset";
      const hor = 1180;
      return exterior(ctx, {
        horizon: hor,
        groundKind: "road",
        ground: sunset ? "#2a2f4a" : "#1a1a2e",
        sky: (
          <g>
            <defs>
              <linearGradient id="jpStreetSky" x1={0} y1={0} x2={0} y2={1}>
                <stop offset="0" stopColor="#0a0c1a" />
                <stop offset="0.4" stopColor="#1a2340" />
                <stop offset="0.7" stopColor={sunset ? "#2a2f4a" : "#151830"} />
                <stop offset="1" stopColor="#1a2340" />
              </linearGradient>
            </defs>
            <rect x={X0} y={Y0} width={X1 - X0} height={hor - Y0 + 40} fill="url(#jpStreetSky)" />
            {/* bare cherry trees along the street - far distance */}
            {Array.from({ length: 12 }).map((_, i) => {
              const x = X0 + 80 + i * 160;
              return (
                <g key={i} transform={`translate(${x} ${hor - 40})`} opacity={0.6}>
                  <path d="M 0 0 Q 10 -60 0 -120 Q -10 -60 0 0" fill="none" stroke="#1a1a2e" strokeWidth={8} strokeLinecap="round" />
                  <path d="M 0 -120 Q 15 -160 0 -200 Q -15 -160 0 -120" fill="none" stroke="#1a1a2e" strokeWidth={5} strokeLinecap="round" />
                  <path d="M 0 -200 Q 20 -230 0 -260 Q -20 -230 0 -200" fill="none" stroke="#1a1a2e" strokeWidth={3} strokeLinecap="round" />
                </g>
              );
            })}
            {/* school in the far distance */}
            <g transform={`translate(${X0 + 300} ${hor - 180})`} opacity={0.5}>
              <rect x={-150} y={-200} width={300} height={200} fill="#1a1a2e" stroke="#1a1a2e" strokeWidth={2} />
              <path d="M -150 -200 L 0 -280 L 150 -200" fill="#1a1a2e" stroke="#1a1a2e" strokeWidth={2} />
              {Array.from({ length: 6 }).map((_, i) => (
                <rect key={i} x={-130 + i * 50} y={-160} width={30} height={40} fill="#0a0c1a" stroke="#1a1a2e" strokeWidth={1} />
              ))}
            </g>
          </g>
        ),
        far: (
          <g>
            {/* shuttered shop fronts */}
            {Array.from({ length: 5 }).map((_, i) => {
              const x = X0 + 180 + i * 220;
              return (
                <g key={i} transform={`translate(${x} ${hor})`}>
                  <rect x={-100} y={-340} width={200} height={340} fill="#1e253a" stroke="#0a0c1a" strokeWidth={3} />
                  {/* shuttered */}
                  <rect x={-90} y={-330} width={180} height={260} fill="#151a2e" stroke="#0a0c1a" strokeWidth={2} />
                  {Array.from({ length: 8 }).map((_, r) => (
                    <line key={r} x1={-90} y1={-330 + r * 32} x2={90} y2={-330 + r * 32} stroke="#0a0c1a" strokeWidth={2} />
                  ))}
                  {/* signage */}
                  <rect x={-40} y={-350} width={80} height={20} rx={4} fill="#0a0c1a" stroke="#1a1a2e" strokeWidth={2} />
                </g>
              );
            })}
          </g>
        ),
        mid: (
          <g>
            {/* pavement with subtle tile pattern */}
            <g opacity={0.4}>
              {Array.from({ length: 30 }).map((_, i) => (
                <rect key={i} x={X0 + (i % 12) * 100} y={hor + 20 + Math.floor(i / 12) * 120} width={80} height={100} fill="none" stroke="#2a2f4a" strokeWidth={1} opacity={0.3} />
              ))}
            </g>
            {/* bicycle leaning against a wall */}
            <g transform={`translate(${X0 + 400} ${hor - 30})`}>
              <ellipse cx={-30} cy={0} rx={25} ry={6} fill="#2a2a2a" stroke="#1a1a1a" strokeWidth={2} />
              <ellipse cx={50} cy={0} rx={25} ry={6} fill="#2a2a2a" stroke="#1a1a1a" strokeWidth={2} />
              <path d="M -30 0 Q -30 -40 10 -60 Q 50 -80 50 -40" fill="none" stroke="#2a2a2a" strokeWidth={5} strokeLinecap="round" />
              <path d="M -30 0 L -20 -30 L 40 -30 L 50 0" fill="none" stroke="#2a2a2a" strokeWidth={3} strokeLinecap="round" />
              <path d="M 10 -60 L 10 -80" stroke="#1a1a1a" strokeWidth={3} strokeLinecap="round" />
            </g>
          </g>
        ),
        set: [
          P("vending_machine", 0.85, 0.08),
          P("street_lamp", 0.15, 0.05, { label: "1", y: 10 }),
          P("street_lamp", 0.35, 0.05, { label: "1", y: 10 }),
          P("street_lamp", 0.55, 0.05, { label: "1", y: 10 }),
          P("street_lamp", 0.75, 0.05, { label: "1", y: 10 }),
          P("street_lamp", 0.95, 0.05, { label: "1", y: 10 }),
        ],
        fore: (
          <g>
            {/* fog layers drifting - use existing fog FX */}
            {Array.from({ length: 6 }).map((_, i) => (
              <ellipse
                key={i}
                cx={X0 - 200 + i * 340 + Math.sin((ctx.t || 0) * 0.15 + i) * 80}
                cy={hor + 300 + i * 60}
                rx={300}
                ry={50}
                fill="#6b7280"
                opacity={0.15}
              />
            ))}
          </g>
        ),
        lights: [
          // sodium lamps - only warm practicals
          ...lamp(180, hor - 80, "#f5a623", sunset ? 0.5 : 0.7),
          ...lamp(400, hor - 80, "#f5a623", sunset ? 0.5 : 0.7),
          ...lamp(620, hor - 80, "#f5a623", sunset ? 0.5 : 0.7),
          ...lamp(840, hor - 80, "#f5a623", sunset ? 0.5 : 0.7),
          ...lamp(1060, hor - 80, "#f5a623", sunset ? 0.5 : 0.7),
          // vending machine blue-white glow (handled by prop)
          { kind: "glow", x: X0 + 900, y: hor - 200, r: 180, color: "#4fb3e8", a: sunset ? 0.3 : 0.5 },
        ],
        ambient: [
          { color: "#1a2340", a: 0.55, mode: "multiply" },
          { color: "#0a0c1a", a: 0.35, mode: "multiply" },
          sunset ? { color: "#f5a623", a: 0.08, mode: "soft-light" } : { color: "#0a0c1a", a: 0.2, mode: "multiply" },
        ],
        rim: { side: 0, color: "#c9d4e8", strength: sunset ? 0.4 : 0.2 },
      });
    }
    case "jp_genkan": {
      // The entryway (genkan) of Yuto's house, night
      const hor = 1180;
      return interior(ctx, {
        horizon: hor,
        wall: "#1a1510", wallKind: "wood",
        floor: "#2a2015", floorKind: "wood",
        wainscot: "#2a2015",
        windows: [],
        deco: <g>{/* tatami/stone step up */}<rect x={X0} y={hor - 60} width={X1 - X0} height={60} fill="#2a2520" stroke="#1a1510" strokeWidth={2} /></g>,
        set: [
          P("shoe_rack", 0.35, 0.2),
          P("jp_sliding_door", 0.75, 0.1, { label: "0" }),
          // scissors and folded mask placed on shoe rack (shot 38)
          P("scissors", 0.35, 0.18, { y: 40, scale: 0.5 }),
          P("folded_mask", 0.35, 0.18, { y: 60, scale: 0.7 }),
        ],
        lights: [
          // dim interior light spilling from inside
          { kind: "cone", x: X0 + 900, y: hor - 100, dir: 90, spread: 40, len: 400, color: "#f5a623", a: 0.15 },
          { kind: "glow", x: X0 + 900, y: hor - 100, r: 300, color: "#f5a623", a: 0.1 },
        ],
        ambient: [
          { color: "#0b1026", a: 0.5, mode: "multiply" },
          { color: "#1a2340", a: 0.3, mode: "multiply" },
        ],
      });
    }
    case "jp_bedroom": {
      // Yuto's bedroom, lights out
      const hor = 1180;
      return interior(ctx, {
        horizon: hor,
        wall: "#1a1820", wallKind: "paint",
        floor: "#1a151a", floorKind: "wood",
        windows: [],
        deco: <g>{/* bed, desk, chair as wall decoration hints */}</g>,
        set: [
          P("bed", 0.25, 0.12, { color: "#2a2028" }),
          P("desk", 0.75, 0.08, { color: "#2a2020" }),
          P("chair", 0.75, 0.05, { color: "#2a2020" }),
          P("randoseru", 0.75, 0.03, { y: 20, scale: 0.6 }),
          // jp_sliding_door with open: 0.02 (gap under door)
          P("jp_sliding_door", 0.12, 0.15, { label: "0.02", scale: 1.1 }),
        ],
        lights: [
          // only light from the gap under the sliding door
          { kind: "shaft", pts: [[X0 + 80, hor], [X0 + 220, hor], [X0 + 200, hor + 500], [X0 + 100, hor + 500]], color: "#c9d4e8", a: 0.06 },
        ],
        ambient: [
          { color: "#0b1026", a: 0.6, mode: "multiply" },
          { color: "#1a2340", a: 0.4, mode: "multiply" },
        ],
        rim: { side: -1, color: "#c9d4e8", strength: 0.15 },
      });
    }
  }
};

export { Cloud, Y1, Y0, X0, X1 };
