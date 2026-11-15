/**
 * A "call" — on-screen text that is never spoken by the narrator (a whispered voice,
 * a written note, a caption card). One whisper sfx cue plays with each call. Rendered
 * over the scene, above the row of narration captions. English / Latin script.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { H, W, hashStr } from "../theme";
import type { Call } from "../schema";

const { fontFamily } = loadMontserrat("normal", { weights: ["700", "800", "900"] });

export const CallOverlay: React.FC<{ call: Call; frame: number; fps: number; fromFrame: number; seed: string }> = ({
  call, frame, fps, fromFrame, seed,
}) => {
  if (!call.text.trim()) return null;
  const local = frame - fromFrame;
  const flick = 0.62 + 0.38 * Math.abs(Math.sin(frame * 0.34 + hashStr(seed) * 9));
  const drift = Math.sin(frame * 0.05 + hashStr(seed) * 4) * 4;
  const size = call.text.length > 22 ? 62 : call.text.length > 14 ? 74 : 88;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {call.whispered && (
        <Sequence from={0} durationInFrames={Math.max(2, Math.round(2.6 * fps))} layout="none">
          <Audio src={staticFile("sfx/whisper.wav")} volume={0.55} />
        </Sequence>
      )}
      <div
        style={{
          position: "absolute",
          left: W / 2,
          top: H * 0.30,
          transform: `translate(-50%,-50%) translateX(${drift}px)`,
          fontFamily,
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.25,
          textAlign: "center",
          color: "#e8ecd8",
          opacity: flick,
          textShadow: "0 0 18px rgba(200,220,255,0.55), 0 0 42px rgba(120,150,220,0.35), 0 4px 12px rgba(0,0,0,0.7)",
          letterSpacing: 0.5,
          maxWidth: 940,
          transition: undefined,
        }}
      >
        {call.text}
      </div>
      {/* faint sub-layer, like breath on glass */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: W / 2,
          top: H * 0.30,
          transform: `translate(-50%,-50%) translateX(${drift}px) scale(1.06)`,
          fontFamily,
          fontWeight: 400,
          fontSize: size,
          lineHeight: 1.25,
          textAlign: "center",
          color: "#9fb4d8",
          opacity: flick * 0.22,
          filter: "blur(3px)",
          maxWidth: 940,
        }}
      >
        {call.text}
      </div>
      {local < 26 && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 32%, rgba(200,215,255,0.10), transparent 60%)" }} />}
    </AbsoluteFill>
  );
};
