#!/usr/bin/env -S npx tsx
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { analyze, loadAnalysis } from "./analyze/index";
import { FORMATS, ROOT, slugify, workPath, type FormatKey } from "./config";
import { loadPlan, makePlan } from "./plan/index";
import { renderPlan, renderPreview } from "./render/render";
import { ensureSfx } from "./render/sfx";

const program = new Command()
  .name("clipforge")
  .description("Shorts automáticos a partir de trailers de games: cortes, legendas PT-BR e splashes GSAP/Three.js.");

const parseFormats = (v: string): FormatKey[] => {
  const list = v.split(",").map((s) => s.trim()) as FormatKey[];
  for (const f of list) if (!(f in FORMATS)) throw new Error(`Formato inválido: ${f} (use ${Object.keys(FORMATS).join(", ")})`);
  return list;
};
const parseList = (v: string) => v.split(",").map(Number).filter((n) => n > 0);

program
  .command("analyze <trailer>")
  .description("Ingest + análise (cenas, áudio/beats, keyframes, transcrição)")
  .option("-s, --slug <slug>", "nome da pasta de trabalho")
  .option("-f, --force", "refaz o proxy mesmo se já existir")
  .action(async (trailer: string, o: { slug?: string; force?: boolean }) => {
    await analyze(trailer, o.slug ?? slugify(path.basename(trailer)), { force: o.force });
  });

program
  .command("plan <slug>")
  .description("Escolhe os cortes e roteiriza os shorts (Claude ou heurística)")
  .option("--heuristic", "não usa a API do Claude")
  .option("-g, --game <nome>", "nome do jogo")
  .option("-n, --count <n>", "quantos shorts", (v) => Number(v))
  .option("--no-sfx", "sem efeitos sonoros")
  .action(async (slug: string, o: { heuristic?: boolean; game?: string; count?: number; sfx: boolean }) => {
    await makePlan(loadAnalysis(slug), o);
  });

program
  .command("render <slug>")
  .description("Renderiza os shorts do plan.json")
  .option("--format <lista>", "9x16,16x9", parseFormats, ["9x16", "16x9"] as FormatKey[])
  .option("--only <lista>", "só alguns shorts, ex.: 1,3", parseList)
  .option("-c, --concurrency <n>", "abas de render em paralelo", (v) => Number(v))
  .action(async (slug: string, o: { format: FormatKey[]; only?: number[]; concurrency?: number }) => {
    await renderPlan(loadPlan(slug), { formats: o.format, only: o.only, concurrency: o.concurrency });
  });

program
  .command("preview <slug>")
  .description("Renderiza frames soltos (PNG) de um short para revisão rápida")
  .option("-i, --index <n>", "qual short (1 = primeiro)", (v) => Number(v), 1)
  .option("--format <f>", "9x16 ou 16x9", "9x16")
  .option("--at <segundos>", "tempos no short, ex.: 0.5,3,10", (v) => v.split(",").map(Number), [0.6, 3, 8, 15])
  .action(async (slug: string, o: { index: number; format: string; at: number[] }) => {
    const [format] = parseFormats(o.format);
    await renderPreview(loadPlan(slug), { short: o.index, format, at: o.at });
  });

program
  .command("make <trailer>")
  .description("Tudo de uma vez: analyze → plan → render")
  .option("-s, --slug <slug>")
  .option("-g, --game <nome>")
  .option("-n, --count <n>", "quantos shorts", (v) => Number(v))
  .option("--heuristic")
  .option("--no-sfx")
  .option("--format <lista>", "9x16,16x9", parseFormats, ["9x16", "16x9"] as FormatKey[])
  .option("-c, --concurrency <n>", "abas de render em paralelo", (v) => Number(v))
  .option("-f, --force")
  .action(async (trailer: string, o) => {
    const slug = o.slug ?? slugify(path.basename(trailer));
    const analysis = await analyze(trailer, slug, { force: o.force });
    const plan = await makePlan(analysis, { heuristic: o.heuristic, game: o.game, count: o.count, sfx: o.sfx });
    const files = await renderPlan(plan, { formats: o.format, concurrency: o.concurrency });
    console.log(`\n✓ ${files.length} vídeos prontos em out/${slug}/`);
  });

program
  .command("studio [slug]")
  .description("Abre o Remotion Studio com o plano (ou a demo) para revisar")
  .option("-i, --index <n>", "qual short abrir (1 = primeiro)", (v) => Number(v), 1)
  .action(async (slug: string | undefined, o: { index: number }) => {
    await ensureSfx();
    const args = ["remotion", "studio", "remotion/index.ts"];
    if (slug) {
      const propsFile = workPath(slug, "studio-props.json");
      fs.writeFileSync(propsFile, JSON.stringify({ plan: loadPlan(slug), shortIndex: o.index - 1 }));
      args.push(`--props=${propsFile}`);
    }
    spawn("npx", args, { cwd: ROOT, stdio: "inherit" });
  });

program.parseAsync().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
