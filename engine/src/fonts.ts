/**
 * Fonts — bundled, never fetched at render time.
 *
 * English captions use Montserrat from @remotion/google-fonts (Remotion caches it into the
 * bundle). Bangla needs fonts that carry Bengali conjuncts and matras, and the brief forbids a
 * CDN dependency at render time: `public/fonts/` ships the woff2 subsets, copied in at install
 * time by scripts/fetch_fonts.py (SIL OFL, see THIRD_PARTY.md).
 *
 * `ensureFonts()` awaits `document.fonts.load` for every family the video actually uses, and the
 * composition waits for it before the first frame — otherwise the opening frames render with a
 * fallback face and the text metrics shift mid-shot.
 */
import { staticFile } from "remotion";
import type { LangId } from "../lang";

export type FontSpec = { family: string; file: string; weight: string; unicodeRange?: string };

/** The Bangla families, in priority order, with their bundled files. */
export const BN_FONTS: FontSpec[] = [
  { family: "Noto Sans Bengali", file: "fonts/NotoSansBengali-bengali.woff2", weight: "400 900" },
  { family: "Noto Sans Bengali", file: "fonts/NotoSansBengali-latin.woff2", weight: "400 900" },
  { family: "Hind Siliguri", file: "fonts/HindSiliguri-bengali.woff2", weight: "400 700", unicodeRange: "U+0980-09FF" },
  { family: "Baloo Da 2", file: "fonts/BalooDa2-bengali.woff2", weight: "400 800", unicodeRange: "U+0980-09FF" },
];

const injected = new Set<string>();

/** Inject one @font-face rule per bundled file, once per page. */
const injectFaces = (specs: FontSpec[]) => {
  if (typeof document === "undefined") return;
  for (const s of specs) {
    const key = `${s.family}|${s.file}`;
    if (injected.has(key)) continue;
    const style = document.createElement("style");
    style.setAttribute("data-studio-font", key);
    style.textContent = `@font-face{font-family:"${s.family}";src:url("${staticFile(s.file)}") format("woff2");font-weight:${s.weight};font-style:normal;font-display:block;${
      s.unicodeRange ? `unicode-range:${s.unicodeRange};` : ""
    }}`;
    document.head.appendChild(style);
    injected.add(key);
  }
};

/**
 * Register the language's fonts and wait until they are actually usable.
 * Resolves when every family reports loaded (or after a bounded wait, so a corrupt file cannot
 * hang a render — the caller logs that case).
 */
export const ensureFonts = async (lang: LangId, timeoutMs = 8000): Promise<{ loaded: boolean; families: string[] }> => {
  if (lang !== "bn") return { loaded: true, families: ["Montserrat"] };
  injectFaces(BN_FONTS);
  const families = [...new Set(BN_FONTS.map((f) => f.family))];
  if (typeof document === "undefined" || !("fonts" in document)) return { loaded: true, families };
  const loads = families.map((f) => document.fonts.load(`900 40px "${f}"`).catch(() => []));
  const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), timeoutMs));
  const result = await Promise.race([Promise.all(loads).then(() => "ok" as const), timeout]);
  const ready = await document.fonts.ready;
  void ready;
  const ok = result === "ok" && families.every((f) => document.fonts.check(`900 40px "${f}"`));
  return { loaded: ok, families };
};

/** CSS font-family value for a language, with Latin fallbacks at the end. */
export const fontFamilyFor = (lang: LangId, latinFallback: string): string =>
  lang === "bn" ? `"Noto Sans Bengali", "Hind Siliguri", ${latinFallback}` : latinFallback;

/** A display face for big Bangla text (titles, inserts): Baloo Da 2 reads heavier. */
export const displayFamilyFor = (lang: LangId, latinFallback: string): string =>
  lang === "bn" ? `"Baloo Da 2", "Noto Sans Bengali", ${latinFallback}` : latinFallback;
