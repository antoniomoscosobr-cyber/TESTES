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
  if (short.narration.length) {
    fs.writeFileSync(`${base}-roteiro.txt`, scriptText(plan, index));
    fs.writeFileSync(`${base}-narracao.srt`, narrationSrt(plan, index));
    files.push(`${base}-roteiro.txt`, `${base}-narracao.srt`);
  }
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

const clock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
};
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

// Roteiro para gravar a narração: cada fala com timecode, duração e ritmo (palavras/s),
// mais as pausas entre falas. Bate com as legendas queimadas no vídeo.
export function scriptText(plan: EditPlan, index: number): string {
  const short = plan.shorts[index];
  const tl = resolveTimeline(short, FPS, plan.beats);
  const lines = tl.narration;
  const words = lines.reduce((acc, l) => acc + wordCount(l.text), 0);
  const spoken = lines.reduce((acc, l) => acc + (l.end - l.start), 0);
  const out: string[] = [];
  out.push(`ROTEIRO — ${short.title}`);
  out.push(`Vídeo: ${tl.duration.toFixed(1)}s · ${lines.length} falas · ${words} palavras · ritmo médio ${(words / Math.max(1, spoken)).toFixed(1)} palavras/s`);
  out.push(`Hook na tela (0:00–0:02.6): ${short.hook.text}${short.hook.sub ? ` / ${short.hook.sub}` : ""}`);
  out.push(`Card final (${clock(tl.endCardStart)}–${clock(tl.duration)}): ${short.endCard.title} · ${short.endCard.cta}`);
  out.push("");
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    if (prev && l.start - prev.end >= 0.4) out.push(`        … pausa ${(l.start - prev.end).toFixed(1)}s`);
    const d = l.end - l.start;
    const n = wordCount(l.text);
    out.push(`[${clock(l.start)} → ${clock(l.end)}]  (${d.toFixed(1)}s · ${n} palavras · ${(n / d).toFixed(1)} p/s)`);
    out.push(`  ${l.text}`);
  });
  out.push("");
  out.push("Dicas: grave em ~2.5 palavras/s, com energia. As legendas do vídeo seguem estes tempos; se o seu ritmo ficar diferente, use a versão sem legenda.");
  return out.join("\n") + "\n";
}

export function narrationSrt(plan: EditPlan, index: number): string {
  const tl = resolveTimeline(plan.shorts[index], FPS, plan.beats);
  return tl.narration.map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text}\n`).join("\n");
}
