import fs from "node:fs";
import path from "node:path";
import { projectPath, workPath } from "../config";
import { decodePcm } from "../ffmpeg";
import { loadPlan, sameSource, savePlan } from "../plan/index";
import { splitByShots } from "../plan/snap";
import { EditPlanSchema, type Analysis, type EditPlan } from "../schema";
import { analyze, loadAnalysis } from "./index";

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
// Correlação de Pearson dos envelopes numa janela [from, to) do antigo, buscando ±maxShift em
// torno de `around`. Tirar a média de cada janela faz só o formato do som contar: um trecho
// qualquer com o mesmo volume médio não passa por "parecido".
export function findOffset(oldEnv: Float32Array, newEnv: Float32Array, opts: { from?: number; to?: number; maxShift?: number; around?: number } = {}): { offset: number; score: number } {
  const a0 = Math.max(0, Math.round((opts.from ?? 0) / HOP));
  const a1 = Math.min(oldEnv.length, Math.round((opts.to ?? oldEnv.length * HOP) / HOP));
  const center = Math.round((opts.around ?? 0) / HOP);
  const max = Math.round((opts.maxShift ?? 30) / HOP);
  let best = { lag: 0, score: -Infinity };
  for (let lag = center - max; lag <= center + max; lag++) {
    let sa = 0;
    let sb = 0;
    let saa = 0;
    let sbb = 0;
    let sab = 0;
    let n = 0;
    for (let i = a0; i < a1; i++) {
      const j = i + lag;
      if (j < 0 || j >= newEnv.length) continue;
      const x = oldEnv[i];
      const y = newEnv[j];
      sa += x;
      sb += y;
      saa += x * x;
      sbb += y * y;
      sab += x * y;
      n++;
    }
    if (n < 2 || n < (a1 - a0) * 0.6) continue;
    const score = (sab - (sa * sb) / n) / Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n) + 1e-12);
    if (score > best.score) best = { lag, score };
  }
  return { offset: best.lag * HOP, score: best.score };
}

// Envelope guardado junto do plano: alinha a troca de fonte mesmo sem o proxy antigo
// (container novo, outra máquina). ~10 KB por minuto de trailer. Leva a "forma" da fonte
// (duração/resolução) para não ser usado com o plano de outra versão.
type SourceShape = { duration: number; width: number; height: number };
export function writeEnvelope(file: string, env: Float32Array, source?: SourceShape) {
  const shape = source && { duration: source.duration, width: source.width, height: source.height };
  fs.writeFileSync(file, JSON.stringify({ hop: HOP, sr: SR, source: shape, db: Array.from(env, (v) => Math.round(v * 10) / 10) }));
}

export function readEnvelope(file: string): { env: Float32Array; source?: SourceShape } {
  const { hop, db, source } = JSON.parse(fs.readFileSync(file, "utf8")) as { hop: number; db: number[]; source?: SourceShape };
  if (hop !== HOP || !Array.isArray(db)) throw new Error(`${file}: envelope em formato inesperado.`);
  return { env: Float32Array.from(db), source };
}

// Guarda o plano e o envelope do áudio em projects/<slug>/ para versionar no git.
export async function keepProject(slug: string): Promise<string> {
  const plan = loadPlan(slug);
  const dir = projectPath(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  const envFile = path.join(dir, "source-envelope.json");
  const proxy = workPath(slug, "source.mp4");
  const analysis = fs.existsSync(workPath(slug, "analysis.json")) ? loadAnalysis(slug) : null;
  if (analysis && fs.existsSync(proxy) && analysis.source.hasAudio && sameSource(analysis.source, plan.source)) {
    writeEnvelope(envFile, energyEnvelope(await decodePcm(proxy, SR)), plan.source);
  } else {
    // Um envelope de outra versão do trailer não serve mais para este plano.
    const old = fs.existsSync(envFile) ? readEnvelope(envFile).source : undefined;
    if (old && !sameSource(old, plan.source)) fs.rmSync(envFile, { force: true });
    if (!fs.existsSync(envFile)) console.warn(`⚠ sem o áudio da fonte do plano aqui: a assinatura para swap-source não foi guardada.`);
  }
  return dir;
}

// Envelope do áudio da fonte para a qual o plano foi feito: do proxy local, se for esse mesmo
// arquivo, ou do guardado em projects/<slug>/.
async function planSourceEnvelope(slug: string, plan: EditPlan): Promise<Float32Array> {
  const proxy = workPath(slug, "source.mp4");
  const kept = projectPath(slug, "source-envelope.json");
  const analysis = fs.existsSync(workPath(slug, "analysis.json")) ? loadAnalysis(slug) : null;
  const proxyIsPlanSource = fs.existsSync(proxy) && (analysis ? sameSource(analysis.source, plan.source) : !fs.existsSync(kept));
  if (proxyIsPlanSource) {
    if (analysis && !analysis.source.hasAudio) throw new Error("A fonte atual não tem áudio: a troca de fonte alinha os dois arquivos pelo som.");
    return energyEnvelope(await decodePcm(proxy, SR));
  }
  if (fs.existsSync(kept)) {
    const { env, source } = readEnvelope(kept);
    if (!source || sameSource(source, plan.source)) return env;
    throw new Error(`projects/${slug}/source-envelope.json é de outra versão do trailer que não a do plano.`);
  }
  throw new Error(`Sem o áudio da fonte do plano para alinhar: nem o proxy em ${proxy} nem projects/${slug}/source-envelope.json.`);
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
      // O comprimento de cada segmento se mantém (a narração, no tempo do short, depende dele);
      // segmento que cairia antes do início do arquivo novo sai.
      segments: s.segments.flatMap((g, gi) => {
        const len = g.srcEnd - g.srcStart;
        const start = g.srcStart + offs[gi];
        if (start + len <= 0.1) {
          console.warn(`⚠ ${s.id}: o trecho ${g.srcStart.toFixed(2)}–${g.srcEnd.toFixed(2)}s não existe no arquivo novo e saiu do short.`);
          return [];
        }
        const s0 = Math.max(0, start);
        return [{ ...g, srcStart: r(s0), srcEnd: r(s0 + len) }];
      }),
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
  // O plano e o áudio antigo ficam salvos antes do reingest (que apaga o proxy antigo): se a
  // troca parar no meio, rodar de novo retoma daqui em vez de alinhar o arquivo novo com ele mesmo.
  const pendingFile = workPath(slug, "swap-pending.json");
  let plan: EditPlan;
  let oldEnv: Float32Array;
  if (fs.existsSync(pendingFile)) {
    const pending = JSON.parse(fs.readFileSync(pendingFile, "utf8")) as { plan: unknown; env: number[] };
    plan = EditPlanSchema.parse(pending.plan);
    oldEnv = Float32Array.from(pending.env);
    console.log("• retomando a troca de fonte que não terminou");
  } else {
    plan = loadPlan(slug, { anySource: true });
    oldEnv = await planSourceEnvelope(slug, plan);
    fs.writeFileSync(pendingFile, JSON.stringify({ plan, env: Array.from(oldEnv, (v) => Math.round(v * 10) / 10) }));
  }

  const analysis: Analysis = await analyze(file, slug, { force: true });
  if (!analysis.source.hasAudio) throw new Error(`${file} não tem áudio: a troca de fonte alinha os dois arquivos pelo som.`);
  const newEnv = energyEnvelope(await decodePcm(workPath(slug, "source.mp4"), SR));
  const global = findOffset(oldEnv, newEnv, { maxShift: 30 });
  console.log(`• troca de fonte: deslocamento global ${global.offset.toFixed(2)}s (correlação ${global.score.toFixed(2)})`);
  if (global.score < 0.5) console.warn("⚠ correlação baixa: os dois arquivos podem não ser o mesmo trailer. Confira o preview.");

  // Refina por segmento: reuploads às vezes cortam/emendam trechos (busca ±5s em volta do global).
  const segOffsets = plan.shorts.map((s) =>
    s.segments.map((g) => {
      const local = findOffset(oldEnv, newEnv, { from: g.srcStart - 0.5, to: g.srcEnd + 0.5, around: global.offset, maxShift: 5 });
      const span = `${s.id} ${g.srcStart.toFixed(2)}–${g.srcEnd.toFixed(2)}s`;
      if (local.score < 0.8) {
        console.warn(`⚠ ${span}: sem casamento claro no arquivo novo (${local.score.toFixed(2)}); usei o deslocamento global. Confira no preview.`);
        return global.offset;
      }
      if (Math.abs(local.offset - global.offset) > 0.5) console.log(`• ${span}: deslocamento próprio ${local.offset.toFixed(2)}s (corte no reupload?)`);
      return local.offset;
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
  fs.rmSync(pendingFile, { force: true });
  if (fs.existsSync(projectPath(slug))) await keepProject(slug); // o guardado passa a apontar para a fonte nova
  console.log(`✓ plano agora usa ${analysis.source.width}x${analysis.source.height} (${file}).`);
  return valid;
}
