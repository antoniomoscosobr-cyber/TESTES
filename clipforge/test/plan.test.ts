import assert from "node:assert/strict";
import { test } from "node:test";
import { PRESET } from "../src/config";
import { findCandidates } from "../src/plan/candidates";
import { mapDirectorOutput, normalizeHashtags } from "../src/plan/director";
import { heuristicShorts } from "../src/plan/heuristic";
import { validatePlan } from "../src/plan/index";
import { avoidFlashFrames, snapShort, splitByShots, trimRanges } from "../src/plan/snap";
import { EditPlanSchema, ShortSchema } from "../src/schema";
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
        description: "d",
        hashtags: ["# Jogo Bom", "#games", "games"],
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

test("diretor: clamps, descarta segmentos/shorts inválidos e respeita a contagem", () => {
  const base = {
    title: "",
    description: "",
    hashtags: [],
    rationale: "",
    hook: { text: "UM DOIS TRES QUATRO CINCO SEIS SETE OITO NOVE", sub: "" },
    captions: [],
    callouts: [{ srcTime: 3, duration: 99, text: "UAU", style: "badge" }],
    splashes: [{ srcTime: 5, kind: "title3d", text: "", intensity: 0.5 }],
    endCard: { title: "", subtitle: "", cta: "" },
    accentColor: "#00ff00",
  };
  const { shorts } = mapDirectorOutput(
    {
      game: "Jogo",
      shorts: [
        { ...base, segments: [{ srcStart: 10, srcEnd: 40, speed: 9, focusX: 1.08, fit: "crop" }] },
        { ...base, segments: [{ srcStart: 20, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }] },
        { ...base, segments: [{ srcStart: 1, srcEnd: 30, speed: 1, focusX: -0.2, fit: "blur" }] },
        { ...base, segments: [{ srcStart: 2, srcEnd: 30, speed: 1, focusX: 0.5, fit: "blur" }] },
      ],
    },
    { count: 2, duration: 35 },
  );
  assert.equal(shorts.length, 2);
  assert.deepEqual(shorts.map((s) => s.id), ["short-01", "short-02"]);
  const s = ShortSchema.parse(shorts[0]);
  assert.equal(s.segments[0].focusX, 1);
  assert.equal(s.segments[0].speed, 2);
  assert.equal(s.callouts[0].duration, 2.5);
  assert.equal(s.splashes[0].text, "Jogo");
  assert.equal(s.hook.text.split(" ").length, 7);
  assert.equal(s.endCard.title, "Jogo");
  assert.equal(shorts[1].segments[0].focusX, 0);
});

test("hashtags normalizadas", () => {
  assert.deepEqual(normalizeHashtags(["# Jogo Bom", "#games", "games", "PS5!", ""]), ["#JogoBom", "#games", "#PS5"]);
});

test("snap: não deixa 'piscada' do shot vizinho e tira cartelas das pontas", () => {
  assert.deepEqual(avoidFlashFrames(9.95, 20.06, [10, 20]), [10, 20]);
  assert.deepEqual(avoidFlashFrames(9.5, 20.5, [10, 20]), [9.5, 20.5]);
  assert.deepEqual(trimRanges(0, 30, [{ start: 0, end: 4 }, { start: 26, end: 30 }]), [4, 26]);
});

test("splitByShots: heurístico enquadra cada shot pelo foco; pedaços iguais se juntam", () => {
  const a = fakeAnalysis();
  a.shots[5] = { ...a.shots[5], focusX: 0.2, focusConfidence: 0.9 }; // 10–12
  a.shots[6] = { ...a.shots[6], focusX: 0.21, focusConfidence: 0.9 }; // 12–14
  a.shots[7] = { ...a.shots[7], focusX: 0.8, focusConfidence: 0.9 }; // 14–16
  const segs = splitByShots([{ srcStart: 10, srcEnd: 18, speed: 1, focusX: 0.5, fit: "crop" }], a, true);
  assert.deepEqual(
    segs.map((s) => [s.srcStart, s.srcEnd, s.fit, s.focusX]),
    [
      [10, 14, "crop", 0.2],
      [14, 16, "crop", 0.8],
      [16, 18, "blur", 0.5],
    ],
  );
  // Sem autoFit (diretor Claude): mantém o fit do diretor.
  const keep = splitByShots([{ srcStart: 16, srcEnd: 20, speed: 1, focusX: 0.3, fit: "crop" }], a, false);
  assert.deepEqual(keep.map((s) => [s.srcStart, s.srcEnd, s.fit, s.focusX]), [[16, 20, "crop", 0.3]]);
});

test("validatePlan corta tempos fora do trailer e recusa short sem segmento válido", () => {
  const plan = EditPlanSchema.parse({
    version: 1,
    slug: "x",
    game: "X",
    director: "heuristic",
    source: { file: "", duration: 30, fps: 30, width: 1920, height: 1080 },
    shorts: [fakeShort({ segments: [{ srcStart: 10, srcEnd: 90, speed: 1, focusX: 0.5, fit: "crop" }] })],
  });
  assert.equal(validatePlan(plan).shorts[0].segments[0].srcEnd, 30);
  const bad = EditPlanSchema.parse({ ...plan, shorts: [fakeShort({ segments: [{ srcStart: 40, srcEnd: 50, speed: 1, focusX: 0.5, fit: "crop" }] })] });
  assert.throws(() => validatePlan(bad), /nenhum segmento/);
});
