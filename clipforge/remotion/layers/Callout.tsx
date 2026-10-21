import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import type { ResolvedTimeline } from "../../src/timeline";
import { FONT_DISPLAY } from "../fonts";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { seeded, useLayout } from "../layout";

type CalloutItem = ResolvedTimeline["callouts"][number];

export const Callouts: React.FC<{ items: CalloutItem[]; accent: string }> = ({ items, accent }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((c, i) => (
        <Sequence key={i} from={Math.round(c.start * fps)} durationInFrames={Math.max(1, Math.round((c.end - c.start) * fps))} name={`callout ${c.text}`} layout="none">
          <Callout item={c} accent={accent} seed={i + 1} />
        </Sequence>
      ))}
    </>
  );
};

// Três estilos: badge (faixa inclinada que desliza), stamp (carimbo que bate na tela)
// e glitch (texto com canais RGB separados tremendo).
const Callout: React.FC<{ item: CalloutItem; accent: string; seed: number }> = ({ item, accent, seed }) => {
  const { u, width, vertical, calloutY } = useLayout();
  const dur = item.end - item.start;
  const ref = useGsapTimeline<HTMLDivElement>(
    (tl, root) => {
      const inner = root.querySelector<HTMLDivElement>("[data-inner]");
      if (item.style === "badge") {
        tl.fromTo(inner, { xPercent: -140, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.3, ease: "back.out(1.8)" }, 0);
        tl.to(inner, { xPercent: 140, opacity: 0, duration: 0.22, ease: "power3.in" }, dur - 0.22);
      } else if (item.style === "stamp") {
        tl.fromTo(inner, { scale: 3.2, opacity: 0, rotation: -18 }, { scale: 1, opacity: 1, rotation: -8, duration: 0.16, ease: "power4.in" }, 0);
        tl.fromTo(inner, { x: 0 }, { x: 10 * u, duration: 0.03, yoyo: true, repeat: 5, ease: "none" }, 0.16);
        tl.to(inner, { opacity: 0, scale: 1.15, duration: 0.18 }, dur - 0.18);
      } else {
        const rand = seeded(seed);
        const r = root.querySelector("[data-r]");
        const c = root.querySelector("[data-c]");
        tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0);
        for (let k = 0; k < Math.floor(dur / 0.07); k++) {
          const at = k * 0.07;
          const strong = k < 4 || rand() > 0.75;
          tl.set(r, { x: strong ? (rand() * 2 - 1) * 22 * u : 4 * u, y: strong ? (rand() * 2 - 1) * 8 * u : 0 }, at);
          tl.set(c, { x: strong ? (rand() * 2 - 1) * 22 * u : -4 * u, y: strong ? (rand() * 2 - 1) * 8 * u : 0 }, at);
        }
        tl.to(inner, { opacity: 0, duration: 0.1 }, dur - 0.1);
      }
    },
    [item, accent, u],
  );

  const text: React.CSSProperties = { fontFamily: FONT_DISPLAY, fontSize: (vertical ? 120 : 104) * u, textTransform: "uppercase", lineHeight: 1 };
  let body: React.ReactNode;
  if (item.style === "badge") {
    body = (
      <div style={{ ...text, background: accent, color: "#000", padding: `${12 * u}px ${34 * u}px`, transform: "skewX(-12deg)", boxShadow: `${12 * u}px ${12 * u}px 0 #000` }}>
        {item.text}
      </div>
    );
  } else if (item.style === "stamp") {
    body = (
      <div style={{ ...text, color: accent, border: `${10 * u}px solid ${accent}`, padding: `${6 * u}px ${28 * u}px`, background: "rgba(0,0,0,0.35)", textShadow: "0 0 30px rgba(0,0,0,0.6)" }}>
        {item.text}
      </div>
    );
  } else {
    body = (
      <div style={{ ...text, position: "relative", color: "#fff" }}>
        <span data-r style={{ position: "absolute", inset: 0, color: "#ff2a55", mixBlendMode: "screen" }}>
          {item.text}
        </span>
        <span data-c style={{ position: "absolute", inset: 0, color: "#00f0ff", mixBlendMode: "screen" }}>
          {item.text}
        </span>
        <span style={{ position: "relative" }}>{item.text}</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: calloutY,
        left: vertical ? 0 : width * 0.45,
        width: vertical ? width : width * 0.5,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div data-inner style={{ opacity: 0 }}>
        {body}
      </div>
    </div>
  );
};
