import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const WORK_DIR = path.join(PUBLIC_DIR, "work");
export const OUT_DIR = path.join(ROOT, "out");
export const PROJECTS_DIR = path.join(ROOT, "projects"); // planos guardados no git (clipforge keep)
export const WHISPER_DIR = path.join(ROOT, ".whisper");
export const REMOTION_ENTRY = path.join(ROOT, "remotion", "index.ts");

export { FPS } from "./timeline";

export const PRESET = {
  minShortSeconds: 15,
  maxShortSeconds: 45,
  hardMaxShortSeconds: 60, // plano editado à mão (ex.: short narrado) pode ir até aqui sem aviso
  targetShortSeconds: 30,
  shortsPerTrailer: 4,
  sceneThreshold: 0.3,
  minShotSeconds: 0.25,
  maxKeyframes: 96,
  keyframeWidth: 384,
  whisperModel: "small" as const,
  whisperVersion: "1.5.5",
  claudeModel: "claude-opus-5-5",
};

export const FORMATS = {
  "9x16": { id: "Short916", width: 1080, height: 1920 },
  "16x9": { id: "Short169", width: 1920, height: 1080 },
} as const;
export type FormatKey = keyof typeof FORMATS;

export const workPath = (slug: string, ...parts: string[]) => path.join(WORK_DIR, slug, ...parts);
export const projectPath = (slug: string, ...parts: string[]) => path.join(PROJECTS_DIR, slug, ...parts);
// Caminho relativo a public/, usado com staticFile() no Remotion.
export const publicRel = (slug: string, ...parts: string[]) => ["work", slug, ...parts].join("/");

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "trailer"
  );
}

// Slug da pasta de trabalho a partir do arquivo. Nomes genéricos ("trailer", "official-trailer",
// só números, ou vazios em alfabetos não latinos) ganham um hash do caminho para não colidir.
const GENERIC_SLUG = /^(trailer|official-trailer|trailer-oficial|teaser|gameplay|video|clip|game|\d+|[a-z]?)$/;
export function slugFor(file: string): string {
  const base = slugify(path.basename(file));
  const generic = GENERIC_SLUG.test(base) || /^[-\d]+$/.test(base);
  if (!generic) return base;
  const hash = createHash("sha1").update(path.resolve(file)).digest("hex").slice(0, 6);
  return `${base}-${hash}`;
}

// Nome do jogo a partir do nome original do arquivo: "DOOM: The Dark Ages - Official Trailer 2 (2025) [4K 60FPS].mp4"
// vira "DOOM: The Dark Ages". Mantém acentos e caixa originais.
export function gameNameFromFile(file: string): string {
  let name = path.basename(file).replace(/\.[A-Za-z0-9]{2,4}$/, "");
  if (!/\s/.test(name)) name = name.replace(/[-_.]+/g, " ");
  name = name.replace(/_/g, " ").replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, " ").replace(/\s+/g, " ").trim();
  // Trechos que indicam "isto já é sobre o trailer" depois de um separador.
  const TRAILERISH =
    /\b(official|oficial|trailer|teaser|gameplay|reveal|announce(ment)?|launch|story|cinematic|premiere|lan[çc]amento|an[úu]ncio|ps[45]|xbox|switch|pc|steam|games?|4k|8k|hdr|\d{3,4}p|\d+ ?fps)\b/i;
  const parts = name.split(/\s+[-–—|:]\s+|\s*\|\s*/);
  if (parts.length > 1 && parts.slice(1).some((p) => TRAILERISH.test(p))) name = parts[0];
  // Tokens técnicos que nunca fazem parte do nome.
  name = name
    .replace(/\b(official|oficial)\b/gi, " ")
    .replace(/\b(trailer|teaser)(\s*#?\d+)?\b/gi, " ")
    .replace(/\b(4k|8k|hdr|\d{3,4}p|\d+ ?fps)\b/gi, " ");
  const words = name.replace(/\s+/g, " ").trim().split(" ");
  // "Battlefield 6 Reveal" -> "Battlefield 6": tira palavras de trailer só do fim.
  while (words.length > 1 && /^(gameplay|reveal|launch|announce(ment)?|story|cinematic|premiere|world|first|look|[-–—|:])$/i.test(words[words.length - 1])) words.pop();
  const cleaned = words.join(" ").replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, "").trim();
  return cleaned || "Game";
}
