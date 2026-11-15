/**
 * qa_sync — narration-to-visual synchronization validator (the V2 sync gate).
 *
 *   npx tsx scripts/qa_sync.ts stories/<file>.json [--lexicon <file.json>] [--map] [--strict]
 *
 * What it enforces (deterministic, no vision model needed):
 *   1. PLACE     — a named place in the narration (canyon, forest, bedroom, …) must match
 *                  the shot's world (3D location or 2D bg). Mismatch = ERROR.
 *   2. TIME      — "night" / "dawn" / "sunset" in the narration must match the shot's `time`.
 *   3. ACTION    — narration verbs (sleep, run, scream, wave, …) must be visible as a pose,
 *                  a beat, or camera/fx language. Sleep/lie = ERROR class; other verbs WARN.
 *   4. OBJECTS   — narrated key objects (phone, letter, gun, …) must be on screen (prop,
 *                  held item, or insert). WARN.
 *   5. DIALOGUE  — quoted lines in the narration need `quote` (an animated mouth). WARN.
 *   6. CONTINUITY- time-of-day jumps, prop persistence, actor teleports, and ≥3 identical
 *                  framing+camera shots in a row (repetition = slop). WARN.
 *
 * Exit code: 1 on any ERROR (or with --strict, on any WARN). Findings print per shot.
 * Extend per story with a sidecar lexicon (--lexicon): see templates/sync-map.md.
 * --map prints the full shot-by-shot sync contract table (paste into sync-map.md).
 */
import fs from "node:fs";
import path from "node:path";
import { StorySchema, type ResolvedShot, type Story } from "../src/schema";
import { buildTimeline } from "../src/timeline";
import { PROPS } from "../src/catalog";

type Lexicon = {
  place: Record<string, string[]>;
  objects: Record<string, string[]>;
  poses: Record<string, string[]>;
  time: Record<string, string[]>;
};

// ---------------------------------------------------------------- built-in lexicon
// place word -> acceptable location/bg ids (any-of)
const PLACE: Lexicon["place"] = {
  canyon: ["desert"], desert: ["desert", "western"], dunes: ["desert"],
  forest: ["forest"], woods: ["forest"], jungle: ["forest"],
  street: ["street", "city", "suburb", "western", "jp_street"], road: ["street", "suburb", "wheatbelt", "western"],
  city: ["city", "street", "office"], town: ["street", "suburb", "western"],
  bedroom: ["bedroom", "room_night", "room_warm", "jp_bedroom"], bed: ["bedroom", "room_night", "room_warm", "jp_bedroom"],
  kitchen: ["kitchen"], office: ["office"], classroom: ["classroom"], school: ["classroom", "jp_street"],
  lab: ["lab"], laboratory: ["lab"], courtroom: ["courtroom"], court: ["courtroom"],
  prison: ["prison", "cell"], jail: ["prison", "cell"],
  hospital: ["hospital"], saloon: ["bar", "western"], tavern: ["bar"],
  factory: ["factory"], store: ["store"], shop: ["store", "street"],
  stage: ["stage"], theater: ["stage"], theatre: ["stage"],
  space: ["space", "moon"], moon: ["moon", "space"],
  sea: ["sea", "shipdeck", "beach"], ocean: ["sea", "shipdeck", "beach"], ship: ["shipdeck", "sea"],
  beach: ["beach"], cave: ["cave"],
  mountain: ["mountain"], village: ["village_night", "village_dawn", "suburb", "street"],
  farm: ["farm", "wheatbelt"], field: ["field", "wheatbelt", "plains"], plains: ["plains", "field", "wheatbelt"],
  trench: ["trench"], battlefield: ["battlefield", "trench", "jp_heian_field"],
  garage: ["cell", "trench", "polar_cabin"], basement: ["cell", "cave"],
};
// object word -> prop ids accepted on screen (any-of)
const OBJECTS: Lexicon["objects"] = {
  phone: ["phone"], letter: ["letter", "paper", "card"], paper: ["paper", "letter", "document"],
  gun: ["gun", "machinegun"], rifle: ["gun", "machinegun"], machinegun: ["machinegun"],
  sword: ["sword"], shield: ["shield"], crown: ["crown"], key: ["key"], coin: ["coin", "coins", "money"],
  money: ["money", "moneybag", "coins", "cash"], book: ["book"], map: ["map"], clock: ["clock", "stopwatch", "watch"],
  bottle: ["bottle", "potion", "flask"], cup: ["cup", "mug"], flag: ["flag"], bomb: ["bomb", "dynamite"],
  torch: ["campfire", "lantern", "fire"], lantern: ["lantern"], candle: ["lantern", "campfire"],
  horse: ["horse"], dog: ["dog"], cat: ["cat"], bird: ["bird", "duck"], cow: ["cow"], pig: ["pig"],
  emu: ["emu"], laptop: ["laptop", "computer", "phone"], computer: ["computer", "laptop"],
  hammer: ["hammer"], wrench: ["wrench"], bucket: ["bucket"], barrel: ["barrel"], crate: ["crate", "box"],
  bed: ["bed"], desk: ["desk", "table"], table: ["table", "desk"], car: ["car", "truck"],
  boat: ["boat", "ship"], rocket: ["rocket"], trophy: ["trophy"], gem: ["gem", "diamond"],
  pizza: ["pizza", "food"], cake: ["cake", "food"], scissors: ["scissors"],
};
// action word -> acceptable actor states (pose or expression) / fx / insert
const POSES: Lexicon["poses"] = {
  sleep: ["lie", "sleepy"], asleep: ["lie", "sleepy"], sleeping: ["lie", "sleepy"], snoring: ["lie", "sleepy", "zzz"],
  lying: ["lie"], lyingdown: ["lie"], liedown: ["lie"],
  sit: ["sit"], sitting: ["sit"], sat: ["sit"],
  walk: ["walk", "moveTo"], walked: ["walk", "moveTo"], walking: ["walk", "moveTo"],
  run: ["run", "moveTo"], running: ["run", "moveTo"], ran: ["run", "moveTo"], chase: ["run", "moveTo"],
  scream: ["furious", "shocked", "scared", "armsUp", "bigtext", "exclaim"],
  screams: ["furious", "shocked", "scared", "armsUp", "bigtext", "exclaim"],
  shouting: ["furious", "shocked", "armsUp", "bigtext", "versus"],
  shout: ["furious", "shocked", "armsUp", "bigtext", "versus", "exclaim"],
  shouts: ["furious", "shocked", "armsUp", "bigtext", "versus", "exclaim"],
  yelled: ["furious", "shocked", "armsUp"], yell: ["furious", "shocked", "armsUp", "bigtext"],
  whisper: ["phone", "suspicious", "whisperfx"],
  laugh: ["laugh", "grin", "smug"], laughing: ["laugh", "grin"], laughs: ["laugh", "grin"],
  cry: ["sad"], crying: ["sad"], cried: ["sad"],
  wave: ["wave"], waving: ["wave"], waves: ["wave"],
  point: ["point"], pointed: ["point"], pointing: ["point"],
  shrug: ["shrug"], shrugged: ["shrug"], shrugging: ["shrug"],
  think: ["think", "suspicious", "determined", "worried"],
  realized: ["surprised", "shocked"], realizes: ["surprised", "shocked"], idea: ["surprised", "sparkle"],
  celebrate: ["armsUp", "happy", "confetti"], celebrating: ["armsUp", "happy", "confetti"],
  cower: ["cower", "scared"], cowering: ["cower", "scared"], hide: ["cower", "scared"],
  fight: ["push", "hammer", "angry", "furious"], fighting: ["push", "hammer", "angry", "furious"],
  punch: ["push"], hit: ["push"],
  swing: ["hammer", "reach"],
  carry: ["hold", "holdUp"], carrying: ["hold", "holdUp"], holds: ["hold", "holdUp", "reach"],
  grab: ["hold", "holdUp", "reach"], grabbed: ["hold", "holdUp", "reach"], picks: ["holdUp", "reach"],
  show: ["holdUp", "insert"], showing: ["holdUp", "insert"],
  type: ["type"], typing: ["type"],
  talk: ["talk", "quote"], talking: ["talk", "quote"],
  phonecall: ["phone"], calls: ["phone"], calling: ["phone"],
  cook: ["apronoutfit"], bake: ["apronoutfit"],
  drive: ["car", "carprop"], driving: ["car", "carprop"], drives: ["car", "carprop"],
};
// time word -> acceptable times (any-of)
const TIME: Lexicon["time"] = {
  night: ["night"], midnight: ["night"], nighttime: ["night"],
  dawn: ["dawn", "night"], sunrise: ["dawn", "sunset", "night"], morning: ["dawn", "day"],
  sunset: ["sunset", "dawn"], dusk: ["sunset", "night"], evening: ["sunset", "night"],
  daytime: ["day"], thatday: ["day"],
};
// words that license an intentional time jump
const TIME_JUMP_WORDS = /(later|that night|next (day|morning|week|year)|meanwhile|years? (later|passed)|suddenly|by then|eventually|now)/i;
// words that license a world change
const WORLD_JUMP_WORDS = /(meanwhile|elsewhere|back (at|in|home)|inside|outside|arrives|returned|moves to)/i;

const LEX: Lexicon = { place: PLACE, objects: OBJECTS, poses: POSES, time: TIME };

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
const NEGATIONS = new Set(["not", "no", "never", "don't", "doesn't", "didn't", "can't", "cannot", "won't", "isn't", "aren't", "without", "stop"]);
const wordsOf = (say: string) => new Set(say.split(/\s+/).map(norm).filter(Boolean));

/** true when `word` appears negated ("don't run") — an explicitly named non-action */
function negated(say: string, word: string): boolean {
  const toks = say.split(/\s+/).map(norm);
  for (let i = 1; i < toks.length; i++) {
    if (toks[i] === word && (NEGATIONS.has(toks[i - 1]) || (i > 1 && NEGATIONS.has(toks[i - 2])))) return true;
  }
  return false;
}

type Finding = { shot: number; sev: "ERROR" | "WARN"; kind: string; msg: string };

function checkShot(story: Story, s: ResolvedShot, i: number, lex: Lexicon): Finding[] {
  const out: Finding[] = [];
  const say = s.say === "…" ? "" : s.say;
  const words = wordsOf(say);
  const hit = (w: string) => [...words].some((t) => t === w || t.startsWith(w));
  const world = s.location ?? s.bg;
  const worldIs = (...ids: string[]) => ids.some((id) => world === id);
  const states = () => {
    const st = new Set<string>();
    for (const a of s.actors) { st.add(a.pose); st.add(a.expression); if (a.moveTo !== undefined) st.add("moveTo"); if (a.holding) st.add(a.holding); }
    for (const b of s.beatsResolved) { if (b.pose) st.add(b.pose); if (b.expression) st.add(b.expression); if (b.fx) st.add(b.fx); }
    for (const p of s.props) st.add(p.type);
    if (s.insert) st.add(s.insert.type);
    if (s.fx) s.fx.forEach((f) => st.add(`${f}fx`));
    if (s.quote) st.add("quote");
    return st;
  };
  const st = states();

  // 1. PLACE
  for (const [word, ok] of Object.entries(lex.place)) {
    if (!words.has(word)) continue;
    if (!worldIs(...ok) && !s.insert) {
      out.push({ shot: i, sev: "ERROR", kind: "PLACE", msg: `narration says "${word}" but the shot shows "${world}" (acceptable: ${ok.join(", ")})` });
    }
  }
  // 2. TIME
  for (const [word, ok] of Object.entries(lex.time)) {
    if (!words.has(word)) continue;
    if (!ok.includes(s.time)) {
      out.push({ shot: i, sev: "ERROR", kind: "TIME", msg: `narration says "${word}" but time is "${s.time}" (acceptable: ${ok.join(", ")})` });
    }
  }
  // 3. ACTION — sleep/lie is a hard ERROR (the canonical contradiction), the rest WARN
  const HARD_ACTIONS = new Set(["sleep", "asleep", "sleeping", "snoring", "lying"]);
  for (const [word, ok] of Object.entries(lex.poses)) {
    if (!words.has(word) || negated(say, word)) continue;
    const satisfied = ok.some((o) =>
      st.has(o) ||
      (o === "moveTo" && s.actors.some((a) => a.moveTo !== undefined)) ||
      (o === "quote" && !!s.quote) ||
      (o === "insert") ||
      (o === "car" && (s.props.some((p) => p.type === "car") || s.actors.some((a) => a.holding === "car"))));
    if (!satisfied) {
      out.push({
        shot: i, sev: HARD_ACTIONS.has(word) ? "ERROR" : "WARN",
        kind: "ACTION",
        msg: `narration says "${word}" but no actor pose/beat/prop shows it (shot has: ${[...st].filter((x) => x.length < 20).join(", ") || "nothing"}; expected one of: ${ok.join(", ")})`,
      });
    }
  }
  // 4. OBJECTS
  for (const [word, ok] of Object.entries(lex.objects)) {
    if (!words.has(word) || negated(say, word)) continue;
    const onScreen = ok.some((o) => st.has(o) || s.props.some((p) => p.type === o) || s.actors.some((a) => a.holding === o));
    if (!onScreen) {
      out.push({ shot: i, sev: "WARN", kind: "OBJECT", msg: `narration mentions "${word}" but no ${ok.join("/") } is visible (prop, held item or insert)` });
    }
  }
  // 5. DIALOGUE — an animated mouth must exist, unless the shot is an insert-only graphic
  if (/[“"'][^"”']{3,}["”']/.test(say) && !s.quote && s.actors.length > 0) {
    out.push({ shot: i, sev: "WARN", kind: "DIALOGUE", msg: "narration contains a quoted line but no `quote` actor (no animated mouth)" });
  }
  return out;
}

function checkContinuity(shots: ResolvedShot[]): Finding[] {
  const out: Finding[] = [];
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1], b = shots[i];
    const worldA = a.location ?? a.bg, worldB = b.location ?? b.bg;
    const license = TIME_JUMP_WORDS.test(a.say) || TIME_JUMP_WORDS.test(b.say) || WORLD_JUMP_WORDS.test(b.say);
    if (a.time !== b.time && !license && worldA === worldB) {
      out.push({ shot: i, sev: "WARN", kind: "TIME-JUMP", msg: `time jumps ${a.time} → ${b.time} with no transition word (add "later/that night/…" or a time word)` });
    }
    if (a.time === b.time && worldA === worldB) {
      for (const p of a.props) {
        if (!b.props.some((q) => q.type === p.type) && !WORLD_JUMP_WORDS.test(b.say)) {
          out.push({ shot: i, sev: "WARN", kind: "PROP-CONT", msg: `prop "${p.type}" was visible in shot ${i - 1} and is gone in shot ${i} of the same scene (restage it, or move the scene)` });
        }
      }
      for (const ab of a.actors) {
        const bb = b.actors.find((x) => x.id === ab.id);
        if (!bb) continue;
        const moved = ab.moveTo !== undefined || bb.moveTo !== undefined || ab.enter !== "none" || bb.enter !== "none" || ab.exit !== "none";
        if (!moved && Math.abs(ab.x - bb.x) > 0.45) {
          out.push({ shot: i, sev: "WARN", kind: "TELEPORT", msg: `actor "${ab.id}" jumps x ${ab.x.toFixed(2)} → ${bb.x.toFixed(2)} between consecutive shots (add moveTo/enter or a wider gap in the story)` });
        }
      }
    }
  }
  // repetition: ≥3 consecutive identical framing+camera
  let run = 1;
  for (let i = 1; i < shots.length; i++) {
    const same = shots[i].framing === shots[i - 1].framing && shots[i].camera === shots[i - 1].camera;
    run = same ? run + 1 : 1;
    if (run >= 3) out.push({ shot: i, sev: "WARN", kind: "REPETITION", msg: `shot ${i - 1}..${i} share framing "${shots[i].framing}" + camera "${shots[i].camera}" (≥3 in a row reads as slop — vary one)` });
  }
  return out;
}

// ---------------------------------------------------------------- sync contract map
function printMap(story: Story, shots: ResolvedShot[]) {
  const rows = shots.map((s, i) => {
    const actors = s.actors.map((a) => `${a.id}(${a.pose}/${a.expression}${a.holding ? `+${a.holding}` : ""})`).join(" ") || "—";
    const props = s.props.map((p) => p.type).join(",") || "—";
    const beats = s.beatsResolved.map((b) => `@${typeof b.at === "number" ? `${b.at}s` : b.at}:${[b.pose, b.expression, b.fx, b.sfx].filter(Boolean).join("+")}`).join(" ") || "—";
    const t0 = s.words[0]?.start ?? 0;
    return `| ${i} | ${t0.toFixed(1)}s | ${(s.say === "…" ? "(silent hold)" : s.say).slice(0, 60)} | ${s.location ?? s.bg}${s.time !== "day" ? `/${s.time}` : ""} | ${actors} | ${props} | ${s.framing}/${s.camera} | ${beats} |`;
  });
  console.log(`# Sync map — ${story.title}\n`);
  console.log("| # | t | narration | world | actors(pose/expr) | props | camera | beats |");
  console.log("|---|---|-----------|-------|-------------------|-------|--------|-------|");
  rows.forEach((r) => console.log(r));
  console.log(`\nPaste into stories/<slug>/sync-map.md and keep it updated with the storyboard.`);
}

// ---------------------------------------------------------------- main
const args = process.argv.slice(2);
const storyArg = args.find((a) => !a.startsWith("--"));
if (!storyArg) { console.error("usage: npx tsx scripts/qa_sync.ts stories/<file>.json [--lexicon f.json] [--map] [--strict]"); process.exit(2); }
const storyPath = path.resolve(storyArg);
const raw = JSON.parse(fs.readFileSync(storyPath, "utf8"));
const story = StorySchema.parse(raw);

// sidecar lexicon next to the story (or --lexicon): stories/<slug>/sync-lexicon.json
const lexPathArg = args.includes("--lexicon") ? args[args.indexOf("--lexicon") + 1] : undefined;
const lexPath = lexPathArg ?? path.join(path.dirname(storyPath), "sync-lexicon.json");
if (fs.existsSync(lexPath)) {
  const extra = JSON.parse(fs.readFileSync(lexPath, "utf8")) as Partial<Lexicon>;
  for (const k of ["place", "objects", "poses", "time"] as const)
    for (const [w, ok] of Object.entries(extra[k] ?? {})) LEX[k][w] = ok;
  console.log(`lexicon: +${Object.values(extra).reduce((n, m) => n + Object.keys(m ?? {}).length, 0)} story-specific entries (${path.relative(process.cwd(), lexPath)})`);
}

// timeline with estimated words: beats resolve, shots get word timings — no TTS needed
const shots = buildTimeline(story, null, null, null).shots;

if (args.includes("--map")) printMap(story, shots);

const findings = [
  ...shots.flatMap((s, i) => checkShot(story, s, i, LEX)),
  ...checkContinuity(shots),
];
findings.sort((a, b) => a.shot - b.shot || (a.sev === "ERROR" ? -1 : 1));
for (const f of findings) console.log(`${f.sev.padEnd(5)} shot ${String(f.shot).padStart(2)} [${f.kind}] ${f.msg}`);
const errors = findings.filter((f) => f.sev === "ERROR").length;
const warns = findings.length - errors;
console.log(`\n${story.shots.length} shots checked: ${errors} error(s), ${warns} warning(s)`);
if (errors > 0 || (args.includes("--strict") && warns > 0)) {
  console.log("FAIL — fix the narration↔visual contradictions (change the shot's world/time/pose/props, or rephrase the narration).");
  process.exit(1);
}
console.log("PASS — no narration↔visual contradictions detected by the lexicon gate.");
