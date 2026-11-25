/**
 * Language packs — everything that differs between production languages lives in data.
 *
 * Adding a language later must be a data task: write `lang/<id>/pack.json`, add its id to
 * ENABLED_LANGS, and the pipeline (resolver, TTS, captions, fonts, budgets, QA rules) picks it up.
 * Nothing English-specific may be hard-coded outside `lang/en/`.
 */

export type LangId = "en" | "bn";

export type VoiceGender = "male" | "female";

export type VoiceRef = {
  id: string; // exact edge-tts voice name, e.g. "bn-BD-PradeepNeural"
  gender: VoiceGender;
  locale: string; // "bn-BD" | "bn-IN" | "en-US" …
  tone: string[]; // free tags: "warm", "authority", "bright", "calm" …
  rate: string; // default rate for this voice ("+22%" style for edge)
  pitch: string; // default pitch ("+0Hz")
};

export type WordBudget = {
  /** target narration words for a video of `seconds` (measured on the real voices) */
  seconds: number;
  words: number;
};

export type CaptionLayout = {
  /** CSS font-family stack, in priority order. Latin fonts listed last as a visual fallback. */
  fontStack: string[];
  /** which locally bundled webfont family to preload before the first frame */
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** extra line gap needed by the script's ascenders/descenders (matras, conjuncts) */
  top: number;
  width: number;
  /** word-level highlight behaviour: "none" (whole chunk) or "current-word" */
  highlight: "none" | "current-word";
  /** never letter-space a complex script; the engine asserts this is 0 for bn */
  letterSpacing: number;
  /** use Bangla digits (০–৯) in inserts by default */
  digits: "western" | "bengali";
};

export type RateModel = {
  /** measured words per second of audio at the default rate */
  wordsPerSecond: number;
  /** measured characters per second, for scripts with long words */
  charsPerSecond: number;
  /** average pause after a sentence end, seconds */
  sentencePause: number;
  /** average pause after a clause comma, seconds */
  clausePause: number;
  /** where these numbers came from (voice + rate + sample size) */
  measuredWith: string;
};

export type LanguagePack = {
  id: LangId;
  displayName: string;
  /** the language name as its own speakers write it, for UI/report lines */
  nativeName: string;

  tts: {
    provider: "edge" | "kokoro";
    /** default voice when the user asks for neither gender nor a specific voice */
    defaultVoice: string;
    /** order to try when the default voice fails (429/403/NoAudioReceived) */
    fallback: string[];
    voices: VoiceRef[];
  };

  normalizer: {
    /** which normalizer the Python TTS stage applies */
    id: "en-basic" | "bn-full";
    /** pronunciation dictionary path relative to the engine root, if any */
    pronunciation?: string;
  };

  captions: CaptionLayout;

  /** path (relative to engine/) of the language's sync lexicon, if it has one */
  syncLexicon?: string;
  /** path to the script-craft reference for this language */
  scriptCraft: string;
  /** path to the voice-direction reference for this language */
  voiceDirection: string;
  /** path to the commonsense intent glossary for this language */
  intentGlossary: string;
  /** gloss-faithfulness checking applies (bn: `say` must match `gloss`) */
  requiresGloss: boolean;

  /** narration length budget per target video length, measured on the real voices */
  wordBudget: WordBudget[];
  rates: RateModel;

  /** QA rules that differ per script system */
  qa: {
    /** fail if any bundled font lacks a codepoint used in the story */
    glyphCoverage: boolean;
    /** fail on stray Latin text unless explicitly allowed (brands) */
    latinPolicy: "allow" | "warn" | "fail";
    /** timing audit limits the language must meet */
    timingMedianMs: number;
    timingMaxMs: number;
    /** audio gate loudness target stays shared; only voice-presence tuning differs */
    voicePresenceThreshold: number;
  };
};
