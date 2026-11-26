// Contact geometry for interactive props.
//
// Every prop is drawn with its origin at bottom-centre, growing upward in negative y
// (see scene/props/Props.tsx). An anchor is a *usable surface* in those same local
// units: the top of a seat cushion, the top of a mattress, the pillow, a desk top.
//
// Both the renderer (scene/layout.ts) and the geometry gate (scripts/qa_geometry.ts)
// read this table, so "sitting on the chair" means one number, not two guesses.

export type AnchorRect = { x: number; y: number; w: number; h: number };

export type PropAnchors = {
  /** sitting surface — hip joint lands here */
  seat?: AnchorRect;
  /** sleeping surface — the body lies on it */
  mattress?: AnchorRect;
  /** where a head rests */
  pillow?: AnchorRect;
  /** working surface, for reaching/typing */
  top?: AnchorRect;
  /** backrest, used for layering checks */
  back?: AnchorRect;
  /** screen / panel that a character looks at */
  screen?: AnchorRect;
  /** a vehicle seat: feet are inside, so they legitimately never reach the floor */
  vehicle?: boolean;
  /** drawing bounds: width and height above the origin, for occlusion checks */
  extent?: { w: number; h: number };
};

export type AnchorName = keyof PropAnchors;

// Values are measured from the drawing code in Props.tsx. If a prop's drawing changes,
// this table is the one place that has to change with it — and the catalog test renders
// every prop so a mismatch shows up as a floating or sunken body.
export const PROP_ANCHORS: Record<string, PropAnchors> = {
  chair: {
    seat: { x: 0, y: -108, w: 124, h: 22 },
    back: { x: 0, y: -230, w: 120, h: 120 },
    extent: { w: 132, h: 230 },
  },
  stool: { seat: { x: 0, y: -122, w: 100, h: 16 }, extent: { w: 112, h: 138 } },
  bench: { seat: { x: 0, y: -94, w: 350, h: 22 }, extent: { w: 360, h: 100 } },
  couch: {
    seat: { x: 0, y: -108, w: 350, h: 70 },
    back: { x: 0, y: -200, w: 400, h: 120 },
    extent: { w: 440, h: 200 },
  },
  // the bed was widened to 440 so a lying stickman (whose body is ~407 drawing units
  // from the top of the head to the toes) actually fits between the boards
  bed: {
    mattress: { x: 0, y: -108, w: 436, h: 70 },
    pillow: { x: -145, y: -116, w: 110, h: 46 },
    // the near edge, for "sits up on the edge of the bed"
    seat: { x: 176, y: -108, w: 64, h: 22 },
    extent: { w: 480, h: 200 },
  },
  // vehicles: the driver sits inside the body, so the picture reads as "in the car"
  truck: { seat: { x: -10, y: -80, w: 160, h: 20 }, vehicle: true, extent: { w: 360, h: 220 } },
  boat: { seat: { x: 0, y: -90, w: 160, h: 20 }, vehicle: true },
  plane: { seat: { x: 0, y: -80, w: 150, h: 20 }, vehicle: true },
  train: { seat: { x: 0, y: -80, w: 150, h: 20 }, vehicle: true },
  desk: { top: { x: 0, y: -194, w: 336, h: 26 }, extent: { w: 340, h: 196 } },
  table: { top: { x: 0, y: -184, w: 296, h: 24 }, extent: { w: 300, h: 186 } },
  computer: { extent: { w: 200, h: 180 } },
  tv: { extent: { w: 300, h: 230 } },
  laptop: { extent: { w: 180, h: 126 } },
  shelf: { extent: { w: 260, h: 360 } },
  door: { extent: { w: 200, h: 420 } },
  window: { extent: { w: 260, h: 300 } },
  car: { seat: { x: -10, y: -74, w: 150, h: 20 }, vehicle: true, extent: { w: 300, h: 180 } },
  hospital: { mattress: { x: 0, y: -108, w: 436, h: 70 } },
  bed_rail: { seat: { x: 0, y: -94, w: 200, h: 20 } },
  // ---------------------------------------------------------------- Bangla settings
  // Measured from the drawings above. The rickshaw is a vehicle: the driver sits inside the
  // body and only the upper body shows, exactly like a car.
  rickshaw: { seat: { x: -5, y: -196, w: 90, h: 18 }, vehicle: true, extent: { w: 340, h: 400 } },
  bench_wood: { seat: { x: 0, y: -108, w: 300, h: 22 }, extent: { w: 310, h: 150 } },
  teastall: { top: { x: 0, y: -176, w: 372, h: 22 }, extent: { w: 460, h: 340 } },
};

export const anchorsOf = (type: string): PropAnchors | undefined => PROP_ANCHORS[type];

export const anchorOf = (type: string, name: AnchorName): AnchorRect | undefined => {
  const v = PROP_ANCHORS[type]?.[name];
  return v && typeof v === "object" && "x" in v ? v : undefined;
};

/** Which anchor an interaction needs. Used by the action resolver and the docs. */
export const ANCHOR_FOR_ACTION: Record<string, AnchorName> = {
  sitOn: "seat",
  lieOn: "mattress",
  sleepOn: "mattress",
  standAt: "top",
  use: "top",
  face: "screen",
};

export const isVehicle = (type: string) => PROP_ANCHORS[type]?.vehicle === true;

/** Props a character can be placed on or against, and how. */
export const SUPPORT_ACTIONS = ["sitOn", "lieOn", "sleepOn"] as const;
export type SupportAction = (typeof SUPPORT_ACTIONS)[number];
