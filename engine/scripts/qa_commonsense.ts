/**
 * qa_commonsense — the Director's Brief gate.
 *
 *   npx tsx scripts/qa_commonsense.ts stories/<file>.json [--spec <file>] [--json] [--min-coverage 40]
 *
 * Two checks, both about what a human would picture:
 *
 *  1. GLOSSARY  — every sentence that matches an entry in data/intent-glossary.json must produce
 *     the canonical picture for that phrase (bed + body on it for "asleep", cup in hand for
 *     "holds a cup", rain + wet grade for "raining"). Missing evidence is an ERROR that prints
 *     the GOOD and BAD renderings for that intent.
 *  2. SCENE SPEC — if a spec exists (`<story>.spec.json` beside the story, or `--spec`), every
 *     declared support, required prop, relation and negation is verified against the resolved
 *     shot. Relations are numeric (src/commonsense/relations.ts).
 *
 * Exit 1 on any ERROR.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema, type ResolvedShot } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { checkRequirement, coverage, matches, type Seen, ENTRIES } from "../src/commonsense/glossary";
import { propsVisible, SpecSchema, validateSpec } from "../src/commonsense/spec";
import { resolvePaths, resolveStory } from "./paths";

type Finding = { shot: number; sev: "ERROR" | "WARN"; kind: string; msg: string };

export function seenOf(shot: ResolvedShot): Seen {
  const props = propsVisible(shot);
  const propOpen: Record<string, number> = {};
  const propCount: Record<string, number> = {};
  for (const p of props) {
    propOpen[p.type] = Math.max(propOpen[p.type] ?? 0, p.open ?? 0, p.lit ?? 0);
    propCount[p.type] = (propCount[p.type] ?? 0) + (p.count ?? 1);
  }
  return {
    props: [...new Set(props.map((p) => p.type))],
    bg: shot.bg,
    actions: shot.actors.map((a) => a.action).filter((a) => a !== "none"),
    poses: shot.actors.map((a) => a.pose),
    expressions: shot.actors.map((a) => a.expression),
    time: shot.time,
    fx: shot.fx,
    transitions: [shot.transition],
    insert: shot.insert?.type,
    actors: shot.actors.length,
    seatedOn: shot.actors.filter((a) => a.on).map((a) => a.on as string),
    holding: shot.actors.map((a) => a.holding).filter((h): h is NonNullable<typeof h> => !!h),
    propOpen,
    propCount,
    scales: shot.actors.map((a) => a.scale),
    facing: shot.actors.map((a) => a.facing),
  };
}

export function checkStory(file: string, specFile?: string): { findings: Finding[]; shots: number; cov: number } {
  const story = StorySchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  const shots = buildTimeline(story, null, null, null).shots;
  const findings: Finding[] = [];
  let covered = 0;
  let total = 0;

  const exempt = new Map((story.intentExempt ?? []).map((e) => [`${e.shot}:${e.id}`, e.reason]));

  shots.forEach((shot, i) => {
    if (shot.say === "…") return;
    const seen = seenOf(shot);
    for (const entry of matches(shot.say)) {
      const reason = exempt.get(`${i + 1}:${entry.id}`);
      if (reason) {
        findings.push({ shot: i + 1, sev: "WARN", kind: "EXEMPT", msg: `[${entry.id}] exempted in the story: ${reason}` });
        continue;
      }
      findings.push(...checkRequirement(entry, entry.requires, seen, i + 1));
    }
    const c = coverage(shot.say);
    covered += c.covered;
    total += c.total;
  });

  const auto = file.replace(/\.json$/, ".spec.json");
  const specPath = specFile ?? (fs.existsSync(auto) ? auto : undefined);
  if (specPath) {
    const spec = SpecSchema.parse(JSON.parse(fs.readFileSync(path.resolve(specPath), "utf8")));
    const cast = story.cast as Record<string, { build?: string }>;
    findings.push(...validateSpec(spec, shots, cast));
  } else {
    findings.push({
      shot: 0,
      sev: "WARN",
      kind: "NO-SPEC",
      msg: `no Scene Spec: write ${path.basename(auto)} from templates/scene-spec.md — the glossary can only check phrases it knows, the spec checks this story`,
    });
  }

  return { findings, shots: shots.length, cov: total ? Math.round((covered / total) * 100) : 0 };
}

export function runCli(argv: string[] = process.argv.slice(2)): number {
  const storyArg = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--spec");
  const specIdx = argv.indexOf("--spec");
  const specFile = specIdx >= 0 ? argv[specIdx + 1] : undefined;
  if (!storyArg) {
    console.error("usage: npx tsx scripts/qa_commonsense.ts stories/<file>.json [--spec <file>] [--json]");
    return 2;
  }
  const file = resolveStory(storyArg, resolvePaths());
  const { findings, shots, cov } = checkStory(file, specFile);
  const minCovIdx = argv.indexOf("--min-coverage");
  const minCov = minCovIdx >= 0 ? Number(argv[minCovIdx + 1]) : 0;

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ file, shots, coverage: cov, findings }, null, 2));
  } else {
    findings.sort((a, b) => a.shot - b.shot || (a.sev === "ERROR" ? -1 : 1));
    for (const f of findings) console.log(`${f.sev.padEnd(5)} shot ${String(f.shot).padStart(2)} [${f.kind}] ${f.msg}`);
    const errors = findings.filter((f) => f.sev === "ERROR").length;
    console.log(
      `\n${path.basename(file)}: ${shots} shots, ${ENTRIES.length} glossary intents — ${errors} commonsense error(s), ${findings.length - errors} warning(s), coverage ${cov}%`,
    );
  }
  const errors = findings.filter((f) => f.sev === "ERROR").length;
  if (errors > 0) return 1;
  if (minCov > 0 && cov < minCov) {
    console.error(`coverage ${cov}% is below --min-coverage ${minCov}% — the narration uses words the glossary cannot check`);
    return 1;
  }
  console.log("PASS — every recognised intent is drawn the way a human would picture it.");
  return 0;
}

if (process.argv[1] && /qa_commonsense\.[tj]s$/.test(process.argv[1])) process.exit(runCli());
