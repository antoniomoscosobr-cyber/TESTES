import type { Analysis, Short } from "../src/schema";

// Análise sintética: 60s, shots de 2s, energia alta entre 30s e 50s.
export function fakeAnalysis(over: Partial<Analysis> = {}): Analysis {
  const shots = Array.from({ length: 30 }, (_, i) => ({
    start: i * 2,
    end: i * 2 + 2,
    motion: i >= 15 && i < 25 ? 0.9 : 0.2,
    energy: i >= 15 && i < 25 ? 0.95 : 0.15,
    focusX: 0.5,
    focusConfidence: 0,
    virtual: false,
  }));
  return {
    version: 1,
    slug: "fake",
    pipeline: 2,
    sourceName: "fake.mp4",
    source: { file: "work/fake/source.mp4", bgFile: "", duration: 60, fps: 30, width: 1920, height: 1080, hasAudio: true, crop: null },
    shots,
    black: [{ start: 58.5, end: 60 }],
    cards: [],
    logoShot: null,
    speech: [],
    audio: {
      hop: 0.1,
      energy: [],
      onsetEnvelope: [],
      onsets: Array.from({ length: 40 }, (_, i) => ({ t: 30 + i * 0.5, strength: 0.8 })),
      bpm: 120,
      beatConfidence: 0.8,
      beats: Array.from({ length: 120 }, (_, i) => i * 0.5),
    },
    transcript: null,
    transcriptStatus: "unavailable",
    keyframes: [],
    contactSheets: [],
    ...over,
  };
}

export function fakeShort(over: Partial<Short> = {}): Short {
  return {
    id: "short-01",
    title: "t",
    description: "",
    hashtags: [],
    hook: { text: "HOOK", sub: "" },
    segments: [{ srcStart: 10, srcEnd: 20, speed: 1, focusX: 0.5, fit: "crop" }],
    captions: [],
    callouts: [],
    splashes: [],
    endCard: { title: "GAME", subtitle: "", cta: "cta" },
    accentColor: "#ff3d3d",
    ...over,
  };
}
