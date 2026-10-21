import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeAudio, AUDIO_SR } from "../src/analyze/audio";
import { buildShots, findCuts, parseScores } from "../src/analyze/scenes";
import { groupPhrases } from "../src/analyze/transcribe";

function clickTrack(bpm: number, seconds: number): Float32Array {
  const pcm = new Float32Array(AUDIO_SR * seconds);
  const period = 60 / bpm;
  for (let t = 0.2; t < seconds; t += period) {
    const start = Math.floor(t * AUDIO_SR);
    for (let i = 0; i < AUDIO_SR * 0.08 && start + i < pcm.length; i++) {
      // Bumbo: senoide grave + ruído no ataque.
      pcm[start + i] = Math.exp(-i / 600) * (Math.sin((2 * Math.PI * 60 * i) / AUDIO_SR) + 0.5 * Math.sin(i * 12.9898) * Math.exp(-i / 80));
    }
  }
  return pcm;
}

test("BPM e onsets de uma faixa de clique a 128 BPM", () => {
  const a = analyzeAudio(clickTrack(128, 20));
  assert.ok(a.bpm !== null && Math.abs(a.bpm - 128) < 2.5, `bpm=${a.bpm}`);
  assert.ok(a.onsets.length >= 35, `onsets=${a.onsets.length}`);
  const period = 60 / 128;
  // Cada onset cai perto de um clique.
  for (const o of a.onsets) {
    const phase = ((o.t - 0.2) % period + period) % period;
    assert.ok(Math.min(phase, period - phase) < 0.06, `onset fora do grid: ${o.t}`);
  }
  assert.ok(a.beats.length > 30);
});

test("silêncio não gera onsets nem BPM confiável", () => {
  const a = analyzeAudio(new Float32Array(AUDIO_SR * 10));
  assert.equal(a.onsets.length, 0);
});

test("parse do scene score do ffmpeg e cortes com duração mínima", () => {
  const text = [
    "frame:0    pts:0       pts_time:0",
    "lavfi.scene_score=0.000000",
    "frame:1    pts:1       pts_time:1.0",
    "lavfi.scene_score=0.800000",
    "frame:2    pts:2       pts_time:1.1",
    "lavfi.scene_score=0.900000",
    "frame:3    pts:3       pts_time:3.0",
    "lavfi.scene_score=0.010000",
  ].join("\n");
  const scores = parseScores(text);
  assert.equal(scores.length, 4);
  const cuts = findCuts(scores, 0.3, 0.25);
  assert.deepEqual(cuts, [1.0]);
  assert.deepEqual(buildShots(cuts, 5), [
    { start: 0, end: 1 },
    { start: 1, end: 5 },
  ]);
});

test("agrupa palavras do whisper em frases e descarta baixa confiança", () => {
  const w = (text: string, start: number, p = 0.9) => ({ text, start, end: start + 0.3, p });
  const phrases = groupPhrases([w("We", 0), w("will", 0.3), w("rise.", 0.6), w("la", 3, 0.1), w("la", 3.3, 0.1), w("Now", 6)]);
  assert.deepEqual(phrases.map((p) => p.text), ["We will rise.", "Now"]);
});

test("detector de voz: fala sintética (ruído na banda de voz modulado a 4 Hz) sim, bumbo não", () => {
  const seconds = 12;
  const pcm = new Float32Array(AUDIO_SR * seconds);
  // 0–6s: bumbo grave a 120 BPM. 6–12s: "fala" (ruído filtrado 300–3000 Hz com sílabas a 4 Hz).
  for (let t = 0; t < 6; t += 0.5) {
    const s0 = Math.floor(t * AUDIO_SR);
    for (let i = 0; i < AUDIO_SR * 0.2; i++) pcm[s0 + i] = 0.9 * Math.exp(-i / 900) * Math.sin((2 * Math.PI * 55 * i) / AUDIO_SR);
  }
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let lp = 0;
  let hp = 0;
  let prev = 0;
  for (let i = 6 * AUDIO_SR; i < pcm.length; i++) {
    const x = rnd();
    lp += 0.55 * (x - lp); // passa-baixa ~3 kHz
    hp = 0.92 * (hp + lp - prev); // passa-alta ~300 Hz
    prev = lp;
    const syllable = Math.max(0, Math.sin((2 * Math.PI * 4 * i) / AUDIO_SR));
    pcm[i] = 1.2 * hp * syllable;
  }
  const a = analyzeAudio(pcm);
  assert.ok(a.speech.length >= 1, "não detectou a fala");
  assert.ok(a.speech.every((r) => r.start >= 5.4), `voz detectada no bumbo: ${JSON.stringify(a.speech)}`);
  const covered = a.speech.reduce((acc, r) => acc + r.end - r.start, 0);
  assert.ok(covered >= 3.5, `cobriu só ${covered}s`);
});
