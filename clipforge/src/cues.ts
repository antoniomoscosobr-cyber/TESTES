// Momentos de efeito derivados da timeline, compartilhados pelas camadas de vídeo e áudio.
// Puro e sem dependências de Node (roda no bundle do Remotion).
import type { ResolvedTimeline } from "./timeline";

const JUMP_FX_SPACING = 1.2; // montagem cortando no beat não vira um estrobo de flashes

// Cortes com salto que recebem clarão/whip/whoosh: no máximo um a cada ~1.2s.
export function jumpEffects(tl: ResolvedTimeline): number[] {
  const out: number[] = [];
  for (const s of tl.segments) {
    if (!s.jump || s.outStart >= tl.endCardStart) continue;
    if (!out.length || s.outStart - out[out.length - 1] >= JUMP_FX_SPACING) out.push(s.outStart);
  }
  return out;
}

export type SfxCue = { at: number; file: string; volume: number };

export function sfxCues(tl: ResolvedTimeline): SfxCue[] {
  const cues: SfxCue[] = [];
  for (const t of jumpEffects(tl)) cues.push({ at: t - 0.12, file: "whoosh.wav", volume: 0.35 });
  for (const s of tl.segments) if (s.speed < 1 && s.outStart < tl.endCardStart) cues.push({ at: s.outStart, file: "impact.wav", volume: 0.3 });
  for (const s of tl.splashes) {
    if (s.kind === "impact" || s.kind === "shockwave") cues.push({ at: s.t, file: "impact.wav", volume: 0.25 + 0.25 * s.intensity });
    else if (s.kind === "glitch") cues.push({ at: s.t, file: "glitch.wav", volume: 0.3 });
    else if (s.kind === "title3d" || s.kind === "particles") cues.push({ at: s.t - 0.05, file: "whoosh.wav", volume: 0.3 });
  }
  for (const c of tl.callouts) cues.push({ at: c.start, file: "pop.wav", volume: 0.3 });
  return cues.filter((c) => c.at >= 0).sort((a, b) => a.at - b.at);
}

// Ganho do som do trailer num instante: base com folga (os SFX somam por cima, sem limitador
// no mixer) e um "duck" curto embaixo de cada SFX forte.
export const TRAILER_GAIN = 0.7;
export function duckGain(t: number, cues: SfxCue[]): number {
  let g = 1;
  for (const c of cues) {
    if (c.file === "pop.wav") continue;
    const d = t - c.at;
    if (d < -0.04 || d > 0.35) continue;
    // ataque de 40 ms, 150 ms segurando, volta em 160 ms
    const depth = 0.4;
    const k = d < 0 ? (d + 0.04) / 0.04 : d < 0.15 ? 1 : 1 - (d - 0.15) / 0.2;
    g = Math.min(g, 1 - depth * Math.max(0, Math.min(1, k)));
  }
  return g;
}
