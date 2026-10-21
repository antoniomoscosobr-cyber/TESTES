import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC_DIR = path.join(ROOT, "public");
export const WORK_DIR = path.join(PUBLIC_DIR, "work");
export const OUT_DIR = path.join(ROOT, "out");
export const WHISPER_DIR = path.join(ROOT, ".whisper");
export const REMOTION_ENTRY = path.join(ROOT, "remotion", "index.ts");

export { FPS } from "./timeline";

export const PRESET = {
  minShortSeconds: 15,
  maxShortSeconds: 45,
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
