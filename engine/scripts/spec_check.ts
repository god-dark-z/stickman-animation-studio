/**
 * spec_check — validate a Director's Brief (Scene Spec) against the story it describes.
 *
 *   npx tsx scripts/spec_check.ts stories/<file>.json [--spec <file>]
 *
 * The spec is the agent's written answer to "what would a human picture for this sentence?".
 * This script refuses the ones that still leave a gap: a body with no support, a required prop
 * that never appears, an "empty chair" with someone sitting in it, a relation that is false in
 * the resolved scene, an "other room" with no plan to show the change.
 *
 * Exit 1 on any ERROR.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { SpecSchema, validateSpec } from "../src/commonsense/spec";
import { resolvePaths, resolveStory } from "./paths";

const argv = process.argv.slice(2);
const specIdx = argv.indexOf("--spec");
const specArgIndex = specIdx >= 0 ? specIdx + 1 : -1;
const specFile = specIdx >= 0 ? argv[specIdx + 1] : undefined;
const storyArg = argv.find((a, i) => !a.startsWith("--") && i !== specArgIndex);

if (!storyArg) {
  console.error("usage: npx tsx scripts/spec_check.ts stories/<file>.json [--spec <file>]");
  process.exit(2);
}

const file = resolveStory(storyArg, resolvePaths());
const story = StorySchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const auto = file.replace(/\.json$/, ".spec.json");
const specPath = specFile ?? (fs.existsSync(auto) ? auto : undefined);

if (!specPath) {
  console.error(`no spec found. Expected ${path.basename(auto)} beside the story, or pass --spec <file>.`);
  console.error("Write one from templates/scene-spec.md — one block per shot.");
  process.exit(2);
}

const spec = SpecSchema.parse(JSON.parse(fs.readFileSync(path.resolve(specPath), "utf8")));
const shots = buildTimeline(story, null, null, null).shots;
const findings = validateSpec(spec, shots, story.cast as Record<string, { build?: string }>);

findings.sort((a, b) => a.shot - b.shot || (a.sev === "ERROR" ? -1 : 1));
for (const f of findings) console.log(`${f.sev.padEnd(5)} shot ${String(f.shot).padStart(2)} [${f.kind}] ${f.msg}`);

const errors = findings.filter((f) => f.sev === "ERROR").length;
console.log(`\n${spec.title}: ${spec.shots.length} shot spec(s), ${shots.length} shot(s) — ${errors} error(s), ${findings.length - errors} warning(s)`);
if (errors) {
  console.error("FAIL — the brief still leaves a human assumption unstated or contradicted.");
  process.exit(1);
}
console.log("PASS — every body has a support and every stated relation holds in the resolved scene.");
