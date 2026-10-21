import fs from "node:fs";
import { FPS, workPath } from "../config";
import { ffmpeg, probe, type ProbeInfo } from "../ffmpeg";

export type IngestResult = { proxy: string; bg: string | null; wav16k: string; info: ProbeInfo };

// Gera um proxy CFR 30fps com GOP curto (seek rápido no OffthreadVideo) e o WAV
// 16 kHz mono usado pelo whisper.cpp.
export async function ingest(input: string, slug: string, force = false): Promise<IngestResult> {
  if (!fs.existsSync(input)) throw new Error(`Arquivo não encontrado: ${input}`);
  fs.mkdirSync(workPath(slug), { recursive: true });
  const proxy = workPath(slug, "source.mp4");
  const wav16k = workPath(slug, "audio16k.wav");
  const original = await probe(input);

  if (force || !fs.existsSync(proxy)) {
    console.log("• ingest: gerando proxy 30fps…");
    await ffmpeg([
      "-i", input,
      "-map", "0:v:0", "-map", "0:a:0?",
      "-vf", `scale='min(1920,iw)':-2:flags=lanczos,fps=${FPS}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-g", "15", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart",
      proxy,
    ]);
  }
  // Fundo do modo "blur" já desfocado em baixa resolução: bem mais barato que blur CSS por frame.
  const bg = workPath(slug, "bg916.mp4");
  const landscape = original.width > original.height;
  if (landscape && (force || !fs.existsSync(bg))) {
    console.log("• ingest: gerando fundo desfocado 9:16…");
    await ffmpeg([
      "-i", proxy,
      "-an",
      "-vf", "crop=ih*9/16:ih,scale=360:640,gblur=sigma=14,eq=brightness=-0.22:saturation=1.3",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "15", "-pix_fmt", "yuv420p",
      bg,
    ]);
  }
  if (original.hasAudio && (force || !fs.existsSync(wav16k))) {
    await ffmpeg(["-i", proxy, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav16k]);
  }
  return { proxy, bg: landscape ? bg : null, wav16k, info: await probe(proxy) };
}
