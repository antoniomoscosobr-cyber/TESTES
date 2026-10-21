import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { HOOK_SECONDS } from "../../src/timeline";
import { FONT_BODY, FONT_DISPLAY } from "../fonts";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { seeded, useLayout } from "../layout";

// Gancho dos primeiros segundos: palavras "batendo" na tela uma a uma.
export const HookTitle: React.FC<{ text: string; sub: string; accent: string }> = (props) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence durationInFrames={Math.round(HOOK_SECONDS * fps)} name="hook" layout="none">
      <Hook {...props} />
    </Sequence>
  );
};

const Hook: React.FC<{ text: string; sub: string; accent: string }> = ({ text, sub, accent }) => {
  const { u, width, vertical, hookY } = useLayout();
  const words = text.split(/\s+/).filter(Boolean);
  const ref = useGsapTimeline<HTMLDivElement>(
    (tl, root) => {
      const rand = seeded(words.length);
      const els = root.querySelectorAll<HTMLSpanElement>("[data-word]");
      const bar = root.querySelector<HTMLDivElement>("[data-bar]");
      const subEl = root.querySelector<HTMLDivElement>("[data-sub]");
      tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "expo.out" }, 0);
      els.forEach((el, i) => {
        tl.fromTo(
          el,
          { scale: 2.8, opacity: 0, filter: "blur(14px)", rotation: (rand() * 2 - 1) * 10 },
          { scale: 1, opacity: 1, filter: "blur(0px)", rotation: 0, duration: 0.28, ease: "expo.out" },
          0.06 + i * 0.1,
        );
      });
      if (subEl) tl.fromTo(subEl, { opacity: 0, y: 20 * u }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.2 + els.length * 0.1);
      tl.to(root, { opacity: 0, y: -40 * u, duration: 0.25, ease: "power2.in" }, HOOK_SECONDS - 0.28);
    },
    [text, sub, accent, u],
  );

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: hookY,
        left: vertical ? width * 0.06 : width * 0.05,
        width: vertical ? width * 0.88 : width * 0.6,
        textAlign: vertical ? "center" : "left",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: `${18 * u}px ${28 * u}px`,
          background: "rgba(0,0,0,0.72)",
          transform: "skewX(-6deg)",
          borderLeft: `${10 * u}px solid ${accent}`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: (vertical ? 104 : 92) * u,
            lineHeight: 1.02,
            color: "#fff",
            textTransform: "uppercase",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: vertical ? "center" : "flex-start",
            gap: `0 ${20 * u}px`,
          }}
        >
          {words.map((w, i) => (
            <span key={i} data-word style={{ display: "inline-block", opacity: 0 }}>
              {w}
            </span>
          ))}
        </div>
        <div data-bar style={{ height: 8 * u, marginTop: 10 * u, background: accent, transformOrigin: "left center", transform: "scaleX(0)" }} />
      </div>
      {sub ? (
        <div
          data-sub
          style={{
            marginTop: 18 * u,
            fontFamily: FONT_BODY,
            fontWeight: 800,
            fontSize: 40 * u,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: 2 * u,
            textShadow: "0 3px 12px rgba(0,0,0,0.8)",
            opacity: 0,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
