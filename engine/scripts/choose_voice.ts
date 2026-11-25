/**
 * choose_voice — pick the narrator voice from the topic when the user named none, and say why.
 *
 *   npx tsx scripts/choose_voice.ts --text "<topic>" --lang bn [--json]
 *   npx tsx scripts/choose_voice.ts --text "…" --pref female      # user preference wins
 *   npx tsx scripts/choose_voice.ts --text "…" --write stories/<slug>/voice-decision.md
 *
 * Precedence (highest first):
 *   1. an explicit user preference (--pref male|female|<voice-id>, or the resolver's voice_pref)
 *   2. a first-person story → the narrator matches the account's owner (--character male|female)
 *   3. tone + genre scoring from the topic text and the story's lines
 *   4. tie or no evidence → the language pack's default voice
 *
 * The scoring table is data (lang/<id>/voice-scoring.json) so it can be edited without code.
 * These are genre defaults, never claims about people.
 */
import fs from "node:fs";
import path from "node:path";
import { getPack, resolveVoice, type LangId, type VoiceGender } from "../lang";
import { resolvePaths } from "./paths";

export type ScoreBreakdownRow = { group: string; weight: number; evidence: string; matchedIn: "topic" | "script" };

export type VoiceChoice = {
  voice: string;
  gender: VoiceGender;
  locale: string;
  reason: string;
  source: "user" | "first-person" | "scored" | "default";
  score: { male: number; female: number };
  breakdown: ScoreBreakdownRow[];
};

type Scoring = {
  keywordGroups: { id: string; male: number; female: number; en: string[]; bn: string[] }[];
  firstPersonBonus: number;
};

const loadScoring = (lang: LangId): Scoring => {
  const p = path.join(resolvePaths().engine, "lang", lang, "voice-scoring.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as Scoring;
};

const norm = (s: string) => s.toLowerCase();

/** Every keyword hit in `text`, per group and gender-weight. */
export const scoreText = (lang: LangId, text: string): { male: number; female: number; rows: ScoreBreakdownRow[] } => {
  const table = loadScoring(lang);
  const hay = norm(text);
  let male = 0;
  let female = 0;
  const rows: ScoreBreakdownRow[] = [];
  for (const g of table.keywordGroups) {
    const words = [...(g.en ?? []), ...(g.bn ?? [])];
    const hits = words.filter((w) => w && hay.includes(norm(w)));
    if (!hits.length) continue;
    male += g.male;
    female += g.female;
    rows.push({ group: g.id, weight: g.male - g.female, evidence: hits.slice(0, 4).join(", "), matchedIn: "topic" });
  }
  return { male, female, rows };
};

const FIRST_PERSON = /\b(i|my|me|we|our)\b|আমি|আমার|আমরা|আমাদের/i;
const FEMALE_CHARACTER = /\b(mother|mom|mum|grandmother|grandma|sister|daughter|girl|woman|queen|princess|she|her)\b|মা|দাদি|নানি|বোন|মেয়ে|মহিলা|রানী|তিনি|তার/i;
const MALE_CHARACTER = /\b(father|dad|grandfather|grandpa|brother|son|boy|man|king|prince|he|his)\b|বাবা|দাদা|নানা|ভাই|ছেলে|পুরুষ|রাজা|রাজপুত্র|তিনি|তার/i;

export type ChooseInput = {
  text: string;
  lang: LangId;
  pref?: string; // from the resolver / --voice
  script?: string; // the story's narration, when already written
  character?: "male" | "female"; // the account's owner for a first-person story
};

export function chooseVoice(input: ChooseInput): VoiceChoice {
  const pack = getPack(input.lang);
  const defaultVoice = pack.tts.voices.find((v) => v.id === pack.tts.defaultVoice)!;

  const voiceChoice = (voice: string, source: VoiceChoice["source"], reason: string, score = { male: 0, female: 0 }, breakdown: ScoreBreakdownRow[] = []): VoiceChoice => {
    const v = pack.tts.voices.find((x) => x.id === voice) ?? defaultVoice;
    return { voice: v.id, gender: v.gender, locale: v.locale, reason, source, score, breakdown };
  };

  // 1. user preference wins, always
  const pref = (input.pref ?? "").trim();
  if (pref && pref !== "auto") {
    const id = resolveVoice(input.lang, pref);
    const v = pack.tts.voices.find((x) => x.id === id);
    return voiceChoice(id, "user", `the user asked for ${pref === id ? `this voice` : `a ${pref} voice`}`, undefined, []);
  }

  // 2. first-person account → follow the account's owner
  const text = `${input.text} ${input.script ?? ""}`;
  if (FIRST_PERSON.test(input.text)) {
    const implied = input.character ?? (FEMALE_CHARACTER.test(input.text) ? "female" : MALE_CHARACTER.test(input.text) ? "male" : undefined);
    if (implied) {
      const id = resolveVoice(input.lang, implied);
      return voiceChoice(id, "first-person", `first-person story told by a ${implied} character, so the narrator matches`, undefined, []);
    }
  }

  // 3. tone + genre scoring
  const { male, female, rows } = scoreText(input.lang, text);
  if (male !== female) {
    const winner: VoiceGender = male > female ? "male" : "female";
    const total = male + female;
    const confidence = Math.abs(male - female) / Math.max(1, total);
    const id = resolveVoice(input.lang, winner);
    const evidence = rows.map((r) => `${r.group} (${r.weight > 0 ? "+" : ""}${r.weight})`).join(", ");
    const weak = confidence < 0.25 ? " (weak margin — the pack default would be defensible)" : "";
    return voiceChoice(id, "scored", `the topic reads as ${winner}-leaning: ${evidence}${weak}`, { male, female }, rows);
  }

  // 4. tie or nothing → default, said plainly
  return voiceChoice(
    defaultVoice.id,
    "default",
    male === 0 && female === 0 ? "no genre signal in the topic — using the language default" : "tone signals cancel out — using the language default",
    { male, female },
    rows,
  );
}

/** The decision file the pipeline writes next to the story. */
export function decisionMarkdown(title: string, lang: LangId, c: VoiceChoice): string {
  const rows = c.breakdown.length
    ? c.breakdown.map((r) => `| ${r.group} | ${r.weight > 0 ? "+" : ""}${r.weight} | ${r.evidence} |`).join("\n")
    : "| _(none)_ | 0 | no genre keywords matched |";
  return `# Voice decision — ${title}

- **Language:** ${lang}
- **Voice:** \`${c.voice}\` (${c.gender}, ${c.locale})
- **Chosen by:** ${c.source}
- **Why:** ${c.reason}
- **Score:** male ${c.score.male} / female ${c.score.female}

| Signal group | Weight (male−female) | Evidence |
|---|---|---|
${rows}

Override any time with \`--voice male|female|<voice-id>\` or by setting \`"voice"\` in the story JSON.
The scoring table is data: \`lang/${lang}/voice-scoring.json\`.
`;
}

// ---------------------------------------------------------------- dialogue distinctness
export type Speaker = { id: string; voice?: string; rate?: string; gender?: VoiceGender };

/**
 * Two speakers in one video must not resolve to the same voice at the same rate — the audience
 * would hear one person talking to themselves. Same voice is acceptable only with a clearly
 * different rate; same gender needs a different voice or rate. Returns the violations, with the
 * fix in the message.
 */
export function checkDistinctSpeakers(lang: LangId, speakers: Speaker[], defaultRate: string): string[] {
  const problems: string[] = [];
  const pack = getPack(lang);
  const resolved = speakers.map((s) => ({
    id: s.id,
    voice: s.voice ?? pack.tts.defaultVoice,
    rate: s.rate ?? defaultRate,
    gender: s.gender ?? pack.tts.voices.find((v) => v.id === (s.voice ?? pack.tts.defaultVoice))?.gender ?? "female",
  }));
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i], b = resolved[j];
      const sameVoice = a.voice === b.voice;
      const rateGap = Math.abs(parseFloat(a.rate) - parseFloat(b.rate));
      if (sameVoice && !(rateGap >= 8)) {
        problems.push(
          `"${a.id}" and "${b.id}" both use ${a.voice} at ${a.rate} — give one of them another voice (${pack.tts.voices
            .filter((v) => v.gender === a.gender && v.id !== a.voice)
            .map((v) => v.id)
            .join(", ") || "none in this pack"}) or a rate at least 8% apart`,
        );
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------- CLI
const isCli = process.argv[1] && /choose_voice\.[tj]s$/.test(process.argv[1]);
if (isCli) {
  const argv = process.argv.slice(2);
  const opt = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const text = opt("--text") ?? "";
  const lang = (opt("--lang") ?? "en") as LangId;
  if (!text) {
    console.error('usage: npx tsx scripts/choose_voice.ts --text "<topic>" [--lang bn] [--pref auto|male|female|<id>] [--json] [--write <file>]');
    process.exit(2);
  }
  const choice = chooseVoice({ text, lang, pref: opt("--pref"), script: opt("--script"), character: opt("--character") as "male" | "female" | undefined });
  if (opt("--write")) {
    fs.mkdirSync(path.dirname(opt("--write")!), { recursive: true });
    fs.writeFileSync(opt("--write")!, decisionMarkdown(text.slice(0, 60), lang, choice));
  }
  if (argv.includes("--json")) console.log(JSON.stringify(choice, null, 2));
  else console.log(`${choice.voice} (${choice.gender}, ${choice.locale}) — ${choice.source}: ${choice.reason}`);
}
