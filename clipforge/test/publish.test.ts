import assert from "node:assert/strict";
import { test } from "node:test";
import { coverFrame, srtFromPages } from "../src/render/publish";

test("SRT gerado das páginas de legenda", () => {
  const srt = srtFromPages([
    { start: 0.5, end: 1.25, words: [{ text: "OLHA", start: 0.5, end: 0.8, emphasis: false }, { text: "ISSO", start: 0.8, end: 1.25, emphasis: true }] },
    { start: 61.002, end: 3725.5, words: [{ text: "fim", start: 61, end: 62, emphasis: false }] },
  ]);
  assert.equal(srt, "1\n00:00:00,500 --> 00:00:01,250\nOLHA ISSO\n\n2\n00:01:01,002 --> 01:02:05,500\nfim\n");
});

test("capa no frame em que o hook já entrou", () => {
  assert.equal(coverFrame(4, false), Math.round((0.06 + 0.4 + 0.3) * 30));
  assert.ok(coverFrame(20, true) <= 66);
});
