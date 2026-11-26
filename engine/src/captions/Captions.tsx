import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import type { Word } from "../schema";
import { clamp } from "../theme";
import { getPack, type LangId } from "../../lang";
import { fontFamilyFor } from "../fonts";

const { fontFamily } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin"] });
export const CAPTION_FONT = fontFamily;

// Group words into short chunks like the references: 1-3 words, max ~14 chars,
// break after punctuation so a sentence end never shares a chunk with the next sentence.
// Bangla uses wider limits: its words are long, and a 14-char limit would split sentences into
// fragments too small to read (measured on the Bangla scripts in stories/tests).
export const chunkWords = (words: Word[], lang: LangId = "en") => {
  const bn = lang === "bn";
  const maxWords = bn ? 3 : 3;
  const maxChars = bn ? 24 : 14;
  const chunks: { text: string; start: number; end: number }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    chunks.push({ text: cur.map((w) => w.text).join(" "), start: cur[0].start, end: cur[cur.length - 1].end });
    cur = [];
  };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) flush();
    cur.push(w);
    // sentence end → flush (also long words get their own beat)
    if (/[.,!?;:।]/.test(w.text.slice(-1)) || w.end - w.start > 0.55) flush();
  }
  flush();
  return chunks;
};

export const Captions: React.FC<{ words: Word[]; frame: number; fps: number; lang?: LangId }> = ({ words, frame, fps, lang = "en" }) => {
  const pack = getPack(lang);
  const layout = pack.captions;
  const chunks = React.useMemo(() => chunkWords(words, lang), [words, lang]);
  const t = frame / fps;
  let idx = -1;
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].start <= t + 0.02) idx = i;
    else break;
  }
  if (idx < 0) return null;
  const c = chunks[idx];
  const next = chunks[idx + 1];
  // hide during long silences
  if (!next && t > c.end + 0.6) return null;
  if (next && t > c.end + 0.8 && t < next.start) return null;
  const age = t - c.start;
  const s = 1 + 0.06 * (1 - clamp(age / 0.08));

  // Bangla: the chunk is split into words so the current one can brighten. Splitting on spaces is
  // safe for graphemes — a conjunct or a matra never spans a space.
  const parts = lang === "bn" ? c.text.split(" ") : [c.text];

  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: layout.top,
          width: layout.width,
          textAlign: "center",
          fontFamily: fontFamilyFor(lang, fontFamily),
          fontWeight: 900,
          fontSize: layout.fontSize,
          // Bangla matras and conjuncts extend above and below the Latin baseline box
          lineHeight: layout.lineHeight,
          color: "#ffffff",
          WebkitTextStroke: "0px",
          textShadow: "0 0 2px #000, 0 6px 0 rgba(0,0,0,0.55), 0 10px 24px rgba(0,0,0,0.45)",
          paintOrder: "stroke fill",
          transform: `scale(${s})`,
          // NEVER letter-space a complex script: it breaks conjuncts apart
          letterSpacing: layout.letterSpacing,
          textTransform: "none",
        }}
      >
        <span style={{ WebkitTextStroke: "14px #0b0b0f", position: "absolute", left: 0, right: 0, color: "transparent" }}>{c.text}</span>
        <span style={{ position: "relative" }}>
          {parts.map((p, i) => {
            // highlight the word being spoken right now, without touching letter spacing
            const spoken = lang === "bn" && layout.highlight === "current-word" && wordsChanged(words, t, c, i);
            return (
              <span key={i} style={spoken ? { color: "#ffe24a" } : undefined}>
                {p}
                {i < parts.length - 1 ? " " : ""}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Is word `i` of this chunk the one being spoken at time `t`?
 * Uses the chunk's own start/end and the word count, so it needs no extra state and works identically
 * during server rendering (Remotion has no event loop while a frame renders).
 */
function wordsChanged(words: Word[], t: number, chunk: { start: number; end: number; text: string }, i: number): boolean {
  if (!words.length) return false;
  const span = chunk.end - chunk.start;
  if (span <= 0) return i === 0;
  const n = chunk.text.split(" ").length;
  const step = span / Math.max(1, n);
  return t >= chunk.start + i * step && t < chunk.start + (i + 1) * step;
}

void CAPTION_FONT;
