/**
 * qa_gloss — the gloss-faithfulness gate (Bangla stories).
 *
 *   npx tsx scripts/qa_gloss.ts stories/<file>.json [--json]
 *
 * A Bangla shot carries `say` (what is spoken) and `gloss` (what it means, in plain English).
 * The Scene Spec, claim extraction and relation checks run on the gloss — so if the gloss drifts
 * from the Bangla, the picture is validated against a meaning the film does not carry.
 *
 * The check, in both directions:
 *   1. Every claim detected in the Bangla text (via lang/bn/sync-lexicon.json) must be present in
 *      the gloss. A Bangla sentence about rain with a gloss that never mentions rain is an ERROR.
 *   2. Every claim detected in the gloss must be present in the Bangla text. A gloss that invents
 *      a bed the narration never mentions is an ERROR — the spec would then demand a bed.
 *
 * Claims are canonical ids (`rain`, `bed`, `sit`, `other-room`, `empty`, …). The lexicon maps
 * Bangla words and English words onto the same ids, which is what makes the comparison possible.
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema } from "../src/schema";
import { resolvePaths, resolveStory } from "./paths";

export type Lexicon = { claims: Record<string, { bn: string[]; en: string[] }> };

export type Claim = { id: string; side: "say" | "gloss"; evidence: string };

export type GlossFinding = { shot: number; sev: "ERROR" | "WARN"; kind: string; msg: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\p{M}'\- ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const loadLexicon = (engine = resolvePaths().engine): Lexicon => {
  const p = path.join(engine, "lang", "bn", "sync-lexicon.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as Lexicon;
};

/**
 * Claims present in a piece of text.
 *
 * Matching is **whole-word** when the cue is short (≤4 characters) and substring when it is long
 * enough to be unambiguous. Substring matching alone produced real false positives: "বন্ধ"
 * (closed) inside "বন্ধু" (friend), and "চা" (tea) inside many unrelated words.
 */
export function claimsIn(text: string, lex: Lexicon, lang: "bn" | "en"): Claim[] {
  const t = norm(text);
  const padded = ` ${t} `;
  const hit = (cue: string): boolean => {
    const c = norm(cue);
    if (!c) return false;
    // short cues (and any Bangla cue under 4 chars) must be a whole word
    const whole = c.length <= 4 || (lang === "bn" && /[\u0980-\u09FF]/.test(c) && c.length <= 5);
    return whole ? padded.includes(` ${c} `) : t.includes(c);
  };
  const out: Claim[] = [];
  for (const [id, cues] of Object.entries(lex.claims)) {
    const banks = lang === "bn" ? [cues.bn ?? [], cues.en ?? []] : [cues.en ?? []];
    for (const bank of banks) {
      const cue = bank.find(hit);
      if (cue) {
        out.push({ id, side: lang === "bn" ? "say" : "gloss", evidence: cue });
        break;
      }
    }
  }
  return out;
}

export function checkGloss(storyFile: string, lex: Lexicon): { findings: GlossFinding[]; shots: number; glossed: number } {
  const story = StorySchema.parse(JSON.parse(fs.readFileSync(storyFile, "utf8")));
  const findings: GlossFinding[] = [];
  let glossed = 0;

  story.shots.forEach((shot, i) => {
    const n = i + 1;
    if (story.lang !== "bn") return;
    if (!shot.say || shot.say === "…") return;
    glossed++;
    if (!shot.gloss || !shot.gloss.trim()) {
      findings.push({ shot: n, sev: "ERROR", kind: "GLOSS-MISSING", msg: "no `gloss` — a Bangla shot must state its meaning in English for the spec and claim checks" });
      return;
    }
    const sayClaims = new Map(claimsIn(shot.say, lex, "bn").map((c) => [c.id, c]));
    const glossClaims = new Map(claimsIn(shot.gloss, lex, "en").map((c) => [c.id, c]));

    for (const [id, c] of sayClaims) {
      if (!glossClaims.has(id)) {
        findings.push({
          shot: n,
          sev: "ERROR",
          kind: "GLOSS-DRIFT",
          msg: `the Bangla says "${c.evidence}" (claim \`${id}\`) but the gloss never says it — the picture would be validated against a weaker meaning. Gloss: "${shot.gloss}"`,
        });
      }
    }
    for (const [id, c] of glossClaims) {
      if (!sayClaims.has(id)) {
        findings.push({
          shot: n,
          sev: "ERROR",
          kind: "GLOSS-INVENT",
          msg: `the gloss says "${c.evidence}" (claim \`${id}\`) but the Bangla does not — the spec would demand something the film never says. Bangla: "${shot.say}"`,
        });
      }
    }
  });

  // A Bangla story with no glosses at all is not a gloss failure, it is a missing meaning layer.
  if (story.lang === "bn" && glossed > 0 && story.shots.every((s) => !s.gloss)) {
    findings.push({ shot: 0, sev: "ERROR", kind: "GLOSS-NONE", msg: "this Bangla story has no `gloss` on any shot — write one per spoken shot from references/12-bangla-voice-and-script.md" });
  }

  return { findings, shots: story.shots.length, glossed };
}

// ---------------------------------------------------------------- CLI
const isCli = process.argv[1] && /qa_gloss\.[tj]s$/.test(process.argv[1]);
if (isCli) {
  const argv = process.argv.slice(2);
  const storyArg = argv.find((a) => !a.startsWith("--"));
  if (!storyArg) {
    console.error("usage: npx tsx scripts/qa_gloss.ts stories/<file>.json [--json]");
    process.exit(2);
  }
  const paths = resolvePaths();
  const file = resolveStory(storyArg, paths);
  const { findings, shots, glossed } = checkGloss(file, loadLexicon(paths.engine));
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ file, shots, glossed, findings }, null, 2));
  } else {
    findings.sort((a, b) => a.shot - b.shot);
    for (const f of findings) console.log(`${f.sev.padEnd(5)} shot ${String(f.shot).padStart(2)} [${f.kind}] ${f.msg}`);
    const errors = findings.filter((f) => f.sev === "ERROR").length;
    console.log(`\n${path.basename(file)}: ${shots} shots, ${glossed} glossed — ${errors} gloss error(s)`);
  }
  const errors = findings.filter((f) => f.sev === "ERROR").length;
  if (errors > 0) {
    console.log("FAIL — make the Bangla narration and the English gloss carry the same claims.");
    process.exit(1);
  }
  console.log("PASS — every Bangla claim is in the gloss, and the gloss invents nothing.");
}
