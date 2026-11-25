import { z } from "zod";
import {
  BACKGROUNDS, BUILDS, CAMERA_MOVES, EXPRESSIONS, FRAMINGS, FX, HAIR, HATS, INSERTS, MUSIC, OUTFITS, POSES, PROPS, SFX,
  TIMES, TRANSITIONS,
} from "./catalog";
import type { LocationData, Objects } from "./location3d/schema";
import { DEFAULT_LANG, getPack, LANGS, type LangId } from "../lang";

const color = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "hex color like #f2b632");

// ------------------------------------------------------------ narration routing
// Two production languages, both built in: `en` (default, unchanged V3 behaviour) and `bn`.
// edge-tts (free Microsoft neural voices, with per-word timestamps that time every shot) is
// the default for both; Kokoro (local ONNX, English voices) stays the offline fallback.
// Voice catalogs, default voice and default rate live in lang/<id>/pack.json — never here.
export const NARRATION_PROVIDERS = ["edge", "kokoro"] as const;
export type NarrationProvider = (typeof NARRATION_PROVIDERS)[number];
export const PROVIDER_VOICES: Record<NarrationProvider, string> = {
  edge: getPack("en").tts.defaultVoice,
  kokoro: "am_michael",
};

// spoken or displayed words attached to a shot, e.g. a whispered voice or a note shown
// as on-screen text, never spoken by the narrator
export const CallSchema = z.object({
  text: z.string().min(1).describe("English text of the call; rendered as flickering on-screen text, never narrated"),
  at: z.union([z.string(), z.number()]).optional().describe("when in this shot: a word from `say` or seconds from shot start"),
  whispered: z.boolean().default(true).describe("play the whisper sfx with the call"),
});

export type Call = z.infer<typeof CallSchema>;

export const CharacterSchema = z.object({
  name: z.string().optional(),
  color: color.describe("main outfit color"),
  outfit: z.enum(OUTFITS).default("shirt"),
  hair: z.enum(HAIR).default("short"),
  hairColor: color.default("#8a4b24"),
  hat: z.enum(HATS).default("none"),
  hatColor: color.optional(),
  skin: color.default("#ffffff"),
  tie: color.optional(),
  bowtie: color.optional(),
  badge: z.boolean().default(false),
  mustache: z.boolean().default(false),
  beard: z.boolean().default(false),
  glasses: z.enum(["none", "round", "square", "sunglasses"]).default("none"),
  build: z.enum(BUILDS).default("normal"),
  lashes: z.boolean().default(false),
  mask: z.boolean().default(false).describe("white surgical mask over the mouth; the expression mouth is hidden"),
  hairOverFace: z.boolean().default(false).describe("long hair falls forward and covers the whole face"),
  backpack: z.boolean().default(false).describe("a school satchel worn on the back (see backpackColor)"),
  backpackColor: color.default("#b3202a"),
  // ---------- character voice (dialogue) ----------
  // The narrator uses the story's `voice`. A character with lines gets this voice instead, so a
  // two-person conversation sounds like two people. Same-gender characters must differ in voice
  // or rate (checked by scripts/choose_voice.ts::checkDistinctSpeakers).
  voice: z.string().optional().describe("explicit edge-tts voice id for this character's spoken lines"),
  voiceRate: z
    .string()
    .regex(/^[+-]\d{1,2}%$/, "rate like +6%")
    .optional()
    .describe("rate override for this character (within ±30% of normal to stay natural)"),
  voicePitch: z.string().regex(/^[+-]\d{1,3}Hz$/, "pitch like +2Hz").optional().describe("pitch override for this character"),
});

const at = z.union([z.string(), z.number()]).describe(
  "when: a word from this shot's `say` text (first match), or seconds from shot start",
);

export const ActorSchema = z.object({
  id: z.string().describe("key in story.cast"),
  x: z.number().min(-0.5).max(1.5).default(0.5).describe("0=left edge, 1=right edge"),
  z: z.number().min(0).max(1).default(0.45).describe("0=far (back wall), 1=near camera"),
  pose: z.enum(POSES).default("stand").describe("low-level pose. Prefer `action` — the engine places the body on the prop for you"),
  // Semantic action layer: say WHAT happens, the engine resolves WHERE the body goes,
  // which anchor it touches and how it is layered. See references/05-storyboard-craft.md.
  action: z
    .enum(["none", "sitOn", "lieOn", "sleepOn", "standAt", "hold", "use", "face", "pointAt", "react", "handOver"])
    .default("none")
    .describe("high-level action resolved onto a prop's anchors; overrides pose/x/z where it applies"),
  on: z.string().optional().describe("the prop this action uses: a prop type in this shot (\"chair\") or \"prop:1\""),
  underBlanket: z.boolean().default(false).describe("sleeping: draw the bed's blanket over the body"),
  inside: z.boolean().default(false).describe("driving/riding: draw the body behind the vehicle body so only the upper body shows"),
  expression: z.enum(EXPRESSIONS).default("neutral"),
  facing: z.enum(["left", "right", "front"]).default("front"),
  holding: z.enum(PROPS).optional().describe("prop drawn in the actor's hand"),
  holdingLabel: z.string().optional(),
  heldHand: z.enum(["her-right", "her-left"]).default("her-left").describe(
    "which of the character's own hands holds the prop; a character facing the camera shows her right hand on the viewer's left",
  ),
  talking: z.boolean().optional().describe("mouth flaps; default true for the shot's focus actor if it has a quote"),
  enter: z.enum(["none", "left", "right", "pop", "drop", "fade"]).default("none"),
  exit: z.enum(["none", "left", "right", "fade"]).default("none"),
  moveTo: z.number().optional().describe("x to walk to over the shot"),
  scale: z.number().default(1),
  flip: z.boolean().default(false).describe("upside down / tumbling"),
});

export const PropSchema = z.object({
  type: z.string().describe("a 2D prop from catalog.ts, or a 3D object from locations/_objects.json. Checked by scripts/make.ts"),
  x: z.number().default(0.5),
  z: z.number().min(0).max(1).default(0.45),
  y: z.number().optional().describe("lift above floor in px (e.g. on a table: 230)"),
  scale: z.number().default(1),
  rotate: z.number().default(0),
  color: color.optional(),
  label: z.string().optional().describe("text printed on the prop (signs, boards, cards, screens, boxes)"),
  glow: z.boolean().default(false),
  enter: z.enum(["none", "pop", "drop", "fade", "left", "right"]).default("none"),
  float: z.boolean().default(false),
  count: z.number().int().min(1).max(40).default(1).describe("repeat the prop in a row/pile"),
  open: z.number().min(0).max(1).default(0).describe("how open this prop is (a sliding door, a lid); 0 = closed"),
  lit: z.number().min(0).max(1).default(1).describe("light level of the prop (a street lamp): 1 = on, 0 = dead"),
});

export const BeatSchema = z.object({
  at,
  actor: z.string().optional().describe("actor id; default = first actor"),
  pose: z.enum(POSES).optional(),
  expression: z.enum(EXPRESSIONS).optional(),
  fx: z.enum(FX).optional(),
  sfx: z.enum(SFX).optional(),
  zoom: z.number().optional().describe("punch the camera zoom by this factor, e.g. 1.25"),
  prop: z.number().optional().describe("index into this shot's props — the prop a propOpen beat drives"),
  propOpen: z.number().min(0).max(1).optional().describe("new open value for that prop (0 = closed, 1 = fully open)"),
  propLit: z.number().min(0).max(1).optional().describe("new light level for that prop (0 = off, 1 = fully lit)"),
});

export const InsertSchema = z.object({
  type: z.enum(INSERTS),
  title: z.string().optional(),
  lines: z.array(z.string()).default([]),
  value: z.number().optional().describe("counter: end value"),
  from: z.number().optional().describe("counter: start value"),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  data: z.array(z.number()).default([]).describe("chart bars"),
  highlight: z.number().int().optional().describe("index of line/bar to highlight"),
  color: color.optional(),
});

export const ShotSchema = z.object({
  say: z.union([z.string().min(1), z.literal("…")]).describe("narration spoken during this shot, or \"…\" for a fully silent shot"),
  gloss: z
    .string()
    .optional()
    .describe("English gloss of `say` — REQUIRED for Bangla stories; the scene spec, claims and relation checks run on it"),
  call: CallSchema.optional().describe("an on-screen call — flickering text + whisper, never narrated"),
  bg: z.enum(BACKGROUNDS).default("void").describe("2D background; ignored when location is set"),
  location: z.string().optional().describe("a 3D location: the name of a file in locations/"),
  time: z.enum(TIMES).default("day"),
  tint: color.optional().describe("overall color grade tint for the scene (e.g. #ff4fa8 for a pink room)"),
  wall: color.optional().describe("override wall color for interiors"),
  actors: z.array(ActorSchema).default([]),
  props: z.array(PropSchema).default([]),
  framing: z.enum(FRAMINGS).default("medium"),
  focus: z.string().optional().describe("actor id or 'prop:N' (index in props) the camera frames"),
  camera: z.enum(CAMERA_MOVES).default("pushIn"),
  fx: z.array(z.enum(FX)).default([]),
  beats: z.array(BeatSchema).default([]),
  sfx: z.array(z.enum(SFX)).default([]).describe("sounds at shot start"),
  insert: InsertSchema.optional().describe("full-screen graphic instead of/over the scene"),
  transition: z.enum(TRANSITIONS).default("dissolve").describe("how this shot enters"),
  quote: z.string().optional().describe("actor id who is speaking a quoted line in this shot (gets talking mouth)"),
});

export type ResolvedStory = {
  title: string;
  lang: LangId;
  provider: NarrationProvider;
  voice: string;
  rate: string;
  music: (typeof MUSIC)[number];
  mix: { music: number; sfx: number; duck: number; autoSfx: boolean };
  intentExempt: { shot: number; id: string; reason: string }[];
  cast: Record<string, Character>;
  shots: Shot[];
};

export const StorySchema = z
  .object({
    title: z.string(),
    lang: z.enum(LANGS as [LangId, ...LangId[]]).default(DEFAULT_LANG).describe(
      "production language: en (default) or bn. Set by scripts/resolve_language.ts from the user's request",
    ),
    provider: z.enum(NARRATION_PROVIDERS).optional().describe("tts backend; default edge (edge-tts). kokoro = offline fallback"),
    voice: z.string().optional().describe("explicit edge-tts voice id; default = the language pack's default voice"),
    rate: z.string().optional().describe("edge-tts rate like +22%; default per provider (kokoro: speed multiplier)"),
    music: z.enum(MUSIC).default("curious"),
    mix: z.object({
      music: z.number().min(0).max(1).default(0.14).describe("music bed level"),
      sfx: z.number().min(0).max(1).default(0.22).describe("sound-effect level"),
      duck: z.number().min(0).max(1).default(0.35).describe("how far music+sfx drop while someone speaks (1 = fully muted)"),
      autoSfx: z.boolean().default(true).describe("auto transition/beat sound effects; turn off for sparse horror mixes"),
    }).default({}),
    cast: z.record(z.string(), CharacterSchema),
    shots: z.array(ShotSchema).min(1),
    // A metaphor can trip the commonsense glossary: "his phone goes from cool to cooking"
    // matches the kitchen intent. Exempt it explicitly, per shot, with a reason — never silently.
    intentExempt: z
      .array(
        z.object({
          shot: z.number().int().min(1).describe("1-based shot index"),
          id: z.string().describe("glossary entry id, e.g. use-cooking"),
          reason: z.string().min(4).describe('why this phrase is not literal, e.g. "metaphor: the phone heats up"'),
        }),
      )
      .default([])
      .describe("explicit, reasoned exemptions from commonsense glossary entries"),
  })
  .transform((s): ResolvedStory => {
    const provider: NarrationProvider = s.provider ?? "edge";
    const lang: LangId = s.lang ?? DEFAULT_LANG;
    const pack = getPack(lang);
    // The default voice and rate follow the language pack; explicit values always win.
    const defaultVoice = provider === "kokoro" ? PROVIDER_VOICES.kokoro : pack.tts.defaultVoice;
    const defaultRate = pack.tts.voices.find((v) => v.id === pack.tts.defaultVoice)?.rate ?? "+22%";
    // Kokoro takes a speed multiplier, not a percentage; edge takes a percentage.
    const rate = provider === "kokoro" && (s.rate ?? defaultRate) === "+22%" ? "0.82" : s.rate ?? defaultRate;
    return { ...s, lang, provider, rate, voice: s.voice ?? defaultVoice };
  });

export type Story = ResolvedStory;
// Per-field partial: keep the optionals optional, but never allow unknown shapes —
// `z.input` on the (untransformed) object is no longer available after `.transform`, so
// spell the input type out from the object definition.
const STORY_INPUT_KEYS = z.object({
  title: z.string(),
  lang: z.enum(LANGS as [LangId, ...LangId[]]).optional(),
  provider: z.enum(NARRATION_PROVIDERS).optional(),
  voice: z.string().optional(),
  rate: z.string().optional(),
  music: z.enum(MUSIC).optional(),
  mix: z.object({
    music: z.number().min(0).max(1).optional(),
    sfx: z.number().min(0).max(1).optional(),
    duck: z.number().min(0).max(1).optional(),
    autoSfx: z.boolean().optional(),
  }).optional(),
  cast: z.record(z.string(), CharacterSchema),
  shots: z.array(ShotSchema).min(1),
  intentExempt: z.array(z.object({ shot: z.number().int().min(1), id: z.string(), reason: z.string().min(4) })).optional(),
});
export type StoryInput = z.input<typeof STORY_INPUT_KEYS>;
export type Actor = z.infer<typeof ActorSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type PropSpec = z.infer<typeof PropSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Insert = z.infer<typeof InsertSchema>;

// ---------- resolved timeline (produced by scripts/make.ts, consumed by the composition) ----------
export type Word = { text: string; start: number; end: number }; // seconds, absolute

export type ResolvedBeat = Beat & { frame: number }; // frame relative to shot start

export type ResolvedShot = Shot & {
  from: number; // absolute start frame
  duration: number; // frames (not including dissolve overlap)
  words: Word[];
  beatsResolved: ResolvedBeat[];
  callFrame: number; // frame within the shot when `call` appears (0 when the shot has no call)
  index: number;
};

export type SfxCue = { name: string; frame: number; volume: number };

export type Timeline = {
  story: Story;
  fps: number;
  durationInFrames: number;
  voiceSrc: string | null; // path under public/
  musicSrc: string | null;
  words: Word[];
  shots: ResolvedShot[];
  sfx: SfxCue[];
  locations?: Record<string, LocationData>; // only the 3D locations this story uses
  objects?: Objects;
};
