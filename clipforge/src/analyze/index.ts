import fs from "node:fs";
import { FPS, PRESET, publicRel, workPath } from "../config";
import { decodePcm } from "../ffmpeg";
import { AnalysisSchema, type Analysis } from "../schema";
import { analyzeAudio, AUDIO_SR, curveMean } from "./audio";
import { ingest } from "./ingest";
import { chooseKeyframes, extractKeyframes } from "./keyframes";
import { buildShots, detectScenes, findCuts, meanScore } from "./scenes";
import { transcribeAudio } from "./transcribe";

export async function analyze(input: string, slug: string, opts: { force?: boolean } = {}): Promise<Analysis> {
  const t0 = Date.now();
  const { proxy, bg, wav16k, info } = await ingest(input, slug, opts.force);

  console.log("• análise: cenas e telas pretas…");
  const scenes = await detectScenes(proxy, workPath(slug, "scene-scores.txt"));
  const cuts = findCuts(scenes.scores, PRESET.sceneThreshold, PRESET.minShotSeconds);
  const rawShots = buildShots(cuts, info.duration);

  console.log("• análise: áudio (energia, onsets, BPM)…");
  const audio = info.hasAudio ? analyzeAudio(await decodePcm(proxy, AUDIO_SR)) : null;

  const motions = rawShots.map((s) => meanScore(scenes.scores, s.start, s.end));
  const motionRef = percentile(motions, 0.95) || 1;
  const shots = rawShots.map((s, i) => ({
    start: r3(s.start),
    end: r3(s.end),
    motion: r3(Math.min(1, motions[i] / motionRef)),
    energy: r3(audio ? curveMean(audio.raw.energy, s.start, s.end) : 0),
  }));

  console.log(`• análise: ${shots.length} shots, keyframes e contact sheets…`);
  const picks = chooseKeyframes(shots);
  const kfDir = workPath(slug, "keyframes");
  const { keyframes, sheets } = await extractKeyframes(proxy, kfDir, picks);

  const transcript = await transcribeAudio(wav16k);

  const analysis: Analysis = AnalysisSchema.parse({
    version: 1,
    slug,
    source: {
      file: publicRel(slug, "source.mp4"),
      bgFile: bg ? publicRel(slug, "bg916.mp4") : "",
      duration: r3(info.duration),
      fps: FPS,
      width: info.width,
      height: info.height,
      hasAudio: info.hasAudio,
    },
    shots,
    black: scenes.black,
    audio: audio
      ? {
          hop: audio.hop,
          energy: audio.energy,
          onsetEnvelope: audio.onsetEnvelope,
          onsets: audio.onsets,
          bpm: audio.bpm,
          beatConfidence: audio.beatConfidence,
          beats: audio.beats,
        }
      : { hop: 0.1, energy: [], onsetEnvelope: [], onsets: [], bpm: null, beatConfidence: 0, beats: [] },
    transcript,
    keyframes: keyframes.map((k) => ({ ...k, file: publicRel(slug, "keyframes", k.file) })),
    contactSheets: sheets.map((s) => ({ ...s, file: publicRel(slug, "keyframes", s.file) })),
  });

  fs.writeFileSync(workPath(slug, "analysis.json"), JSON.stringify(analysis, null, 1));
  const bpm = analysis.audio.bpm ? `${analysis.audio.bpm} BPM (conf. ${analysis.audio.beatConfidence})` : "sem BPM";
  console.log(
    `✓ análise pronta em ${((Date.now() - t0) / 1000).toFixed(1)}s — ${info.duration.toFixed(1)}s, ${shots.length} shots, ` +
      `${analysis.audio.onsets.length} impactos, ${bpm}, fala: ${transcript ? transcript.phrases.length + " frases" : "não"}`,
  );
  return analysis;
}

export function loadAnalysis(slug: string): Analysis {
  const file = workPath(slug, "analysis.json");
  if (!fs.existsSync(file)) throw new Error(`Sem análise para "${slug}". Rode: clipforge analyze <trailer>`);
  return AnalysisSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
