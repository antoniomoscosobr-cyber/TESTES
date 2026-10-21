import { PRESET } from "../config";
import type { Analysis } from "../schema";

export type Candidate = {
  start: number;
  end: number;
  score: number;
  features: {
    energy: number;
    motion: number;
    cutDensity: number;
    impacts: number;
    peak: number;
    speech: number;
    black: number;
  };
};

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Janelas contíguas alinhadas a cortes de cena, pontuadas por energia, movimento,
// ritmo de cortes, impactos e fala. Retorna as melhores sem sobreposição relevante.
export function findCandidates(
  a: Analysis,
  opts: { min?: number; max?: number; target?: number; count?: number } = {},
): Candidate[] {
  const min = opts.min ?? PRESET.minShortSeconds;
  const max = opts.max ?? PRESET.maxShortSeconds;
  const target = opts.target ?? PRESET.targetShortSeconds;
  const count = opts.count ?? 12;
  const shots = a.shots;
  const strongImpacts = a.audio.onsets.filter((o) => o.strength >= 0.35);
  const phrases = a.transcript?.phrases ?? [];

  // Densidade máxima de impactos em qualquer janela de 10s, para normalizar.
  let maxImpactDensity = 1e-6;
  for (let t = 0; t < a.source.duration; t += 1) {
    const sum = strongImpacts.filter((o) => o.t >= t && o.t < t + 10).reduce((acc, o) => acc + o.strength, 0);
    maxImpactDensity = Math.max(maxImpactDensity, sum / 10);
  }

  const all: Candidate[] = [];
  for (let i = 0; i < shots.length; i++) {
    for (let j = i; j < shots.length; j++) {
      const start = shots[i].start;
      const end = shots[j].end;
      const dur = end - start;
      if (dur < min) continue;
      if (dur > max) break;
      let energy = 0;
      let motion = 0;
      let peak = 0;
      for (let k = i; k <= j; k++) {
        const len = shots[k].end - shots[k].start;
        energy += shots[k].energy * len;
        motion += shots[k].motion * len;
        peak = Math.max(peak, shots[k].energy);
      }
      energy /= dur;
      motion /= dur;
      const cutDensity = Math.min(1, (j - i + 1) / dur / 1.2);
      const impacts = Math.min(
        1,
        strongImpacts.filter((o) => o.t >= start && o.t < end).reduce((acc, o) => acc + o.strength, 0) / dur / maxImpactDensity,
      );
      const speech = Math.min(1, phrases.reduce((acc, p) => acc + overlap(start, end, p.start, p.end), 0) / dur);
      const black = Math.min(1, a.black.reduce((acc, b) => acc + overlap(start, end, b.start, b.end), 0) / dur);
      const durFit = Math.exp(-0.5 * Math.pow((dur - target) / 10, 2));
      const score =
        0.28 * energy + 0.18 * motion + 0.14 * cutDensity + 0.16 * impacts + 0.1 * peak + 0.08 * speech + 0.06 * durFit - 0.8 * black;
      all.push({
        start,
        end,
        score: round(score),
        features: {
          energy: round(energy),
          motion: round(motion),
          cutDensity: round(cutDensity),
          impacts: round(impacts),
          peak: round(peak),
          speech: round(speech),
          black: round(black),
        },
      });
    }
  }

  all.sort((x, y) => y.score - x.score);
  const picked: Candidate[] = [];
  for (const c of all) {
    const clash = picked.some((p) => overlap(c.start, c.end, p.start, p.end) > 0.25 * Math.min(c.end - c.start, p.end - p.start));
    if (!clash) picked.push(c);
    if (picked.length >= count) break;
  }
  // Trailer curto demais para o mínimo: usa ele inteiro.
  if (picked.length === 0 && shots.length) {
    picked.push({
      start: 0,
      end: a.source.duration,
      score: 0,
      features: { energy: 0, motion: 0, cutDensity: 0, impacts: 0, peak: 0, speech: 0, black: 0 },
    });
  }
  return picked;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
