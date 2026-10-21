import { PRESET } from "../config";
import type { Analysis, EditPlan, Short } from "../schema";
import { segmentOutDuration } from "../timeline";

const SHOT_SNAP = 0.25;
const BEAT_SNAP = 0.12;
const ONSET_SNAP = 0.2;
const MIN_SEGMENT = 0.4;

function nearest(values: number[], t: number, within: number): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (Math.abs(v - t) <= within && (best === null || Math.abs(v - t) < Math.abs(best - t))) best = v;
  }
  return best;
}

// Cortes caem em troca de cena (preferência) ou no beat; splashes caem no impacto mais próximo.
// Também garante limites válidos e a duração final entre o mínimo e o máximo.
export function snapShort(short: Short, a: Analysis): Short {
  const boundaries = [0, ...a.shots.map((s) => s.end)];
  const beats = a.audio.beats;
  const onsets = a.audio.onsets.map((o) => o.t);
  const dur = a.source.duration;
  const snap = (t: number) => nearest(boundaries, t, SHOT_SNAP) ?? nearest(beats, t, BEAT_SNAP) ?? t;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Tira telas pretas das pontas dos segmentos.
  const unblack = (start: number, end: number) => {
    for (const b of a.black) {
      if (start >= b.start - 0.05 && start < b.end) start = b.end;
      if (end > b.start && end <= b.end + 0.05) end = b.start;
    }
    return [start, end];
  };

  let segments = short.segments
    .map((s) => {
      const [srcStart, srcEnd] = unblack(clamp(snap(s.srcStart), 0, dur), clamp(snap(s.srcEnd), 0, dur));
      return {
        ...s,
        srcStart: r3(srcStart),
        srcEnd: r3(srcEnd),
        speed: clamp(s.speed || 1, 0.5, 2),
        focusX: clamp(s.focusX, 0, 1),
      };
    })
    .filter((s) => s.srcEnd - s.srcStart >= MIN_SEGMENT);
  if (segments.length === 0) segments = [{ ...short.segments[0], srcStart: 0, srcEnd: Math.min(dur, PRESET.targetShortSeconds), speed: 1 }];

  const total = () => segments.reduce((acc, s) => acc + segmentOutDuration(s), 0);
  // Longo demais: encurta do fim.
  while (total() > PRESET.maxShortSeconds && segments.length) {
    const last = segments[segments.length - 1];
    const excess = total() - PRESET.maxShortSeconds;
    const room = segmentOutDuration(last) - 1;
    if (room >= excess) {
      last.srcEnd = r3(last.srcEnd - excess * last.speed);
      break;
    }
    segments.pop();
  }
  // Curto demais: estende o último segmento enquanto houver trailer.
  if (total() < PRESET.minShortSeconds) {
    const last = segments[segments.length - 1];
    last.srcEnd = r3(Math.min(dur, last.srcEnd + (PRESET.minShortSeconds - total()) * last.speed));
  }

  const splashes = short.splashes.map((s) => ({ ...s, srcTime: r3(nearest(onsets, s.srcTime, ONSET_SNAP) ?? s.srcTime) }));
  return { ...short, segments, splashes };
}

export function snapPlan(plan: EditPlan, a: Analysis): EditPlan {
  return { ...plan, shorts: plan.shorts.map((s) => snapShort(s, a)) };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
