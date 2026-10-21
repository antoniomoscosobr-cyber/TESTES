import fs from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import type { Phrase } from "../schema";
import { PRESET, WHISPER_DIR } from "../config";

export type TranscriptResult = {
  status: "ok" | "no-speech" | "unavailable";
  transcript: { language: string; phrases: Phrase[] } | null;
};

// Pastas separadas: o installWhisperCpp não instala nada se a pasta de destino já existir.
const whisperBinDir = () => path.join(WHISPER_DIR, `whisper.cpp-${PRESET.whisperVersion}`);
const whisperModelDir = () => path.join(WHISPER_DIR, "models");

// Mesmo critério do @remotion/install-whisper-cpp (a função dele não é exportada pelo pacote).
function whisperExecutable(dir: string, version: string): string {
  const [maj, min, patch] = version.split(".").map(Number);
  const modern = maj > 1 || (maj === 1 && (min > 7 || (min === 7 && patch >= 4)));
  const bin = modern ? path.join(dir, "build", "bin", "whisper-cli") : path.join(dir, "main");
  return process.platform === "win32" ? `${bin}.exe` : bin;
}

async function ensureWhisper(model: typeof PRESET.whisperModel) {
  const binDir = whisperBinDir();
  const exe = whisperExecutable(binDir, PRESET.whisperVersion);
  if (!fs.existsSync(exe)) {
    // Instalação anterior interrompida deixa a pasta sem o executável.
    fs.rmSync(binDir, { recursive: true, force: true });
    console.log(`• transcrição: instalando whisper.cpp ${PRESET.whisperVersion} (uma vez só)…`);
    await installWhisperCpp({ to: binDir, version: PRESET.whisperVersion, printOutput: false });
    if (!fs.existsSync(exe)) {
      throw new Error(
        "whisper.cpp não foi compilado. Precisa de git, make e um compilador C/C++ (macOS: xcode-select --install; Linux: build-essential).",
      );
    }
  }
  const modelDir = whisperModelDir();
  fs.mkdirSync(modelDir, { recursive: true });
  const modelFile = path.join(modelDir, `ggml-${model}.bin`);
  if (!fs.existsSync(modelFile)) {
    console.log(`• transcrição: baixando modelo ${model} (huggingface.co)…`);
    try {
      await downloadWhisperModel({ model, folder: modelDir, printOutput: false });
    } catch (err) {
      // Download interrompido deixa um .bin parcial que seria tratado como modelo válido na próxima vez.
      fs.rmSync(modelFile, { force: true });
      throw err;
    }
  }
  return { binDir, modelDir };
}

// Transcreve com whisper.cpp (timestamps por palavra). "unavailable" quando não deu para rodar
// (sem rede para o modelo, sem compilador, etc.) — diferente de "no-speech", em que rodou e não havia fala.
export async function transcribeAudio(wav16k: string): Promise<TranscriptResult> {
  if (process.env.CLIPFORGE_NO_WHISPER === "1" || !fs.existsSync(wav16k)) return { status: "unavailable", transcript: null };
  const model = (process.env.CLIPFORGE_WHISPER_MODEL as typeof PRESET.whisperModel) || PRESET.whisperModel;
  try {
    const { binDir, modelDir } = await ensureWhisper(model);
    console.log(`• transcrição: whisper.cpp (${model})…`);
    const out = await transcribe({
      inputPath: wav16k,
      whisperPath: binDir,
      whisperCppVersion: PRESET.whisperVersion,
      modelFolder: modelDir,
      model,
      tokenLevelTimestamps: true,
      language: "auto",
      splitOnWord: true,
    });
    const { captions } = toCaptions({ whisperCppOutput: out });
    const phrases = groupPhrases(
      captions
        .map((c) => ({ text: c.text.trim(), start: c.startMs / 1000, end: c.endMs / 1000, p: c.confidence ?? 1 }))
        .filter((w) => w.text && !/^\[.*\]$|^\(.*\)$|♪/.test(w.text)),
    );
    return phrases.length
      ? { status: "ok", transcript: { language: out.result.language, phrases } }
      : { status: "no-speech", transcript: null };
  } catch (err) {
    console.warn(`⚠ transcrição indisponível (${(err as Error).message.split("\n")[0]}). Seguindo sem legendas da fala.`);
    return { status: "unavailable", transcript: null };
  }
}

// Agrupa palavras em frases por pontuação, pausas e tamanho; descarta frases de baixa confiança
// (alucinações típicas do whisper em trechos só de música).
export function groupPhrases(words: { text: string; start: number; end: number; p: number }[]): Phrase[] {
  const phrases: Phrase[] = [];
  let cur: typeof words = [];
  const flush = () => {
    if (!cur.length) return;
    const conf = cur.reduce((a, w) => a + w.p, 0) / cur.length;
    if (conf >= 0.45) {
      phrases.push({
        text: cur.map((w) => w.text).join(" "),
        start: cur[0].start,
        end: cur[cur.length - 1].end,
        words: cur.map(({ text, start, end }) => ({ text, start, end })),
      });
    }
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && (w.start - prev.end > 0.6 || cur.length >= 12)) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) flush();
  }
  flush();
  return phrases;
}
