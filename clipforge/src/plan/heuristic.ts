import { PRESET } from "../config";
import type { Analysis, CaptionLine, Phrase, Short } from "../schema";
import type { Candidate } from "./candidates";
import { normalizeHashtags } from "./director";

const HOOKS: { text: string; sub: string }[] = [
  { text: "VOCÊ NÃO ESTÁ PRONTO PRA ISSO", sub: "assiste até o final" },
  { text: "OLHA O NÍVEL DESSE JOGO", sub: "trailer novo" },
  { text: "ISSO AQUI VAI SER ENORME", sub: "presta atenção nos detalhes" },
  { text: "O TRAILER QUE TODO MUNDO TÁ COMENTANDO", sub: "e com razão" },
  { text: "PARA TUDO E ASSISTE ISSO", sub: "" },
];
const CALLOUTS = ["OLHA ISSO", "BRUTAL", "QUE ISSO?!", "INSANO", "SEGURA ESSA"];
const SPLASH_KINDS = ["impact", "particles", "shockwave", "glitch"] as const;
const CALLOUT_STYLES = ["stamp", "badge", "glitch"] as const;
const ACCENTS = ["#ff3d3d", "#00e5ff", "#b6ff00", "#ff9f1c", "#c084fc"];
const STOPWORDS = new Set(
  "the and for with that this from your you are was were will have what when where they them their there about into just more than then over only also some very which would could should because before after while these those other being been does doing para como mais pelo pela pelos pelas esse essa isso este esta isto aquele aquela você vocês nossa nosso eles elas quando onde porque ainda muito sobre entre depois antes".split(
    " ",
  ),
);

export type HeuristicOptions = {
  // Frases para legendar (ex.: legendas PT-BR importadas com --subs). Padrão: a transcrição.
  phrases?: Phrase[];
};

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a1 > b0 && a0 < b1;
const inRanges = (t: number, ranges: { start: number; end: number }[]) => ranges.some((r) => t >= r.start && t <= r.end);

// Plano sem IA: cada candidato vira um short com cold open (um shot forte de outro trecho do
// trailer, nunca repetido entre shorts), o trecho principal (contínuo ou, com batida clara,
// uma montagem cortada no beat), o logo do jogo no fim, legendas e efeitos nos maiores impactos.
export function heuristicShorts(a: Analysis, candidates: Candidate[], game: string, count: number, opts: HeuristicOptions = {}): Short[] {
  const impacts = [...a.audio.onsets].sort((x, y) => y.strength - x.strength);
  const usedColdOpens = new Set<number>();
  const montageOk = a.audio.beatConfidence >= 0.4 && a.audio.beats.length >= 16;
  const phrases = opts.phrases ?? a.transcript?.phrases ?? [];
  const asciiGame = game.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  return candidates.slice(0, count).map((c, n) => {
    const segments: Short["segments"] = [];
    const cold = pickColdOpen(a, c, usedColdOpens, n);
    if (cold !== null) {
      const s = a.shots[cold];
      usedColdOpens.add(cold);
      segments.push({ srcStart: s.start, srcEnd: Math.min(s.end, s.start + 2), speed: 1, focusX: s.focusX, fit: "crop" });
    }
    // Logo real do jogo sob o card final, se não estiver já dentro do trecho.
    const logo = a.logoShot !== null ? a.shots[a.logoShot] : undefined;
    const logoSeg = logo && !overlaps(c.start, c.end, logo.start, logo.end) && !segments.some((g) => overlaps(g.srcStart, g.srcEnd, logo.start, logo.end))
      ? { srcStart: logo.start, srcEnd: Math.min(logo.end, logo.start + 2.8), speed: 1, focusX: 0.5, fit: "blur" as const }
      : null;
    const used = segments.reduce((acc, g) => acc + g.srcEnd - g.srcStart, 0) + (logoSeg ? logoSeg.srcEnd - logoSeg.srcStart : 0);
    const window = { ...c, end: Math.min(c.end, c.start + PRESET.maxShortSeconds - used) };
    const main = montageOk && n % 2 === 1 ? beatMontage(a, window) : null;
    segments.push(...(main ?? [{ srcStart: window.start, srcEnd: window.end, speed: 1, focusX: 0.5, fit: "crop" as const }]));
    if (logoSeg) segments.push(logoSeg);

    const inside = (t: number) => segments.some((s) => t >= s.srcStart + 0.3 && t <= s.srcEnd - 0.3);
    const top = impacts.filter((o) => inside(o.t) && !inRanges(o.t, a.cards));
    const spaced: typeof top = [];
    for (const o of top) {
      if (spaced.every((s) => Math.abs(s.t - o.t) > 2.5)) spaced.push(o);
      if (spaced.length >= 5) break;
    }
    spaced.sort((x, y) => x.t - y.t);

    const captions: CaptionLine[] = phrases
      .filter((p) => segments.some((s) => overlaps(p.start, p.end, s.srcStart, s.srcEnd)))
      .map((p) => ({ srcStart: p.start, srcEnd: p.end, text: p.text, emphasis: autoEmphasis(p.text), words: p.words.length ? p.words : undefined }));

    const splashes: Short["splashes"] = spaced.map((o, i) => ({
      srcTime: o.t,
      kind: SPLASH_KINDS[(n + i) % SPLASH_KINDS.length],
      text: "",
      intensity: Math.min(1, 0.5 + o.strength / 2),
    }));
    // Um título 3D com o nome do jogo no segundo impacto (o primeiro costuma cair sob o hook).
    if (splashes.length >= 2) splashes[1] = { ...splashes[1], kind: "title3d", text: asciiGame };

    const hook = HOOKS[n % HOOKS.length];
    return {
      id: `short-${String(n + 1).padStart(2, "0")}`,
      title: `${game}: ${capitalize(hook.text.toLowerCase())}`,
      description: `${game} — ${hook.sub ? `${capitalize(hook.sub)}. ` : ""}Comenta o que achou do trailer!`,
      hashtags: normalizeHashtags([game.replace(/[^\p{L}\p{N}]+/gu, ""), "games", "gamer", "gaming", "trailer", "shorts"]),
      hook,
      segments,
      captions,
      callouts: spaced.slice(2, 4).map((o, i) => ({
        srcTime: o.t,
        duration: 1.2,
        text: CALLOUTS[(n + i) % CALLOUTS.length],
        style: CALLOUT_STYLES[(n + i) % CALLOUT_STYLES.length],
      })),
      splashes,
      endCard: { title: game.toUpperCase(), subtitle: "Trailer oficial", cta: "Segue pra mais trailers" },
      accentColor: ACCENTS[n % ACCENTS.length],
    };
  });
}

// As 1–2 palavras mais longas da frase (fora stop-words) viram ênfase nas legendas.
export function autoEmphasis(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w.toLowerCase()));
  return [...new Set(words)].sort((x, y) => y.length - x.length).slice(0, words.length > 6 ? 2 : 1);
}

// Montagem no ritmo: os shots mais fortes da janela, cada um aparado em 2 ou 4 beats,
// em ordem cronológica, até ~25s. Os cortes caem exatamente nos beats.
export function beatMontage(a: Analysis, c: Candidate): Short["segments"] | null {
  const beats = a.audio.beats.filter((b) => b >= c.start && b <= c.end);
  if (beats.length < 8) return null;
  const diffs = beats.slice(1).map((b, i) => b - beats[i]).sort((x, y) => x - y);
  const period = diffs[Math.floor(diffs.length / 2)];
  if (!(period > 0.25 && period < 1.2)) return null;
  const shots = a.shots
    .map((s, i) => ({ s, i, score: s.energy * 0.6 + s.motion * 0.4 }))
    .filter(({ s }) => s.start >= c.start && s.end <= c.end && !inRanges((s.start + s.end) / 2, a.cards) && !inRanges((s.start + s.end) / 2, a.black))
    .sort((x, y) => y.score - x.score);
  const picked: { start: number; end: number }[] = [];
  let total = 0;
  for (const { s, score } of shots) {
    if (total >= 25) break;
    const first = beats.find((b) => b >= s.start + 0.05);
    if (first === undefined) continue;
    const want = score > 0.6 ? 4 : 2;
    let k = want;
    while (k >= 1 && first + k * period > s.end - 0.05) k--;
    if (k < 1) continue;
    const end = beats.find((b) => Math.abs(b - (first + k * period)) < period * 0.3) ?? first + k * period;
    if (picked.some((p) => overlaps(p.start, p.end, first, end))) continue;
    picked.push({ start: first, end });
    total += end - first;
  }
  if (total < 12) return null;
  return picked
    .sort((x, y) => x.start - y.start)
    .map((p) => ({ srcStart: p.start, srcEnd: p.end, speed: 1, focusX: 0.5, fit: "crop" as const }));
}

function pickColdOpen(a: Analysis, c: Candidate, used: Set<number>, n: number): number | null {
  let best: number | null = null;
  let bestScore = 0;
  a.shots.forEach((s, i) => {
    if (s.end > c.start - 1 && s.start < c.end + 1) return; // fora da janela principal
    const mid = (s.start + s.end) / 2;
    if (s.end - s.start < 0.6 || inRanges(mid, a.black) || inRanges(mid, a.cards) || i === a.logoShot) return;
    if ([...used].some((u) => Math.abs((a.shots[u].start + a.shots[u].end) / 2 - mid) < 1.5)) return;
    const score = s.energy * 0.6 + s.motion * 0.4;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  // Shorts seguintes aceitam um cold open um pouco mais fraco, já que os melhores foram usados.
  return bestScore > Math.max(0.2, 0.35 - n * 0.05) ? best : null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
