import assert from "node:assert/strict";
import { test } from "node:test";
import { paginate, resolveTimeline } from "../src/timeline";
import { fakeShort } from "./helpers";

test("segmentos viram sequências contíguas no short, respeitando a velocidade", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [
        { srcStart: 40, srcEnd: 42, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 10, srcEnd: 13, speed: 0.5, focusX: 0.5, fit: "blur" },
      ],
    }),
    30,
  );
  assert.equal(tl.segments[0].from, 0);
  assert.equal(tl.segments[0].durationInFrames, 60);
  assert.equal(tl.segments[1].from, 60);
  assert.equal(tl.segments[1].durationInFrames, 180); // 3s a 0.5x = 6s
  assert.equal(tl.segments[1].trimBefore, 300);
  assert.equal(tl.segments[1].jump, true);
  assert.equal(tl.durationInFrames, 240);
});

test("eventos em tempo da fonte são mapeados e os de fora são descartados", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [
        { srcStart: 40, srcEnd: 42, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 10, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" },
      ],
      splashes: [
        { srcTime: 41, kind: "particles", text: "", intensity: 1 },
        { srcTime: 15, kind: "impact", text: "", intensity: 1 },
        { srcTime: 30, kind: "glitch", text: "", intensity: 1 },
      ],
      callouts: [{ srcTime: 12, duration: 1, text: "OLHA", style: "badge" }],
    }),
    30,
  );
  assert.deepEqual(tl.splashes.map((s) => [s.kind, s.t]), [["particles", 1], ["impact", 7]]);
  assert.equal(tl.callouts[0].start, 4);
});

test("legendas: páginas curtas e tempo por palavra proporcional ao tamanho", () => {
  const pages = paginate("O mundo inteiro está em guerra agora", ["guerra"], 0, 3.5);
  assert.ok(pages.every((p) => p.words.length <= 4));
  const words = pages.flatMap((p) => p.words);
  assert.equal(words.length, 7);
  assert.ok(Math.abs(words[words.length - 1].end - 3.5) < 1e-9);
  const inteiro = words.find((w) => w.text === "inteiro")!;
  const o = words.find((w) => w.text === "O")!;
  assert.ok(inteiro.end - inteiro.start > o.end - o.start);
  assert.equal(words.find((w) => w.text === "guerra")!.emphasis, true);
});

test("ênfase ignora acento, caixa e pontuação", () => {
  const [page] = paginate("Você!", ["voce"], 0, 1);
  assert.equal(page.words[0].emphasis, true);
});

test("legenda atravessa segmentos colados com câmera lenta no meio", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [
        { srcStart: 10, srcEnd: 14, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 14, srcEnd: 16, speed: 0.5, focusX: 0.5, fit: "crop" },
        { srcStart: 16, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" },
      ],
      captions: [{ srcStart: 12, srcEnd: 17, text: "um dois três quatro cinco seis", emphasis: [] }],
    }),
    30,
  );
  const words = tl.pages.flatMap((p) => p.words);
  assert.equal(words.length, 6);
  assert.ok(Math.abs(words[0].start - 2) < 0.05, `início ${words[0].start}`);
  assert.ok(Math.abs(words[words.length - 1].end - 9) < 0.05, `fim ${words[words.length - 1].end}`);
});

test("frase só um pouco dentro do short é descartada; com palavras do whisper, corta exato", () => {
  const segs = [{ srcStart: 10, srcEnd: 30, speed: 1, focusX: 0.5, fit: "crop" as const }];
  const partial = resolveTimeline(fakeShort({ segments: segs, captions: [{ srcStart: 7, srcEnd: 11, text: "a b c d e f g h", emphasis: [] }] }), 30);
  assert.equal(partial.pages.length, 0);
  const words = [
    { text: "We", start: 9.0, end: 9.4 },
    { text: "will", start: 10.1, end: 10.4 },
    { text: "rise", start: 10.5, end: 11.0 },
    { text: "again", start: 11.1, end: 11.6 },
  ];
  const exact = resolveTimeline(fakeShort({ segments: segs, captions: [{ srcStart: 9, srcEnd: 11.6, text: "We will rise again", emphasis: [], words }] }), 30);
  const out = exact.pages.flatMap((p) => p.words);
  assert.deepEqual(out.map((w) => w.text), ["will", "rise", "again"]);
  assert.ok(Math.abs(out[0].start - 0.1) < 1e-6);
});

test("card final: nada de efeito ou legenda por baixo; callout espera o hook", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }],
      captions: [{ srcStart: 15, srcEnd: 19, text: "uma frase que passa do fim", emphasis: [] }],
      callouts: [{ srcTime: 1, duration: 1.2, text: "OLHA", style: "badge" }],
      splashes: [
        { srcTime: 1, kind: "title3d", text: "X", intensity: 1 },
        { srcTime: 16.5, kind: "particles", text: "", intensity: 1 },
        { srcTime: 18, kind: "impact", text: "", intensity: 1 },
        { srcTime: 10, kind: "impact", text: "", intensity: 1 },
      ],
    }),
    30,
  );
  assert.ok(Math.abs(tl.endCardStart - 17.2) < 1e-6);
  assert.deepEqual(tl.splashes.map((s) => s.t), [10]);
  assert.ok(tl.pages.every((p) => p.end <= tl.endCardStart + 1e-6));
  assert.ok(tl.callouts[0].start >= 2.6);
});

test("frases sobrepostas: a segunda espera a primeira", () => {
  const tl = resolveTimeline(
    fakeShort({
      segments: [{ srcStart: 0, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }],
      captions: [
        { srcStart: 4, srcEnd: 8, text: "primeira frase bem longa aqui", emphasis: [] },
        { srcStart: 6, srcEnd: 10, text: "Corre!", emphasis: [] },
      ],
    }),
    30,
  );
  const corre = tl.pages.find((p) => p.words[0].text === "Corre!")!;
  assert.ok(corre.start >= 8 - 1e-6, `começou em ${corre.start}`);
  const first = tl.pages.filter((p) => p !== corre);
  assert.ok(first.every((p) => p.end <= corre.start + 1e-6));
});
