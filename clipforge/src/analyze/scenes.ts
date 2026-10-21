import fs from "node:fs";
import { ffmpeg, filterValue } from "../ffmpeg";

export type FrameScore = { t: number; score: number };
export type SceneResult = {
  scores: FrameScore[];
  black: { start: number; end: number }[];
};

// Uma única passada (em 320px) mede o scene score de cada frame e detecta telas pretas.
export async function detectScenes(proxy: string, scoresFile: string): Promise<SceneResult> {
  const { stderr } = await ffmpeg([
    "-i", proxy,
    "-an",
    "-vf",
    `scale=320:-2,blackdetect=d=0.1:pix_th=0.10,select='gte(scene\\,0)',metadata=print:key=lavfi.scene_score:file=${filterValue(scoresFile)}`,
    "-f", "null", "-",
  ]);
  const scores = parseScores(fs.readFileSync(scoresFile, "utf8"));
  const black = [...stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
  return { scores, black };
}

export function parseScores(text: string): FrameScore[] {
  const out: FrameScore[] = [];
  let t: number | null = null;
  for (const line of text.split("\n")) {
    const pts = line.match(/pts_time:([\d.]+)/);
    if (pts) {
      t = Number(pts[1]);
      continue;
    }
    const sc = line.match(/lavfi\.scene_score=([\d.]+)/);
    if (sc && t !== null) {
      out.push({ t, score: Number(sc[1]) });
      t = null;
    }
  }
  return out;
}

// Cortes = frames com score acima do limiar, respeitando duração mínima de shot.
export function findCuts(scores: FrameScore[], threshold: number, minShot: number): number[] {
  const cuts: number[] = [];
  let last = 0;
  for (const { t, score } of scores) {
    if (score >= threshold && t - last >= minShot) {
      cuts.push(t);
      last = t;
    }
  }
  return cuts;
}

export function buildShots(cuts: number[], duration: number): { start: number; end: number }[] {
  const bounds = [0, ...cuts.filter((c) => c > 0 && c < duration), duration];
  const shots: { start: number; end: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    if (bounds[i + 1] - bounds[i] > 0.01) shots.push({ start: bounds[i], end: bounds[i + 1] });
  }
  return shots;
}

export function meanScore(scores: FrameScore[], start: number, end: number): number {
  let sum = 0;
  let n = 0;
  for (const s of scores) {
    // Ignora o próprio frame do corte, que tem score alto por definição.
    if (s.t > start + 0.04 && s.t < end) {
      sum += s.score;
      n++;
    }
  }
  return n ? sum / n : 0;
}
