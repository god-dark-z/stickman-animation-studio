/**
 * battery — the commonsense regression suite.
 *
 *   npx tsx scripts/battery.ts [--json] [--only <category>]
 *
 * Every entry in data/commonsense-battery.json is one sentence a person could write, a written
 * statement of what a human expects to see, a compact storyboard plan, and the machine-checkable
 * part of that expectation. The runner builds a real single-shot story from the plan, resolves it
 * with the same code the renderer uses, and asserts:
 *
 *   1. the Scene Spec requirements (props, support, actions, expressions, counts, negation)
 *   2. the geometry gate (contact, layering, framing) — no body floating or sunk
 *   3. the commonsense glossary for every phrase the sentence matches
 *
 * A FAIL means the engine cannot draw the sentence the way a human pictures it. The report is the
 * primary regression score for the project; `--render` on a key entry is done separately with
 * `npm run stills` so the picture can be inspected by eye.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema, type ResolvedShot } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { checkRequirement, matches, type Requirement } from "../src/commonsense/glossary";
import { checkShot } from "./qa_geometry";
import { seenOf } from "./qa_commonsense";

type Entry = {
  id: string;
  category: string;
  sentence: string;
  /** English gloss — required for Bangla entries; the checks read it as the meaning layer */
  gloss?: string;
  expect: string;
  plan: Record<string, unknown>;
  check: Requirement;
};

const CAST = {
  a: { color: "#3a6fb0", outfit: "shirt", tie: "#c23b33", hair: "short", hairColor: "#2a1a10" },
  b: { color: "#c2543a", outfit: "sweater", hair: "bob", hairColor: "#4a2a12" },
  c: { color: "#3aa06f", outfit: "hoodie", hair: "curly", hairColor: "#1d1a16" },
  d: { color: "#a03a8f", outfit: "dress", hair: "long", hairColor: "#2b1b10" },
  e: { color: "#b0862a", outfit: "overalls", hair: "messy", hairColor: "#181410" },
  f: { color: "#4a4a58", outfit: "suit", hair: "parted", hairColor: "#101010" },
};

const data = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "../data/commonsense-battery.json"), "utf8"),
) as { entries: Entry[] };

// The Bangla battery: same 14 categories, Bangla sentences, English glosses, Bangla checks.
// Read lazily so a missing/older file cannot break the English suite.
const bnPath = path.resolve(import.meta.dirname, "../lang/bn/commonsense-battery.json");
const bnData: { entries: Entry[] } = fs.existsSync(bnPath)
  ? (JSON.parse(fs.readFileSync(bnPath, "utf8")) as { entries: Entry[] })
  : { entries: [] };

export type BatteryResult = {
  id: string;
  category: string;
  sentence: string;
  expect: string;
  lang: "en" | "bn";
  pass: boolean;
  errors: string[];
  warnings: string[];
};

export function runBattery(only?: string, lang: "en" | "bn" | "all" = "en"): BatteryResult[] {
  const results: BatteryResult[] = [];
  const entries: { entry: Entry; lang: "en" | "bn" }[] = [];
  if (lang === "en" || lang === "all") for (const e of data.entries) entries.push({ entry: e, lang: "en" });
  if (lang === "bn" || lang === "all") for (const e of bnData.entries) entries.push({ entry: e, lang: "bn" });

  for (const { entry, lang: entryLang } of entries) {
    if (only && entry.category !== only) continue;
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const story = StorySchema.parse({
        title: entry.sentence,
        lang: entryLang,
        music: "warm",
        cast: CAST,
        shots: [{ ...entry.plan, say: entry.sentence, ...(entry.gloss ? { gloss: entry.gloss } : {}) }],
      });
      const timeline = buildTimeline(story, null, null, null);
      const shot: ResolvedShot = timeline.shots[0];
      const cast = story.cast as Record<string, { build?: string }>;

      for (const f of checkShot(shot, cast, 0)) {
        (f.sev === "ERROR" ? errors : warnings).push(`[geometry ${f.kind}] ${f.msg}`);
      }
      const seen = seenOf(shot);
      // The glossary is matched on the narration in the story's own language, and on the gloss
      // too for Bangla (loanwords and mixed phrasing live in the English cues).
      for (const g of matches(entry.sentence, entryLang)) {
        for (const f of checkRequirement(g, g.requires, seen, 1)) {
          (f.sev === "ERROR" ? errors : warnings).push(`[glossary ${g.id}] ${f.msg.split("\n")[0]}`);
        }
      }
      if (entryLang === "bn" && entry.gloss) {
        for (const g of matches(entry.gloss, "en")) {
          for (const f of checkRequirement(g, g.requires, seen, 1)) {
            (f.sev === "ERROR" ? errors : warnings).push(`[gloss ${g.id}] ${f.msg.split("\n")[0]}`);
          }
        }
      }
      for (const f of checkRequirement(
        { id: entry.id, category: entry.category, phrases: [entry.sentence], requires: entry.check, good: entry.expect, bad: "" },
        entry.check,
        seen,
        1,
      )) {
        (f.sev === "ERROR" ? errors : warnings).push(`[expectation] ${f.msg.split("\n")[0]}`);
      }
    } catch (e) {
      errors.push(`[schema] ${(e as Error).message.split("\n")[0]}`);
    }
    results.push({ ...entry, lang: entryLang, pass: errors.length === 0, errors, warnings });
  }
  return results;
}

export function report(results: BatteryResult[], asJson: boolean): string {
  const byCat = new Map<string, { pass: number; total: number }>();
  for (const r of results) {
    const c = byCat.get(r.category) ?? { pass: 0, total: 0 };
    c.total++;
    if (r.pass) c.pass++;
    byCat.set(r.category, c);
  }
  const passed = results.filter((r) => r.pass).length;
  if (asJson) return JSON.stringify({ passed, total: results.length, categories: Object.fromEntries(byCat), results }, null, 2);

  const lines: string[] = [];
  lines.push(`# Commonsense battery — ${passed}/${results.length} drawn as a human would picture it\n`);
  lines.push("| category | pass | rate |");
  lines.push("|---|---|---|");
  for (const [cat, c] of [...byCat].sort()) lines.push(`| ${cat} | ${c.pass}/${c.total} | ${Math.round((c.pass / c.total) * 100)}% |`);
  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    lines.push("\n## Failures\n");
    for (const r of failed) {
      lines.push(`### ${r.id} — "${r.sentence}"`);
      lines.push(`**A human expects:** ${r.expect}`);
      for (const e of r.errors) lines.push(`- **ERROR** ${e}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

if (process.argv[1] && /battery\.[tj]s$/.test(process.argv[1])) {
  const argv = process.argv.slice(2);
  const onlyIdx = argv.indexOf("--only");
  const langIdx = argv.indexOf("--lang");
  const lang = (langIdx >= 0 ? argv[langIdx + 1] : "all") as "en" | "bn" | "all";
  const results = runBattery(onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined, lang);
  const out = report(results, argv.includes("--json"));
  const dir = path.resolve(import.meta.dirname, "../out/battery");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "report.md"), out);
  if (argv.includes("--json")) console.log(out);
  else {
    const passed = results.filter((r) => r.pass).length;
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`FAIL ${r.id} "${r.sentence}"`);
      for (const e of r.errors.slice(0, 3)) console.log(`  ${e}`);
    }
    console.log(`\n${passed}/${results.length} micro-stories drawn as a human would picture them`);
    console.log(`report: out/battery/report.md`);
  }
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}
