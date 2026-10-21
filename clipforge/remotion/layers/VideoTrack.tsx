import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { ResolvedSegment, ResolvedTimeline } from "../../src/timeline";
import { useLayout } from "../layout";

type Props = { tl: ResolvedTimeline; src: string; bgSrc: string; srcWidth: number; srcHeight: number };

export const VideoTrack: React.FC<Props> = ({ tl, src, bgSrc, srcWidth, srcHeight }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {tl.segments.map((seg, i) => {
        const next = tl.segments[i + 1];
        return (
          <Sequence key={i} from={seg.from} durationInFrames={seg.durationInFrames} name={`seg ${i + 1}`}>
            <SegmentView
              seg={seg}
              src={src}
              bgSrc={bgSrc}
              aspect={srcWidth && srcHeight ? srcWidth / srcHeight : 16 / 9}
              fadeIn={seg.jump}
              fadeOut={!next || next.jump}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const SegmentView: React.FC<{ seg: ResolvedSegment; src: string; bgSrc: string; aspect: number; fadeIn: boolean; fadeOut: boolean }> = ({
  seg,
  src,
  bgSrc,
  aspect,
  fadeIn,
  fadeOut,
}) => {
  const frame = useCurrentFrame();
  const { width, height, vertical } = useLayout();
  const d = seg.durationInFrames;
  // Zoom lento contínuo: dá vida a planos parados.
  const drift = interpolate(frame, [0, d], [1, 1.05], { extrapolateRight: "clamp" });

  const volume = (f: number) =>
    interpolate(f, [0, 3, Math.max(4, d - 3), d], [fadeIn ? 0 : 1, 1, 1, fadeOut ? 0 : 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  if (!src) return <Placeholder seg={seg} drift={drift} />;

  const video = (style: React.CSSProperties, muted: boolean, file = src) => (
    <OffthreadVideo
      src={staticFile(file)}
      trimBefore={seg.trimBefore}
      playbackRate={seg.speed}
      muted={muted}
      volume={muted ? 0 : volume}
      style={style}
    />
  );

  if (!vertical) {
    return (
      <AbsoluteFill style={{ transform: `scale(${drift})` }}>
        {video({ width: "100%", height: "100%", objectFit: "cover" }, false)}
      </AbsoluteFill>
    );
  }

  if (seg.fit === "crop") {
    const vw = height * aspect;
    const left = Math.min(0, Math.max(width - vw, width / 2 - seg.focusX * vw));
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", left, top: 0, width: vw, height, transform: `scale(${drift})`, transformOrigin: `${seg.focusX * 100}% 50%` }}>
          {video({ width: "100%", height: "100%" }, false)}
        </div>
      </AbsoluteFill>
    );
  }

  // blur: quadro inteiro no centro, cópia desfocada preenchendo o fundo
  // (pré-desfocada no ingest quando existe; blur CSS só como fallback).
  const fh = width / aspect;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {bgSrc ? (
        <AbsoluteFill style={{ transform: "scale(1.1)" }}>
          {video({ width: "100%", height: "100%", objectFit: "cover" }, true, bgSrc)}
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.42)" }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ transform: "scale(1.25)", filter: "blur(38px) brightness(0.5) saturate(1.3)" }}>
          {video({ width: "100%", height: "100%", objectFit: "cover" }, true)}
        </AbsoluteFill>
      )}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: height * 0.46 - fh / 2,
          width,
          height: fh,
          transform: `scale(${drift})`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {video({ width: "100%", height: "100%" }, false)}
      </div>
    </AbsoluteFill>
  );
};

// Sem vídeo (preview no Studio com o plano de demonstração): fundo animado por segmento.
const Placeholder: React.FC<{ seg: ResolvedSegment; drift: number }> = ({ seg, drift }) => {
  const frame = useCurrentFrame();
  const { u } = useLayout();
  const hue = (seg.index * 67 + frame * 0.6) % 360;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + seg.focusX * 40}% 40%, hsl(${hue} 80% 45%), hsl(${(hue + 140) % 360} 70% 12%))`,
        transform: `scale(${drift})`,
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(255,255,255,0.35)",
        fontFamily: "monospace",
        fontSize: 34 * u,
      }}
    >
      segmento {seg.index + 1} · {seg.srcStart.toFixed(1)}–{seg.srcEnd.toFixed(1)}s · {seg.fit}
    </AbsoluteFill>
  );
};
