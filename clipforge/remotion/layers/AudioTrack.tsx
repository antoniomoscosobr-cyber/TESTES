import React from "react";
import { Html5Audio, Sequence, staticFile } from "remotion";
import { duckGain, narrationGain, sfxCues, TRAILER_GAIN } from "../../src/cues";
import type { ResolvedTimeline } from "../../src/timeline";

const XFADE = 4; // frames de cruzamento nos cortes com salto
const FINAL_FADE = 1.2; // segundos de fade no fim (sob o card final)

// Som do trailer, separado da imagem:
// - cortes com salto cruzam (equal-power) em vez de cair para o silêncio;
// - câmera lenta não estica o som: toca a 1x o trecho que TERMINA no fim do segmento, então
//   a volta à velocidade normal encaixa sem emenda (o impacto + whoosh cobrem a entrada);
// - ganho com folga e "duck" sob os SFX, fade longo no final.
// ducking=false: trilha "limpa" (stem para o usuário mixar com a própria voz no editor dele).
export const AudioTrack: React.FC<{ tl: ResolvedTimeline; src: string; ducking?: boolean }> = ({ tl, src, ducking = true }) => {
  if (!src) return null;
  const cues = ducking ? sfxCues(tl) : [];
  const voice = ducking ? tl.narration : [];
  const fps = tl.fps;
  const total = tl.durationInFrames;
  const slow = (i: number) => !!tl.segments[i] && tl.segments[i].speed !== 1;
  return (
    <>
      {tl.segments.map((seg, i) => {
        const next = tl.segments[i + 1];
        const fadeIn = i > 0 && (seg.jump || slow(i) || slow(i - 1));
        const fadeOut = !!next && (next.jump || slow(i) || slow(i + 1));
        const tail = fadeOut ? XFADE : 0;
        const dur = Math.min(seg.durationInFrames + tail, total - seg.from);
        const outSeconds = seg.durationInFrames / fps;
        const trimBefore = slow(i) ? Math.max(0, Math.round((seg.srcEnd - outSeconds) * fps)) : seg.trimBefore;
        const volume = (f: number) => {
          let v = TRAILER_GAIN;
          if (fadeIn && f < XFADE) v *= Math.sin((Math.PI / 2) * (f / XFADE));
          if (tail && f >= seg.durationInFrames) v *= Math.cos((Math.PI / 2) * Math.min(1, (f - seg.durationInFrames) / XFADE));
          const abs = (seg.from + f) / fps;
          if (abs > tl.duration - FINAL_FADE) v *= Math.max(0, Math.min(1, (tl.duration - abs) / FINAL_FADE));
          return v * duckGain(abs, cues) * narrationGain(abs, voice);
        };
        return (
          <Sequence key={i} from={seg.from} durationInFrames={dur} name={`áudio ${i + 1}${slow(i) ? " (1x)" : ""}`} layout="none">
            <Html5Audio src={staticFile(src)} trimBefore={trimBefore} volume={volume} />
          </Sequence>
        );
      })}
    </>
  );
};
