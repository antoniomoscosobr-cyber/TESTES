// Converte um Short (eventos em tempo da fonte) para a linha do tempo do vídeo final.
// Puro e sem dependências de Node: usado tanto pelo pipeline quanto pelo Remotion.
import type { Short, SplashSchema, CalloutStyleSchema } from "./schema";
import type { z } from "zod";

export const FPS = 30;
export const HOOK_SECONDS = 2.6;
export const END_CARD_SECONDS = 2.8;
const MAX_WORDS_PER_PAGE = 4;
const MAX_CHARS_PER_PAGE = 24;

export type TimedWord = { text: string; start: number; end: number; emphasis: boolean };
export type CaptionPage = { start: number; end: number; words: TimedWord[] };

export type ResolvedSegment = Short["segments"][number] & {
  index: number;
  from: number; // frame inicial no short
  durationInFrames: number;
  outStart: number; // segundos no short
  outEnd: number;
  trimBefore: number; // frame inicial na fonte
  jump: boolean; // true quando não é continuação direta do segmento anterior
};

export type ResolvedTimeline = {
  fps: number;
  durationInFrames: number;
  duration: number;
  segments: ResolvedSegment[];
  pages: CaptionPage[];
  callouts: { start: number; end: number; text: string; style: z.infer<typeof CalloutStyleSchema> }[];
  splashes: { t: number; kind: z.infer<typeof SplashSchema>["kind"]; text: string; intensity: number; index: number }[];
};

export function segmentOutDuration(seg: { srcStart: number; srcEnd: number; speed: number }): number {
  return Math.max(0, seg.srcEnd - seg.srcStart) / seg.speed;
}

export function resolveTimeline(short: Short, fps: number): ResolvedTimeline {
  const segments: ResolvedSegment[] = [];
  let frame = 0;
  short.segments.forEach((seg, index) => {
    const durationInFrames = Math.max(1, Math.round(segmentOutDuration(seg) * fps));
    const prev = short.segments[index - 1];
    segments.push({
      ...seg,
      index,
      from: frame,
      durationInFrames,
      outStart: frame / fps,
      outEnd: (frame + durationInFrames) / fps,
      trimBefore: Math.round(seg.srcStart * fps),
      jump: !!prev && Math.abs(prev.srcEnd - seg.srcStart) > 0.05,
    });
    frame += durationInFrames;
  });

  const srcToOut = (t: number): number | null => {
    for (const s of segments) {
      if (t >= s.srcStart && t <= s.srcEnd) return s.outStart + (t - s.srcStart) / s.speed;
    }
    return null;
  };

  // Para um intervalo da fonte, pega o maior trecho que cai dentro de um segmento.
  const mapRange = (a: number, b: number): { start: number; end: number } | null => {
    let best: { start: number; end: number } | null = null;
    for (const s of segments) {
      const lo = Math.max(a, s.srcStart);
      const hi = Math.min(b, s.srcEnd);
      if (hi - lo <= 0) continue;
      const start = s.outStart + (lo - s.srcStart) / s.speed;
      const end = s.outStart + (hi - s.srcStart) / s.speed;
      if (!best || end - start > best.end - best.start) best = { start, end };
    }
    if (!best) return null;
    const original = (b - a) || 1;
    return best.end - best.start >= Math.min(0.35, original * 0.4) ? best : null;
  };

  const pages: CaptionPage[] = [];
  for (const line of short.captions) {
    const range = mapRange(line.srcStart, line.srcEnd);
    if (!range) continue;
    pages.push(...paginate(line.text, line.emphasis, range.start, range.end));
  }
  pages.sort((a, b) => a.start - b.start);
  // Evita sobreposição entre páginas: cada uma termina quando a próxima começa.
  for (let i = 0; i < pages.length - 1; i++) {
    if (pages[i].end > pages[i + 1].start) {
      pages[i].end = pages[i + 1].start;
      clampWords(pages[i]);
    }
  }

  const callouts = short.callouts
    .map((c) => {
      const t = srcToOut(c.srcTime);
      return t === null ? null : { start: t, end: t + c.duration, text: c.text, style: c.style };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const splashes = short.splashes
    .map((s, index) => {
      const t = srcToOut(s.srcTime);
      return t === null ? null : { t, kind: s.kind, text: s.text, intensity: s.intensity, index };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return {
    fps,
    durationInFrames: frame,
    duration: frame / fps,
    segments,
    pages: pages.filter((p) => p.end - p.start > 0.05),
    callouts,
    splashes,
  };
}

const normalize = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

// Divide uma frase em páginas curtas (estilo TikTok) e distribui o tempo de cada
// palavra proporcional ao número de caracteres — a tradução PT-BR não tem timestamps
// por palavra, então essa é a melhor aproximação sem forced alignment.
export function paginate(text: string, emphasis: string[], start: number, end: number): CaptionPage[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || end <= start) return [];
  const emph = new Set(emphasis.flatMap((e) => e.split(/\s+/)).map(normalize).filter(Boolean));

  const chunks: string[][] = [];
  let current: string[] = [];
  for (const w of words) {
    const len = [...current, w].join(" ").length;
    if (current.length > 0 && (current.length >= MAX_WORDS_PER_PAGE || len > MAX_CHARS_PER_PAGE)) {
      chunks.push(current);
      current = [];
    }
    current.push(w);
    if (/[.!?…]$/.test(w)) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);

  const weight = (w: string) => w.length + 1;
  const total = words.reduce((acc, w) => acc + weight(w), 0);
  const span = end - start;
  let cursor = start;
  return chunks.map((chunk) => {
    const pageStart = cursor;
    const timed: TimedWord[] = chunk.map((w) => {
      const d = (weight(w) / total) * span;
      const tw = { text: w, start: cursor, end: cursor + d, emphasis: emph.has(normalize(w)) };
      cursor += d;
      return tw;
    });
    return { start: pageStart, end: cursor, words: timed };
  });
}

function clampWords(page: CaptionPage) {
  for (const w of page.words) {
    w.start = Math.min(w.start, page.end);
    w.end = Math.min(w.end, page.end);
  }
}
