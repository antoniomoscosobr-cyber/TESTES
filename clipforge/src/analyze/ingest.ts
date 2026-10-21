import fs from "node:fs";
import path from "node:path";
import { FPS, workPath } from "../config";
import { ffmpeg, probe, type ProbeInfo } from "../ffmpeg";

export type Crop = { w: number; h: number; x: number; y: number };
export type IngestResult = { proxy: string; bg: string | null; wav16k: string; info: ProbeInfo; crop: Crop | null; reingested: boolean };

// Muda quando o formato dos arquivos derivados muda, para forçar reingest.
const INGEST_VERSION = 2;
type Fingerprint = { version: number; path: string; size: number; mtimeMs: number };

// Arquivos derivados do trailer; se o trailer mudar, todos são refeitos.
const DERIVED = ["source.mp4", "bg916.mp4", "audio16k.wav", "analysis.json", "scene-scores.txt", "keyframes"];

// Gera um proxy CFR 30fps com GOP curto (seek rápido no OffthreadVideo), sem tarjas pretas,
// o fundo 9:16 desfocado e o WAV 16 kHz mono do whisper.cpp. Reaproveita o que já existe
// só se for do MESMO arquivo de entrada (caminho, tamanho e data).
export async function ingest(input: string, slug: string, force = false): Promise<IngestResult> {
  if (!fs.existsSync(input)) throw new Error(`Arquivo não encontrado: ${input}`);
  const dir = workPath(slug);
  fs.mkdirSync(dir, { recursive: true });
  const proxy = workPath(slug, "source.mp4");
  const bg = workPath(slug, "bg916.mp4");
  const wav16k = workPath(slug, "audio16k.wav");

  const stat = fs.statSync(input);
  const fp: Fingerprint = { version: INGEST_VERSION, path: path.resolve(input), size: stat.size, mtimeMs: Math.round(stat.mtimeMs) };
  const fpFile = workPath(slug, "ingest.json");
  const previous = readJson<Fingerprint & { crop?: Crop | null }>(fpFile);
  const same = !!previous && previous.version === fp.version && previous.size === fp.size && previous.mtimeMs === fp.mtimeMs;
  const reingest = force || !same;
  if (reingest) {
    if (previous && !same) console.log(`• ingest: "${slug}" era de outro arquivo (ou versão antiga); refazendo tudo.`);
    for (const f of DERIVED) fs.rmSync(workPath(slug, f), { recursive: true, force: true });
    // Um plano feito para outro trailer não serve mais; guarda como backup em vez de apagar.
    const plan = workPath(slug, "plan.json");
    if (previous && !same && fs.existsSync(plan)) fs.renameSync(plan, workPath(slug, `plan.old-${Date.now()}.json`));
    fs.rmSync(fpFile, { force: true });
  }

  const original = await probe(input);
  const crop = reingest ? await detectLetterbox(input, original) : (previous?.crop ?? null);
  if (reingest && crop) console.log(`• ingest: tarjas pretas detectadas, recortando para ${crop.w}x${crop.h}.`);

  if (!fs.existsSync(proxy)) {
    console.log("• ingest: gerando proxy 30fps…");
    const cropFilter = crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},` : "";
    await atomic(proxy, (tmp) =>
      ffmpeg([
        "-i", input,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", `${cropFilter}scale='min(1920,iw)':-2:flags=lanczos,fps=${FPS}`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-g", "15", "-pix_fmt", "yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart",
        "-f", "mp4", tmp,
      ]),
    );
  }
  const info = await probe(proxy);
  // Fundo do modo "blur" já desfocado em baixa resolução: bem mais barato que blur CSS por frame.
  // Para fonte vertical/quadrada também serve: o crop 9:16 vira um "cover".
  if (!fs.existsSync(bg)) {
    console.log("• ingest: gerando fundo desfocado 9:16…");
    const cover = info.width / info.height > 9 / 16 ? "crop=ih*9/16:ih" : "crop=iw:iw*16/9";
    await atomic(bg, (tmp) =>
      ffmpeg([
        "-i", proxy,
        "-an",
        "-vf", `${cover},scale=360:640,gblur=sigma=14,eq=brightness=-0.22:saturation=1.3`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "15", "-pix_fmt", "yuv420p",
        "-f", "mp4", tmp,
      ]),
    );
  }
  if (info.hasAudio && !fs.existsSync(wav16k)) {
    await atomic(wav16k, (tmp) => ffmpeg(["-i", proxy, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", "-f", "wav", tmp]));
  }
  fs.writeFileSync(fpFile, JSON.stringify({ ...fp, crop }, null, 1));
  return { proxy, bg, wav16k, info, crop, reingested: reingest };
}

// Escreve num .tmp e só renomeia depois de sucesso: Ctrl+C no meio não deixa arquivo quebrado
// que seria reaproveitado na próxima execução.
async function atomic(target: string, write: (tmp: string) => Promise<unknown>) {
  const tmp = `${target}.tmp`;
  try {
    await write(tmp);
    fs.renameSync(tmp, target);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Detecta letterbox/pillarbox com cropdetect só nos keyframes (rápido). Retorna null se as
// tarjas forem pequenas (< 4% da altura/largura) ou se a detecção não for consistente.
export async function detectLetterbox(input: string, info: ProbeInfo): Promise<Crop | null> {
  let stderr = "";
  try {
    ({ stderr } = await ffmpeg(["-skip_frame", "nokey", "-i", input, "-an", "-vf", "cropdetect=limit=24:round=2:reset=1", "-f", "null", "-"]));
  } catch {
    return null;
  }
  return pickCrop(parseCropLines(stderr), info.width, info.height);
}

export function parseCropLines(stderr: string): Crop[] {
  return [...stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) => ({ w: +m[1], h: +m[2], x: +m[3], y: +m[4] }));
}

export function pickCrop(crops: Crop[], width: number, height: number): Crop | null {
  // Frames escuros dão crops minúsculos; ignora os que cortam mais de 40%.
  const valid = crops.filter((c) => c.w >= width * 0.6 && c.h >= height * 0.6);
  if (valid.length < 3) return null;
  const counts = new Map<string, { c: Crop; n: number }>();
  for (const c of valid) {
    const key = `${c.w}:${c.h}:${c.x}:${c.y}`;
    counts.set(key, { c, n: (counts.get(key)?.n ?? 0) + 1 });
  }
  // A maior área entre os crops frequentes (cenas escuras encolhem o crop; o maior é o real).
  const frequent = [...counts.values()].filter((e) => e.n >= valid.length * 0.15).map((e) => e.c);
  if (!frequent.length) return null;
  const best = frequent.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  const cutH = 1 - best.h / height;
  const cutW = 1 - best.w / width;
  if (cutH < 0.04 && cutW < 0.04) return null;
  // Nunca corta mais que as tarjas típicas (2.76:1 em 16:9 ≈ 36%).
  if (cutH > 0.4 || cutW > 0.4) return null;
  return best;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}
