/**
 * resolve_language — decide the production language from the raw `/make-video` request.
 *
 *   npx tsx scripts/resolve_language.ts --text "Why does your phone get hot? in Bangla"
 *   npx tsx scripts/resolve_language.ts --text "…" --lang bn --voice female --json
 *
 * Output: { lang, voice_pref, evidence[], note? }
 *
 * Rules, in order of precedence:
 *   1. --lang flag wins over any wording.
 *   2. A negation ("not in Bangla", "English only", "no Bangla", "ইংরেজিতে") forces en.
 *   3. An explicit language request in English, Bangla script, or Banglish selects bn.
 *   4. Otherwise: en. If the topic itself is written in Bangla script, still en, with one
 *      visible note telling the user how to get Bangla (the owner's rule: explicit request only).
 *
 * A topic word alone never triggers Bangla: "a story about Bangla literature" stays English.
 */
import { DEFAULT_LANG, isLang, LANGS, DEFAULT_LANG as EN, type LangId } from "../lang";

export type VoicePref = "auto" | "male" | "female" | string;

export type Evidence = { rule: string; match: string; index: number };

export type Resolution = {
  lang: LangId;
  voice_pref: VoicePref;
  evidence: Evidence[];
  note?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// words that are a language REQUEST only when attached to a production verb/noun;
// a bare topic noun ("Bangla literature") must not trigger a switch.
// NOTE: "script" is deliberately absent — "the Bangla script" means the writing system.
const PRODUCTION_WORDS = [
  "narration", "narrate", "narrated", "voice", "voiceover", "voice-over", "audio", "video",
  "make", "do", "create", "produce", "render", "say", "speak", "spoken", "language", "in",
  "with", "using", "version", "te", "e", "banao", "koro", "korbo", "chai", "bolo",
  "ন্যারেশন", "ভয়েস", "ভয়েসে", "বানাও", "বানান", "করো", "করুন", "বলো", "ভাষায়", "ভাষা",
];

// A request written IN Bangla script that asks for the act of producing ("say it", "make it",
// "I want it") is a Bangla request — directing the voice in Bangla is as explicit as it gets.
const BN_INSTRUCTION = /(?:বলো|বলুন|বানাও|বানান|বানাবে|করো|করুন|করবে|চাই|দাও|দেখাও|শোনাও|ন্যারেট\s*করো)/u;

// explicit request patterns. Each: regex, rule name. Bangla script and Banglish included.
const REQUEST_PATTERNS: { re: RegExp; rule: string }[] = [
  // ---- English explicit requests
  { re: /\b(?:in|with|using|into)\s+(?:bangla|bengali)\b/i, rule: "en:in-bangla" },
  { re: /\b(?:bangla|bengali)\s+(?:narration|voice|voiceover|voice-over|audio|version|subtitles|captions|language)\b/i, rule: "en:bangla-production-noun" },
  { re: /\b(?:narration|voice|voiceover|audio|video|it|this|everything)\s+(?:in|into)\s+(?:bangla|bengali)\b/i, rule: "en:production-noun-in-bangla" },
  { re: /\b(?:make|do|create|produce|render|say|speak|narrate)\b[^.!?\n]{0,40}\b(?:bangla|bengali)\b/i, rule: "en:verb-bangla" },
  { re: /\b(?:bangla|bengali)\s*[- ]?\s*(?:te|e|ay|aay)\b[^.!?\n]{0,30}\b(?:banao|bana|koro|kor|chai|bolo|bol|karo|banao)\b/i, rule: "banglish:X-te-verb" },
  { re: /\b(?:bangla|bengali)\s+(?:bhashay|bhasha|bhashae|bhasay)\b/i, rule: "banglish:bangla-bhashay" },
  { re: /\b(?:bangla|bengali)\s+(?:te|e)\s+(?:banao|bana|koro|kor|chai|bolo|bol)\b/i, rule: "banglish:bangla-te-verb" },
  // ---- Bangla script explicit requests
  { re: /বাংলায়(?!\s*সাহিত্য|\s*ভাষা\s*আন্দোলন)/u, rule: "bn:বাংলায়" },
  { re: /বাংলা\s*ভাষায়/u, rule: "bn:বাংলা-ভাষায়" },
  { re: /বাংলা\s*(?:ন্যারেশন|ভয়েস|ভয়েসে|অডিও|ভিডিও|ভার্সন|স্ক্রিপ্ট)/u, rule: "bn:বাংলা-production-noun" },
  { re: /(?:ন্যারেশন|ভয়েস|ভয়েসে|অডিও|ভিডিও)\s*বাংলায়?/u, rule: "bn:production-noun-বাংলায়" },
  { re: /বাংলায়\s*(?:বানাও|বানান|করো|করুন|বলো|বলুন|বানাবে|করবে)/u, rule: "bn:বাংলায়-verb" },
  { re: /বাংলা\s*(?:ভাষা|ভাষায়)\s*(?:বানাও|করো|করুন|বলো)/u, rule: "bn:ভাষায়-verb" },
];

// ---- negations: force English, checked BEFORE requests
const NEGATION_PATTERNS: { re: RegExp; rule: string }[] = [
  { re: /\b(?:not|no|never|don'?t|dont|do not)\b[^.!?\n]{0,20}\b(?:in\s+)?(?:bangla|bengali)\b/i, rule: "neg:not-bangla" },
  { re: /\b(?:no|without)\s+(?:bangla|bengali)\b/i, rule: "neg:no-bangla" },
  { re: /\b(?:english\s+only|only\s+english|in\s+english|english\s+please|keep\s+it\s+english)\b/i, rule: "neg:english-only" },
  { re: /\b(?:bangla|bengali)\s+(?:no|not|noy|na)\b/i, rule: "banglish:bangla-na" },
  { re: /বাংলা\s*(?:নয়|না|চাই না|নেই)/u, rule: "bn:বাংলা-না" },
  { re: /(?:ইংরেজি|ইংরেজিতে|english)\s*(?:তেই|ই|only|e|তে)\s*(?:রাখো|রাখুন|করে|করো|করুন|দাও|chai)?/iu, rule: "bn:ইংরেজিতে" },
  // "in English, do it" — the language noun alone, in Bangla script, is a negation of Bangla
  { re: /ইংরেজিতে/u, rule: "bn:ইংরেজিতে-noun" },
];

// ---- topic-only guards: a Bangla noun after a topic preposition must not switch
const TOPIC_GUARD = /\b(?:about|of|on|history\s+of|story\s+of|documentary\s+about)\s+(?:the\s+)?(?:bangla|bengali)\b/i;
const TOPIC_FOLLOW = /^(?:\s*(?:literature|language|poets?|poetry|people|music|cuisine|food|cinema|film|art|history|movement|renaissance|grammar|alphabet|script|culture|festival|new\s+year|calendar|movies?|songs?|literary|nationalism|identity|books?|novels?|writers?|authors?)\b)/i;

/** Voice preference detection, everywhere except explicit ids (those come from --voice). */
const VOICE_PATTERNS: { re: RegExp; pref: "male" | "female"; rule: string }[] = [
  { re: /\b(?:female|woman|women'?s?|feminine|lady|girl'?s?)\s+(?:voice|narrator|narration|voiceover)\b/i, pref: "female", rule: "voice:female-en" },
  { re: /\b(?:voice|narrator|narration)\s+(?:of\s+a\s+)?(?:a\s+)?(?:female|woman|women|girl)\b/i, pref: "female", rule: "voice:female-en2" },
  { re: /\b(?:male|man'?s?|masculine|gentleman|boy'?s?)\s+(?:voice|narrator|narration|voiceover)\b/i, pref: "male", rule: "voice:male-en" },
  { re: /\b(?:voice|narrator|narration)\s+(?:of\s+a\s+)?(?:a\s+)?(?:male|man|boy)\b/i, pref: "male", rule: "voice:male-en2" },
  { re: /মহিলা\s*(?:কণ্ঠ|কণ্ঠে|ভয়েস|ভয়েসে|ন্যারেশন)/u, pref: "female", rule: "voice:মহিলা" },
  { re: /(?:কণ্ঠ|ভয়েস|ন্যারেশন)\s*মহিলা/u, pref: "female", rule: "voice:মহিলা2" },
  { re: /পুরুষ\s*(?:কণ্ঠ|কণ্ঠে|ভয়েস|ভয়েসে|ন্যারেশন)/u, pref: "male", rule: "voice:পুরুষ" },
  { re: /(?:কণ্ঠ|ভয়েস|ন্যারেশন)\s*পুরুষ/u, pref: "male", rule: "voice:পুরুষ2" },
  { re: /\b(?:male|man|purush|chele)\s*(?:kontho|konto|voice|kheye|voiceover)\b/i, pref: "male", rule: "voice:male-banglish" },
  { re: /\b(?:female|mohila|meye)\s*(?:kontho|konto|voice|voiceover)\b/i, pref: "female", rule: "voice:female-banglish" },
];

const BANGLA_SCRIPT = /[\u0980-\u09FF]/;
const LATIN_LETTER = /[A-Za-z]/;

export function resolveLanguage(input: { text?: string; flag?: string | null; voice?: string | null }): Resolution {
  const text = norm(input.text ?? "");
  const evidence: Evidence[] = [];

  // 0. might the user be writing the request in Bangla script at all?
  const hasBanglaScript = BANGLA_SCRIPT.test(input.text ?? "");
  const hasLatin = LATIN_LETTER.test(input.text ?? "");

  // voice preference first (independent of language)
  let voicePref: VoicePref = "auto";
  if (input.voice && input.voice.trim()) {
    voicePref = input.voice.trim();
    evidence.push({ rule: "flag:voice", match: input.voice.trim(), index: 0 });
  } else {
    for (const p of VOICE_PATTERNS) {
      const m = input.text?.match(p.re);
      if (m) {
        voicePref = p.pref;
        evidence.push({ rule: p.rule, match: m[0], index: m.index ?? 0 });
        break;
      }
    }
  }

  // 1. explicit --lang flag
  if (input.flag && input.flag.trim()) {
    const f = input.flag.trim().toLowerCase();
    if (!isLang(f)) {
      return {
        lang: EN,
        voice_pref: voicePref,
        evidence: [{ rule: "flag:lang-invalid", match: input.flag, index: 0 }],
        note: `--lang ${input.flag} is not one of ${LANGS.join(", ")} — produced in English (default).`,
      };
    }
    return { lang: f, voice_pref: voicePref, evidence: [...evidence, { rule: "flag:lang", match: f, index: 0 }] };
  }

  // 2. negations force English
  for (const p of NEGATION_PATTERNS) {
    const m = input.text?.match(p.re);
    if (m) {
      return {
        lang: "en",
        voice_pref: voicePref,
        evidence: [...evidence, { rule: p.rule, match: m[0], index: m.index ?? 0 }],
      };
    }
  }

  // 3. explicit requests
  for (const p of REQUEST_PATTERNS) {
    const m = input.text?.match(p.re);
    if (!m) continue;
    const idx = m.index ?? 0;
    // topic guard: "in Bangla literature" is a topic, not a language request
    const after = (input.text ?? "").slice(idx + m[0].length);
    if (TOPIC_FOLLOW.test(after) && !/\b(?:narration|voice|voiceover|video|audio|make|create|produce|render|narrate)\b/i.test(m[0])) continue;
    return {
      lang: "bn",
      voice_pref: voicePref,
      evidence: [...evidence, { rule: p.rule, match: m[0], index: idx }],
    };
  }

  // 4. default. If the whole request is Bangla script with a directive verb, that IS an explicit
  //    Bangla request (the user is instructing in Bangla). Otherwise stay en with a visible note.
  if (hasBanglaScript && BN_INSTRUCTION.test(input.text ?? "")) {
    return {
      lang: "bn",
      voice_pref: voicePref,
      evidence: [...evidence, { rule: "bn:instruction-verb", match: (input.text ?? "").match(BN_INSTRUCTION)![0], index: 0 }],
    };
  }
  if (hasBanglaScript && !hasLatin) {
    return {
      lang: DEFAULT_LANG,
      voice_pref: voicePref,
      evidence: [...evidence, { rule: "default:bangla-topic-only", match: "Bangla script in topic", index: 0 }],
      note: "Produced in English (default). Add 'in Bangla' to produce Bangla.",
    };
  }

  return { lang: DEFAULT_LANG, voice_pref: voicePref, evidence: [...evidence, { rule: "default:en", match: "", index: 0 }] };
}

// ---------------------------------------------------------------- CLI
const isCli = process.argv[1] && /resolve_language\.[tj]s$/.test(process.argv[1]);
if (isCli) {
  const argv = process.argv.slice(2);
  const opt = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const text = opt("--text") ?? argv.filter((a, i) => !a.startsWith("--") && !["--text", "--lang", "--voice"].includes(argv[i - 1] ?? "")).join(" ");
  const res = resolveLanguage({ text, flag: opt("--lang"), voice: opt("--voice") });
  if (argv.includes("--json") || true) console.log(JSON.stringify(res, null, 2));
  if (argv.includes("--print-lang")) process.stdout.write(res.lang);
}
