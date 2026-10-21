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
  const again = findOffset(readEnvelope(file).env, energyEnvelope(shifted, sr), { maxShift: 3 });
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

const planWith = (short: ReturnType<typeof fakeShort>) =>
  EditPlanSchema.parse({
    version: 1,
    slug: "x",
    game: "X",
    director: "heuristic",
    source: { file: "", duration: 60, fps: 30, width: 1920, height: 1080 },
    shorts: [short],
  });

test("legenda original só perde as palavras que ficam sob a narração", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" }],
      captions: [{ srcStart: 5, srcEnd: 11, text: "We will rise again and take back what is ours from them", emphasis: [] }],
      narration: [{ start: 2.8, end: 5.2, text: "Olha só isso aqui gente", emphasis: [] }],
    }),
    30,
  );
  const words = tl.pages.flatMap((p) => p.words.map((w) => w.text));
  assert.ok(words.includes("ours"), words.join(" "));
  assert.ok(!words.includes("We"), "a palavra sob a narração sai");
  for (let i = 1; i < tl.pages.length; i++) assert.ok(tl.pages[i].start >= tl.pages[i - 1].end - 1e-6);
});

test("narração sobreposta é normalizada igual no vídeo, no roteiro e no .srt", () => {
  const plan = planWith(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" }],
      narration: [
        { start: 1, end: 4, text: "Primeira fala do vídeo.", emphasis: [] },
        { start: 3.5, end: 6, text: "Segunda fala começa antes.", emphasis: [] },
        { start: 5.9, end: 6.05, text: "Sim!", emphasis: [] },
        { start: 40, end: 42, text: "Depois do fim.", emphasis: [] },
      ],
    }),
  );
  const tl = resolveTimeline(plan.shorts[0], 30);
  assert.deepEqual(tl.narration.map((n) => [n.start, n.end]), [
    [1, 4],
    [4, 6],
  ]);
  const srt = narrationSrt(plan, 0);
  assert.match(srt, /00:00:04,000 --> 00:00:06,000\nSegunda fala/);
  assert.doesNotMatch(srt, /Sim!|Depois/);
  assert.match(scriptText(plan, 0), /2 falas/);
});

test("palavras de uma fala que passa do fim seguem o ritmo original", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }],
      narration: [{ start: 13, end: 22, text: "um dois três quatro cinco seis sete oito nove dez onze doze", emphasis: [] }],
    }),
    30,
  );
  assert.equal(tl.narration[0].end, 20);
  const sete = tl.pages.flatMap((p) => p.words).find((w) => w.text === "sete");
  // espalhadas por 13–22s, "sete" cai depois do card final (17.2s) e não aparece
  assert.equal(sete, undefined);
});

test("roteiro arredonda o timecode sem gerar 00:60.0", () => {
  const plan = planWith(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 70, speed: 1, focusX: 0.5, fit: "crop" }],
      narration: [{ start: 59.96, end: 62, text: "Virada do minuto.", emphasis: [] }],
    }),
  );
  const txt = scriptText(plan, 0);
  assert.match(txt, /\[01:00\.0 → 01:02\.0\]/);
  assert.doesNotMatch(txt, /:60\.0/);
});

test("shiftPlan mantém o comprimento dos segmentos e tira os que caem antes do início", () => {
  const plan = planWith(
    fakeShort({
      segments: [
        { srcStart: 0.3, srcEnd: 0.8, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 0.5, srcEnd: 2, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 10, srcEnd: 12, speed: 1, focusX: 0.5, fit: "crop" },
      ],
    }),
  );
  const out = shiftPlan(plan, [[-1, -1, -1]]);
  assert.deepEqual(out.shorts[0].segments.map((s) => [s.srcStart, s.srcEnd]), [
    [0, 1.5],
    [9, 11],
  ]);
});

test("segmento sem par no arquivo novo não passa como casamento", () => {
  const sr = 8000;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const noise = (seconds: number, rate: number) => {
    const out = new Float32Array(sr * seconds);
    for (let i = 0; i < out.length; i++) out[i] = rnd() * (Math.sin((i / sr) * rate) > 0.3 ? 1 : 0.05);
    return out;
  };
  const old = energyEnvelope(noise(20, 2.3), sr);
  const other = energyEnvelope(noise(20, 3.7), sr);
  const { score } = findOffset(old, other, { from: 5, to: 7, maxShift: 5, around: 0 });
  assert.ok(score < 0.8, `score ${score}`);
});

test("envelope guardado leva a forma da fonte", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-env-")), "env.json");
  writeEnvelope(file, Float32Array.from([1, 2, 3]), { duration: 90.1, width: 640, height: 360 });
  const { env, source } = readEnvelope(file);
  assert.deepEqual(Array.from(env), [1, 2, 3]);
  assert.deepEqual(source, { duration: 90.1, width: 640, height: 360 });
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test("fala da narração na pausa entre duas palavras da legenda original não some", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" }],
      captions: [
        {
          srcStart: 4,
          srcEnd: 9,
          text: "We will rise. Again and again",
          emphasis: [],
          words: [
            { text: "We", start: 4, end: 4.3 },
            { text: "will", start: 4.3, end: 4.6 },
            { text: "rise.", start: 4.6, end: 5 },
            { text: "Again", start: 7, end: 7.5 },
            { text: "and", start: 7.5, end: 7.8 },
            { text: "again", start: 7.8, end: 9 },
          ],
        },
      ],
      narration: [{ start: 5.3, end: 6.7, text: "Olha isso!", emphasis: [] }],
    }),
    30,
  );
  const page = tl.pages.find((p) => p.words.some((w) => w.text === "Olha"));
  assert.ok(page, tl.pages.map((p) => p.words.map((w) => w.text).join(" ")).join(" | "));
  assert.ok(Math.abs(page.start - 5.3) < 1e-6);
  for (const p of tl.pages) if (p !== page) assert.ok(p.end <= 5.3 + 1e-6 || p.start >= 6.7 - 1e-6, `página sobre a narração: ${p.start}-${p.end}`);
});

test("roteiro avisa quando a fala passa do fim do vídeo", () => {
  const plan = planWith(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }],
      narration: [{ start: 13, end: 22, text: "um dois três quatro cinco seis sete oito nove dez onze doze", emphasis: [] }],
    }),
  );
  assert.match(scriptText(plan, 0), /passa 2\.0s do fim do vídeo/);
});

test("shiftPlan puxa para dentro o que passaria do fim e tira o short sem trechos", () => {
  const plan = planWith(
    fakeShort({
      segments: [
        { srcStart: 10, srcEnd: 12, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 84, srcEnd: 88, speed: 1, focusX: 0.5, fit: "crop" },
      ],
    }),
  );
  plan.source.duration = 90;
  const out = shiftPlan(plan, [[0, 0]], 86);
  assert.deepEqual(out.shorts[0].segments.map((s) => [s.srcStart, s.srcEnd]), [
    [10, 12],
    [82, 86],
  ]);
  const gone = shiftPlan(plan, [[-20, -100]], 86);
  assert.equal(gone.shorts.length, 0);
});
