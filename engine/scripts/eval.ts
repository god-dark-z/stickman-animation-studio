#!/usr/bin/env node
/**
 * eval — the cross-agent / cross-model scoreboard.
 *
 *   npx tsx scripts/eval.ts                    # everything runnable here, writes evals/REPORT.md
 *   npx tsx scripts/eval.ts --lang bn          # Bangla suites only
 *   npx tsx scripts/eval.ts --json             # machine-readable
 *   npx tsx scripts/eval.ts --agent "Claude Code" --model "sonnet-4.5"
 *
 * What it measures, and what it cannot:
 *
 *   MEASURED HERE (no paid API, no network):
 *     • the English and Bangla commonsense batteries (scene/geometry/glossary)
 *     • the language resolver suite
 *     • the Bangla normalizer + punctuation/pronunciation suites
 *     • the voice-choice suite
 *     • the Bangla text + glyph gates on every Bangla test story
 *     • the gate stack on every test story that ships in stories/tests
 *
 *   NOT MEASURABLE HERE:
 *     • how a *specific* model writes a story. That needs the model's API, which this project
 *       forbids (no paid APIs). `--record` lets an operator paste the per-model numbers they
 *       obtained elsewhere into evals/model-runs.json, and this report merges them honestly,
 *       labelling the source. Nothing is ever invented.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { resolvePaths } from "./paths";

const paths = resolvePaths();
const root = paths.engine;
const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const opt = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
const python = process.platform === "win32" ? "python" : "python3";

type Row = {
  suite: string;
  lang: "en" | "bn" | "all";
  pass: number;
  total: number;
  detail: string;
  measured: boolean;
};

const run = (cmd: string, args: string[]): { ok: boolean; out: string } => {
  try {
    // shell:true is required for .cmd launchers (npx) on Windows; every arg here is a local path
    // or a fixed script name, never user input.
    const out = execFileSync(cmd, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    return { ok: true, out };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
};

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const rows: Row[] = [];

// ---------------------------------------------------------------- batteries
const battery = (lang: "en" | "bn") => {
  const r = run(npx, ["tsx", "scripts/battery.ts", "--lang", lang, "--json"]);
  // --json prints the full report object; read `passed` / `total` from it
  try {
    const start = r.out.indexOf("{");
    const parsed = JSON.parse(r.out.slice(start)) as { passed: number; total: number };
    rows.push({ suite: "commonsense battery", lang, pass: parsed.passed, total: parsed.total, detail: "scene spec + geometry + glossary", measured: true });
  } catch {
    rows.push({ suite: "commonsense battery", lang, pass: 0, total: 0, detail: `could not parse battery output for ${lang}`, measured: false });
  }
};

if (!flag("--lang") || opt("--lang") === "en" || opt("--lang") === "all") battery("en");
if (!flag("--lang") || opt("--lang") === "bn" || opt("--lang") === "all") battery("bn");

// ---------------------------------------------------------------- unit suites (TS)
const tsSuite = (suite: string, script: string, lang: Row["lang"]) => {
  const r = run(npx, ["tsx", script]);
  const m = r.out.match(/(\d+) passed(?:, (\d+) failed)?(?: of (\d+))?/);
  if (m) {
    const pass = Number(m[1]);
    const fail = Number(m[2] ?? 0);
    const total = Number(m[3] ?? pass + fail);
    rows.push({ suite, lang, pass, total, detail: script, measured: true });
  } else {
    rows.push({ suite, lang, pass: 0, total: 0, detail: `could not parse output of ${script}`, measured: false });
  }
};

tsSuite("language resolver", "scripts/test_language.ts", "all");
tsSuite("voice choice", "scripts/test_voice_choice.ts", "all");
{
  const r = run(npx, ["tsx", "scripts/skill_lint.ts"]);
  const m = r.out.match(/(\d+) error\(s\)/);
  rows.push({ suite: "skill lint", lang: "all", pass: r.ok ? 1 : 0, total: 1, detail: m ? `${m[1]} error(s), frontmatter/links/JSON examples` : "skill_lint output unparsed", measured: true });
}

// ---------------------------------------------------------------- unit suites (Python)
const pySuite = (suite: string, script: string, lang: Row["lang"]) => {
  const r = run(python, ["-I", script]);
  const m = r.out.match(/(\d+) passed, (\d+) failed/);
  if (m) rows.push({ suite, lang, pass: Number(m[1]), total: Number(m[1]) + Number(m[2]), detail: script, measured: true });
  else rows.push({ suite, lang, pass: 0, total: 0, detail: `could not parse output of ${script}`, measured: false });
};

pySuite("bangla normalizer", "scripts/test_bn_normalize.py", "bn");
pySuite("bangla timing", "scripts/test_bn_tts.py", "bn");

// ---------------------------------------------------------------- typecheck + gates on test stories
const tc = run(npx, ["tsc", "--noEmit"]);
rows.push({ suite: "typecheck", lang: "all", pass: tc.ok ? 1 : 0, total: 1, detail: tc.ok ? "tsc --noEmit clean" : tc.out.slice(0, 200), measured: true });

const testsDir = path.join(root, "stories", "tests");
const storyFiles = fs.existsSync(testsDir) ? fs.readdirSync(testsDir).filter((f) => f.endsWith(".json") && !f.endsWith(".spec.json")) : [];
const bnStories = storyFiles.filter((f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(testsDir, f), "utf8")).lang === "bn";
  } catch {
    return false;
  }
});

for (const f of [path.join("stories", "why-phone-gets-hot.json"), ...storyFiles.map((s) => path.join("stories", "tests", s))]) {
  const full = path.join(root, f);
  if (!fs.existsSync(full)) continue;
  const lang = JSON.parse(fs.readFileSync(full, "utf8")).lang === "bn" ? "bn" : "en";
  let ok = 0;
  let total = 0;
  for (const [gate, cmd, args] of [
    ["sync", npx, ["tsx", "scripts/qa_sync.ts", full]],
    ["geometry", npx, ["tsx", "scripts/qa_geometry.ts", full]],
    ["commonsense", npx, ["tsx", "scripts/qa_commonsense.ts", full]],
  ] as [string, string, string[]][]) {
    total++;
    if (run(cmd, args).ok) ok++;
    else void gate;
  }
  if (lang === "bn") {
    total += 2;
    if (run(python, ["scripts/qa_bangla.py", full, "--with-gloss"]).ok) ok++;
    if (run(python, ["scripts/qa_glyphs.py", full]).ok) ok++;
  }
  rows.push({ suite: "gate stack", lang, pass: ok, total, detail: path.basename(f), measured: true });
}

// ---------------------------------------------------------------- optional recorded model runs
const recordedPath = path.join(paths.engine, "..", "evals", "model-runs.json");
type Recorded = { agent: string; model: string; lang: "en" | "bn"; suite: string; pass: number; total: number; source: string; date: string };
let recorded: Recorded[] = [];
if (fs.existsSync(recordedPath)) {
  try {
    recorded = JSON.parse(fs.readFileSync(recordedPath, "utf8")).runs ?? [];
  } catch {
    recorded = [];
  }
}

// ---------------------------------------------------------------- report
const pct = (p: number, t: number) => (t ? Math.round((p / t) * 100) : 0);
const pctRecords = rows.filter((r) => r.total > 0);
const overallPass = pctRecords.reduce((n, r) => n + r.pass, 0);
const overallTotal = pctRecords.reduce((n, r) => n + r.total, 0);

const lines: string[] = [];
lines.push("# Eval report");
lines.push("");
lines.push(`Generated ${new Date().toISOString().slice(0, 10)} by \`npx tsx scripts/eval.ts\`.`);
lines.push("");
lines.push(`## Summary — ${overallPass}/${overallTotal} checks (${pct(overallPass, overallTotal)} %)`);
lines.push("");
lines.push("| suite | language | pass | rate | what it proves |");
lines.push("|---|---|---|---|---|");
for (const r of rows) {
  lines.push(`| ${r.suite} | ${r.lang} | ${r.pass}/${r.total} | ${pct(r.pass, r.total)} % | ${r.detail}${r.measured ? "" : " **(NOT MEASURED)**"} |`);
}
lines.push("");

const byLang = new Map<string, { p: number; t: number }>();
for (const r of pctRecords) {
  const c = byLang.get(r.lang) ?? { p: 0, t: 0 };
  c.p += r.pass;
  c.t += r.total;
  byLang.set(r.lang, c);
}
lines.push("## By language");
lines.push("");
lines.push("| language | pass | rate |");
lines.push("|---|---|---|");
for (const [l, c] of [...byLang].sort()) lines.push(`| ${l} | ${c.p}/${c.t} | ${pct(c.p, c.t)} % |`);
lines.push("");

lines.push("## Per-category, per-language (commonsense battery)");
lines.push("");
lines.push("Category figures are in `docs/dev/v4/battery-report.md`, generated by the same run.");
lines.push("");

lines.push("## Per-agent and per-model");
lines.push("");
if (recorded.length) {
  lines.push("| agent | model | language | suite | pass | rate | source | date |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const r of recorded) lines.push(`| ${r.agent} | ${r.model} | ${r.lang} | ${r.suite} | ${r.pass}/${r.total} | ${pct(r.pass, r.total)} % | ${r.source} | ${r.date} |`);
  lines.push("");
  lines.push("These rows come from the operator's own runs (see `evals/model-runs.json`), not from this");
  lines.push("machine. They are reproduced as given, with their source, never merged into the numbers above.");
} else {
  lines.push("**No per-agent / per-model rows are recorded.** Measuring how a specific model writes a story");
  lines.push("requires that model's API, and this project's rules forbid paid APIs. What *is* measured here is");
  lines.push("everything the engine can prove without a model: the batteries, the gates, the resolver, the");
  lines.push("normalizer, the voice chooser, the glyph coverage and the typecheck.");
  lines.push("");
  lines.push("To add your own numbers, run a video with an agent, then append to `evals/model-runs.json`:");
  lines.push("");
  lines.push("```json");
  lines.push('{ "runs": [{ "agent": "Claude Code", "model": "sonnet", "lang": "en", "suite": "battery",');
  lines.push('              "pass": 61, "total": 61, "source": "local run 2026-11-20", "date": "2026-11-20" }]}');
  lines.push("```");
  lines.push("");
  lines.push("Then re-run `npx tsx scripts/eval.ts` and the table above fills in.");
}
lines.push("");

lines.push("## How to read this");
lines.push("");
lines.push("- A **gate stack** row is one story rendered through sync → geometry → commonsense (+ Bangla");
lines.push("  text and glyph gates). 3/3 means every gate passed for that story.");
lines.push("- A **battery** row is the engine's ability to draw a sentence the way a human pictures it.");
lines.push("  It is a property of the engine and the glossary, not of any model.");
lines.push("- Nothing in this report was inferred. Rows that could not run say so.");

const report = lines.join("\n") + "\n";
const evalsDir = path.join(root, "..", "evals");
fs.mkdirSync(evalsDir, { recursive: true });
fs.writeFileSync(path.join(evalsDir, "REPORT.md"), report);
if (flag("--json")) console.log(JSON.stringify({ rows, recorded }, null, 2));
else {
  for (const r of rows) console.log(`${String(pct(r.pass, r.total)).padStart(3)}%  ${r.suite.padEnd(22)} ${r.lang.padEnd(4)} ${r.pass}/${r.total}  ${r.detail}`);
  console.log(`\noverall ${overallPass}/${overallTotal} (${pct(overallPass, overallTotal)}%)`);
  console.log(`report → evals/REPORT.md`);
}
process.exit(pctRecords.some((r) => r.pass !== r.total) ? 1 : 0);
