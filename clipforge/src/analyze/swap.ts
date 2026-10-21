import fs from "node:fs";
import path from "node:path";
import { projectPath, workPath } from "../config";
import { decodePcm } from "../ffmpeg";
import { loadPlan, savePlan } from "../plan/index";
import { splitByShots } from "../plan/snap";
import { EditPlanSchema, type Analysis, type EditPlan } from "../schema";
import { analyze } from "./index";

const SR = 8000;
const HOP = 0.01; // envelope a 100 Hz

// Envelope de energia em log (dB), centrado — base para alinhar duas versões do mesmo trailer.
export function energyEnvelope(pcm: Float32Array, sr = SR, hop = HOP): Float32Array {
  const step = Math.max(1, Math.round(sr * hop));
  const n = Math.floor(pcm.length / step);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * step; j < (i + 1) * step; j++) s += pcm[j] * pcm[j];
    env[i] = 10 * Math.log10(s / step + 1e-9);
  }
  let mean = 0;
  for (const v of env) mean += v;
  mean /= n || 1;
  for (let i = 0; i < n; i++) env[i] -= mean;
  return env;
}

// Deslocamento (em segundos) que leva um tempo do áudio antigo ao novo: novo = antigo + offset.
// Correlação normalizada dos envelopes numa janela [from, to) do antigo, buscando ±maxShift.
export function findOffset(oldEnv: Float32Array, newEnv: Float32Array, opts: { from?: number; to?: number; maxShift?: number; around?: number } = {}): { offset: number; score: number } {
  const a0 = Math.max(0, Math.round((opts.from ?? 0) / HOP));
  const a1 = Math.min(oldEnv.length, Math.round((opts.to ?? oldEnv.length * HOP) / HOP));
  const center = Math.round((opts.around ?? 0) / HOP);
  const max = Math.round((opts.maxShift ?? 30) / HOP);
  let best = { lag: 0, score: -Infinity };
  for (let lag = center - max; lag <= center + max; lag++) {
    let num = 0;
    let da = 0;
    let db = 0;
    let n = 0;
    for (let i = a0; i < a1; i++) {
      const j = i + lag;
      if (j < 0 || j >= newEnv.length) continue;
      num += oldEnv[i] * newEnv[j];
      da += oldEnv[i] * oldEnv[i];
      db += newEnv[j] * newEnv[j];
      n++;
    }
    if (n < (a1 - a0) * 0.6) continue;
    const score = num / Math.sqrt(da * db + 1e-12);
    if (score > best.score) best = { lag, score };
  }
  return { offset: best.lag * HOP, score: best.score };
}

// Envelope guardado junto do plano: alinha a troca de fonte mesmo sem o proxy antigo
// (container novo, outra máquina). ~10 KB por minuto de trailer.
export function writeEnvelope(file: string, env: Float32Array) {
  fs.writeFileSync(file, JSON.stringify({ hop: HOP, sr: SR, db: Array.from(env, (v) => Math.round(v * 10) / 10) }));
}

export function readEnvelope(file: string): Float32Array {
  const { hop, db } = JSON.parse(fs.readFileSync(file, "utf8")) as { hop: number; db: number[] };
  if (hop !== HOP || !Array.isArray(db)) throw new Error(`${file}: envelope em formato inesperado.`);
  return Float32Array.from(db);
}

// Guarda o plano e o envelope do áudio em projects/<slug>/ para versionar no git.
export async function keepProject(slug: string): Promise<string> {
  const plan = loadPlan(slug);
  const dir = projectPath(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  const proxy = workPath(slug, "source.mp4");
  if (fs.existsSync(proxy)) writeEnvelope(path.join(dir, "source-envelope.json"), energyEnvelope(await decodePcm(proxy, SR)));
  return dir;
}

// Aplica os deslocamentos ao plano: cada segmento com o seu, e eventos (legendas, callouts,
// splashes) com o do segmento mais próximo. A narração está no tempo do short e não muda.
export function shiftPlan(plan: EditPlan, segOffsets: number[][]): EditPlan {
  const shorts = plan.shorts.map((s, si) => {
    const offs = segOffsets[si];
    const offsetAt = (t: number) => {
      let best = 0;
      let dist = Infinity;
      s.segments.forEach((g, gi) => {
        const d = t < g.srcStart ? g.srcStart - t : t > g.srcEnd ? t - g.srcEnd : 0;
        if (d < dist) {
          dist = d;
          best = offs[gi];
        }
      });
      return best;
    };
    const r = (v: number) => Math.max(0, Math.round(v * 1000) / 1000);
    return {
      ...s,
      segments: s.segments.map((g, gi) => ({ ...g, srcStart: r(g.srcStart + offs[gi]), srcEnd: r(g.srcEnd + offs[gi]) })),
      captions: s.captions.map((c) => {
        const o = offsetAt(c.srcStart);
        return { ...c, srcStart: r(c.srcStart + o), srcEnd: r(c.srcEnd + o), words: c.words?.map((w) => ({ ...w, start: w.start + o, end: w.end + o })) };
      }),
      callouts: s.callouts.map((c) => ({ ...c, srcTime: r(c.srcTime + offsetAt(c.srcTime)) })),
      splashes: s.splashes.map((x) => ({ ...x, srcTime: r(x.srcTime + offsetAt(x.srcTime)) })),
    };
  });
  return { ...plan, shorts };
}

// Troca a fonte de um plano (ex.: 360p → 1080p do mesmo trailer) sem refazer o roteiro.
export async function swapSource(slug: string, file: string, opts: { refit?: boolean } = {}): Promise<EditPlan> {
  const plan = loadPlan(slug);
  const oldProxy = workPath(slug, "source.mp4");
  const kept = projectPath(slug, "source-envelope.json");
  // O envelope do áudio antigo fica em memória: o reingest a seguir apaga o proxy antigo.
  let oldEnv: Float32Array;
  if (fs.existsSync(oldProxy)) oldEnv = energyEnvelope(await decodePcm(oldProxy, SR));
  else if (fs.existsSync(kept)) oldEnv = readEnvelope(kept);
  else throw new Error(`Sem o proxy antigo (${oldProxy}) nem projects/${slug}/source-envelope.json para alinhar o áudio.`);

  const analysis: Analysis = await analyze(file, slug, { force: true });
  const newEnv = energyEnvelope(await decodePcm(workPath(slug, "source.mp4"), SR));
  const global = findOffset(oldEnv, newEnv, { maxShift: 30 });
  console.log(`• troca de fonte: deslocamento global ${global.offset.toFixed(2)}s (correlação ${global.score.toFixed(2)})`);
  if (global.score < 0.5) console.warn("⚠ correlação baixa: os dois arquivos podem não ser o mesmo trailer. Confira o preview.");

  // Refina por segmento (reuploads às vezes cortam/emendam trechos).
  const segOffsets = plan.shorts.map((s) =>
    s.segments.map((g) => {
      const local = findOffset(oldEnv, newEnv, { from: g.srcStart - 0.5, to: g.srcEnd + 0.5, around: global.offset, maxShift: 1.5 });
      return local.score > 0.6 ? local.offset : global.offset;
    }),
  );
  let shifted = shiftPlan(plan, segOffsets);
  shifted = {
    ...shifted,
    source: {
      file: analysis.source.file,
      bgFile: analysis.source.bgFile,
      duration: analysis.source.duration,
      fps: analysis.source.fps,
      width: analysis.source.width,
      height: analysis.source.height,
    },
    beats: analysis.audio.beatConfidence >= 0.4 ? analysis.audio.beats : [],
  };
  // Com resolução melhor, o enquadramento pode voltar a seguir o foco de cada shot.
  if (opts.refit) shifted.shorts = shifted.shorts.map((s) => ({ ...s, segments: splitByShots(s.segments, analysis, true) }));
  const valid = EditPlanSchema.parse(shifted);
  savePlan(slug, valid);
  if (fs.existsSync(projectPath(slug))) await keepProject(slug); // o guardado passa a apontar para a fonte nova
  console.log(`✓ plano agora usa ${analysis.source.width}x${analysis.source.height} (${file}).`);
  return valid;
}
