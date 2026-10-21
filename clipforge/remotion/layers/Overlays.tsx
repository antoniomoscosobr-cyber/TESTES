import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedTimeline } from "../../src/timeline";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { seeded, useLayout } from "../layout";

export const ProgressBar: React.FC<{ accent: string; totalFrames: number }> = ({ accent, totalFrames }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  return (
    <div style={{ position: "absolute", left: 0, top: 0, height: 10 * u, width: `${(frame / Math.max(1, totalFrames - 1)) * 100}%`, background: accent, boxShadow: `0 0 ${16 * u}px ${accent}` }} />
  );
};

// Clarões (cortes com salto, impact, flash) e barras de glitch, em GSAP.
export const FlashLayer: React.FC<{ tl: ResolvedTimeline; accent: string }> = ({ tl, accent }) => {
  const { height } = useLayout();
  const bars = 7;
  const ref = useGsapTimeline<HTMLDivElement>(
    (t, root) => {
      const flash = root.querySelector("[data-flash]");
      const barEls = root.querySelectorAll<HTMLDivElement>("[data-bar]");
      const hit = (at: number, peak: number, dur: number) =>
        t.fromTo(flash, { opacity: peak }, { opacity: 0, duration: dur, ease: "power2.out" }, at);

      for (const seg of tl.segments) if (seg.jump) hit(seg.outStart, 0.85, 0.22);
      for (const s of tl.splashes) {
        if (s.kind === "flash") hit(s.t, 1, 0.4);
        if (s.kind === "impact") hit(s.t, 0.45 * s.intensity, 0.18);
        if (s.kind === "glitch") {
          const rand = seeded(s.index + 7);
          for (let k = 0; k < 6; k++) {
            const at = s.t + k * 0.05;
            barEls.forEach((bar) => {
              const show = rand() > 0.45 && k < 5;
              t.set(bar, { opacity: show ? 0.85 : 0, top: rand() * height, height: 8 + rand() * 70, xPercent: (rand() * 2 - 1) * 20 }, at);
            });
          }
        }
      }
    },
    [tl, height],
  );
  return (
    <AbsoluteFill ref={ref} style={{ pointerEvents: "none" }}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          data-bar
          style={{
            position: "absolute",
            left: "-10%",
            width: "120%",
            opacity: 0,
            background: i % 2 ? accent : "#00f0ff",
            mixBlendMode: "difference",
          }}
        />
      ))}
      <AbsoluteFill data-flash style={{ background: "#fff", opacity: 0, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

// Efeitos sonoros sintetizados (public/sfx) nos splashes e nos cortes com salto.
export const SfxTrack: React.FC<{ tl: ResolvedTimeline }> = ({ tl }) => {
  const { fps } = useVideoConfig();
  const cues: { at: number; file: string; volume: number }[] = [];
  for (const seg of tl.segments) if (seg.jump) cues.push({ at: seg.outStart - 0.12, file: "whoosh.wav", volume: 0.5 });
  for (const s of tl.splashes) {
    if (s.kind === "impact" || s.kind === "shockwave") cues.push({ at: s.t, file: "impact.wav", volume: 0.35 + 0.4 * s.intensity });
    else if (s.kind === "glitch") cues.push({ at: s.t, file: "glitch.wav", volume: 0.4 });
    else if (s.kind === "title3d" || s.kind === "particles") cues.push({ at: s.t - 0.05, file: "whoosh.wav", volume: 0.45 });
  }
  for (const c of tl.callouts) cues.push({ at: c.start, file: "pop.wav", volume: 0.4 });
  return (
    <>
      {cues
        .filter((c) => c.at >= 0)
        .map((c, i) => (
          <Sequence key={i} from={Math.round(c.at * fps)} durationInFrames={Math.round(1.5 * fps)} name={`sfx ${c.file}`} layout="none">
            <Html5Audio src={staticFile(`sfx/${c.file}`)} volume={c.volume} />
          </Sequence>
        ))}
    </>
  );
};
