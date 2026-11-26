import React from "react";
import { ensureFonts } from "./fonts";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate, delayRender, continueRender } from "remotion";
import type { ResolvedShot, Timeline } from "./schema";
import { Scene, PostFX } from "./scene/Scene";
import { Scene3D } from "./location3d/Scene3D";
import { Captions } from "./captions/Captions";
import { CallOverlay } from "./captions/Call";
import { H, W, clamp, easeOut } from "./theme";

export const TRANS = 7;

const ShotWrap: React.FC<{ shot: ResolvedShot; first: boolean; children: React.ReactNode }> = ({ shot, first, children }) => {
  const f = useCurrentFrame();
  if (first) return <AbsoluteFill>{children}</AbsoluteFill>;
  switch (shot.transition) {
    case "cut":
      return <AbsoluteFill>{children}</AbsoluteFill>;
    case "flash":
      return (
        <AbsoluteFill>
          {children}
          <AbsoluteFill style={{ backgroundColor: "#fff", opacity: clamp(1 - f / 6) }} />
        </AbsoluteFill>
      );
    case "iris": {
      const r = easeOut(clamp(f / 12)) * 1300;
      return (
        <AbsoluteFill style={{ clipPath: `circle(${r}px at ${W / 2}px ${H * 0.45}px)` }}>
          {children}
        </AbsoluteFill>
      );
    }
    case "whip": {
      const q = easeOut(clamp(f / 7));
      return (
        <AbsoluteFill style={{ transform: `translateX(${(1 - q) * W}px)`, filter: q < 1 ? `blur(${(1 - q) * 30}px)` : undefined }}>
          {children}
        </AbsoluteFill>
      );
    }
    case "zoom": {
      const q = easeOut(clamp(f / TRANS));
      return <AbsoluteFill style={{ opacity: q, transform: `scale(${1.25 - 0.25 * q})` }}>{children}</AbsoluteFill>;
    }
    default:
      return <AbsoluteFill style={{ opacity: interpolate(f, [0, TRANS], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
  }
};

const ShotScene: React.FC<{ shot: ResolvedShot; timeline: Timeline }> = ({ shot, timeline }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cast = timeline.story.cast;
  const location = shot.location ? timeline.locations?.[shot.location] : undefined;
  if (location) return <Scene3D shot={shot} cast={cast} location={location} objects={timeline.objects ?? {}} frame={f} fps={fps} lang={timeline.story.lang} />;
  return <Scene shot={shot} cast={cast} frame={f} fps={fps} lang={timeline.story.lang} />;
};

// an on-screen call: flickering text + whisper, appearing at the shot's callFrame
const ShotCall: React.FC<{ shot: ResolvedShot; first: boolean; children: React.ReactNode }> = ({ shot, first, children }) => {
  const f = useCurrentFrame();
  const call = shot.call && f >= shot.callFrame ? shot.call : null;
  if (!call) return <>{children}</>;
  const overlay = <CallOverlay call={call} frame={f} fps={30} fromFrame={shot.callFrame} seed={String(shot.index)} />;
  if (first) return <AbsoluteFill>{children}{overlay}</AbsoluteFill>;
  switch (shot.transition) {
    case "cut":
      return <AbsoluteFill>{children}{overlay}</AbsoluteFill>;
    case "flash":
      return (
        <AbsoluteFill>
          {children}
          <AbsoluteFill style={{ backgroundColor: "#fff", opacity: clamp(1 - f / 6) }} />
          {overlay}
        </AbsoluteFill>
      );
    case "iris": {
      const r = easeOut(clamp(f / 12)) * 1300;
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ clipPath: `circle(${r}px at ${W / 2}px ${H * 0.45}px)` }}>{children}</AbsoluteFill>
          {overlay}
        </AbsoluteFill>
      );
    }
    case "whip": {
      const q = easeOut(clamp(f / 7));
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ transform: `translateX(${(1 - q) * W}px)`, filter: q < 1 ? `blur(${(1 - q) * 30}px)` : undefined }}>{children}</AbsoluteFill>
          {overlay}
        </AbsoluteFill>
      );
    }
    case "zoom": {
      const q = easeOut(clamp(f / TRANS));
      return <AbsoluteFill style={{ opacity: q, transform: `scale(${1.25 - 0.25 * q})` }}>{children}{overlay}</AbsoluteFill>;
    }
    default:
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ opacity: interpolate(f, [0, TRANS], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>
          {overlay}
        </AbsoluteFill>
      );
  }
};

export const StoryVideo: React.FC<Timeline> = (tl) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { shots } = tl;
  const mix = tl.story.mix ?? { music: 0.14, sfx: 0.22, duck: 0.35, autoSfx: true };
  const lang = tl.story.lang ?? "en";

  // Bangla fonts must be usable BEFORE the first frame. Without this the opening frames render
  // with a fallback face, the line breaks differ, and text visibly jumps when the real font lands.
  const [fontsReady, setFontsReady] = React.useState(lang !== "bn");
  const handle = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (lang !== "bn" || fontsReady) return;
    handle.current = delayRender("loading Bangla fonts");
    let cancelled = false;
    ensureFonts(lang)
      .then((r) => {
        if (!r.loaded) console.warn(`[fonts] Bangla families did not all report ready: ${r.families.join(", ")}`);
      })
      .finally(() => {
        if (!cancelled) {
          setFontsReady(true);
          if (handle.current !== null) continueRender(handle.current);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lang, fontsReady, delayRender, continueRender]);

  // Narration-aware ducking: while someone is speaking, the bed and the effects step back
  // so the voice is always the loudest thing in the mix.
  const voiceGain = React.useMemo(() => {
    const w = tl.words ?? [];
    const g = new Float32Array(Math.max(1, tl.durationInFrames + 1));
    for (const word of w) {
      const a = Math.max(0, Math.floor(word.start * fps));
      const b = Math.min(g.length - 1, Math.ceil(word.end * fps));
      for (let i = a; i <= b; i++) g[i] = 1;
    }
    // soften the release so the bed breathes instead of pumping
    const out = new Float32Array(g.length);
    for (let i = 0; i < g.length; i++) {
      const v = g[i] || (i > 0 ? out[i - 1] * 0.86 : 0);
      out[i] = v;
    }
    return out;
  }, [tl.words, tl.durationInFrames, fps]);

  const duck = (f: number) => 1 - mix.duck * (voiceGain[Math.min(voiceGain.length - 1, Math.max(0, f))] || 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {shots.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.duration + (i < shots.length - 1 ? TRANS : 0)} name={`${i}: ${s.say.slice(0, 30)}`}>
          <ShotCall shot={s} first={i === 0}>
            <ShotScene shot={s} timeline={tl} />
          </ShotCall>
        </Sequence>
      ))}
      <PostFX frame={frame} />
      {fontsReady && <Captions words={tl.words} frame={frame} fps={fps} lang={lang} />}
      {tl.voiceSrc && <Audio src={staticFile(tl.voiceSrc)} />}
      {tl.musicSrc && (
        <Audio src={staticFile(tl.musicSrc)} loop volume={(f) => interpolate(f, [0, 15, tl.durationInFrames - 30, tl.durationInFrames], [0, mix.music, mix.music, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * duck(f)} />
      )}
      {tl.sfx.map((c, i) => (
        <Sequence key={`sfx${i}`} from={Math.max(0, c.frame)} durationInFrames={Math.max(1, Math.min(4 * fps, tl.durationInFrames - c.frame))} layout="none">
          <Audio src={staticFile(`sfx/${c.name}.wav`)} volume={(f) => c.volume * mix.sfx * duck(c.frame + f)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
