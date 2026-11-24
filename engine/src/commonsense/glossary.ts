/**
 * The commonsense glossary.
 *
 * A narration sentence quietly implies a whole picture: "he is asleep in the other room"
 * implies a bed, a mattress, a pillow, a blanket, a body lying on it, dim light, and a
 * different room than the shot before. An agent reading literally draws a man on the floor.
 *
 * `data/intent-glossary.json` maps phrases to the canonical picture a human would expect,
 * with a GOOD example and a BAD (literal) example for each. This module matches a shot's
 * narration against those phrases and turns every unmet requirement into a gate finding,
 * so the picture is checked against human expectation instead of the agent's intent.
 */
import GLOSSARY from "../../data/intent-glossary.json";

export type Sev = "ERROR" | "WARN";

export type Finding = { shot: number; sev: Sev; kind: string; msg: string };

export type Requirement = {
  /** prop types that must all be on screen (shot props + background set dressing) */
  props?: string[];
  /** at least one of these prop types must be on screen */
  propsAny?: string[];
  /** the shot's background must be one of these */
  bgAnyOf?: string[];
  /** the shot's background must NOT be one of these (rain indoors, for example) */
  bgNotAnyOf?: string[];
  /** at least one actor must use one of these semantic actions */
  actionAnyOf?: string[];
  /** at least one actor must use one of these low-level poses */
  poseAnyOf?: string[];
  /** at least one actor must show one of these expressions */
  expressionAnyOf?: string[];
  /** the shot must be graded to one of these times */
  timeAnyOf?: string[];
  /** at least one of these effects must be on */
  fxAnyOf?: string[];
  /** at least one of these transitions must be used (for time jumps and cuts) */
  transitionAnyOf?: string[];
  /** an insert graphic must be one of these */
  insertAnyOf?: string[];
  /** what an actor holds in hand */
  holding?: string;
  /** minimum number of actors in frame */
  minActors?: number;
  /** maximum number of actors in frame */
  maxActors?: number;
  /** any actor scaled at least this much (a giant) */
  minScale?: number;
  /** a prop repeated at least this many times ("three cups") */
  propCount?: { type: string; min: number };
  /** a prop must be drawn open (door) or lit (lamp): field value >= 0.5 */
  propOpen?: string;
  /** at least two actors must face each other */
  facingEachOther?: boolean;
  /** these prop types must NOT be on screen */
  forbidProps?: string[];
  /** no actor may be placed on this prop type (an empty chair stays empty) */
  noActorOn?: string;
  /** no actor may be placed on ANY of these prop types ("the seat was empty" = chair, bench, stool, couch) */
  noActorOnAny?: string[];
};

export type GlossaryEntry = {
  id: string;
  category: string;
  /** lowercase phrases; a shot's narration matching any of them must satisfy `requires` */
  phrases: string[];
  requires: Requirement;
  good: string;
  bad: string;
};

export const CATEGORIES = [
  "posture",
  "location",
  "containment",
  "held",
  "in-use",
  "state",
  "time-weather",
  "motion",
  "count-scale",
  "people",
  "emotion",
  "negation",
  "cause",
  "abstract",
] as const;

export type Seen = {
  props: string[];
  bg: string;
  actions: string[];
  poses: string[];
  expressions: string[];
  time: string;
  fx: string[];
  transitions: string[];
  insert?: string;
  actors: number;
  seatedOn: string[];
  holding: string[];
  propOpen: Record<string, number>;
  propCount: Record<string, number>;
  scales: number[];
  facing: string[];
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim()} `;

export const ENTRIES: GlossaryEntry[] = (GLOSSARY as { entries: GlossaryEntry[] }).entries;

/** Glossary entries whose phrase appears in this narration text. */
export function matches(text: string): GlossaryEntry[] {
  const t = norm(text);
  return ENTRIES.filter((e) => e.phrases.some((p) => t.includes(` ${p.toLowerCase()} `)));
}

/** Content-word coverage: how much of the narration the glossary can speak to at all. */
export function coverage(text: string): { covered: number; total: number } {
  const stop = new Set(["the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "is", "was", "were", "it", "he", "she", "they", "his", "her", "their", "that", "this", "with", "for", "as", "by", "from", "not", "no", "did", "does", "do", "be", "been", "has", "had", "have"]);
  const words = norm(text).trim().split(" ").filter((w) => w.length > 2 && !stop.has(w));
  const phrases = ENTRIES.flatMap((e) => e.phrases).map((p) => ` ${p} `);
  let covered = 0;
  for (const w of words) if (phrases.some((p) => p.includes(` ${w} `))) covered++;
  return { covered, total: words.length };
}

/** Turn one requirement into findings; `seen` is what the shot actually contains. */
export function checkRequirement(entry: GlossaryEntry, req: Requirement, seen: Seen, shot: number): Finding[] {
  const out: Finding[] = [];
  const fail = (msg: string) =>
    out.push({
      shot,
      sev: "ERROR",
      kind: "COMMONSENSE",
      msg: `"${entry.phrases[0]}" [${entry.id}] — ${msg}\n         GOOD: ${entry.good}\n         BAD (what was drawn): ${entry.bad}`,
    });

  for (const p of req.props ?? []) {
    if (!seen.props.includes(p)) fail(`a human expects a \`${p}\` in this shot; declare it in the shot's props (or the background)`);
  }
  if (req.propsAny && !req.propsAny.some((p) => seen.props.includes(p))) {
    fail(`a human expects one of ${req.propsAny.map((p) => `\`${p}\``).join(" / ")} in this shot`);
  }
  if (req.bgAnyOf && !req.bgAnyOf.includes(seen.bg)) {
    fail(`this sentence is set in ${req.bgAnyOf.join(" / ")}; the shot uses \`${seen.bg}\`. Change \`bg\`, or write a transition to the new place`);
  }
  if (req.bgNotAnyOf && req.bgNotAnyOf.includes(seen.bg)) {
    fail(`this happens out of doors, but the shot is inside \`${seen.bg}\` — move it outside or show it through a window`);
  }
  if (req.actionAnyOf && !req.actionAnyOf.some((a) => seen.actions.includes(a))) {
    fail(`no actor uses ${req.actionAnyOf.join(" / ")} — the body is drawn wherever the raw coordinates put it. Use the semantic action`);
  }
  if (req.poseAnyOf && !req.poseAnyOf.some((a) => seen.poses.includes(a))) {
    fail(`no actor is in the pose ${req.poseAnyOf.join(" / ")} that a viewer expects`);
  }
  if (req.expressionAnyOf && !req.expressionAnyOf.some((e) => seen.expressions.includes(e))) {
    fail(`no face shows ${req.expressionAnyOf.join(" / ")} — the emotion is invisible`);
  }
  if (req.timeAnyOf && !req.timeAnyOf.includes(seen.time)) {
    fail(`the sentence says it is ${req.timeAnyOf.join(" / ")}; the shot is graded \`${seen.time}\`. Set \`time\`, or drop the time word`);
  }
  if (req.fxAnyOf && !req.fxAnyOf.some((f) => seen.fx.includes(f))) {
    fail(`the sentence describes ${req.fxAnyOf.join(" / ")}; add it to the shot's \`fx\``);
  }
  if (req.transitionAnyOf && !req.transitionAnyOf.some((t) => seen.transitions.includes(t))) {
    fail(`this beat is a change of place or time: use one of the transitions ${req.transitionAnyOf.join(" / ")} so the cut reads`);
  }
  if (req.insertAnyOf && !(seen.insert && req.insertAnyOf.includes(seen.insert))) {
    fail(`this is an explainer beat: add an insert (${req.insertAnyOf.join(" / ")}) so the abstraction is drawn, not just said`);
  }
  if (req.holding && !seen.holding.includes(req.holding)) {
    fail(`nobody holds the \`${req.holding}\` — set "holding": "${req.holding}" on the actor so it sits in the hand`);
  }
  if (req.minActors !== undefined && seen.actors < req.minActors) {
    fail(`a human expects at least ${req.minActors} people on screen; the shot has ${seen.actors}`);
  }
  if (req.maxActors !== undefined && seen.actors > req.maxActors) {
    fail(`a human expects at most ${req.maxActors} people on screen; the shot has ${seen.actors}`);
  }
  const minScale = req.minScale;
  if (minScale !== undefined && !seen.scales.some((s) => s >= minScale)) {
    fail(`this thing is huge: scale the actor to at least ${minScale} so the size reads (largest is ${Math.max(0, ...seen.scales).toFixed(2)})`);
  }
  if (req.propCount) {
    const n = seen.propCount[req.propCount.type] ?? 0;
    if (n < req.propCount.min) {
      fail(`the sentence counts ${req.propCount.min} \`${req.propCount.type}\`(s); the shot draws ${n} (use the prop's "count" field)`);
    }
  }
  if (req.propOpen) {
    const v = seen.propOpen[req.propOpen] ?? 0;
    if (v < 0.5) fail(`the \`${req.propOpen}\` must be visibly open/lit: set "open": 1 (or "lit": 1) on it — it is ${v}`);
  }
  if (req.facingEachOther) {
    const facing = new Set(seen.facing);
    if (!(facing.has("left") && facing.has("right"))) {
      fail(`two people must face each other; facings are ${seen.facing.join(", ") || "none"} — set one "left" and one "right"`);
    }
  }
  for (const p of req.forbidProps ?? []) {
    if (seen.props.includes(p)) fail(`a \`${p}\` is shown but the sentence rules it out — remove it`);
  }
  if (req.noActorOn && seen.seatedOn.includes(req.noActorOn)) {
    fail(`nobody may be on the \`${req.noActorOn}\` (the sentence says it is empty), but an actor is placed on it`);
  }
  const forbiddenSeat = (req.noActorOnAny ?? []).find((t) => seen.seatedOn.includes(t));
  if (forbiddenSeat) {
    fail(`the seat is supposed to be empty, but an actor is placed on the \`${forbiddenSeat}\``);
  }
  return out;
}
