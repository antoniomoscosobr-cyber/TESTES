import assert from "node:assert/strict";
import { test } from "node:test";
import { PRESET } from "../src/config";
import { findCandidates } from "../src/plan/candidates";
import { mapDirectorOutput } from "../src/plan/director";
import { heuristicShorts } from "../src/plan/heuristic";
import { snapShort } from "../src/plan/snap";
import { ShortSchema } from "../src/schema";
import { resolveTimeline, segmentOutDuration } from "../src/timeline";
import { fakeAnalysis, fakeShort } from "./helpers";

test("candidatos preferem o trecho de alta energia e não se sobrepõem", () => {
  const cands = findCandidates(fakeAnalysis(), { count: 3 });
  assert.ok(cands.length >= 2);
  const best = cands[0];
  assert.ok(best.start >= 24 && best.end <= 56, `melhor: ${best.start}-${best.end}`);
  for (const c of cands) {
    const d = c.end - c.start;
    assert.ok(d >= PRESET.minShortSeconds && d <= PRESET.maxShortSeconds);
  }
  for (let i = 0; i < cands.length; i++)
    for (let j = i + 1; j < cands.length; j++) {
      const ov = Math.max(0, Math.min(cands[i].end, cands[j].end) - Math.max(cands[i].start, cands[j].start));
      assert.ok(ov <= 0.25 * Math.min(cands[i].end - cands[i].start, cands[j].end - cands[j].start));
    }
});

test("snap: cortes caem em troca de cena ou beat, splashes no impacto", () => {
  const a = fakeAnalysis();
  const s = snapShort(
    fakeShort({
      segments: [{ srcStart: 30.1, srcEnd: 47.93, speed: 1, focusX: 0.5, fit: "crop" }],
      splashes: [{ srcTime: 33.12, kind: "impact", text: "", intensity: 1 }],
    }),
    a,
  );
  assert.equal(s.segments[0].srcStart, 30); // fronteira de shot
  assert.equal(s.segments[0].srcEnd, 48);
  assert.equal(s.splashes[0].srcTime, 33); // onset
});

test("snap: limita a duração e remove tela preta do fim", () => {
  const a = fakeAnalysis();
  const long = snapShort(fakeShort({ segments: [{ srcStart: 0, srcEnd: 60, speed: 1, focusX: 0.5, fit: "crop" }] }), a);
  const total = long.segments.reduce((acc, s) => acc + segmentOutDuration(s), 0);
  assert.ok(total <= PRESET.maxShortSeconds + 1e-6, `total=${total}`);

  const tail = snapShort(fakeShort({ segments: [{ srcStart: 40, srcEnd: 60, speed: 1, focusX: 0.5, fit: "crop" }] }), a);
  assert.ok(tail.segments[0].srcEnd <= 58.5);

  const short = snapShort(fakeShort({ segments: [{ srcStart: 10, srcEnd: 14, speed: 1, focusX: 0.5, fit: "crop" }] }), a);
  const t2 = short.segments.reduce((acc, s) => acc + segmentOutDuration(s), 0);
  assert.ok(t2 >= PRESET.minShortSeconds - 1e-6, `curto demais: ${t2}`);
});

test("plano heurístico é válido e gera eventos dentro do short", () => {
  const a = fakeAnalysis();
  const shorts = heuristicShorts(a, findCandidates(a, { count: 6 }), "Fake Game", 2).map((s) => snapShort(s, a));
  assert.equal(shorts.length, 2);
  for (const s of shorts) {
    ShortSchema.parse(s);
    const tl = resolveTimeline(s, 30);
    assert.ok(tl.splashes.length > 0);
    assert.ok(tl.duration >= PRESET.minShortSeconds - 0.05 && tl.duration <= PRESET.maxShortSeconds + 0.05);
  }
});

test("resposta do diretor é normalizada (valores fora da lista viram padrão)", () => {
  const { shorts } = mapDirectorOutput({
    game: "Jogo",
    shorts: [
      {
        title: "t",
        rationale: "r",
        hook: { text: "OLHA", sub: "" },
        segments: [{ srcStart: 1, srcEnd: 20, speed: 1, focusX: 0.4, fit: "Blur " }],
        captions: [{ srcStart: 2, srcEnd: 4, text: "Oi", emphasis: [] }],
        callouts: [{ srcTime: 3, duration: 1, text: "UAU", style: "sticker" }],
        splashes: [{ srcTime: 5, kind: "explosion", text: "", intensity: 3 }],
        endCard: { title: "JOGO", subtitle: "", cta: "Segue" },
        accentColor: "vermelho",
      },
    ],
  });
  const s = ShortSchema.parse(shorts[0]);
  assert.equal(s.segments[0].fit, "blur");
  assert.equal(s.callouts[0].style, "badge");
  assert.equal(s.splashes[0].kind, "impact");
  assert.equal(s.splashes[0].intensity, 1);
  assert.equal(s.accentColor, "#ff3d3d");
});
