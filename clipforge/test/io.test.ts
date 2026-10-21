import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { parseCropLines, pickCrop } from "../src/analyze/ingest";
import { gameNameFromFile, slugFor } from "../src/config";
import { filterValue } from "../src/ffmpeg";
import { loadSubtitles } from "../src/plan/index";

test("filterValue escapa caminhos do Windows e caracteres especiais do filtergraph", () => {
  assert.equal(filterValue("C:\\Users\\Ana\\x.txt"), "C\\\\:/Users/Ana/x.txt"); // C\\: como na doc do ffmpeg
  const v = filterValue("/tmp/a,b [x]'y:z/f.ttf");
  for (const ch of [",", "[", "]"]) assert.ok(v.includes(`\\${ch}`), `${ch} sem escape em ${v}`);
  assert.ok(!/(^|[^\\]),/.test(v));
});

test("slug: nomes genéricos ganham hash, nomes normais ficam legíveis", () => {
  assert.equal(slugFor("/x/Hades II.mp4"), "hades-ii");
  assert.match(slugFor("/a/trailer.mp4"), /^trailer-[0-9a-f]{6}$/);
  assert.notEqual(slugFor("/a/trailer.mp4"), slugFor("/b/trailer.mp4"));
  assert.match(slugFor("/a/原神 予告編.mp4"), /^trailer-[0-9a-f]{6}$/);
});

test("nome do jogo a partir do arquivo", () => {
  const cases: [string, string][] = [
    ["DOOM: The Dark Ages - Official Trailer 2 (2025) [4K 60FPS].webm", "DOOM: The Dark Ages"],
    ["Ghost of Yōtei - Story Trailer | PS5 Games.mp4", "Ghost of Yōtei"],
    ["Marvel 1943: Rise of Hydra - Official Trailer.mp4", "Marvel 1943: Rise of Hydra"],
    ["Story of Seasons - Official Trailer.mp4", "Story of Seasons"],
    ["Battlefield 6 Official Reveal Trailer 2025.mp4", "Battlefield 6"],
    ["hollow_knight_silksong.mp4", "hollow knight silksong"],
  ];
  for (const [file, name] of cases) assert.equal(gameNameFromFile(file), name, file);
});

test("letterbox: escolhe o crop real e ignora frames escuros e tarjas pequenas", () => {
  const stderr = [
    ...Array(20).fill("[Parsed_cropdetect_0 @ 0x1] x1:0 x2:1919 y1:138 y2:941 w:1920 h:804 x:0 y:138 pts:1 t:1 crop=1920:804:0:138"),
    ...Array(5).fill("crop=1920:640:0:220"), // cena escura
    ...Array(3).fill("crop=320:240:800:420"), // frame quase preto
  ].join("\n");
  assert.deepEqual(pickCrop(parseCropLines(stderr), 1920, 1080), { w: 1920, h: 804, x: 0, y: 138 });
  assert.equal(pickCrop(parseCropLines(Array(10).fill("crop=1920:1072:0:4").join("\n")), 1920, 1080), null);
  assert.equal(pickCrop([], 1920, 1080), null);
});

test("legendas .srt viram frases com tempo (tags e linhas quebradas limpas)", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cf-")), "pt.srt");
  fs.writeFileSync(
    file,
    "\uFEFF1\n00:00:01,000 --> 00:00:03,500\n<i>Eles disseram</i>\nque o mundo ia acabar.\n\n2\n00:00:04,000 --> 00:00:05,000\nEstavam errados.\n",
  );
  const phrases = loadSubtitles(file);
  assert.deepEqual(
    phrases.map((p) => [p.text, p.start, p.end]),
    [
      ["Eles disseram que o mundo ia acabar.", 1, 3.5],
      ["Estavam errados.", 4, 5],
    ],
  );
});
