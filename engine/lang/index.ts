/**
 * The language registry — the only place that knows which packs exist.
 *
 *   import { getPack, LANGS, isLang } from "../lang";
 *   const pack = getPack("bn");
 *   pack.tts.defaultVoice  // "bn-BD-NabanitaNeural"
 *
 * Packs are plain JSON so the Python side (scripts/resolve_language.py, tts_bn.py) can read the
 * same data without a TS runtime. English stays the default everywhere.
 */
import en from "./en/pack.json";
import bn from "./bn/pack.json";
import type { LangId, LanguagePack, VoiceGender, VoiceRef } from "./types";

export type { LangId, LanguagePack, VoiceGender, VoiceRef } from "./types";

const PACKS: Record<LangId, LanguagePack> = {
  en: en as LanguagePack,
  bn: bn as LanguagePack,
};

export const LANGS: readonly LangId[] = ["en", "bn"] as const;
export const DEFAULT_LANG: LangId = "en";

export const isLang = (v: unknown): v is LangId => typeof v === "string" && (LANGS as readonly string[]).includes(v);

export const getPack = (lang: LangId = DEFAULT_LANG): LanguagePack => {
  const pack = PACKS[lang];
  if (!pack) throw new Error(`no language pack for "${lang}" — enabled: ${LANGS.join(", ")}`);
  return pack;
};

/** Voice entries for a language, optionally the ones matching a gender. */
export const voicesOf = (lang: LangId, gender?: VoiceGender): VoiceRef[] =>
  getPack(lang).tts.voices.filter((v) => !gender || v.gender === gender);

/** All enabled packs (for docs/tables generated from code). */
export const allPacks = (): LanguagePack[] => LANGS.map((l) => PACKS[l]);

/**
 * Map a voice preference to a concrete voice id.
 * - "auto"       → the language's default voice
 * - "male"/"female" → the first voice of that gender, preferring the default locale
 * - anything else is treated as an explicit voice id (validated against the catalog by callers)
 */
export const resolveVoice = (lang: LangId, pref: string = "auto"): string => {
  const pack = getPack(lang);
  if (pref === "auto" || !pref) return pack.tts.defaultVoice;
  if (pref !== "male" && pref !== "female") return pref;
  const def = pack.tts.voices.find((v) => v.id === pack.tts.defaultVoice);
  const sameLocale = pack.tts.voices.filter((v) => v.gender === pref && v.locale === def?.locale);
  const anyLocale = pack.tts.voices.filter((v) => v.gender === pref);
  return (sameLocale[0] ?? anyLocale[0] ?? pack.tts.voices[0]).id;
};

/** Word budget for a target duration: exact hit, else linear interpolation, else nearest. */
export const wordsForSeconds = (lang: LangId, seconds: number): number => {
  const table = [...getPack(lang).wordBudget].sort((a, b) => a.seconds - b.seconds);
  const exact = table.find((b) => b.seconds === seconds);
  if (exact) return exact.words;
  if (seconds <= table[0].seconds) return table[0].words;
  if (seconds >= table[table.length - 1].seconds) return table[table.length - 1].words;
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (seconds > a.seconds && seconds < b.seconds) {
      const t = (seconds - a.seconds) / (b.seconds - a.seconds);
      return Math.round(a.words + t * (b.words - a.words));
    }
  }
  return table[0].words;
};

/** Seconds of narration a script of `words` should take at the pack's measured rate. */
export const secondsForWords = (lang: LangId, words: number): number =>
  Math.round((words / getPack(lang).rates.wordsPerSecond) * 10) / 10;
