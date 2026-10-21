import React from "react";
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import type { ResolvedSegment, ResolvedTimeline } from "../../src/timeline";
import { useLayout } from "../layout";

type Props = { tl: ResolvedTimeline; src: string; bgSrc: string; srcWidth: number; srcHeight: number };

// Só imagem: o som do trailer é tocado pelo AudioTrack (Overlays/Audio), separado, para poder
// cruzar os cortes e manter o som em velocidade normal na câmera lenta.
export const VideoTrack: React.FC<Props> = ({ tl, src, bgSrc, srcWidth, srcHeight }) => {
  const aspect = srcWidth && srcHeight ? srcWidth / srcHeight : 16 / 9;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {tl.segments.map((seg, i) => (
        <Sequence key={i} from={seg.from} durationInFrames={seg.durationInFrames} name={`seg ${i + 1}`}>
          <SegmentView seg={seg} src={src} bgSrc={bgSrc} aspect={aspect} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SegmentView: React.FC<{ seg: ResolvedSegment; src: string; bgSrc: string; aspect: number }> = ({ seg, src, bgSrc, aspect }) => {
  const frame = useCurrentFrame();
  const { width, height, vertical } = useLayout();
  // Zoom lento contínuo: dá vida a planos parados.
  const drift = interpolate(frame, [0, seg.durationInFrames], [1, 1.05], { extrapolateRight: "clamp" });

  if (!src) return <Placeholder seg={seg} drift={drift} />;

  const video = (style: React.CSSProperties, file = src) => (
    <OffthreadVideo src={staticFile(file)} trimBefore={seg.trimBefore} playbackRate={seg.speed} muted style={style} />
  );
  const blurredBg = (useFile: boolean) =>
    useFile ? (
      <AbsoluteFill style={{ transform: "scale(1.1)" }}>
        {video({ width: "100%", height: "100%", objectFit: "cover" }, bgSrc)}
        <AbsoluteFill style={{ background: "rgba(0,0,0,0.42)" }} />
      </AbsoluteFill>
    ) : (
      <AbsoluteFill style={{ transform: "scale(1.25)", filter: "blur(38px) brightness(0.5) saturate(1.3)" }}>
        {video({ width: "100%", height: "100%", objectFit: "cover" })}
      </AbsoluteFill>
    );

  if (!vertical) {
    // 16:9 nativo preenche; mais largo que isso (2.39:1 já sem tarjas) volta a ter tarjas,
    // como no cinema; vertical/quadrado fica no centro com fundo desfocado.
    if (aspect >= 1.7 && aspect <= 1.86) {
      return <AbsoluteFill style={{ transform: `scale(${drift})` }}>{video({ width: "100%", height: "100%", objectFit: "cover" })}</AbsoluteFill>;
    }
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {aspect < 1.7 ? blurredBg(false) : null}
        <AbsoluteFill style={{ transform: `scale(${drift})` }}>{video({ width: "100%", height: "100%", objectFit: "contain" })}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (seg.fit === "crop" && aspect > width / height) {
    const vw = height * aspect;
    const left = Math.min(0, Math.max(width - vw, width / 2 - seg.focusX * vw));
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div style={{ position: "absolute", left, top: 0, width: vw, height, transform: `scale(${drift})`, transformOrigin: `${seg.focusX * 100}% 50%` }}>
          {video({ width: "100%", height: "100%" })}
        </div>
      </AbsoluteFill>
    );
  }

  // blur: quadro inteiro no centro (cabendo na largura e em ~80% da altura), fundo desfocado
  // (pré-desfocado no ingest; blur CSS só como fallback).
  const fw = Math.min(width, height * 0.8 * aspect);
  const fh = fw / aspect;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {blurredBg(!!bgSrc)}
      <div
        style={{
          position: "absolute",
          left: (width - fw) / 2,
          top: height * 0.46 - fh / 2,
          width: fw,
          height: fh,
          transform: `scale(${drift})`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        }}
      >
        {video({ width: "100%", height: "100%" })}
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
