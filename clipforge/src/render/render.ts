import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, type ChromiumOptions } from "@remotion/renderer";
import { FORMATS, OUT_DIR, PUBLIC_DIR, REMOTION_ENTRY, workPath, type FormatKey } from "../config";
import type { EditPlan, ShortProps } from "../schema";
import { ensureSfx } from "./sfx";

export type RenderOptions = { formats: FormatKey[]; only?: number[]; concurrency?: number };

// Chromium a usar: CLIPFORGE_BROWSER, o headless do Playwright (ambientes de CI/nuvem) ou
// null — aí o Remotion baixa o Chrome Headless Shell dele na primeira vez.
function findBrowser(): string | null {
  if (process.env.CLIPFORGE_BROWSER) return process.env.CLIPFORGE_BROWSER;
  const base = "/opt/pw-browsers";
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell")).sort().reverse()) {
    const bin = path.join(base, dir, "chrome-linux", "headless_shell");
    if (fs.existsSync(bin)) return bin;
  }
  return null;
}

// WebGL (Three.js): GPU via ANGLE no macOS/Windows; no Linux, SwiftShader (CPU) por padrão,
// que funciona em qualquer servidor. CLIPFORGE_GL força outro (angle, egl, vulkan, swangle…).
export function resolveGl(): NonNullable<ChromiumOptions["gl"]> {
  const env = process.env.CLIPFORGE_GL as ChromiumOptions["gl"];
  if (env) return env;
  return process.platform === "darwin" || process.platform === "win32" ? "angle" : "swangle";
}

type Bundle = { serveUrl: string; browserExecutable: string | null; chromiumOptions: ChromiumOptions };

// Empacota as composições com uma pasta pública mínima (só os SFX e os arquivos deste trailer,
// via hard link) e apaga tudo no fim — sem isso cada render deixava ~40 MB no tmp e, no Windows,
// copiava todos os proxies de public/work.
export async function withBundle<T>(plan: EditPlan, fn: (b: Bundle) => Promise<T>): Promise<T> {
  await ensureSfx();
  const staged = fs.mkdtempSync(path.join(os.tmpdir(), "clipforge-public-"));
  let serveUrl: string | null = null;
  try {
    linkTree(path.join(PUBLIC_DIR, "sfx"), path.join(staged, "sfx"));
    for (const f of [plan.source.file, plan.source.bgFile].filter(Boolean)) {
      const dest = path.join(staged, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      linkOrCopy(path.join(PUBLIC_DIR, f), dest);
    }
    console.log("• render: empacotando composições Remotion…");
    serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir: staged, symlinkPublicDir: true });
    return await fn({ serveUrl, browserExecutable: findBrowser(), chromiumOptions: { gl: resolveGl() } });
  } finally {
    if (serveUrl && fs.existsSync(serveUrl)) fs.rmSync(serveUrl, { recursive: true, force: true });
    fs.rmSync(staged, { recursive: true, force: true });
  }
}

function linkOrCopy(src: string, dest: string) {
  if (!fs.existsSync(src)) throw new Error(`Arquivo do plano não encontrado: ${src}`);
  try {
    fs.linkSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
  }
}

function linkTree(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) linkOrCopy(path.join(src, f), path.join(dest, f));
}

export async function renderPlan(plan: EditPlan, opts: RenderOptions): Promise<string[]> {
  const outDir = path.join(OUT_DIR, plan.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const outputs: string[] = [];
  const failures: string[] = [];

  await withBundle(plan, async ({ serveUrl, browserExecutable, chromiumOptions }) => {
    for (const [i, short] of plan.shorts.entries()) {
      if (opts.only?.length && !opts.only.includes(i + 1)) continue;
      for (const fmt of opts.formats) {
        const { id } = FORMATS[fmt];
        const inputProps: ShortProps = { plan, slug: "", shortIndex: i };
        const outputLocation = path.join(outDir, `${short.id}-${fmt}.mp4`);
        const t0 = Date.now();
        let lastPct = -10;
        try {
          const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
          await renderMedia({
            composition,
            serveUrl,
            codec: "h264",
            crf: 18,
            imageFormat: "jpeg",
            jpegQuality: 92,
            colorSpace: "bt709",
            inputProps,
            outputLocation,
            browserExecutable,
            chromiumOptions,
            concurrency: opts.concurrency ?? null,
            licenseKey: process.env.REMOTION_LICENSE_KEY ?? null,
            onProgress: ({ progress }) => {
              const pct = Math.floor(progress * 100);
              if (pct >= lastPct + 10) {
                lastPct = pct;
                process.stdout.write(`\r  ${short.id} ${fmt}: ${pct}%   `);
              }
            },
          });
          const secs = ((Date.now() - t0) / 1000).toFixed(0);
          process.stdout.write(`\r  ✓ ${short.id} ${fmt} (${(composition.durationInFrames / composition.fps).toFixed(1)}s) em ${secs}s → ${outputLocation}\n`);
          outputs.push(outputLocation);
        } catch (err) {
          // Um short com problema não derruba os outros; o resumo no fim lista as falhas.
          process.stdout.write("\n");
          console.error(`✗ ${short.id} ${fmt}: ${(err as Error).message.split("\n")[0]}`);
          failures.push(`${short.id} ${fmt}`);
        }
      }
    }
  });
  if (failures.length) {
    const msg = `${failures.length} render(s) falharam: ${failures.join(", ")}`;
    if (!outputs.length) throw new Error(msg);
    console.warn(`⚠ ${msg}`);
  }
  return outputs;
}

// Frames soltos em PNG para revisar rápido sem renderizar o vídeo inteiro.
export async function renderPreview(plan: EditPlan, opts: { short: number; format: FormatKey; at: number[] }): Promise<string[]> {
  const short = plan.shorts[opts.short - 1];
  if (!short) throw new Error(`Short ${opts.short} não existe (o plano tem ${plan.shorts.length}).`);
  const inputProps: ShortProps = { plan, slug: "", shortIndex: opts.short - 1 };
  const dir = path.join(OUT_DIR, plan.slug, "preview");
  fs.mkdirSync(dir, { recursive: true });
  return withBundle(plan, async ({ serveUrl, browserExecutable, chromiumOptions }) => {
    const composition = await selectComposition({ serveUrl, id: FORMATS[opts.format].id, inputProps, browserExecutable, chromiumOptions });
    const files: string[] = [];
    for (const t of opts.at) {
      const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(t * composition.fps)));
      const output = path.join(dir, `${short.id}-${opts.format}-${t.toFixed(2)}s.png`);
      await renderStill({ composition, serveUrl, frame, output, inputProps, browserExecutable, chromiumOptions });
      console.log(`  ✓ ${output}`);
      files.push(output);
    }
    return files;
  });
}

// Quanto espaço um trailer ocupa em public/work (usado pelo `clean`).
export function workSize(slug: string): number {
  const walk = (p: string): number =>
    fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((acc, f) => acc + walk(path.join(p, f)), 0) : fs.statSync(p).size;
  return fs.existsSync(workPath(slug)) ? walk(workPath(slug)) : 0;
}
