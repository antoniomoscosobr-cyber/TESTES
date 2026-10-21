import { spawn } from "node:child_process";

export type RunResult = { stdout: Buffer; stderr: string };

export function run(cmd: string, args: string[], opts: { quiet?: boolean } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      // Mantém só o final do stderr para não estourar memória em vídeos longos.
      if (err.length > 4_000_000) err = err.slice(-2_000_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else {
        if (!opts.quiet) process.stderr.write(err.slice(-4000));
        reject(new Error(`${cmd} saiu com código ${code}`));
      }
    });
  });
}

export const ffmpeg = (args: string[]) => run("ffmpeg", ["-hide_banner", "-y", ...args]);

export type ProbeInfo = {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
};

export async function probe(file: string): Promise<ProbeInfo> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const info = JSON.parse(stdout.toString()) as {
    format: { duration?: string };
    streams: { codec_type: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string }[];
  };
  const video = info.streams.find((s) => s.codec_type === "video");
  if (!video) throw new Error(`Nenhum stream de vídeo em ${file}`);
  const [num, den] = (video.avg_frame_rate ?? "30/1").split("/").map(Number);
  return {
    duration: Number(info.format.duration ?? video.duration ?? 0),
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: den ? num / den : 30,
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
  };
}

// Decodifica o áudio para PCM float32 mono.
export async function decodePcm(file: string, sampleRate: number): Promise<Float32Array> {
  const { stdout } = await run("ffmpeg", [
    "-hide_banner", "-v", "error",
    "-i", file,
    "-vn", "-ac", "1", "-ar", String(sampleRate),
    "-f", "f32le", "pipe:1",
  ]);
  // Copia para um buffer alinhado (o Buffer do Node pode ter byteOffset não múltiplo de 4).
  const aligned = new ArrayBuffer(stdout.byteLength - (stdout.byteLength % 4));
  new Uint8Array(aligned).set(stdout.subarray(0, aligned.byteLength));
  return new Float32Array(aligned);
}
