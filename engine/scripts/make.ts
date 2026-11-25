// One command: story JSON -> narrated, captioned, sound-designed 1080x1920 MP4.
//
//   npm run make -- stories/my-story.json [--preview] [--stills] [--no-tts]
//                  [--lang en|bn] [--voice auto|male|female|<voice-id>]
//
//   --preview  render at 50% resolution (fast check of timing and framing)
//   --stills   only render one QA still per shot to out/<slug>/stills (no video)
//   --no-tts   skip narration (estimated timings, silent voice) for offline work
//   --lang     override the story's language (default: the story JSON's `lang`, else en)
//   --voice    override the story's voice: auto (pack default), male, female, or an exact id
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { StorySchema, type Word } from "../src/schema";
import { buildTimeline, tokenize } from "../src/timeline";
import { PROPS, SFX } from "../src/catalog";
import { loadLibrary } from "./location-lib";
import { hashStr } from "../src/theme";
import { resolvePaths } from "./paths";
import { getPack, isLang, resolveVoice } from "../lang";
import { checkDistinctSpeakers } from "./choose_voice";

const root = resolvePaths().engine;
const args = process.argv.slice(2);
const storyPath = args.find((a) => !a.startsWith("--"));
const flag = (f: string) => args.includes(f);
const opt = (f: string, d?: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
if (!storyPath) {
  console.error("usage: npm run make -- stories/<story>.json [--preview] [--stills] [--no-tts]");
  process.exit(1);
}

const log = (s: string) => console.log(`\x1b[36m▸\x1b[0m ${s}`);
const python = process.platform === "win32" ? "python" : "python3";

// ---------------------------------------------------------------- 1. validate
const raw = JSON.parse(fs.readFileSync(storyPath, "utf8"));
// --lang / --voice override what the story file says, before validation, so one story can be
// produced in either language without editing it (the resolver already decided; this is the flag).
const langFlag = opt("--lang");
if (langFlag !== undefined) {
  if (!isLang(langFlag)) {
    console.error(`--lang "${langFlag}" is not enabled. Use: en, bn`);
    process.exit(1);
  }
  raw.lang = langFlag;
}
const voiceFlag = opt("--voice");
if (voiceFlag !== undefined) {
  const storyLang = isLang(raw.lang) ? raw.lang : "en";
  if (["auto", "male", "female"].includes(voiceFlag)) raw.voice = resolveVoice(storyLang, voiceFlag);
  else raw.voice = voiceFlag; // explicit id — the pack catalog check below catches typos
  delete raw.rate; // a new voice brings its own default rate
}
const parsed = StorySchema.safeParse(raw);
if (!parsed.success) {
  console.error("\x1b[31mStory JSON is invalid:\x1b[0m");
  for (const issue of parsed.error.issues) console.error(`  • ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
const story = parsed.data;
// The chosen voice must exist in the language pack's catalog for edge narration (a typo would
// otherwise be discovered only after the network round-trip).
if (story.provider === "edge") {
  const pack = getPack(story.lang);
  for (const [id, c] of Object.entries(story.cast)) {
    if (c.voice && !pack.tts.voices.some((v) => v.id === c.voice)) {
      console.error(`cast.${id}.voice "${c.voice}" is not in the ${story.lang} catalog. Available:`);
      for (const v of pack.tts.voices) console.error(`  • ${v.id} (${v.gender}, ${v.locale})`);
      process.exit(1);
    }
  }
  if (!pack.tts.voices.some((v) => v.id === story.voice)) {
    console.error(`voice "${story.voice}" is not in the ${story.lang} catalog. Available:`);
    for (const v of pack.tts.voices) console.error(`  • ${v.id} (${v.gender}, ${v.locale})`);
    process.exit(1);
  }
}

// Two speakers must be audibly distinct: same voice at the same rate sounds like one person
// talking to themselves. This is a validation error, not a style note.
const speakers = [...new Set(story.shots.filter((s) => s.quote).map((s) => s.quote!))]
  .map((id) => ({ id, voice: story.cast[id]?.voice, rate: story.cast[id]?.voiceRate, gender: undefined }));
if (speakers.length > 1) {
  const problems = checkDistinctSpeakers(story.lang, speakers, story.rate);
  if (problems.length) {
    console.error("\x1b[31mDialogue speakers are not distinct:\x1b[0m");
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }
}
for (const [i, s] of story.shots.entries()) {
  for (const a of s.actors) if (!story.cast[a.id]) { console.error(`shot ${i}: actor "${a.id}" is not in cast`); process.exit(1); }
  if (s.quote && !story.cast[s.quote]) { console.error(`shot ${i}: quote "${s.quote}" is not in cast`); process.exit(1); }
}
// 3D locations: only what this story uses goes into the render
const usedLocations = [...new Set(story.shots.flatMap((s) => (s.location ? [s.location] : [])))];
const library = usedLocations.length ? loadLibrary() : null;
if (library && library.errors.length) { console.error("\x1b[31mlocations/ has errors:\x1b[0m"); library.errors.forEach((e) => console.error(`  • ${e}`)); process.exit(1); }
for (const name of usedLocations) if (!library!.locations.some((l) => l.name === name)) { console.error(`no location called "${name}". Have: ${library!.locations.map((l) => l.name).join(", ")}`); process.exit(1); }
for (const [i, s] of story.shots.entries()) {
  for (const p of s.props) {
    if ((PROPS as readonly string[]).includes(p.type) || (s.location && library!.objects[p.type])) continue;
    console.error(`shot ${i}: no prop or object called "${p.type}". See: npx tsx scripts/locations.ts --list`);
    if (!s.location && library?.objects[p.type]) console.error("  It is a 3D object, so this shot needs a \"location\".");
    process.exit(1);
  }
}
// CPU-only machines: ANGLE over SwiftShader is the reliable path. Override with --gl or REMOTION_GL.
const gl = (opt("--gl") ?? process.env.REMOTION_GL ?? "angle") as "angle" | "swiftshader" | "swangle" | "egl" | "swangle";
const chromiumOptions = usedLocations.length ? { gl } : {};
const missingSfx = SFX.filter((n) => !fs.existsSync(path.join(root, "public/sfx", `${n}.wav`)));
const missingGrain = !fs.existsSync(path.join(root, "public/grain.png"));
if (missingSfx.length || missingGrain) {
  log("sound library / grain texture missing — generating it (one time)…");
  execFileSync(python, [path.join(root, "scripts/gen_audio_assets.py")], { stdio: "inherit" });
}

// ASCII slug, but a non-ASCII title would collapse to "story" — hash the title
// into the fallback so distinct non-English-titled stories never collide in out/ and public/voice/.
const asciiSlug = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const slug = asciiSlug || `story-${Math.abs(hashStr(story.title)).toString(36).slice(0, 8)}`;
const outDir = path.join(root, "out", slug);
fs.mkdirSync(outDir, { recursive: true });
const words = story.shots.reduce((n, s) => n + tokenize(s.say).length, 0);
log(`"${story.title}" — ${story.shots.length} shots, ${words} words (~${Math.round(words / 3.75)}s)`);

// ---------------------------------------------------------------- 2. narration
let wordTimes: Word[] | null = null;
let voiceSrc: string | null = null;
if (!flag("--no-tts")) {
  const voiceDir = path.join(root, "public/voice");
  fs.mkdirSync(voiceDir, { recursive: true });
  // narration text only — `call` texts are never spoken, they are on-screen text
  const textFile = path.join(outDir, "script.txt");
  fs.writeFileSync(textFile, story.shots.map((s) => (s.say === "…" ? "" : s.say.trim())).join(" "));
  const isKokoro = story.provider === "kokoro";
  const audioFile = path.join(voiceDir, `${slug}${isKokoro ? "-kokoro" : ""}.${isKokoro ? "wav" : "mp3"}`);
  const wj = path.join(outDir, "words.json");

  // ---------------------------------------------------------- character voices
  // A character with `voice`/`voiceRate` speaks its own lines. When any character overrides the
  // narrator, the narration becomes a speaker plan: one run per shot, in order, each with its
  // own voice and rate. With a single voice the plan collapses to the V3 single-request path.
  const speakerOf = (shotIdx: number): { speaker: string; voice: string; rate: string; pitch: string } => {
    const shot = story.shots[shotIdx];
    const id = shot.quote ?? (shot.actors.length === 1 ? shot.actors[0].id : undefined);
    const cast = id ? story.cast[id] : undefined;
    return {
      speaker: id ?? "narrator",
      voice: cast?.voice ?? story.voice,
      rate: cast?.voiceRate ?? story.rate,
      pitch: cast?.voicePitch ?? "+0Hz",
    };
  };
  const plan = story.shots.map((s, i) => ({ ...speakerOf(i), text: s.say === "…" ? "" : s.say.trim() }));
  const distinctVoices = new Set(plan.filter((p) => p.text).map((p) => `${p.voice}|${p.rate}|${p.pitch}`));
  const multiVoice = !isKokoro && distinctVoices.size > 1;

  const keyPayload = multiVoice
    ? [JSON.stringify(plan), story.provider, story.lang]
    : [fs.readFileSync(textFile, "utf8"), story.voice, story.rate, story.provider, story.lang];
  // the same text, voice, rate, provider and language don't need synthesizing again, and keep
  // their exact timing
  const keyFile = path.join(outDir, "narration.key");
  const key = JSON.stringify(keyPayload);
  const reusable = fs.existsSync(keyFile) && fs.readFileSync(keyFile, "utf8") === key && fs.existsSync(wj) && fs.existsSync(audioFile) && fs.statSync(audioFile).size > 0;
  if (reusable) log("narration: unchanged, reusing it");
  else if (isKokoro) {
    // local Kokoro ONNX TTS + faster-whisper for word timings (offline fallback)
    log(`narration: kokoro ${story.voice} @ ${story.rate}x`);
    execFileSync(python, [path.join(root, "scripts/tts_kokoro.py"), textFile, audioFile, wj, story.voice, story.rate], { stdio: "inherit" });
    fs.writeFileSync(keyFile, key);
  } else if (multiVoice) {
    // several speakers: one run per shot with its own voice, joined on an exact byte clock
    const planFile = path.join(outDir, "speakers.json");
    fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
    const speakers = [...new Set(plan.filter((p) => p.text).map((p) => p.speaker))];
    log(`narration: ${distinctVoices.size} voices (${speakers.join(", ")}) — ${story.lang}`);
    execFileSync(python, [path.join(root, "scripts/dialogue_tts.py"), planFile, audioFile, wj, "--lang", story.lang], { stdio: "inherit" });
    fs.writeFileSync(keyFile, key);
  } else {
    // edge-tts neural voice (default) — exact per-word boundaries; --lang selects the normalizer
    log(`narration: ${story.voice} @ ${story.rate} (${story.lang})`);
    execFileSync(python, [path.join(root, "scripts/tts.py"), textFile, audioFile, wj, story.voice, story.rate, "+0Hz", "--lang", story.lang], { stdio: "inherit" });
    fs.writeFileSync(keyFile, key);
  }
  wordTimes = JSON.parse(fs.readFileSync(wj, "utf8"));
  voiceSrc = `voice/${path.basename(audioFile)}`;
}

if (flag("--narration-only")) {
  log(`narration ready → ${path.relative(root, outDir)}${voiceSrc ? ` (${wordTimes?.length ?? 0} words)` : " (silent)"}`);
  process.exit(0);
}

// ---------------------------------------------------------------- 3. timeline
const musicSrc = story.music === "none" ? null : `music/${story.music}.wav`;
const timeline = {
  ...buildTimeline(story, wordTimes, voiceSrc, musicSrc),
  ...(library ? { locations: Object.fromEntries(library.locations.filter((l) => usedLocations.includes(l.name)).map((l) => [l.name, l])), objects: library.objects } : {}),
};
fs.writeFileSync(path.join(outDir, "timeline.json"), JSON.stringify(timeline, null, 1));
log(`timeline: ${(timeline.durationInFrames / timeline.fps).toFixed(1)}s, ${timeline.sfx.length} sound cues`);
if (flag("--timeline-only")) process.exit(0);
for (const s of timeline.shots) {
  const len = s.duration / timeline.fps;
  if (len < 0.8) console.warn(`  ⚠ shot ${s.index} is only ${len.toFixed(2)}s — consider merging it`);
  if (len > 6) console.warn(`  ⚠ shot ${s.index} lasts ${len.toFixed(1)}s — consider splitting it (refs cut every 1.5–4s)`);
}

// ---------------------------------------------------------------- 4. render
log("bundling…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const inputProps = timeline as unknown as Record<string, unknown>;
// Captions load a web font, so one dropped connection shouldn't end the run.
const withRetry = async <T>(job: () => Promise<T>, tries = 3): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try { return await job(); } catch (e) {
      if (attempt >= tries) throw e;
      log(`render failed (${(e as Error).message.slice(0, 80)}), retrying…`);
    }
  }
};
const composition = await withRetry(() => selectComposition({ serveUrl, id: "Story", inputProps, chromiumOptions }));

if (flag("--stills")) {
  const dir = path.join(outDir, "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const s of timeline.shots) {
    const f = s.from + Math.floor(s.duration * 0.6);
    const out = path.join(dir, `shot${String(s.index).padStart(2, "0")}.png`);
    await withRetry(() => renderStill({ composition, serveUrl, frame: f, output: out, inputProps, scale: 0.5, chromiumOptions }));
  }
  log(`stills → ${path.relative(root, dir)}`);
  process.exit(0);
}

const rawOut = path.join(outDir, "raw.mp4");
const preview = flag("--preview");
let last = -1;
const os = await import("node:os");
const cores = os.cpus().length;
// Memory guard: a 1080x1920 frame with three.js costs ~250-350 MB per tab. Cap by both
// cores and free RAM so a 16 GB CPU-only machine never thrashes into an OOM kill.
const freeGb = os.freemem() / 1e9;
const ramCap = Math.max(1, Math.floor(freeGb / 0.9));
const concurrency = Number(opt("--concurrency")) || (usedLocations.length ? Math.min(2, ramCap) : Math.max(2, Math.min(8, cores - 2, ramCap)));
log(`render: ${usedLocations.length ? "3D (gl=" + gl + ") " : "2D "}concurrency ${concurrency} of ${cores} cores, ${freeGb.toFixed(1)} GB free`);
await withRetry(() => renderMedia({
  composition, serveUrl, codec: "h264", outputLocation: rawOut, inputProps, chromiumOptions,
  scale: preview ? 0.5 : 1, crf: Number(opt("--crf")) || (preview ? 28 : 18), audioBitrate: "192k", concurrency,
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) { last = p; process.stdout.write(`\r  rendering ${"█".repeat(p)}${"░".repeat(20 - p)} ${Math.round(progress * 100)}%`); }
  },
}));
process.stdout.write("\n");

// ---------------------------------------------------------------- 5. loudness (-14 LUFS like the references)
// TP is targeted at -1.5 dBTP (not -1.0): AAC encoding overshoots the PCM peak by ~0.3-0.5 dB,
// and the delivery bar is a measured <= -1.0 dBTP in the final file (scripts/qa_audio.py).
const ffmpeg = execFileSync(python, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim();
const final = path.join(outDir, `${slug}${preview ? "-preview" : ""}.mp4`);
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", rawOut, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", final]);
fs.rmSync(rawOut);
log(`done → ${path.relative(root, final)}`);
