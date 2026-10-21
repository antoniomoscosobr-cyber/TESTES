import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { END_CARD_SECONDS } from "../../src/timeline";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { useLayout } from "../layout";

type Props = { title: string; subtitle: string; cta: string; accent: string; totalFrames: number };

export const EndCard: React.FC<Props> = ({ totalFrames, ...props }) => {
  const { fps } = useVideoConfig();
  const dur = Math.min(totalFrames, Math.round(END_CARD_SECONDS * fps));
  return (
    <Sequence from={totalFrames - dur} durationInFrames={dur} name="end card" layout="none">
      <Card {...props} />
    </Sequence>
  );
};

const Card: React.FC<Omit<Props, "totalFrames">> = ({ title, subtitle, cta, accent }) => {
  const { u, vertical } = useLayout();
  const words = title.split(/\s+/).filter(Boolean);
  // Nomes longos encolhem para caber em até 2 linhas.
  const longest = Math.max(1, ...words.map((w) => w.length));
  const titleScale = Math.min(1, 9 / longest, 18 / Math.max(1, title.length) + 0.35);
  const ref = useGsapTimeline<HTMLDivElement>(
    (tl, root) => {
      const shade = root.querySelector("[data-shade]");
      const chars = root.querySelectorAll("[data-ch]");
      const line = root.querySelector("[data-line]");
      const sub = root.querySelector("[data-sub]");
      const btn = root.querySelector("[data-cta]");
      tl.fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" }, 0);
      tl.fromTo(chars, { yPercent: 120, opacity: 0, rotationX: -80 }, { yPercent: 0, opacity: 1, rotationX: 0, duration: 0.45, ease: "back.out(1.6)", stagger: 0.035 }, 0.1);
      tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "expo.out" }, 0.35);
      if (sub) tl.fromTo(sub, { opacity: 0, y: 20 * u }, { opacity: 1, y: 0, duration: 0.3 }, 0.55);
      tl.fromTo(btn, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, 0.75);
      tl.fromTo(btn, { scale: 1 }, { scale: 1.07, duration: 0.35, yoyo: true, repeat: 3, ease: "sine.inOut" }, 1.05);
    },
    [title, subtitle, cta, accent, u],
  );

  return (
    <AbsoluteFill ref={ref} style={{ alignItems: "center", justifyContent: "center", perspective: 800 }}>
      <AbsoluteFill data-shade style={{ background: "radial-gradient(circle, rgba(0,0,0,0.55), rgba(0,0,0,0.92))", opacity: 0 }} />
      <div style={{ position: "relative", textAlign: "center", width: "90%" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: (vertical ? 150 : 140) * u * titleScale, lineHeight: 1, color: "#fff", textTransform: "uppercase" }}>
          {words.map((word, wi) => (
            <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap", margin: `0 ${14 * u}px` }}>
              {[...word].map((ch, i) => (
                <span key={i} data-ch style={{ display: "inline-block", opacity: 0 }}>
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>
        <div data-line style={{ height: 10 * u, width: "60%", margin: `${20 * u}px auto`, background: accent, transform: "scaleX(0)" }} />
        {subtitle ? (
          <div data-sub style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 46 * u, color: "#fff", textTransform: "uppercase", letterSpacing: 3 * u, opacity: 0 }}>
            {subtitle}
          </div>
        ) : null}
        <div
          data-cta
          style={{
            display: "inline-block",
            marginTop: 40 * u,
            padding: `${18 * u}px ${44 * u}px`,
            background: accent,
            color: "#000",
            fontFamily: FONT_BODY,
            fontWeight: 900,
            fontSize: 44 * u,
            textTransform: "uppercase",
            borderRadius: 999,
            opacity: 0,
          }}
        >
          {cta}
        </div>
      </div>
    </AbsoluteFill>
  );
};
