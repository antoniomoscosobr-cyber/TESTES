import fs from "node:fs";
import path from "node:path";
import { FPS, PRESET } from "../config";
import { ffmpeg, run } from "../ffmpeg";

export type Keyframe = { index: number; shot: number; t: number; file: string };

// Escolhe 1 frame por shot (no meio), amostrando uniformemente se houver shots demais.
export function chooseKeyframes(shots: { start: number; end: number }[], max = PRESET.maxKeyframes) {
  let picks = shots.map((s, i) => ({ shot: i, t: (s.start + s.end) / 2, len: s.end - s.start }));
  const long = picks.filter((p) => p.len >= 0.4);
  if (long.length >= Math.min(12, picks.length)) picks = long;
  if (picks.length > max) {
    const step = picks.length / max;
    picks = Array.from({ length: max }, (_, i) => picks[Math.floor(i * step)]);
  }
  return picks.map((p, index) => ({ index, shot: p.shot, t: Math.round(p.t * 1000) / 1000 }));
}

export async function extractKeyframes(
  proxy: string,
  dir: string,
  picks: { index: number; shot: number; t: number }[],
): Promise<{ keyframes: Keyframe[]; sheets: { file: string; keyframes: number[] }[] }> {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f));
  if (picks.length === 0) return { keyframes: [], sheets: [] };

  // Uma passada só: seleciona os frames pelo número (proxy é CFR).
  const frames = picks.map((p) => Math.round(p.t * FPS));
  const expr = frames.map((n) => `eq(n\\,${n})`).join("+");
  await ffmpeg([
    "-i", proxy,
    "-an",
    "-vf", `select='${expr}',scale=${PRESET.keyframeWidth}:-2`,
    "-fps_mode", "vfr",
    "-start_number", "0",
    "-q:v", "3",
    path.join(dir, "kf_%03d.jpg"),
  ]);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("kf_")).sort();
  const keyframes: Keyframe[] = picks.slice(0, files.length).map((p, i) => ({ ...p, file: files[i] }));

  // Contact sheets 4x4 com o índice do keyframe desenhado em cada célula.
  const font = await findFont();
  const label = font
    ? `drawtext=fontfile=${font}:text='#%{n}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6,`
    : "";
  await ffmpeg([
    "-framerate", "1",
    "-start_number", "0",
    "-i", path.join(dir, "kf_%03d.jpg"),
    "-vf", `${label}tile=4x4:padding=6:margin=6:color=0x111111`,
    "-fps_mode", "vfr",
    "-start_number", "0",
    "-q:v", "4",
    path.join(dir, "sheet_%02d.jpg"),
  ]);
  const sheetFiles = fs.readdirSync(dir).filter((f) => f.startsWith("sheet_")).sort();
  const sheets = sheetFiles.map((file, s) => ({
    file,
    keyframes: keyframes.slice(s * 16, s * 16 + 16).map((k) => k.index),
  }));
  return { keyframes, sheets };
}

async function findFont(): Promise<string | null> {
  try {
    const { stdout } = await run("fc-match", ["-f", "%{file}", "DejaVu Sans:bold"], { quiet: true });
    const file = stdout.toString().trim();
    return file && fs.existsSync(file) ? file : null;
  } catch {
    return null;
  }
}
