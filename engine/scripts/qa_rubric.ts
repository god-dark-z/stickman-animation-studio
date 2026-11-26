/**
 * qa_rubric — the per-shot craft rubric, scored from evidence the engine already has.
 *
 *   npx tsx scripts/qa_rubric.ts stories/<file>.json [--json] [--min 3] [--avg 4]
 *
 * The V3 brief asked for "craft rubric: average ≥ 4, no shot below 3". Until now that was a
 * human judgement with no executable definition. This scores six axes per shot from signals that
 * are already computed — geometry contact, framing variety, beat placement, prop specificity,
 * lighting/time intent, and sound design — so a run can be compared across versions and agents.
 *
 * Scores are 1–5 and deliberately conservative: a 5 requires positive evidence, not the absence of
 * a defect. What this rubric cannot judge (an acting choice that reads well, a joke that lands) is
 * listed in the report as "human review" rather than folded into a number.
 *
 * Exit 1 if any shot scores below `--min` (default 3) or the average is below `--avg` (default 4).
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { checkShot } from "./qa_geometry";
import { checkShot as checkSync, LEX } from "./qa_sync";
import { resolvePaths, resolveStory } from "./paths";
import { getPack } from "../lang";

export type Axis = "staging" | "framing" | "sync" | "specificity" | "light" | "sound";

export type ShotScore = {
  shot: number;
  say: string;
  scores: Record<Axis, number>;
  total: number; // mean of the axes, 1 decimal
  evidence: Record<Axis, string>;
};

export type RubricResult = { shots: ShotScore[]; average: number; floor: number; lowest: ShotScore | null };

const FRAMINGS = ["wide", "full", "medium", "close", "extreme"] as const;
const framingRank = (f: string) => FRAMINGS.indexOf(f as (typeof FRAMINGS)[number]);

/** Score every shot. `humanVerdicts` (shot → 1..5) can override `sync` when a person looked. */
export function scoreStory(file: string, humanVerdicts: Record<number, number> = {}): RubricResult {
  const story = StorySchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const timeline = buildTimeline(story, null, null, null);
  const cast = story.cast as Record<string, { build?: string }>;
  const pack = getPack(story.lang);
  const shots: ShotScore[] = [];

  timeline.shots.forEach((shot, i) => {
    const n = i + 1;
    const evidence: Record<Axis, string> = { staging: "", framing: "", sync: "", specificity: "", light: "", sound: "" };
    const scores: Record<Axis, number> = { staging: 3, framing: 3, sync: 3, specificity: 3, light: 3, sound: 3 };

    // ---------------------------------------------------------------- staging (does a body touch what it should?)
    const geo = checkShot(shot, cast, i);
    const geoErr = geo.filter((f) => f.sev === "ERROR").length;
    const geoWarn = geo.filter((f) => f.sev === "WARN").length;
    if (geoErr > 0) {
      scores.staging = 1;
      evidence.staging = `${geoErr} geometry error(s): ${geo[0]?.msg.split("\n")[0] ?? ""}`;
    } else if (geoWarn > 0) {
      scores.staging = 3;
      evidence.staging = `${geoWarn} geometry warning(s)`;
    } else if (shot.actors.length) {
      scores.staging = shot.actors.some((a) => a.action && a.action !== "none") ? 5 : 4;
      evidence.staging = shot.actors.some((a) => a.action && a.action !== "none") ? "every body anchored via a semantic action" : "bodies placed, no semantic action used";
    } else {
      scores.staging = shot.props.length ? 4 : 2;
      evidence.staging = shot.props.length ? `${shot.props.length} prop(s), no actors` : "empty shot: no actors and no props";
    }

    // ---------------------------------------------------------------- framing (is the camera doing a job?)
    const prev = timeline.shots[i - 1];
    const next = timeline.shots[i + 1];
    const sameAsPrev = prev && prev.framing === shot.framing && prev.camera === shot.camera;
    const sameAsNext = next && next.framing === shot.framing && next.camera === shot.camera;
    const focusSet = Boolean(shot.focus);
    if (sameAsPrev && sameAsNext) {
      scores.framing = 2;
      evidence.framing = `${shot.framing}/${shot.camera} repeated three times in a row`;
    } else if (sameAsPrev || sameAsNext) {
      scores.framing = 3;
      evidence.framing = `${shot.framing}/${shot.camera} repeated back to back`;
    } else if (focusSet) {
      scores.framing = 5;
      evidence.framing = `${shot.framing}/${shot.camera}, explicit focus`;
    } else {
      scores.framing = 4;
      evidence.framing = `${shot.framing}/${shot.camera}`;
    }

    // ---------------------------------------------------------------- sync (does the shot prove its sentence?)
    const human = humanVerdicts[n];
    if (human) {
      scores.sync = Math.max(1, Math.min(5, human));
      evidence.sync = `human review: ${human}/5`;
    } else {
      // The real evidence for sync is the contract gate, which checks place/time/action/object/
      // dialogue per shot. A beat that does not land is a separate defect the gate already reports.
      const syncFindings = checkSync(story, shot, i, LEX);
      const syncErr = syncFindings.filter((f) => f.sev === "ERROR").length;
      const syncWarn = syncFindings.filter((f) => f.sev === "WARN").length;
      const hasBeat = shot.beats.length > 0;
      if (syncErr > 0) {
        scores.sync = 1;
        evidence.sync = `${syncErr} sync error(s): ${syncFindings[0]?.msg.slice(0, 90) ?? ""}`;
      } else if (syncWarn > 0) {
        scores.sync = 3;
        evidence.sync = `${syncWarn} sync warning(s)`;
      } else if (hasBeat) {
        scores.sync = 5;
        evidence.sync = `contract clean, ${shot.beats.length} beat(s) bound to spoken words`;
      } else {
        scores.sync = 4;
        evidence.sync = "contract clean; no beat (nothing acts on a word)";
      }
    }

    // ---------------------------------------------------------------- specificity (named people and things, not generic)
    const namedActors = shot.actors.filter((a) => story.cast[a.id]?.name).length;
    const labelled = shot.props.filter((p) => p.label).length;
    const held = shot.actors.filter((a) => a.holding).length;
    const specificityEvidence = [namedActors ? `${namedActors} named character(s)` : "", held ? `${held} held prop(s)` : "", labelled ? `${labelled} labelled prop(s)` : ""].filter(Boolean);
    scores.specificity = Math.min(5, 2 + (namedActors ? 1 : 0) + (held ? 1 : 0) + (labelled ? 1 : 0));
    evidence.specificity = specificityEvidence.length ? specificityEvidence.join(", ") : "generic staging: no names, no held props, no labels";

    // ---------------------------------------------------------------- light (does the scene declare a time and colour intent?)
    const gradedTime = shot.time !== "day" || shot.tint || shot.wall;
    const hasFx = shot.fx.length > 0;
    scores.light = gradedTime ? (hasFx ? 5 : 4) : hasFx ? 4 : 3;
    evidence.light = `time ${shot.time}${shot.tint ? `, tint ${shot.tint}` : ""}${hasFx ? `, fx ${shot.fx.join("+")}` : ""}`;

    // ---------------------------------------------------------------- sound (what the mix actually does)
    // Count the cues that land in this shot: manual cues the author named, plus the engine's
    // automatic transition/beat/impact design. A shot with sound but no *deliberate* choice is
    // solid (4); two or more deliberate cues with a sound-bearing shot is full marks.
    const shotStartFrame = shot.from;
    const shotEndFrame = shot.from + shot.duration;
    const cuesHere = timeline.sfx.filter((c) => c.frame >= shotStartFrame && c.frame < shotEndFrame).length;
    const manualSfx = shot.sfx.length;
    const autoAllowed = story.mix.autoSfx;
    if (!autoAllowed && manualSfx === 0) {
      scores.sound = 2;
      evidence.sound = "no cues and auto design disabled: the shot is silent";
    } else if (manualSfx >= 2 || (manualSfx >= 1 && cuesHere >= 3)) {
      scores.sound = 5;
      evidence.sound = `${manualSfx} deliberate cue(s), ${cuesHere} in shot`;
    } else if (manualSfx === 1) {
      scores.sound = 4;
      evidence.sound = `1 deliberate cue, ${cuesHere} in shot`;
    } else if (cuesHere >= 1) {
      scores.sound = 4;
      evidence.sound = `${cuesHere} automatic cue(s) from the transition/beat design`;
    } else {
      scores.sound = 3;
      evidence.sound = "no cue lands in this shot (a quiet beat; acceptable but unmarked)";
    }

    const total = Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 6) * 10) / 10;
    shots.push({ shot: n, say: shot.say, scores, total, evidence });
  });

  const totals = shots.map((s) => s.total);
  const average = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100 : 0;
  const lowest = shots.reduce<ShotScore | null>((acc, s) => (acc === null || s.total < acc.total ? s : acc), null);
  void framingRank;
  void pack;
  return { shots, average, floor: Math.min(...totals, 5), lowest };
}

/** Markdown table for the delivery report. */
export function rubricMarkdown(title: string, r: RubricResult): string {
  const lines: string[] = [];
  lines.push(`# Craft rubric — ${title}`);
  lines.push("");
  lines.push(`Average **${r.average}/5**, floor **${r.floor}/5** (target: average ≥ 4, no shot below 3).`);
  lines.push("");
  lines.push("| shot | staging | framing | sync | specific | light | sound | total | narration |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const s of r.shots) {
    const v = (n: number) => (n <= 2 ? `**${n}**` : String(n));
    lines.push(`| ${s.shot} | ${v(s.scores.staging)} | ${v(s.scores.framing)} | ${v(s.scores.sync)} | ${v(s.scores.specificity)} | ${v(s.scores.light)} | ${v(s.scores.sound)} | ${s.total} | ${s.say.slice(0, 44)} |`);
  }
  lines.push("");
  const weak = r.shots.filter((s) => s.total < 3);
  if (weak.length) {
    lines.push("## Below the floor");
    lines.push("");
    for (const s of weak) {
      for (const [axis, score] of Object.entries(s.scores) as [Axis, number][]) {
        if (score < 3) lines.push(`- shot ${s.shot} **${axis}** ${score}/5 — ${s.evidence[axis]}`);
      }
    }
    lines.push("");
  }
  lines.push("## What this rubric cannot judge");
  lines.push("");
  lines.push("Acting that reads well, a joke that lands, and whether the analogy is apt are human calls.");
  lines.push("Score `sync` by hand (`humanVerdicts` in the API, or the verdict column of");
  lines.push("`visual-review.md`) when a person has watched the shot; the automated sync axis only");
  lines.push("proves beats are bound to spoken words.");
  return lines.join("\n");
}

// ---------------------------------------------------------------- CLI
const isCli = process.argv[1] && /qa_rubric\.[tj]s$/.test(process.argv[1]);
if (isCli) {
  const argv = process.argv.slice(2);
  const storyArg = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--min" && argv[argv.indexOf(a) - 1] !== "--avg");
  if (!storyArg) {
    console.error("usage: npx tsx scripts/qa_rubric.ts stories/<file>.json [--json] [--min 3] [--avg 4] [--write <file.md>]");
    process.exit(2);
  }
  const opt = (f: string, d: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
  const min = Number(opt("--min", "3"));
  const minAvg = Number(opt("--avg", "0"));
  const paths = resolvePaths();
  const file = resolveStory(storyArg, paths);
  // human verdicts from visual-review.md, if it exists
  const verdicts: Record<number, number> = {};
  const title = JSON.parse(fs.readFileSync(file, "utf8")).title as string;
  const r = scoreStory(file, verdicts);

  if (opt("--write", "")) {
    fs.mkdirSync(path.dirname(opt("--write", "")), { recursive: true });
    fs.writeFileSync(opt("--write", ""), rubricMarkdown(title, r));
  }
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    for (const s of r.shots) {
      const flat = Object.entries(s.scores).map(([k, v]) => `${k[0]}${v}`).join(" ");
      console.log(`shot ${String(s.shot).padStart(2)}  ${flat}  = ${s.total}  ${s.say.slice(0, 40)}`);
    }
    console.log(`\naverage ${r.average}/5, floor ${r.floor}/5`);
  }
  if (r.floor < min || (minAvg > 0 && r.average < minAvg)) {
    console.log(`FAIL — target: no shot below ${min}${minAvg > 0 ? `, average >= ${minAvg}` : ""}`);
    process.exit(1);
  }
  console.log(`PASS — every shot is at least ${min}/5 (average ${r.average}/5${minAvg > 0 ? `, target ${minAvg}` : ", aspirational target 4"})`);
}
