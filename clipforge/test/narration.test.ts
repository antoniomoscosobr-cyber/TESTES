import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { energyEnvelope, findOffset, readEnvelope, shiftPlan, writeEnvelope } from "../src/analyze/swap";
import { narrationGain, NARRATION_DUCK } from "../src/cues";
import { narrationSrt, scriptText } from "../src/render/publish";
import { EditPlanSchema } from "../src/schema";
import { resolveTimeline } from "../src/timeline";
import { fakeShort } from "./helpers";

const narrated = () =>
  fakeShort({
    segments: [{ srcStart: 0, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" }],
    captions: [{ srcStart: 4, srcEnd: 6, text: "fala original do trailer", emphasis: [] }],
    narration: [
      { start: 0.3, end: 2.5, text: "Isso aqui quebrou a internet.", emphasis: ["internet"] },
      { start: 3.5, end: 7, text: "Noventa milhões de views em vinte e quatro horas.", emphasis: ["Noventa"] },
      { start: 26, end: 29.5, text: "Segue pra mais!", emphasis: [] },
    ],
  });

test("narração vira legenda no tempo do short e tem prioridade sobre a fala original", () => {
  const tl = resolveTimeline(narrated(), 30);
  const words = tl.pages.flatMap((p) => p.words.map((w) => w.text));
  assert.ok(words.includes("internet."));
  assert.ok(!words.includes("original"), "fala original sob a narração não deveria aparecer");
  assert.ok(Math.abs(tl.pages[0].start - 0.3) < 1e-6);
  assert.equal(tl.pages.find((p) => p.words.some((w) => w.text === "Noventa"))!.words.find((w) => w.text === "Noventa")!.emphasis, true);
  // fala dentro do card final: fica no roteiro, mas não vira legenda
  assert.equal(tl.narration.length, 3);
  assert.ok(tl.pages.every((p) => p.end <= tl.endCardStart + 1e-6));
});

test("trailer abaixa sob a narração com rampa", () => {
  const w = [{ start: 2, end: 4 }];
  assert.equal(narrationGain(1, w), 1);
  assert.ok(Math.abs(narrationGain(3, w) - NARRATION_DUCK) < 1e-9);
  const mid = narrationGain(1.925, w);
  assert.ok(mid < 1 && mid > NARRATION_DUCK);
  assert.equal(narrationGain(4.3, w), 1);
});

test("roteiro com timecodes e SRT da narração", () => {
  const plan = EditPlanSchema.parse({
    version: 1,
    slug: "x",
    game: "X",
    director: "heuristic",
    source: { file: "", duration: 60, fps: 30, width: 1920, height: 1080 },
    shorts: [narrated()],
  });
  const txt = scriptText(plan, 0);
  assert.match(txt, /\[00:00\.3 → 00:02\.5\]/);
  assert.match(txt, /Noventa milhões de views/);
  assert.match(txt, /pausa 1\.0s/);
  assert.match(narrationSrt(plan, 0), /^1\n00:00:00,300 --> 00:00:02,500\nIsso aqui quebrou a internet\.\n/);
});

test("alinhamento de áudio acha o deslocamento entre duas versões do trailer", () => {
  const sr = 8000;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const seconds = 20;
  const base = new Float32Array(sr * (seconds + 2));
  for (let i = 0; i < base.length; i++) {
    const t = i / sr;
    const burst = Math.sin(t * 2.3) > 0.6 || Math.sin(t * 5.1 + 1) > 0.9 ? 1 : 0.05;
    base[i] = rnd() * burst;
  }
  const old = base.subarray(0, sr * seconds);
  const shifted = base.subarray(Math.round(sr * 0.5), Math.round(sr * 0.5) + sr * seconds); // novo começa 0.5s depois
  const { offset, score } = findOffset(energyEnvelope(old, sr), energyEnvelope(shifted, sr), { maxShift: 3 });
  assert.ok(Math.abs(offset - -0.5) <= 0.011, `offset ${offset}`);
  assert.ok(score > 0.9);
  // o envelope guardado em arquivo (arredondado a 0.1 dB) alinha igual
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-env-")), "env.json");
  writeEnvelope(file, energyEnvelope(old, sr));
  const again = findOffset(readEnvelope(file), energyEnvelope(shifted, sr), { maxShift: 3 });
  assert.equal(again.offset, offset);
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test("shiftPlan desloca segmentos e eventos, não a narração", () => {
  const plan = EditPlanSchema.parse({
    version: 1,
    slug: "x",
    game: "X",
    director: "heuristic",
    source: { file: "", duration: 60, fps: 30, width: 1920, height: 1080 },
    shorts: [
      fakeShort({
        segments: [
          { srcStart: 10, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" },
          { srcStart: 40, srcEnd: 45, speed: 1, focusX: 0.5, fit: "crop" },
        ],
        splashes: [{ srcTime: 42, kind: "impact", text: "", intensity: 1 }],
        narration: [{ start: 1, end: 3, text: "oi", emphasis: [] }],
      }),
    ],
  });
  const out = shiftPlan(plan, [[-0.5, -0.7]]);
  assert.deepEqual(out.shorts[0].segments.map((s) => [s.srcStart, s.srcEnd]), [
    [9.5, 19.5],
    [39.3, 44.3],
  ]);
  assert.equal(out.shorts[0].splashes[0].srcTime, 41.3);
  assert.equal(out.shorts[0].narration[0].start, 1);
});
