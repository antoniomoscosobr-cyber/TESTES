import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "../ffmpeg";
import type { EditPlan } from "../schema";
import { FPS, resolveTimeline, type CaptionPage } from "../timeline";

// Alvo de loudness das plataformas de vídeo curto (TikTok/Reels/Shorts normalizam perto disso).
const LOUDNESS = { I: -14, TP: -1.5, LRA: 11 };

// Normaliza o áudio em duas passadas (loudnorm linear: sem "bombear" o som) copiando o vídeo.
export async function normalizeLoudness(file: string): Promise<{ inputI: number; outputI: number } | null> {
  const filter = `loudnorm=I=${LOUDNESS.I}:TP=${LOUDNESS.TP}:LRA=${LOUDNESS.LRA}`;
  const { stderr } = await ffmpeg(["-i", file, "-vn", "-af", `${filter}:print_format=json`, "-f", "null", "-"]);
  const m = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) return null;
  const st = JSON.parse(m[0]) as Record<string, string>;
  if (!Number.isFinite(Number(st.input_i))) return null; // sem áudio / silêncio
  const tmp = `${file}.loud.mp4`;
  try {
    await ffmpeg([
      "-i", file,
      "-c:v", "copy",
      "-af",
      `${filter}:measured_I=${st.input_i}:measured_TP=${st.input_tp}:measured_LRA=${st.input_lra}:measured_thresh=${st.input_thresh}:offset=${st.target_offset}:linear=true`,
      "-ar", "48000",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      tmp,
    ]);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return { inputI: Number(st.input_i), outputI: LOUDNESS.I };
}

const srtTime = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
};

export function srtFromPages(pages: CaptionPage[]): string {
  return pages
    .map((p, i) => `${i + 1}\n${srtTime(p.start)} --> ${srtTime(p.end)}\n${p.words.map((w) => w.text).join(" ")}\n`)
    .join("\n");
}

// Arquivos para postar junto com o vídeo: texto do post, metadados e legendas .srt.
export function writeSidecars(plan: EditPlan, index: number, outDir: string): string[] {
  const short = plan.shorts[index];
  const tl = resolveTimeline(short, FPS, plan.beats);
  const base = path.join(outDir, short.id);
  const hashtags = short.hashtags.join(" ");
  const post = [short.title, "", short.description, "", hashtags].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n").trim();
  fs.writeFileSync(`${base}.txt`, `${post}\n`);
  fs.writeFileSync(
    `${base}.json`,
    JSON.stringify(
      {
        id: short.id,
        game: plan.game,
        title: short.title,
        description: short.description,
        hashtags: short.hashtags,
        hook: short.hook,
        duration: Math.round(tl.duration * 100) / 100,
        director: plan.director,
        sourceRanges: short.segments.map((s) => ({ start: s.srcStart, end: s.srcEnd, speed: s.speed })),
      },
      null,
      2,
    ),
  );
  const files = [`${base}.txt`, `${base}.json`];
  if (tl.pages.length) {
    fs.writeFileSync(`${base}.srt`, srtFromPages(tl.pages));
    files.push(`${base}.srt`);
  }
  return files;
}

// Frame da capa: quando o hook já entrou inteiro (e antes de começar a sair).
export function coverFrame(hookWords: number, hasSub: boolean): number {
  const t = Math.min(2.2, 0.06 + hookWords * 0.1 + 0.3 + (hasSub ? 0.35 : 0));
  return Math.round(t * FPS);
}
