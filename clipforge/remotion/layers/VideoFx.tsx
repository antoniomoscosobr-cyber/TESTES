import React from "react";
import { AbsoluteFill } from "remotion";
import { jumpEffects } from "../../src/cues";
import type { ResolvedTimeline } from "../../src/timeline";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { seeded } from "../layout";

// Efeitos de câmera sobre o vídeo, todos em GSAP: zoom punch + tremida nos impactos,
// falha de cor no glitch e "whip zoom" nos cortes com salto.
export const VideoFx: React.FC<{ tl: ResolvedTimeline; children: React.ReactNode }> = ({ tl, children }) => {
  const ref = useGsapTimeline<HTMLDivElement>(
    (t, el) => {
      t.set(el, { scale: 1, x: 0, y: 0, filter: "none" }, 0);

      const jumps = jumpEffects(tl);
      for (const at of jumps) {
        t.fromTo(
          el,
          { scale: 1.14, filter: "blur(10px) brightness(1.6)" },
          { scale: 1, filter: "blur(0px) brightness(1)", duration: 0.24, ease: "expo.out" },
          at,
        );
      }

      // Pulso sutil no beat da música, longe dos outros movimentos de câmera.
      const busy = [...jumps, ...tl.splashes.map((s) => s.t)];
      for (const b of tl.beats) {
        if (busy.some((x) => Math.abs(x - b) < 0.6)) continue;
        t.fromTo(el, { scale: 1.014 }, { scale: 1, duration: 0.22, ease: "power2.out" }, b);
      }

      for (const s of tl.splashes) {
        const rand = seeded(s.index + 1);
        if (s.kind === "impact" || s.kind === "shockwave" || s.kind === "particles") {
          const punch = 1 + 0.09 * s.intensity;
          t.fromTo(el, { scale: 1 }, { scale: punch, duration: 0.05, ease: "power4.out" }, s.t);
          t.fromTo(el, { scale: punch }, { scale: 1, duration: 0.5, ease: "power3.out" }, s.t + 0.05);
          const amp = (s.kind === "impact" ? 34 : 20) * s.intensity;
          let at = s.t;
          let prev = { x: 0, y: 0 };
          for (let k = 0; k < 8; k++) {
            const decay = 1 - k / 8;
            const next = k === 7 ? { x: 0, y: 0 } : { x: (rand() * 2 - 1) * amp * decay, y: (rand() * 2 - 1) * amp * decay };
            t.fromTo(el, prev, { ...next, duration: 0.04, ease: "none" }, at);
            prev = next;
            at += 0.04;
          }
        } else if (s.kind === "glitch") {
          let at = s.t;
          for (let k = 0; k < 7; k++) {
            const on = k % 2 === 0 && k < 6;
            t.fromTo(
              el,
              { filter: "none", x: 0 },
              {
                filter: on ? `hue-rotate(${Math.round(rand() * 180)}deg) saturate(3) contrast(1.4)` : "none",
                x: on ? (rand() * 2 - 1) * 40 : 0,
                duration: 0.001,
              },
              at,
            );
            at += 0.05;
          }
        }
      }
    },
    [tl],
  );
  return (
    <AbsoluteFill ref={ref} style={{ willChange: "transform" }}>
      {children}
    </AbsoluteFill>
  );
};
