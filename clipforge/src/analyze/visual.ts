import { run } from "../ffmpeg";

export const VIS_FPS = 6;
export const VIS_W = 160;

export type ShotVisual = {
  focusX: number; // centro horizontal da ação (0..1)
  focusConfidence: number; // 0 = espalhado/parado, 1 = ação concentrada numa faixa 9:16
  centeredness: number; // fração dos detalhes no miolo do quadro (logos/títulos ≈ alto)
  detail: number; // média do gradiente (0..1): texto e logos têm bordas fortes
};

export type GrayFrames = { w: number; h: number; fps: number; frames: Uint8Array[] };

// Decodifica o proxy em cinza 160px a 6 fps: barato e suficiente para foco e cartelas.
export async function decodeGray(proxy: string, width: number, height: number): Promise<GrayFrames> {
  const w = VIS_W;
  const h = Math.max(2, 2 * Math.round((VIS_W * height) / width / 2));
  const { stdout } = await run("ffmpeg", [
    "-hide_banner", "-v", "error",
    "-i", proxy,
    "-an",
    "-vf", `fps=${VIS_FPS},scale=${w}:${h}:flags=area,format=gray`,
    "-f", "rawvideo", "pipe:1",
  ]);
  const size = w * h;
  const frames: Uint8Array[] = [];
  for (let off = 0; off + size <= stdout.length; off += size) frames.push(new Uint8Array(stdout.buffer, stdout.byteOffset + off, size));
  return { w, h, fps: VIS_FPS, frames };
}

// Por shot: onde está a ação (diferença entre frames, mais um pouco de detalhe estático) e quão
// concentrada ela é numa janela da largura do crop 9:16. Também mede se o shot parece um
// cartaz/logo centralizado (detalhe concentrado no miolo).
export function analyzeShotVisual(g: GrayFrames, start: number, end: number, cropFraction: number): ShotVisual {
  const { w, h, fps, frames } = g;
  const a = Math.max(0, Math.ceil(start * fps + 0.5)); // pula o frame do corte
  const b = Math.min(frames.length - 1, Math.floor(end * fps - 0.5));
  const motion = new Float64Array(w);
  const edges = new Float64Array(w);
  let centerEdges = 0;
  let totalEdges = 0;
  let edgeSum = 0;
  let n = 0;
  for (let k = a; k <= b; k++) {
    const f = frames[k];
    const prev = k > a ? frames[k - 1] : null;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      const midRow = y > h * 0.2 && y < h * 0.8;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        const gx = Math.abs(f[i + 1] - f[i - 1]);
        const gy = Math.abs(f[i + w] - f[i - w]);
        const grad = gx + gy;
        edges[x] += grad;
        totalEdges += grad;
        edgeSum += grad;
        if (midRow && x > w * 0.25 && x < w * 0.75) centerEdges += grad;
        if (prev) motion[x] += Math.abs(f[i] - prev[i]);
      }
    }
    n++;
  }
  if (n === 0) return { focusX: 0.5, focusConfidence: 0, centeredness: 0, detail: 0 };

  const motionTotal = motion.reduce((s, v) => s + v, 0);
  const weights = new Float64Array(w);
  // Movimento domina; detalhe estático ajuda em planos parados; leve preferência pelo centro.
  const edgeScale = motionTotal > 0 ? (0.25 * motionTotal) / (totalEdges || 1) : 1;
  for (let x = 0; x < w; x++) {
    const c = (x + 0.5) / w - 0.5;
    weights[x] = (motion[x] + edges[x] * edgeScale) * Math.exp(-(c * c) / (2 * 0.35 * 0.35));
  }
  const total = weights.reduce((s, v) => s + v, 0) || 1;
  // Melhor janela da largura do crop (soma deslizante) e o centróide dentro dela.
  const win = Math.max(1, Math.round(w * Math.min(1, cropFraction)));
  let best = 0;
  let bestStart = 0;
  let acc = 0;
  for (let x = 0; x < w; x++) {
    acc += weights[x];
    if (x >= win) acc -= weights[x - win];
    if (x >= win - 1 && acc > best) {
      best = acc;
      bestStart = x - win + 1;
    }
  }
  let cx = 0;
  let cw = 0;
  for (let x = bestStart; x < bestStart + win; x++) {
    cx += (x + 0.5) * weights[x];
    cw += weights[x];
  }
  const focusX = cw > 0 ? cx / cw / w : 0.5;
  const share = best / total; // fração do "interesse" que cabe no crop
  const baseline = Math.min(1, cropFraction);
  const motionLevel = motionTotal / (n * w * h * 255);
  // Sem movimento quase nenhum, o foco vem só de bordas: confiança reduzida.
  const motionFactor = Math.min(1, motionLevel / 0.01);
  const focusConfidence = Math.max(0, Math.min(1, ((share - baseline) / (1 - baseline)) * (0.4 + 0.6 * motionFactor)));
  return {
    focusX: Math.round(focusX * 1000) / 1000,
    focusConfidence: Math.round(focusConfidence * 1000) / 1000,
    centeredness: totalEdges > 0 ? Math.round((centerEdges / totalEdges) * 1000) / 1000 : 0,
    detail: Math.round(Math.min(1, edgeSum / (n * w * h * 2 * 255) / 0.15) * 1000) / 1000,
  };
}

// Cartelas: shots parados (> 1s) nas pontas do trailer ou antes do primeiro impacto forte —
// classificação etária, logos de publisher, "do estúdio de…", texto legal.
// Logo final: entre os shots parados do fim, o mais "centralizado" (logo grande no meio).
export function detectCards(
  shots: { start: number; end: number; motion: number; centeredness: number; detail: number }[],
  duration: number,
  black: { start: number; end: number }[],
  firstStrongOnset: number | null,
): { cards: { start: number; end: number }[]; logoShot: number | null } {
  const isBlack = (s: { start: number; end: number }) => black.some((b) => b.start <= s.start + 0.1 && b.end >= s.end - 0.1);
  const staticShot = (s: { start: number; end: number; motion: number; detail: number }) =>
    s.end - s.start >= 1 && s.motion < 0.08 && s.detail > 0.02;
  const head = Math.max(duration * 0.15, Math.min(firstStrongOnset ?? 0, duration * 0.25));
  const tailStart = duration * 0.75;

  let logoShot: number | null = null;
  let bestCentered = 0;
  shots.forEach((s, i) => {
    if (s.start < tailStart || isBlack(s) || !staticShot(s)) return;
    if (s.centeredness > bestCentered + 0.02 || (Math.abs(s.centeredness - bestCentered) <= 0.02 && logoShot !== null && i > logoShot)) {
      bestCentered = Math.max(bestCentered, s.centeredness);
      logoShot = i;
    }
  });
  if (bestCentered < 0.45) logoShot = null;

  const cards = shots
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i !== logoShot && !isBlack(s) && staticShot(s) && (s.end <= head || s.start >= tailStart))
    .map(({ s }) => ({ start: s.start, end: s.end }));
  return { cards, logoShot };
}

// Divide takes longos (> maxLen) em sub-shots de ~step segundos, cortando no impacto mais forte
// perto de cada divisão — assim viram candidatos, keyframes e focos próprios.
export function splitLongShots<T extends { start: number; end: number }>(
  shots: T[],
  onsets: { t: number; strength: number }[],
  maxLen = 8,
  step = 4,
): (T & { virtual: boolean })[] {
  const out: (T & { virtual: boolean })[] = [];
  for (const s of shots) {
    const len = s.end - s.start;
    if (len <= maxLen) {
      out.push({ ...s, virtual: false });
      continue;
    }
    const pieces = Math.max(2, Math.round(len / step));
    const cuts: number[] = [];
    for (let k = 1; k < pieces; k++) {
      const target = s.start + (len * k) / pieces;
      const near = onsets.filter((o) => Math.abs(o.t - target) < step * 0.35 && o.t > s.start + 1 && o.t < s.end - 1);
      const pick = near.length ? near.reduce((x, y) => (y.strength > x.strength ? y : x)).t : target;
      if (!cuts.length || pick - cuts[cuts.length - 1] > 1) cuts.push(pick);
    }
    const bounds = [s.start, ...cuts, s.end];
    for (let k = 0; k < bounds.length - 1; k++) out.push({ ...s, start: bounds[k], end: bounds[k + 1], virtual: true });
  }
  return out;
}
