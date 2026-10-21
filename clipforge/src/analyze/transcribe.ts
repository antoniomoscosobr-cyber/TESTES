import fs from "node:fs";
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import type { Phrase } from "../schema";
import { PRESET, WHISPER_DIR } from "../config";

// Transcreve com whisper.cpp (timestamps por palavra). Retorna null quando não dá
// (sem rede para baixar o modelo, sem fala, etc.) — o resto do pipeline segue sem legendas da fala.
export async function transcribeAudio(wav16k: string): Promise<{ language: string; phrases: Phrase[] } | null> {
  if (process.env.CLIPFORGE_NO_WHISPER === "1" || !fs.existsSync(wav16k)) return null;
  const model = (process.env.CLIPFORGE_WHISPER_MODEL as typeof PRESET.whisperModel) || PRESET.whisperModel;
  try {
    fs.mkdirSync(WHISPER_DIR, { recursive: true });
    // Baixa o modelo primeiro: falha rápido se huggingface.co estiver bloqueado, antes de compilar o whisper.cpp.
    const modelFile = path.join(WHISPER_DIR, `ggml-${model}.bin`);
    const hadModel = fs.existsSync(modelFile);
    try {
      await downloadWhisperModel({ model, folder: WHISPER_DIR, printOutput: false });
    } catch (err) {
      // Download interrompido deixa um .bin parcial que seria tratado como modelo válido na próxima vez.
      if (!hadModel) fs.rmSync(modelFile, { force: true });
      throw err;
    }
    await installWhisperCpp({ to: WHISPER_DIR, version: PRESET.whisperVersion, printOutput: false });
    console.log(`• transcrição: whisper.cpp (${model})…`);
    const out = await transcribe({
      inputPath: wav16k,
      whisperPath: WHISPER_DIR,
      whisperCppVersion: PRESET.whisperVersion,
      modelFolder: WHISPER_DIR,
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
    return phrases.length ? { language: out.result.language, phrases } : null;
  } catch (err) {
    console.warn(`⚠ transcrição indisponível (${(err as Error).message.split("\n")[0]}). Seguindo sem legendas da fala.`);
    return null;
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
