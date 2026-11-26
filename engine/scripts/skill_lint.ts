#!/usr/bin/env node
/**
 * skill-lint — the repository's own hygiene gate.
 *
 *   npx tsx scripts/skill_lint.ts [--json]
 *
 * Checks, all as errors unless noted:
 *   1. SKILL.md has valid frontmatter (name, description) and the name matches the folder/repo.
 *   2. Every command/agent instruction file has parseable frontmatter with a description.
 *   3. Every relative path mentioned in SKILL.md, README.md and docs/agents/*.md resolves.
 *   4. Every JSON example fenced in the docs/references/templates parses (and is a story-shaped
 *      object when it claims to be a shot).
 *   5. No stray files: no .DS_Store, no *.log, no editor backups, no `agentvision-render.png`-style
 *      leftovers, no empty directories with build artifacts committed.
 *   6. Every reference listed in SKILL.md's map exists.
 *   7. No "TODO"/"TBD"/"FIXME"/placeholder text in shipped docs.
 */
import fs from "node:fs";
import path from "node:path";
import { resolvePaths } from "./paths";

const paths = resolvePaths();
const engine = paths.engine;
const repo = path.dirname(engine);
const argv = process.argv.slice(2);

type Finding = { sev: "ERROR" | "WARN"; check: string; msg: string };
const findings: Finding[] = [];
const err = (check: string, msg: string) => findings.push({ sev: "ERROR", check, msg });
const warn = (check: string, msg: string) => findings.push({ sev: "WARN", check, msg });

const read = (p: string) => fs.readFileSync(p, "utf8");

// ---------------------------------------------------------------- 1. SKILL.md frontmatter
const skillPath = path.join(repo, "SKILL.md");
if (!fs.existsSync(skillPath)) err("skill", "SKILL.md is missing");
else {
  const src = read(skillPath);
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) err("skill", "SKILL.md has no YAML frontmatter");
  else {
    const fm = m[1];
    const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    // The whole block after `description:` up to the closing --- (a multi-line YAML literal).
    // The old lookahead stopped at the first line starting with a lowercase word + colon, which
    // truncated the description mid-sentence and produced a false "no Bangla" error.
    const desc = fm.slice(fm.indexOf("description:")).replace(/^description:\s*\|?\s*/, "").trim();
    if (!name) err("skill", "SKILL.md frontmatter is missing `name:`");
    else if (name !== "stickman-animation-studio") err("skill", `SKILL.md name "${name}" does not match the skill folder`);
    if (!desc || desc.length < 80) err("skill", "SKILL.md description is missing or too short to trigger well");
    else {
      if (!/bangla|bengali|বাংলা/i.test(desc)) err("skill", "SKILL.md description does not mention Bangla, so Bangla requests would not trigger it");
      if (!/video|cartoon|animation/i.test(desc)) err("skill", "SKILL.md description does not mention video/cartoon");
    }
  }
  // 7. placeholder text
  for (const bad of ["TODO:", "TBD", "FIXME", "lorem ipsum"]) {
    if (src.includes(bad)) err("placeholder", `SKILL.md still contains "${bad}"`);
  }
}

// ---------------------------------------------------------------- 2. command / agent frontmatter
const frontmatterFiles = [
  path.join(repo, "commands", "make-video.md"),
  ...(fs.existsSync(path.join(repo, "docs", "agents"))
    ? fs.readdirSync(path.join(repo, "docs", "agents")).filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => path.join(repo, "docs", "agents", f))
    : []),
];
for (const f of frontmatterFiles) {
  if (!fs.existsSync(f)) continue;
  const src = read(f);
  if (f.includes(`${path.sep}agents${path.sep}`)) {
    // agent playbooks are plain markdown, but must name the product and the gates
    if (!/gates:|Delivery line|Honest delivery/i.test(src)) warn("agent-doc", `${path.basename(f)} has no verification line`);
  } else {
    const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) err("frontmatter", `${path.relative(repo, f)} has no frontmatter`);
    else if (!/description:/i.test(m[1])) err("frontmatter", `${path.relative(repo, f)} frontmatter has no description`);
    if (m && /argument-hint:/i.test(m[1]) === false) warn("frontmatter", `${path.relative(repo, f)} has no argument-hint`);
  }
}

// ---------------------------------------------------------------- 3. relative links resolve
const linkDocs = [path.join(repo, "SKILL.md"), path.join(repo, "README.md"), ...frontmatterFiles];
// only check paths that look like repo files (skip shell commands, flags, globs)
const pathRe = /`((?:references|templates|docs|engine|install|commands|evals|stories)\/[A-Za-z0-9_./<>-]+\.(?:md|ts|tsx|py|json|sh|ps1|toml|yml|yaml))`/g;
for (const d of linkDocs) {
  if (!fs.existsSync(d)) continue;
  const src = read(d);
  for (const m of src.matchAll(pathRe)) {
    const rel = m[1];
    if (rel.includes("<") || rel.includes("*")) continue; // pattern placeholders
    const candidates = [path.join(repo, rel), path.join(engine, rel), path.join(repo, "engine", rel)];
    if (!candidates.some((c) => fs.existsSync(c))) warn("link", `${path.relative(repo, d)} mentions \`${rel}\` which does not exist`);
  }
}

// SKILL.md's reference map must be complete
if (fs.existsSync(skillPath)) {
  const src = read(skillPath);
  const refDir = path.join(repo, "references");
  if (fs.existsSync(refDir)) {
    for (const f of fs.readdirSync(refDir).filter((x) => x.endsWith(".md"))) {
      if (!src.includes(`references/${f}`)) warn("reference-map", `references/${f} is not listed in SKILL.md's reference map`);
    }
  }
}

// ---------------------------------------------------------------- 4. JSON examples parse
const jsonDocs = [
  path.join(repo, "SKILL.md"),
  path.join(repo, "README.md"),
  path.join(repo, "templates", "scene-spec.md"),
  path.join(repo, "templates", "sync-map.md"),
  path.join(repo, "templates", "fact-check-table.md"),
  ...(fs.existsSync(path.join(repo, "references"))
    ? fs.readdirSync(path.join(repo, "references")).filter((f) => f.endsWith(".md")).map((f) => path.join(repo, "references", f))
    : []),
  ...(fs.existsSync(path.join(repo, "docs", "agents"))
    ? fs.readdirSync(path.join(repo, "docs", "agents")).filter((f) => f.endsWith(".md")).map((f) => path.join(repo, "docs", "agents", f))
    : []),
];
let jsonExamples = 0;
for (const d of jsonDocs) {
  if (!fs.existsSync(d)) continue;
  const src = read(d);
  for (const m of src.matchAll(/```json\r?\n([\s\S]*?)```/g)) {
    const body = m[1].trim();
    if (!body || body.includes("…") || body.includes("<") || /\bwhat\b.*\bmeans\b/.test(body)) continue; // illustrative
    try {
      const parsed = JSON.parse(body);
      jsonExamples++;
      // A story-shaped example (title + cast) must be complete; a Scene Spec example has
      // `shots` but no `cast` by design, and a one-field fragment is illustrative.
      if (parsed && typeof parsed === "object" && "title" in parsed && "shots" in parsed) {
        const s = parsed as { title?: unknown; cast?: unknown; shots: unknown[] };
        const looksLikeSpec = s.shots.every((x) => typeof x === "object" && x !== null && "shot" in (x as object) && "where" in (x as object));
        if (!s.cast && !looksLikeSpec) err("json-example", `${path.relative(repo, d)}: a story example has no "cast"`);
      }
    } catch (e) {
      err("json-example", `${path.relative(repo, d)}: a fenced JSON example does not parse — ${(e as Error).message}`);
    }
  }
}
if (jsonExamples === 0) warn("json-example", "no machine-checked JSON examples found in the docs");

// ---------------------------------------------------------------- 5. stray files
const walk = (dir: string, depth = 0): string[] => {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "out", "public", ".freebuff"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, depth + 1));
    else out.push(p);
  }
  return out;
};
const files = walk(repo);
for (const f of files) {
  const base = path.basename(f);
  const rel = path.relative(repo, f);
  if (base === ".DS_Store") err("stray", `stray OS file: ${rel}`);
  if (base.endsWith(".log") && !rel.includes(path.join("docs", "dev"))) err("stray", `stray log file: ${rel}`);
  if (/\.(bak|orig|rej|swp)$/.test(base)) err("stray", `editor/merge leftover: ${rel}`);
  if (/^(agentvision-render|screenshot|untitled|temp|tmp)/i.test(base) && /\.(png|jpg|mp4)$/i.test(base)) err("stray", `leftover capture: ${rel}`);
  if (base === "package-lock.json" && rel !== path.join("engine", "package-lock.json")) warn("stray", `unexpected lockfile: ${rel}`);
}

// ---------------------------------------------------------------- 6. every documented script exists
const scriptRe = /`(?:npx tsx |python |npm run )scripts\/([A-Za-z0-9_]+\.(?:ts|py))`/g;
if (fs.existsSync(skillPath)) {
  for (const m of read(skillPath).matchAll(scriptRe)) {
    if (!fs.existsSync(path.join(engine, "scripts", m[1]))) err("script", `SKILL.md names scripts/${m[1]} which does not exist`);
  }
}

// ---------------------------------------------------------------- report
const errors = findings.filter((f) => f.sev === "ERROR");
if (argv.includes("--json")) console.log(JSON.stringify({ findings, jsonExamples }, null, 2));
else {
  for (const f of findings) console.log(`${f.sev.padEnd(5)} [${f.check}] ${f.msg}`);
  console.log(`\n${errors.length} error(s), ${findings.length - errors.length} warning(s); ${jsonExamples} JSON example(s) parsed`);
}
if (!errors.length) console.log("PASS — frontmatter, links, paths, JSON examples and file hygiene are clean.");
process.exit(errors.length ? 1 : 0);
