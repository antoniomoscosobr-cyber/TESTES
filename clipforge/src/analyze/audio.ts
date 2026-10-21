import FFT from "fft.js";

export const AUDIO_SR = 22050;
const FRAME = 1024;
const HOP = 512;
export const HOP_SECONDS = HOP / AUDIO_SR;
const OUT_HOP = 0.1; // resolução das curvas salvas no analysis.json

export type AudioAnalysis = {
  hop: number;
  energy: number[];
  onsetEnvelope: number[];
  onsets: { t: number; strength: number }[];
  bpm: number | null;
  beatConfidence: number;
  beats: number[];
  // Curvas em resolução cheia (HOP_SECONDS), usadas pelo scoring e não salvas.
  raw: { energy: Float32Array; envelope: Float32Array };
};

export function analyzeAudio(pcm: Float32Array): AudioAnalysis {
  const nFrames = Math.max(0, Math.floor((pcm.length - FRAME) / HOP) + 1);
  const energy = new Float32Array(nFrames);
  const flux = new Float32Array(nFrames);
  const fft = new FFT(FRAME);
  const window = new Float32Array(FRAME).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));
  const input = new Array<number>(FRAME).fill(0);
  const spectrum = fft.createComplexArray() as number[];
  let prev = new Float32Array(FRAME / 2);
  let cur = new Float32Array(FRAME / 2);

  for (let f = 0; f < nFrames; f++) {
    const off = f * HOP;
    let sq = 0;
    for (let i = 0; i < FRAME; i++) {
      const s = pcm[off + i];
      sq += s * s;
      input[i] = s * window[i];
    }
    energy[f] = Math.sqrt(sq / FRAME);
    fft.realTransform(spectrum, input);
    let fl = 0;
    for (let k = 0; k < FRAME / 2; k++) {
      const re = spectrum[2 * k];
      const im = spectrum[2 * k + 1];
      cur[k] = Math.log1p(100 * Math.sqrt(re * re + im * im));
      const d = cur[k] - prev[k];
      if (d > 0) fl += d;
    }
    flux[f] = f === 0 ? 0 : fl;
    [prev, cur] = [cur, prev];
  }

  normalizeInPlace(energy, 0.98);
  const envelope = onsetEnvelope(flux);
  const onsets = pickOnsets(envelope).map((o) => ({ t: o.t, strength: impactStrength(o, energy) }));
  const tempo = estimateTempo(envelope);
  const beats = tempo.period ? trackBeats(envelope, tempo.period) : [];

  return {
    hop: OUT_HOP,
    energy: downsample(energy, "mean"),
    onsetEnvelope: downsample(envelope, "max"),
    onsets,
    bpm: tempo.period ? round(60 / (tempo.period * HOP_SECONDS), 1) : null,
    beatConfidence: round(tempo.confidence, 3),
    beats: beats.map((b) => round(b * HOP_SECONDS, 3)),
    raw: { energy, envelope },
  };
}

// Spectral flux menos a média local (realça ataques), normalizado em 0..1.
function onsetEnvelope(flux: Float32Array): Float32Array {
  const env = new Float32Array(flux.length);
  const w = 8;
  for (let i = 0; i < flux.length; i++) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(flux.length - 1, i + w); j++) {
      sum += flux[j];
      n++;
    }
    env[i] = Math.max(0, flux[i] - sum / n);
  }
  normalizeInPlace(env, 0.995);
  return env;
}

function pickOnsets(env: Float32Array): { t: number; strength: number }[] {
  const out: { t: number; strength: number }[] = [];
  const minGap = Math.round(0.1 / HOP_SECONDS);
  const local = 5;
  const meanW = 22;
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    const v = env[i];
    if (v < 0.12) continue;
    let isMax = true;
    for (let j = Math.max(0, i - local); j <= Math.min(env.length - 1, i + local); j++) {
      if (env[j] > v) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - meanW); j <= Math.min(env.length - 1, i + meanW); j++) {
      sum += env[j];
      n++;
    }
    if (v < (sum / n) * 1.4 + 0.04) continue;
    if (i - last < minGap) continue;
    out.push({ t: round(i * HOP_SECONDS, 3), strength: round(v, 3) });
    last = i;
  }
  return out;
}

// Impacto = ataque espectral + salto de energia (booms graves quase não aparecem no flux).
function impactStrength(o: { t: number; strength: number }, energy: Float32Array): number {
  const after = curveMean(energy, o.t, o.t + 0.15);
  const before = curveMean(energy, o.t - 0.3, o.t - 0.05);
  const rise = Math.max(0, Math.min(1, (after - before) * 3));
  return round(0.55 * o.strength + 0.45 * rise, 3);
}

// Autocorrelação do envelope com peso log-gaussiano em torno de 120 BPM.
export function estimateTempo(env: Float32Array): { period: number | null; confidence: number } {
  const toLag = (bpm: number) => 60 / bpm / HOP_SECONDS;
  const minLag = Math.floor(toLag(185));
  const maxLag = Math.ceil(toLag(65));
  if (env.length < maxLag * 4) return { period: null, confidence: 0 };
  let mean = 0;
  for (const v of env) mean += v;
  mean /= env.length;
  const c = Array.from(env, (v) => v - mean);
  const ac0 = c.reduce((acc, v) => acc + v * v, 0) || 1;
  const acf = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < c.length; i++) s += c[i] * c[i + lag];
    return s / ac0;
  };
  let best = 0;
  let bestLag = 0;
  let bestRaw = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const raw = acf(lag);
    const bpm = 60 / (lag * HOP_SECONDS);
    const weight = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    if (raw * weight > best) {
      best = raw * weight;
      bestLag = lag;
      bestRaw = raw;
    }
  }
  if (!bestLag) return { period: null, confidence: 0 };
  // Interpolação parabólica para um período fracionário (o hop de ~23ms quantiza demais o BPM).
  const a = acf(bestLag - 1);
  const b = bestRaw;
  const d = acf(bestLag + 1);
  const denom = a - 2 * b + d;
  const shift = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - d)) / denom)) : 0;
  return { period: bestLag + shift, confidence: Math.max(0, Math.min(1, bestRaw)) };
}

// Beat tracking por programação dinâmica (Ellis, 2007): segue o envelope de onsets
// tolerando pequenas variações de andamento.
export function trackBeats(env: Float32Array, period: number, tightness = 100): number[] {
  const n = env.length;
  const score = new Float64Array(n);
  const backlink = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let i = 0; i < n; i++) {
    let bestVal = -Infinity;
    let bestJ = -1;
    for (let j = i - hi; j <= i - lo; j++) {
      if (j < 0) continue;
      const pen = -tightness * Math.pow(Math.log((i - j) / period), 2);
      const v = score[j] + pen;
      if (v > bestVal) {
        bestVal = v;
        bestJ = j;
      }
    }
    score[i] = env[i] + (bestJ >= 0 ? Math.max(0, bestVal) : 0);
    backlink[i] = bestVal > 0 ? bestJ : -1;
  }
  // Começa do melhor score no último período.
  let end = n - 1;
  for (let i = Math.max(0, n - Math.round(period)); i < n; i++) if (score[i] > score[end]) end = i;
  const beats: number[] = [];
  for (let i = end; i >= 0; i = backlink[i]) {
    beats.push(i);
    if (backlink[i] < 0) break;
  }
  return beats.reverse();
}

function normalizeInPlace(arr: Float32Array, percentile: number) {
  if (arr.length === 0) return;
  const sorted = Float32Array.from(arr).sort();
  const ref = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentile))] || 1;
  for (let i = 0; i < arr.length; i++) arr[i] = Math.min(1, arr[i] / ref);
}

function downsample(arr: Float32Array, mode: "mean" | "max"): number[] {
  const step = Math.max(1, Math.round(OUT_HOP / HOP_SECONDS));
  const out: number[] = [];
  for (let i = 0; i < arr.length; i += step) {
    let acc = 0;
    let n = 0;
    for (let j = i; j < Math.min(arr.length, i + step); j++) {
      acc = mode === "max" ? Math.max(acc, arr[j]) : acc + arr[j];
      n++;
    }
    out.push(round(mode === "max" ? acc : acc / n, 3));
  }
  return out;
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

// Média de uma curva bruta (HOP_SECONDS) num intervalo em segundos.
export function curveMean(curve: Float32Array, start: number, end: number): number {
  const a = Math.max(0, Math.floor(start / HOP_SECONDS));
  const b = Math.min(curve.length, Math.ceil(end / HOP_SECONDS));
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += curve[i];
  return s / (b - a);
}
