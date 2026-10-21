import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeShotVisual, detectCards, splitLongShots, type GrayFrames } from "../src/analyze/visual";

function synth(n: number, draw: (k: number, set: (x: number, y: number, v: number) => void) => void): GrayFrames {
  const w = 160;
  const h = 90;
  const frames = Array.from({ length: n }, (_, k) => {
    const f = new Uint8Array(w * h).fill(20);
    draw(k, (x, y, v) => {
      if (x >= 0 && x < w && y >= 0 && y < h) f[y * w + x] = v;
    });
    return f;
  });
  return { w, h, fps: 6, frames };
}

const CROP = 9 / 16 / (16 / 9); // fração da largura que cabe no 9:16

test("foco segue a ação: quadrado se mexendo no terço esquerdo", () => {
  const g = synth(24, (k, set) => {
    const cx = 25 + (k % 6) * 2;
    const cy = 30 + (k % 4) * 3;
    for (let y = cy; y < cy + 20; y++) for (let x = cx; x < cx + 20; x++) set(x, y, 230);
  });
  const v = analyzeShotVisual(g, 0, 4, CROP);
  assert.ok(v.focusX > 0.12 && v.focusX < 0.32, `focusX=${v.focusX}`);
  assert.ok(v.focusConfidence > 0.55, `conf=${v.focusConfidence}`);
});

test("ação espalhada pelo quadro inteiro dá confiança baixa", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = synth(24, (_k, set) => {
    for (let i = 0; i < 4000; i++) set(Math.floor(rnd() * 160), Math.floor(rnd() * 90), Math.floor(rnd() * 255));
  });
  const v = analyzeShotVisual(g, 0, 4, CROP);
  assert.ok(v.focusConfidence < 0.4, `conf=${v.focusConfidence}`);
});

test("logo centralizado parado tem centeredness alto", () => {
  const g = synth(18, (_k, set) => {
    for (let y = 35; y < 55; y++) for (let x = 50; x < 110; x += 3) set(x, y, 250);
  });
  const v = analyzeShotVisual(g, 0, 3, CROP);
  assert.ok(v.centeredness > 0.6, `centeredness=${v.centeredness}`);
});

test("cartelas nas pontas e logo final", () => {
  const mk = (start: number, end: number, motion: number, centeredness: number) => ({ start, end, motion, centeredness, detail: 0.3 });
  const shots = [
    mk(0, 3, 0.01, 0.3), // classificação etária
    mk(3, 5, 0.02, 0.5), // logo do publisher
    mk(5, 50, 0.7, 0.3), // ação
    mk(50, 53, 0.01, 0.8), // logo do jogo
    mk(53, 56, 0.01, 0.3), // texto legal
    mk(56, 58, 0, 0), // preto
  ];
  const { cards, logoShot } = detectCards(shots, 58, [{ start: 56, end: 58 }], 6);
  assert.equal(logoShot, 3);
  assert.deepEqual(cards, [
    { start: 0, end: 3 },
    { start: 3, end: 5 },
    { start: 53, end: 56 },
  ]);
});

test("takes longos viram sub-shots cortados nos impactos", () => {
  const out = splitLongShots(
    [
      { start: 0, end: 3 },
      { start: 3, end: 23 },
    ],
    [
      { t: 7.2, strength: 0.9 },
      { t: 6.5, strength: 0.3 },
      { t: 15, strength: 0.8 },
    ],
  );
  assert.equal(out[0].virtual, false);
  assert.ok(out.length >= 5);
  assert.ok(out.slice(1).every((s) => s.virtual));
  assert.ok(out.some((s) => s.start === 7.2), JSON.stringify(out.map((s) => [s.start, s.end])));
  assert.equal(out[out.length - 1].end, 23);
  assert.ok(out.slice(1).every((s) => s.end - s.start <= 8));
});
