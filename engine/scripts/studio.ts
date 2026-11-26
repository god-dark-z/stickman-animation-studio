/**
 * studio — one command, all stages, refusing to advance past a failed gate.
 *
 *   npm run studio -- <topic-or-story.json> [--tier draft|standard|studio]
 *                    [--no-tts] [--resume] [--force] [--from <stage>] [--engine <dir>]
 *                    [--lang en|bn] [--voice auto|male|female|<voice-id>]
 *
 * Stages (in order):
 *   validate   schema + asset + cast checks (tsx scripts/validate.ts)
 *   narration  TTS -> audio + word timings (skipped by --no-tts)
 *   timeline   build the resolved timeline
 *   sync       sync gate  (qa_sync.ts)
 *   geometry   scene-graph gate (qa_geometry.ts)
 *   commonsense  Director's Brief + intent glossary (qa_commonsense.ts)
 *   stills     one still per shot
 *   pixels     stills pixel gate (qa_stills.py)
 *   timing     narration timing audit (qa_timing.py)
 *   render     the video
 *   video      container/spec/dead-frame gate (qa_video.py)
 *   audio      loudness/peak gate (qa_audio.py)
 *   visual     per-shot claim checklist + review file (qa_visual_report.py)
 *
 * State lives in stories/<slug>/.state.json, the log in out/<slug>/run.log.
 * A failed stage stops the run and prints the exact command to retry.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { StorySchema } from "../src/schema";
import { resolvePaths, resolveStory, slugOf } from "./paths";
import { getPack, isLang } from "../lang";
import { chooseVoice, decisionMarkdown } from "./choose_voice";

type Tier = "draft" | "standard" | "studio";
// `bangla` is a no-op PASS for English stories, so it can sit in one fixed stage list: the
// pipeline never branches, and a Bangla story cannot skip its text gate by accident.
const STAGES = ["validate", "bangla", "narration", "timeline", "sync", "geometry", "commonsense", "stills", "pixels", "timing", "render", "video", "audio", "visual"] as const;
type Stage = (typeof STAGES)[number];

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string, d?: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const storyArg = args.find((a, i) => !a.startsWith("--") && !["--tier", "--from", "--engine", "--lang", "--voice"].includes(args[i - 1] ?? ""));
if (!storyArg) {
  console.error("usage: npm run studio -- <story.json|slug> [--tier draft|standard|studio] [--no-tts] [--resume] [--force] [--from <stage>]");
  process.exit(2);
}
const tier = (opt("--tier", "standard") as Tier) ?? "standard";
if (!["draft", "standard", "studio"].includes(tier)) {
  console.error(`unknown tier "${tier}" — use draft | standard | studio`);
  process.exit(2);
}

// --lang / --voice are options of every stage, so they are forwarded verbatim to the child
// commands that accept them (make.ts, and the gates that read story-derived data).
const passthrough: string[] = [];
const langArg = opt("--lang");
const voiceArg = opt("--voice");
if (langArg !== undefined) passthrough.push("--lang", langArg);
if (voiceArg !== undefined) passthrough.push("--voice", voiceArg);

const paths = resolvePaths({ engine: opt("--engine") });
const storyPath = resolveStory(storyArg, paths);const raw = JSON.parse(fs.readFileSync(storyPath, "utf8"));
const parsed = StorySchema.safeParse(raw);
if (!parsed.success) {
  console.error(`\x1b[31mStory JSON is invalid\x1b[0m (${path.relative(process.cwd(), storyPath)}):`);
  for (const i of parsed.error.issues) console.error(`  • ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
const story = parsed.data;
const slug = slugOf(story.title);
const outDir = path.join(paths.out, slug);
const stateDir = path.join(paths.stories, slug);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(stateDir, { recursive: true });
const logPath = path.join(outDir, "run.log");
const statePath = path.join(stateDir, ".state.json");

// Voice decision file: written before narration so the choice is on record even when the run
// fails later. Only when the story left the voice to the pipeline (no explicit voice in the JSON
// and no --voice flag) — a user-chosen voice needs no justification.
if (!story.voice || story.voice === getPack(story.lang).tts.defaultVoice) {
  const explicit = Object.values(story.cast).some((c) => c.voice);
  if (!explicit) {
    try {
      const choice = chooseVoice({ text: story.title, lang: story.lang, script: story.shots.map((s) => s.say).join(" ") });
      fs.writeFileSync(path.join(stateDir, "voice-decision.md"), decisionMarkdown(story.title, story.lang, choice));
    } catch {
      // a missing decision file must never block a render; the gate list is what matters
    }
  }
}

type State = { slug: string; story: string; tier: Tier; stages: Record<string, { status: "ok" | "failed"; ms: number; at: string; cmd?: string }> };
const state: State = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { slug, story: path.relative(paths.engine, storyPath), tier, stages: {} };
state.tier = tier;
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
save();

const log = (line: string) => {
  const stamp = new Date().toISOString().slice(11, 19);
  fs.appendFileSync(logPath, `${stamp} ${line}\n`);
};

const python = process.platform === "win32" ? "python" : "python3";
const hasTts = !flag("--no-tts");

const stageCmd = (stage: Stage): { cmd: string; args: string[]; skip?: string } => {
  const preview = tier === "draft";
  switch (stage) {
    case "validate": return { cmd: "npx", args: ["tsx", "scripts/validate.ts", storyPath] };
    case "bangla": {
      // effective language: the --lang flag wins, else the story's own lang.
      // Two gates: the text is single-script and glossed, AND the Bangla claims match the gloss.
      const effLang = langArg ?? (isLang(raw.lang) ? raw.lang : "en");
      if (effLang !== "bn") return { cmd: "", args: [], skip: "English story: the Bangla text gate does not apply" };
      // qa_bangla runs both checks in order (it shells to qa_gloss when the story is Bangla)
      return { cmd: python, args: ["scripts/qa_bangla.py", storyPath, "--with-gloss"] };
    }
    case "narration": return hasTts ? { cmd: "npx", args: ["tsx", "scripts/make.ts", storyPath, "--narration-only", ...passthrough] } : { cmd: "", args: [], skip: "--no-tts" };
    case "timeline": return { cmd: "npx", args: ["tsx", "scripts/make.ts", storyPath, "--timeline-only", ...passthrough] };
    case "sync": return { cmd: "npx", args: ["tsx", "scripts/qa_sync.ts", storyPath] };
    case "geometry": return { cmd: "npx", args: ["tsx", "scripts/qa_geometry.ts", storyPath] };
    case "commonsense": return { cmd: "npx", args: ["tsx", "scripts/qa_commonsense.ts", storyPath] };
    case "stills": return { cmd: "npx", args: ["tsx", "scripts/make.ts", storyPath, "--stills", ...(hasTts ? [] : ["--no-tts"]), ...passthrough] };
    case "pixels": return { cmd: python, args: ["scripts/qa_stills.py", path.join(paths.out, slug, "stills")] };
    case "timing": return hasTts
      ? { cmd: python, args: ["scripts/qa_timing.py", path.join(outDir, "words.json"), path.join(paths.publicDir, "voice", `${slug}.mp3`)] }
      : { cmd: "", args: [], skip: "--no-tts: estimated timing" };
    case "render": return { cmd: "npx", args: ["tsx", "scripts/make.ts", storyPath, ...(preview ? ["--preview"] : []), ...(hasTts ? [] : ["--no-tts"]), "--crf", tier === "studio" ? "16" : preview ? "28" : "20", ...passthrough] };
    case "video": return { cmd: python, args: ["scripts/qa_video.py", path.join(outDir, `${slug}${preview ? "-preview" : ""}.mp4`), ...(preview ? ["--preview"] : []), ...(hasTts ? [] : ["--silent"])] };
    case "audio": return hasTts
      ? { cmd: python, args: ["scripts/qa_audio.py", path.join(outDir, `${slug}${preview ? "-preview" : ""}.mp4`)] }
      : { cmd: "", args: [], skip: "--no-tts: silent render, nothing to measure" };
    case "visual": return { cmd: python, args: ["scripts/qa_visual_report.py", storyPath, path.join(outDir, "stills")] };
  }
};

const runStage = (stage: Stage): Promise<number> =>
  new Promise((resolve) => {
    const { cmd, args: a, skip } = stageCmd(stage);
    if (skip) {
      console.log(`\x1b[90m• ${stage}: skipped (${skip})\x1b[0m`);
      log(`${stage}: skipped (${skip})`);
      resolve(0);
      return;
    }
    console.log(`\x1b[36m▸ ${stage}\x1b[0m`);
    log(`$ ${cmd} ${a.join(" ")}`);
    const child = spawn(cmd, a, { cwd: paths.engine, shell: process.platform === "win32", env: { ...process.env, STUDIO_TIER: tier } });
    child.stdout.on("data", (d) => { process.stdout.write(d); fs.appendFileSync(logPath, d.toString()); });
    child.stderr.on("data", (d) => { process.stderr.write(d); fs.appendFileSync(logPath, d.toString()); });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", (e) => { console.error(e.message); resolve(1); });
  });

const STAGE_DOCS: Record<Stage, string> = {
  validate: "schema + asset + cast checks",
  bangla: "Bangla text gate (single script, gloss present) — skipped for English",
  narration: "TTS -> audio + word timings (skipped by --no-tts)",
  timeline: "build the resolved timeline",
  sync: "sync gate (qa_sync.ts)",
  geometry: "scene-graph gate (qa_geometry.ts)",
  commonsense: "Director's Brief + intent glossary (qa_commonsense.ts)",
  stills: "one still per shot",
  pixels: "stills pixel gate (qa_stills.py)",
  timing: "narration timing audit (qa_timing.py)",
  render: "the video",
  video: "container/spec/dead-frame gate (qa_video.py)",
  audio: "loudness/peak gate (qa_audio.py)",
  visual: "per-shot claim checklist + review file (qa_visual_report.py)",
};
void STAGE_DOCS;

const FIX: Record<Stage, string> = {
  validate: "fix the story JSON (the error names the field), then re-run",
  bangla: "make the text one script: add Latin words to stories/<slug>/pronunciation.json, rewrite English lines in Bangla, and add a `gloss` to every spoken shot",
  narration: "check the network / voice name, or run with --no-tts",
  timeline: "fix the story (see the error above)",
  sync: "change the shot's world/time/pose/props, or rephrase the narration, until 0 errors",
  geometry: "add the semantic action + declare the prop in that shot's props (see the error), or widen the framing",
  commonsense: "draw what the sentence implies: the error prints the GOOD and BAD renderings — fix props/action/time/bg or rephrase",
  stills: "fix the render error above (missing prop, bad 3D location)",
  pixels: "a still is black/blank/desaturated — check that shot's bg/location and lighting",
  timing: "re-synthesize narration (delete out/<slug>/narration.key) or use forced alignment",
  render: "see the error above; on low RAM lower concurrency with --concurrency 2",
  video: "the MP4 is wrong (spec/duration/dead frames) — re-render, check the story's shot lengths",
  audio: "loudness/peak out of range — the pipeline loudnorms automatically; re-render",
  visual: "create out/<slug>/visual-review.md as the checklist asks, or rely on the geometry gate and say so",
};

const from = opt("--from") as Stage | undefined;
const startAt = from ? STAGES.indexOf(from) : 0;
if (from && startAt < 0) {
  console.error(`unknown stage "${from}". Stages: ${STAGES.join(", ")}`);
  process.exit(2);
}

console.log(`\x1b[1mstudio\x1b[0m ${story.title} · tier ${tier} · ${story.shots.length} shots${hasTts ? "" : " · no TTS"}`);
console.log(`story: ${path.relative(process.cwd(), storyPath)}  →  out/${slug}/\n`);
log(`=== studio ${story.title} (${tier}) ===`);

for (let i = startAt; i < STAGES.length; i++) {
  const stage = STAGES[i];
  const prev = state.stages[stage];
  if (flag("--resume") && !flag("--force") && prev?.status === "ok") {
    console.log(`\x1b[90m• ${stage}: ok (resumed)\x1b[0m`);
    continue;
  }
  const t0 = Date.now();
  const code = await runStage(stage);
  const ms = Date.now() - t0;
  if (code !== 0) {
    state.stages[stage] = { status: "failed", ms, at: new Date().toISOString(), cmd: `${stage}` };
    save();
    log(`${stage}: FAILED in ${(ms / 1000).toFixed(1)}s`);
    console.error(`\n\x1b[31m✗ ${stage} failed\x1b[0m after ${(ms / 1000).toFixed(1)}s`);
    console.error(`  fix: ${FIX[stage]}`);
    console.error(`  log: ${path.relative(process.cwd(), logPath)}`);
    console.error(`  resume from here: npm run studio -- ${path.relative(process.cwd(), storyPath)} --tier ${tier} --from ${stage} --resume`);
    process.exit(1);
  }
  state.stages[stage] = { status: "ok", ms, at: new Date().toISOString() };
  save();
  console.log(`\x1b[32m✓\x1b[0m ${stage} \x1b[90m(${(ms / 1000).toFixed(1)}s)\x1b[0m`);
}

const done = path.join(outDir, `${slug}${tier === "draft" ? "-preview" : ""}.mp4`);
console.log(`\n\x1b[32mDone.\x1b[0m ${path.relative(process.cwd(), done)}`);
console.log(`  log:        ${path.relative(process.cwd(), logPath)}`);
console.log(`  state:      ${path.relative(process.cwd(), statePath)}`);
console.log(`  sync map:   npx tsx scripts/qa_sync.ts ${path.relative(paths.engine, storyPath)} --map`);
