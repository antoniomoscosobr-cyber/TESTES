import { PRESET } from "../config";
import type { Analysis, EditPlan, Short } from "../schema";
import { segmentOutDuration } from "../timeline";

const SHOT_SNAP = 0.25;
const BEAT_SNAP = 0.15;
const ONSET_SNAP = 0.2;
const WORD_SNAP = 0.4;
const FLASH_FRAME = 0.12; // menos que isso de um shot vizinho vira "piscada" na tela
const MIN_SEGMENT = 0.4;
const FOCUS_CONFIDENT = 0.55;

type Seg = Short["segments"][number];

function nearest(values: number[], t: number, within: number): number | null {
  let best: number | null = null;
  for (const v of values) {
    if (Math.abs(v - t) <= within && (best === null || Math.abs(v - t) < Math.abs(best - t))) best = v;
  }
  return best;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export type SnapOptions = {
  // true no plano heurístico: o enquadramento (crop/blur e focusX) vem da análise de foco por shot.
  autoFit?: boolean;
};

// Cortes caem em troca de cena ou no beat (sem deixar "piscadas" de 1–3 frames do shot vizinho e
// sem cortar palavras ao meio); splashes caem no impacto mais próximo; o enquadramento 9:16 segue
// o foco de cada shot. Também garante limites válidos e a duração final entre o mínimo e o máximo.
export function snapShort(short: Short, a: Analysis, opts: SnapOptions = {}): Short {
  const boundaries = [0, ...a.shots.map((s) => s.end)];
  const beatsOk = a.audio.beatConfidence >= 0.4 ? a.audio.beats : [];
  const onsets = a.audio.onsets.map((o) => o.t);
  const words = (a.transcript?.phrases ?? []).flatMap((p) => p.words);
  const dur = a.source.duration;

  const snapEdge = (t: number) => {
    let v = nearest(boundaries, t, SHOT_SNAP) ?? nearest(beatsOk, t, BEAT_SNAP) ?? t;
    // No meio de uma palavra? Vai para a borda mais próxima dela.
    const w = words.find((x) => v > x.start + 0.02 && v < x.end - 0.02);
    if (w) {
      const edge = v - w.start < w.end - v ? w.start : w.end;
      if (Math.abs(edge - v) <= WORD_SNAP) v = edge;
    }
    return clamp(v, 0, dur);
  };

  const fix = (s: Seg): Seg => {
    let srcStart = snapEdge(s.srcStart);
    let srcEnd = snapEdge(s.srcEnd);
    [srcStart, srcEnd] = avoidFlashFrames(srcStart, srcEnd, boundaries);
    [srcStart, srcEnd] = trimRanges(srcStart, srcEnd, [...a.black, ...a.cards]);
    return { ...s, srcStart: r3(srcStart), srcEnd: r3(srcEnd), speed: clamp(s.speed || 1, 0.5, 2), focusX: clamp(s.focusX, 0, 1) };
  };

  let segments = short.segments.map(fix).filter((s) => s.srcEnd - s.srcStart >= MIN_SEGMENT);
  if (segments.length === 0) {
    const start = a.shots.find((s) => !a.cards.some((c) => s.start >= c.start && s.start < c.end))?.start ?? 0;
    segments = [fix({ ...short.segments[0], srcStart: start, srcEnd: Math.min(dur, start + PRESET.targetShortSeconds), speed: 1 })];
  }

  const total = () => segments.reduce((acc, s) => acc + segmentOutDuration(s), 0);
  // Longo demais: encurta do fim (no corte de cena/beat mais próximo).
  while (total() > PRESET.maxShortSeconds && segments.length > 1) {
    const last = segments[segments.length - 1];
    const excess = total() - PRESET.maxShortSeconds;
    if (segmentOutDuration(last) - 1 >= excess) break;
    segments.pop();
  }
  if (total() > PRESET.maxShortSeconds) {
    const last = segments[segments.length - 1];
    const target = last.srcEnd - (total() - PRESET.maxShortSeconds) * last.speed;
    last.srcEnd = r3(Math.min(target, boundaries.filter((b) => b <= target && b > last.srcStart + 1).pop() ?? target));
  }
  // Curto demais: estende o último segmento enquanto houver trailer útil.
  if (total() < PRESET.minShortSeconds) {
    const last = segments[segments.length - 1];
    const wanted = last.srcEnd + (PRESET.minShortSeconds - total()) * last.speed;
    const limit = Math.min(dur, ...[...a.black, ...a.cards].filter((r) => r.start >= last.srcEnd).map((r) => r.start));
    const grown = boundaries.find((b) => b >= wanted && b <= limit) ?? Math.min(wanted, limit);
    last.srcEnd = r3(Math.max(last.srcEnd, grown));
  }

  segments = splitByShots(segments, a, !!opts.autoFit);
  const splashes = short.splashes.map((s) => ({ ...s, srcTime: r3(nearest(onsets, s.srcTime, ONSET_SNAP) ?? s.srcTime) }));
  return { ...short, segments, splashes };
}

// Se um corte cai a menos de ~3 frames de uma troca de cena dentro do segmento, encosta nela.
export function avoidFlashFrames(start: number, end: number, boundaries: number[]): [number, number] {
  const afterStart = boundaries.find((b) => b > start && b - start < FLASH_FRAME);
  const beforeEnd = [...boundaries].reverse().find((b) => b < end && end - b < FLASH_FRAME);
  return [afterStart ?? start, beforeEnd ?? end];
}

// Tira telas pretas e cartelas das pontas de um intervalo.
export function trimRanges(start: number, end: number, ranges: { start: number; end: number }[]): [number, number] {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of ranges) {
      if (start >= b.start - 0.05 && start < b.end) start = b.end;
      if (end > b.start && end <= b.end + 0.05) end = b.start;
    }
  }
  return [start, end];
}

// Divide segmentos nas trocas de cena para que o crop 9:16 siga o foco de cada shot, e junta
// de novo os pedaços vizinhos com o mesmo enquadramento (não muda nada na timeline final).
export function splitByShots(segments: Seg[], a: Analysis, autoFit: boolean): Seg[] {
  const out: Seg[] = [];
  for (const seg of segments) {
    const inner = a.shots.filter((s) => s.end > seg.srcStart + 0.05 && s.start < seg.srcEnd - 0.05);
    if (inner.length === 0) {
      out.push(seg);
      continue;
    }
    for (const shot of inner) {
      const srcStart = Math.max(seg.srcStart, shot.start);
      const srcEnd = Math.min(seg.srcEnd, shot.end);
      const confident = shot.focusConfidence >= FOCUS_CONFIDENT;
      let fit = seg.fit;
      let focusX = seg.focusX;
      if (autoFit) {
        fit = confident ? "crop" : "blur";
        focusX = confident ? shot.focusX : 0.5;
      } else if (seg.fit === "crop" && confident && inner.length > 1) {
        // O diretor deu um foco só para vários shots; cada shot usa o seu.
        focusX = shot.focusX;
      }
      out.push({ ...seg, srcStart: r3(srcStart), srcEnd: r3(srcEnd), fit, focusX: r3(clamp(focusX, 0, 1)) });
    }
  }
  // Pedaços minúsculos herdam o enquadramento do vizinho; depois junta os iguais e contíguos.
  const merged: Seg[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    const contiguous = prev && Math.abs(prev.srcEnd - s.srcStart) < 0.01 && prev.speed === s.speed;
    if (contiguous && (s.srcEnd - s.srcStart < 0.5 || (prev.fit === s.fit && Math.abs(prev.focusX - s.focusX) < 0.08))) {
      prev.srcEnd = s.srcEnd;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export function snapPlan(plan: EditPlan, a: Analysis): EditPlan {
  const autoFit = plan.director === "heuristic";
  return { ...plan, shorts: plan.shorts.map((s) => snapShort(s, a, { autoFit })) };
}
