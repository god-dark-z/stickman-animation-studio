import React from "react";
import { INK, shade } from "../theme";

/**
 * A Japanese school satchel (ランドセル / randoseru).
 *
 * Drawn centred on (0,0) with the given width and height, so the same art can be
 * hung on a character's back and stood upright on a chair as a prop.
 *
 * Origin convention for props in this engine is bottom-centre; the prop wrapper
 * shifts this component by -h/2 to put the satchel on the floor.
 */
export const Randoseru: React.FC<{ color?: string; w: number; h: number }> = ({ color = "#b3202a", w, h }) => {
  const dark = shade(color, -0.22);
  const light = shade(color, 0.16);
  const rx = Math.max(6, w * 0.1);
  const flapBottom = -h / 2 + h * 0.3;
  return (
    <g>
      {/* carrying handle */}
      <path d={`M ${-w * 0.13} ${-h / 2 + 2} Q 0 ${-h / 2 - h * 0.09} ${w * 0.13} ${-h / 2 + 2}`} fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      {/* body */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} fill={color} stroke={INK} strokeWidth={5} />
      {/* soft volume on the left face */}
      <path
        d={`M ${-w / 2 + 4} ${-h / 2 + rx} Q ${-w * 0.22} 0 ${-w / 2 + 4} ${h / 2 - rx} L ${-w * 0.3} ${h / 2 - rx} Q ${-w * 0.16} 0 ${-w * 0.3} ${-h / 2 + rx} Z`}
        fill={light}
        opacity={0.45}
      />
      {/* top lid with a rounded lower edge */}
      <path
        d={`M ${-w / 2} ${-h / 2 + 6} L ${w / 2} ${-h / 2 + 6} L ${w / 2} ${flapBottom} Q 0 ${flapBottom + h * 0.08} ${-w / 2} ${flapBottom} Z`}
        fill={dark}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* flap clasp */}
      <rect x={-w * 0.07} y={flapBottom - h * 0.045} width={w * 0.14} height={h * 0.09} rx={3} fill="#e0b24a" stroke={INK} strokeWidth={3.5} />
      {/* front pocket */}
      <rect x={-w * 0.3} y={-h * 0.02} width={w * 0.6} height={h * 0.3} rx={Math.max(5, w * 0.06)} fill={light} stroke={INK} strokeWidth={4} />
      <path d={`M ${-w * 0.3} ${h * 0.07} L ${w * 0.3} ${h * 0.07}`} stroke={INK} strokeWidth={3} opacity={0.55} />
    </g>
  );
};
