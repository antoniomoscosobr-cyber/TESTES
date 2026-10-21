import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { FORMATS, OUT_DIR, PUBLIC_DIR, REMOTION_ENTRY, type FormatKey } from "../config";
import type { EditPlan, ShortProps } from "../schema";
import { ensureSfx } from "./sfx";

export type RenderOptions = { formats: FormatKey[]; only?: number[]; concurrency?: number };

// Usa o Chromium headless do ambiente se houver (evita download do Remotion).
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

const chromiumOptions = { gl: "swangle" as const };

async function prepare() {
  await ensureSfx();
  console.log("• render: empacotando composições Remotion…");
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir: PUBLIC_DIR, symlinkPublicDir: true });
  return { serveUrl, browserExecutable: findBrowser() };
}

export async function renderPlan(plan: EditPlan, opts: RenderOptions): Promise<string[]> {
  const { serveUrl, browserExecutable } = await prepare();
  const outDir = path.join(OUT_DIR, plan.slug);
  fs.mkdirSync(outDir, { recursive: true });

  const outputs: string[] = [];
  for (const [i, short] of plan.shorts.entries()) {
    if (opts.only?.length && !opts.only.includes(i + 1)) continue;
    for (const fmt of opts.formats) {
      const { id } = FORMATS[fmt];
      const inputProps: ShortProps = { plan, slug: "", shortIndex: i };
      const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
      const outputLocation = path.join(outDir, `${short.id}-${fmt}.mp4`);
      const t0 = Date.now();
      let lastPct = -10;
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        crf: 18,
        imageFormat: "jpeg",
        jpegQuality: 92,
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
    }
  }
  return outputs;
}

// Frames soltos em PNG para revisar rápido sem renderizar o vídeo inteiro.
export async function renderPreview(plan: EditPlan, opts: { short: number; format: FormatKey; at: number[] }): Promise<string[]> {
  const { serveUrl, browserExecutable } = await prepare();
  const short = plan.shorts[opts.short - 1];
  if (!short) throw new Error(`Short ${opts.short} não existe (o plano tem ${plan.shorts.length}).`);
  const inputProps: ShortProps = { plan, slug: "", shortIndex: opts.short - 1 };
  const composition = await selectComposition({ serveUrl, id: FORMATS[opts.format].id, inputProps, browserExecutable, chromiumOptions });
  const dir = path.join(OUT_DIR, plan.slug, "preview");
  fs.mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  for (const t of opts.at) {
    const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(t * composition.fps)));
    const output = path.join(dir, `${short.id}-${opts.format}-${t.toFixed(2)}s.png`);
    await renderStill({ composition, serveUrl, frame, output, inputProps, browserExecutable, chromiumOptions });
    console.log(`  ✓ ${output}`);
    files.push(output);
  }
  return files;
}
