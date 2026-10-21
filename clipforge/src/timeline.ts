// Converte um Short (eventos em tempo da fonte) para a linha do tempo do vídeo final.
// Puro e sem dependências de Node: usado tanto pelo pipeline quanto pelo Remotion.
import type { Short, SplashSchema, CalloutStyleSchema } from "./schema";
import type { z } from "zod";

export const FPS = 30;
export const HOOK_SECONDS = 2.6;
export const END_CARD_SECONDS = 2.8;
const MAX_WORDS_PER_PAGE = 4;
const MAX_CHARS_PER_PAGE = 24;
const MIN_LINE_COVERAGE = 0.6; // fração da frase que precisa estar no short para ser legendada
const MIN_PAGE = 0.25;

// Quanto tempo cada efeito ocupa na tela (para não começar um efeito que o card final cobriria).
export const SPLASH_WINDOW: Record<string, number> = { particles: 1.3, shockwave: 1.0, title3d: 1.8, impact: 0.5, flash: 0.4, glitch: 0.4 };

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
  endCardStart: number;
  narration: { start: number; end: number; text: string }[]; // falas da narração (tempo do short)
  beats: number[]; // beats da música no tempo do short (para o pulso de câmera)
  segments: ResolvedSegment[];
  pages: CaptionPage[];
  callouts: { start: number; end: number; text: string; style: z.infer<typeof CalloutStyleSchema> }[];
  splashes: { t: number; kind: z.infer<typeof SplashSchema>["kind"]; text: string; intensity: number; index: number }[];
};

export function segmentOutDuration(seg: { srcStart: number; srcEnd: number; speed: number }): number {
  return Math.max(0, seg.srcEnd - seg.srcStart) / seg.speed;
}

// Trechos contínuos da fonte (segmentos colados, mesmo com velocidades diferentes) formam um "run":
// dentro dele o tempo da fonte mapeia para o do short sem buracos.
type Run = { srcStart: number; srcEnd: number; segs: ResolvedSegment[] };

function buildRuns(segments: ResolvedSegment[]): Run[] {
  const runs: Run[] = [];
  for (const s of segments) {
    const last = runs[runs.length - 1];
    if (last && !s.jump) {
      last.segs.push(s);
      last.srcEnd = s.srcEnd;
    } else {
      runs.push({ srcStart: s.srcStart, srcEnd: s.srcEnd, segs: [s] });
    }
  }
  return runs;
}

function mapInRun(run: Run, t: number): number {
  for (const s of run.segs) {
    if (t <= s.srcEnd + 1e-6) return s.outStart + (Math.max(t, s.srcStart) - s.srcStart) / s.speed;
  }
  const last = run.segs[run.segs.length - 1];
  return last.outEnd;
}

export function resolveTimeline(short: Short, fps: number, sourceBeats: number[] = []): ResolvedTimeline {
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
  const duration = frame / fps;
  // Card final só existe em shorts que comportam hook + card sem se sobreporem.
  const endCardStart = duration > HOOK_SECONDS + END_CARD_SECONDS + 1 ? duration - END_CARD_SECONDS : duration;
  const runs = buildRuns(segments);

  const srcToOut = (t: number): number | null => {
    for (const r of runs) if (t >= r.srcStart && t <= r.srcEnd) return mapInRun(r, t);
    return null;
  };

  // ---- Legendas ----
  // Narração normalizada uma vez (em ordem, sem sobreposição, dentro do short): legendas,
  // ducking, roteiro e .srt usam os mesmos tempos. As palavras seguem o fim original da fala,
  // para o ritmo não acelerar quando ela passa do fim do vídeo (o card final corta as páginas).
  const narration: { start: number; end: number; wordsEnd: number; text: string; emphasis: string[] }[] = [];
  for (const n of [...short.narration].sort((x, y) => x.start - y.start)) {
    const text = n.text.trim();
    const prev = narration[narration.length - 1];
    const start = Math.max(0, n.start, prev ? prev.end : 0);
    const end = Math.min(duration, n.end);
    if (!text || end - start < MIN_PAGE) continue;
    narration.push({ start, end, wordsEnd: Math.max(end, n.end), text, emphasis: n.emphasis });
  }
  const underNarration = (a: number, b: number) => narration.some((n) => a < n.end && b > n.start);
  const lines: TimedWord[][] = [];
  for (const line of short.captions) {
    const words = sourceWords(line);
    if (!words.length) continue;
    const totalChars = words.reduce((acc, w) => acc + w.text.length + 1, 0);
    // O run que contém mais da frase; palavras fora dele são descartadas.
    let best: { run: Run; kept: typeof words; chars: number } | null = null;
    for (const run of runs) {
      const kept = words.filter((w) => (w.start + w.end) / 2 >= run.srcStart && (w.start + w.end) / 2 <= run.srcEnd);
      const chars = kept.reduce((acc, w) => acc + w.text.length + 1, 0);
      if (!best || chars > best.chars) best = { run, kept, chars };
    }
    if (!best || best.chars / totalChars < MIN_LINE_COVERAGE) continue;
    const { run } = best;
    const mapped = best.kept.map((w) => ({
      text: w.text,
      start: mapInRun(run, Math.max(w.start, run.srcStart)),
      end: mapInRun(run, Math.min(w.end, run.srcEnd)),
      emphasis: w.emphasis,
    }));
    // A narração tem prioridade: palavras da fala original por baixo dela não viram legenda.
    // O resto da frase continua, em trechos contínuos (sem sobra de uma palavra só).
    let part: TimedWord[] = [];
    const flush = () => {
      if (part.length >= 2 || (part.length && part.length === mapped.length)) lines.push(part);
      part = [];
    };
    for (const w of mapped) {
      if (underNarration(w.start, w.end)) flush();
      else part.push(w);
    }
    flush();
  }
  // Narração: já está no tempo do short; palavras distribuídas pela duração de cada fala.
  for (const n of narration) {
    const words = sourceWords({ srcStart: n.start, srcEnd: n.wordsEnd, text: n.text, emphasis: n.emphasis });
    if (words.length) lines.push(words);
  }
  lines.sort((x, y) => x[0].start - y[0].start);
  // Frases sobrepostas: a seguinte espera a anterior terminar (comprimida no tempo que sobra).
  for (let i = 1; i < lines.length; i++) {
    const prevEnd = lines[i - 1][lines[i - 1].length - 1].end;
    const cur = lines[i];
    const start = cur[0].start;
    const end = cur[cur.length - 1].end;
    if (start >= prevEnd) continue;
    if (end - prevEnd < MIN_PAGE) {
      lines.splice(i--, 1);
      continue;
    }
    const k = (end - prevEnd) / (end - start);
    for (const w of cur) {
      w.start = prevEnd + (w.start - start) * k;
      w.end = prevEnd + (w.end - start) * k;
    }
  }
  const pages = lines
    .flatMap((ws) => chunkPages(ws))
    .map((p) => clampPage(p, endCardStart))
    .filter((p): p is CaptionPage => p !== null && p.end - p.start >= MIN_PAGE);

  // ---- Callouts: depois do hook e antes do card final ----
  const callouts = short.callouts
    .map((c) => {
      const t = srcToOut(c.srcTime);
      if (t === null) return null;
      const start = Math.max(t, HOOK_SECONDS + 0.1);
      const end = Math.min(start + c.duration, endCardStart);
      return end - start >= 0.5 ? { start, end, text: c.text, style: c.style } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // ---- Splashes: nada que o card final cubra; título 3D não briga com o hook ----
  const splashes = short.splashes
    .map((s, index) => {
      const t = srcToOut(s.srcTime);
      if (t === null) return null;
      if (t + (SPLASH_WINDOW[s.kind] ?? 0.5) > endCardStart + 0.05) return null;
      if (s.kind === "title3d" && t < HOOK_SECONDS) return null;
      return { t, kind: s.kind, text: s.text, intensity: s.intensity, index };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Callout em cima de um título 3D disputa o mesmo espaço: o título ganha.
  const titles = splashes.filter((s) => s.kind === "title3d").map((s) => [s.t, s.t + SPLASH_WINDOW.title3d]);
  const freeCallouts = callouts.filter((c) => !titles.some(([a, b]) => c.start < b && c.end > a));

  const beats = sourceBeats
    .map((b) => srcToOut(b))
    .filter((t): t is number => t !== null && t > 0.2 && t < endCardStart)
    .sort((x, y) => x - y)
    .filter((t, i, arr) => i === 0 || t - arr[i - 1] > 0.2);

  return {
    fps,
    durationInFrames: frame,
    duration,
    endCardStart,
    narration: narration.map(({ start, end, text }) => ({ start, end, text })),
    beats,
    segments,
    pages,
    callouts: freeCallouts,
    splashes,
  };
}

const normalize = (w: string) =>
  w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

// Palavras da frase com tempo na fonte: as do whisper quando batem com o texto; senão,
// estimadas pelo tamanho de cada palavra (traduções PT-BR não têm timestamps por palavra).
function sourceWords(line: Short["captions"][number]): { text: string; start: number; end: number; emphasis: boolean }[] {
  const emph = new Set(line.emphasis.flatMap((e) => e.split(/\s+/)).map(normalize).filter(Boolean));
  const texts = line.text.split(/\s+/).filter(Boolean);
  if (!texts.length || line.srcEnd <= line.srcStart) return [];
  if (line.words && line.words.length === texts.length) {
    return line.words.map((w, i) => ({ text: texts[i], start: w.start, end: w.end, emphasis: emph.has(normalize(texts[i])) }));
  }
  const weight = (w: string) => w.length + 1;
  const total = texts.reduce((acc, w) => acc + weight(w), 0);
  const span = line.srcEnd - line.srcStart;
  let cursor = line.srcStart;
  return texts.map((text) => {
    const d = (weight(text) / total) * span;
    const w = { text, start: cursor, end: cursor + d, emphasis: emph.has(normalize(text)) };
    cursor += d;
    return w;
  });
}

// Páginas curtas estilo TikTok (até 4 palavras / 24 caracteres, quebra em fim de frase).
// 5 palavras só quando cabem nos 24 caracteres e evitam uma quebra pior.
const MAX_WORDS_HARD = 5;
// Palavras que não devem fechar uma página ("…Leonida, a" / "versão do GTA").
const WEAK_END = /^(a|o|as|os|e|é|de|do|da|dos|das|no|na|nos|nas|em|um|uma|com|pra|pro|que|por|se|the|of|and|to|in|is|an)$/i;

// "Weazel | News", "GTA | 6": a quebra cairia no meio de um nome.
const splitsName = (a: string, b: string) => !/[,;:.!?…]$/.test(a) && /^\p{Lu}/u.test(a) && /^[\p{Lu}\d]/u.test(b);

// Quebra uma frase em páginas pelo menor custo: poucas páginas, sem palavra sozinha,
// de preferência depois de vírgula, sem fechar em artigo/preposição nem partir nomes
// ("Weazel | News", "Tom | Petty", "GTA | 6").
function splitSentence(words: TimedWord[]): TimedWord[][] {
  const n = words.length;
  const pageCost = (j: number, i: number): number => {
    const size = i - j;
    const text = words.slice(j, i).map((w) => w.text).join(" ");
    if (size > 1 && (size > MAX_WORDS_HARD || text.length > MAX_CHARS_PER_PAGE)) return Infinity;
    const last = words[i - 1].text;
    let c = 1 + 0.1 * (MAX_WORDS_PER_PAGE - size) ** 2;
    if (size > MAX_WORDS_PER_PAGE) c += 0.6;
    if (size === 1 && n > 1) c += 1.5;
    if (i < n) {
      const soft = /[,;:]$/.test(last);
      if (!soft) c += 0.3;
      if (WEAK_END.test(last)) c += 2;
      if (splitsName(last, words[i].text)) c += 1.5;
    }
    return c;
  };
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_WORDS_HARD); j < i; j++) {
      const c = best[j] + pageCost(j, i);
      if (c < best[i]) {
        best[i] = c;
        from[i] = j;
      }
    }
  }
  const out: TimedWord[][] = [];
  for (let i = n; i > 0; i = from[i]) out.unshift(words.slice(from[i], i));
  return out;
}

function chunkPages(words: TimedWord[]): CaptionPage[] {
  const sentences: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) {
      sentences.push(cur);
      cur = [];
    }
  }
  if (cur.length) sentences.push(cur);
  const pages: CaptionPage[] = sentences
    .flatMap(splitSentence)
    .map((ws) => ({ start: ws[0].start, end: ws[ws.length - 1].end, words: ws }));
  // Cada página fica na tela até a próxima começar (sem "piscar" entre palavras próximas).
  for (let i = 0; i < pages.length - 1; i++) {
    const gap = pages[i + 1].start - pages[i].end;
    if (gap > 0 && gap < 0.6) pages[i].end = pages[i + 1].start;
  }
  return pages;
}

function clampPage(p: CaptionPage, limit: number): CaptionPage | null {
  if (p.start >= limit) return null;
  if (p.end <= limit) return p;
  const words = p.words.filter((w) => w.start < limit).map((w) => ({ ...w, end: Math.min(w.end, limit) }));
  return words.length ? { start: p.start, end: limit, words } : null;
}

// Página que não cabe numa linha vira duas linhas equilibradas, sem partir nomes nem fechar a
// primeira linha em artigo/preposição ("COM A / VICE CITY", não "COM A VICE / CITY").
const ONE_LINE_CHARS = 15;
const rowLength = (ws: { text: string; emphasis: boolean }[]) => ws.reduce((acc, w) => acc + w.text.length + (w.emphasis ? 2 : 0), 0) + ws.length - 1;
export function captionRows<W extends { text: string; emphasis: boolean }>(words: W[]): W[][] {
  if (words.length < 2 || rowLength(words) <= ONE_LINE_CHARS) return [words];
  let cut = 1;
  let best = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words[k - 1].text;
    const cost = Math.max(rowLength(words.slice(0, k)), rowLength(words.slice(k))) + (WEAK_END.test(a) ? 4 : 0) + (splitsName(a, words[k].text) ? 100 : 0);
    if (cost < best) {
      best = cost;
      cut = k;
    }
  }
  return [words.slice(0, cut), words.slice(cut)];
}

// Mantido para uso direto (e testes): distribui uma frase num intervalo do short.
export function paginate(text: string, emphasis: string[], start: number, end: number): CaptionPage[] {
  const words = sourceWords({ srcStart: start, srcEnd: end, text, emphasis });
  return chunkPages(words);
}
