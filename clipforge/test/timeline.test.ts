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
