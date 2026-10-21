import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import type { CaptionPage } from "../../src/timeline";
import { FONT_BODY } from "../fonts";
import { useGsapTimeline } from "../gsap/useGsapTimeline";
import { useLayout } from "../layout";

// Legendas dinâmicas estilo TikTok: páginas de até 4 palavras, a palavra falada
// acende na cor de destaque com "pop" elástico; palavras-chave ficam maiores e coloridas.
export const Captions: React.FC<{ pages: CaptionPage[]; accent: string }> = ({ pages, accent }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((page, i) => {
        const from = Math.round(page.start * fps);
        const dur = Math.max(1, Math.round(page.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} name={`legenda ${i + 1}`} layout="none">
            <Page page={page} accent={accent} />
          </Sequence>
        );
      })}
    </>
  );
};

const Page: React.FC<{ page: CaptionPage; accent: string }> = ({ page, accent }) => {
  const { u, width, captionY } = useLayout();
  const ref = useGsapTimeline<HTMLDivElement>(
    (tl, root) => {
      const words = root.querySelectorAll<HTMLSpanElement>("[data-word]");
      tl.fromTo(root, { scale: 0.6, y: 40 * u, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.16, ease: "back.out(2.2)" }, 0);
      page.words.forEach((w, i) => {
        const el = words[i];
        const t0 = w.start - page.start;
        const base = w.emphasis ? accent : "#ffffff";
        const peak = w.emphasis ? 1.26 : 1.12;
        tl.fromTo(el, { scale: 1, color: base }, { scale: peak, color: w.emphasis ? "#ffffff" : accent, duration: 0.07, ease: "power2.out" }, t0);
        tl.fromTo(el, { scale: peak }, { scale: w.emphasis ? 1.12 : 1, duration: 0.3, ease: "elastic.out(1.1, 0.45)" }, t0 + 0.07);
        tl.fromTo(el, { color: w.emphasis ? "#ffffff" : accent }, { color: base, duration: 0.1 }, Math.max(t0 + 0.08, w.end - page.start));
      });
      const end = page.end - page.start;
      if (end > 0.25) tl.to(root, { opacity: 0, scale: 0.92, duration: 0.08 }, end - 0.08);
    },
    [page, accent, u],
  );

  return (
    <div
      style={{
        position: "absolute",
        left: width * 0.06,
        width: width * 0.88,
        top: captionY,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        ref={ref}
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `${4 * u}px ${26 * u}px`,
          fontFamily: FONT_BODY,
          fontWeight: 900,
          fontSize: 82 * u,
          lineHeight: 1.05,
          textTransform: "uppercase",
          textAlign: "center",
          WebkitTextStroke: `${12 * u}px #000`,
          paintOrder: "stroke fill",
          textShadow: `0 ${8 * u}px ${18 * u}px rgba(0,0,0,0.55)`,
          opacity: 0,
        }}
      >
        {page.words.map((w, i) => (
          <span key={i} data-word style={{ display: "inline-block", color: w.emphasis ? accent : "#fff", transform: w.emphasis ? "rotate(-3deg)" : undefined, margin: w.emphasis ? `0 ${8 * u}px` : undefined }}>
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
};
