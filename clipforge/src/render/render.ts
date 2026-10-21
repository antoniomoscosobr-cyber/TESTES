import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, type ChromiumOptions } from "@remotion/renderer";
import { FORMATS, OUT_DIR, PUBLIC_DIR, REMOTION_ENTRY, workPath, type FormatKey } from "../config";
import type { EditPlan, ShortProps } from "../schema";
import { coverFrame, normalizeLoudness, writeSidecars } from "./publish";
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

type Job = {
  label: string;
  compositionId: string;
  props: Pick<ShortProps, "hideCaptions" | "audioMode">;
  output: string;
  kind: "video" | "audio";
  cover?: string;
};

// Lista do que renderizar por short. Shorts narrados ganham também a versão 9:16 sem legenda
// (para quando o ritmo da voz não bater com as legendas) e os stems de áudio para mixar a voz.
function jobsFor(plan: EditPlan, i: number, formats: FormatKey[], outDir: string): Job[] {
  const short = plan.shorts[i];
  const jobs: Job[] = formats.map((fmt) => ({
    label: `${short.id} ${fmt}`,
    compositionId: FORMATS[fmt].id,
    props: { hideCaptions: false, audioMode: "mix" },
    output: path.join(outDir, `${short.id}-${fmt}.mp4`),
    kind: "video",
    cover: path.join(outDir, `${short.id}-${fmt}-cover.jpg`),
  }));
  if (short.narration.length) {
    const fmt: FormatKey = formats.includes("9x16") ? "9x16" : formats[0];
    jobs.push({
      label: `${short.id} ${fmt} sem legenda`,
      compositionId: FORMATS[fmt].id,
      props: { hideCaptions: true, audioMode: "mix" },
      output: path.join(outDir, `${short.id}-${fmt}-sem-legenda.mp4`),
      kind: "video",
    });
    jobs.push({ label: `${short.id} trilha`, compositionId: FORMATS[fmt].id, props: { hideCaptions: true, audioMode: "bed" }, output: path.join(outDir, `${short.id}-trilha.wav`), kind: "audio" });
    if (plan.sfx) {
      jobs.push({ label: `${short.id} sfx`, compositionId: FORMATS[fmt].id, props: { hideCaptions: true, audioMode: "sfx" }, output: path.join(outDir, `${short.id}-sfx.wav`), kind: "audio" });
    }
  }
  return jobs;
}

export async function renderPlan(plan: EditPlan, opts: RenderOptions): Promise<string[]> {
  const outDir = path.join(OUT_DIR, plan.slug);
  fs.mkdirSync(outDir, { recursive: true });
  const outputs: string[] = [];
  const failures: string[] = [];

  await withBundle(plan, async ({ serveUrl, browserExecutable, chromiumOptions }) => {
    for (const [i, short] of plan.shorts.entries()) {
      if (opts.only?.length && !opts.only.includes(i + 1)) continue;
      writeSidecars(plan, i, outDir);
      for (const job of jobsFor(plan, i, opts.formats, outDir)) {
        const inputProps: ShortProps = { plan, slug: "", shortIndex: i, ...job.props };
        const t0 = Date.now();
        let lastPct = -10;
        try {
          const composition = await selectComposition({ serveUrl, id: job.compositionId, inputProps, browserExecutable, chromiumOptions });
          await renderMedia({
            composition,
            serveUrl,
            ...(job.kind === "video"
              ? { codec: "h264" as const, crf: 18, imageFormat: "jpeg" as const, jpegQuality: 92, colorSpace: "bt709" as const }
              : { codec: "wav" as const }),
            inputProps,
            outputLocation: job.output,
            browserExecutable,
            chromiumOptions,
            concurrency: opts.concurrency ?? null,
            licenseKey: process.env.REMOTION_LICENSE_KEY ?? null,
            onProgress: ({ progress }) => {
              const pct = Math.floor(progress * 100);
              if (pct >= lastPct + 10) {
                lastPct = pct;
                process.stdout.write(`\r  ${job.label}: ${pct}%   `);
              }
            },
          });
          // Stems saem crus (o usuário mixa); os MP4 são normalizados para as plataformas.
          if (job.kind === "video") await normalizeLoudness(job.output);
          if (job.cover) {
            await renderStill({
              composition,
              serveUrl,
              frame: Math.min(composition.durationInFrames - 1, coverFrame(short.hook.text.split(/\s+/).length, !!short.hook.sub)),
              output: job.cover,
              imageFormat: "jpeg",
              jpegQuality: 90,
              inputProps,
              browserExecutable,
              chromiumOptions,
            });
          }
          const secs = ((Date.now() - t0) / 1000).toFixed(0);
          process.stdout.write(`\r  ✓ ${job.label} (${(composition.durationInFrames / composition.fps).toFixed(1)}s) em ${secs}s → ${job.output}\n`);
          outputs.push(job.output);
        } catch (err) {
          // Um render com problema não derruba os outros; o resumo no fim lista as falhas.
          process.stdout.write("\n");
          console.error(`✗ ${job.label}: ${(err as Error).message.split("\n")[0]}`);
          failures.push(job.label);
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
  const inputProps: ShortProps = { plan, slug: "", shortIndex: opts.short - 1, hideCaptions: false, audioMode: "mix" };
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
