#!/usr/bin/env -S npx tsx
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { analyze, loadAnalysis } from "./analyze/index";
import { keepProject, swapSource } from "./analyze/swap";
import { FORMATS, ROOT, slugFor, workPath, type FormatKey } from "./config";
import { loadPlan, makePlan, planFits } from "./plan/index";
import { renderPlan, renderPreview, workSize } from "./render/render";
import { ensureSfx } from "./render/sfx";

const program = new Command()
  .name("clipforge")
  .description("Shorts automáticos a partir de trailers de games: cortes, legendas PT-BR e splashes GSAP/Three.js.");

const parseFormats = (v: string): FormatKey[] => {
  const list = v.split(",").map((s) => s.trim()) as FormatKey[];
  for (const f of list) if (!(f in FORMATS)) throw new Error(`Formato inválido: ${f} (use ${Object.keys(FORMATS).join(", ")})`);
  return list;
};
const parseList = (v: string) => {
  const list = v.split(",").map((s) => Number(s.trim()));
  if (list.some((n) => !Number.isInteger(n) || n < 1)) throw new Error(`Lista inválida: "${v}" (use números a partir de 1, ex.: 1,3)`);
  return list;
};
const parsePositive = (name: string) => (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} inválido: "${v}"`);
  return n;
};

program
  .command("analyze <trailer>")
  .description("Ingest + análise (cenas, áudio/beats, keyframes, transcrição)")
  .option("-s, --slug <slug>", "nome da pasta de trabalho")
  .option("-f, --force", "refaz tudo mesmo se o trailer não mudou")
  .action(async (trailer: string, o: { slug?: string; force?: boolean }) => {
    await analyze(trailer, o.slug ?? slugFor(trailer), { force: o.force });
  });

program
  .command("plan <slug>")
  .description("Escolhe os cortes e roteiriza os shorts (Claude ou heurística)")
  .option("--heuristic", "não usa a API do Claude")
  .option("-g, --game <nome>", "nome do jogo")
  .option("-n, --count <n>", "quantos shorts", parsePositive("count"))
  .option("--subs <arquivo>", "legendas .srt/.vtt (ex.: PT-BR) para usar no lugar da transcrição")
  .option("--no-sfx", "sem efeitos sonoros")
  .action(async (slug: string, o: { heuristic?: boolean; game?: string; count?: number; sfx: boolean; subs?: string }) => {
    await makePlan(loadAnalysis(slug), o);
  });

program
  .command("render <slug>")
  .description("Renderiza os shorts do plan.json")
  .option("--format <lista>", "9x16,16x9", parseFormats, ["9x16", "16x9"] as FormatKey[])
  .option("--only <lista>", "só alguns shorts, ex.: 1,3", parseList)
  .option("-c, --concurrency <n>", "abas de render em paralelo", parsePositive("concurrency"))
  .option("--no-extras", "só os vídeos principais: sem a versão sem legenda e os stems da narração")
  .action(async (slug: string, o: { format: FormatKey[]; only?: number[]; concurrency?: number; extras: boolean }) => {
    await renderPlan(loadPlan(slug), { formats: o.format, only: o.only, concurrency: o.concurrency, extras: o.extras });
  });

program
  .command("preview <slug>")
  .description("Renderiza frames soltos (PNG) de um short para revisão rápida")
  .option("-i, --index <n>", "qual short (1 = primeiro)", parsePositive("index"), 1)
  .option("--format <f>", "9x16 ou 16x9", "9x16")
  .option("--at <segundos>", "tempos no short, ex.: 0.5,3,10", (v) => v.split(",").map(Number), [0.6, 3, 8, 15])
  .action(async (slug: string, o: { index: number; format: string; at: number[] }) => {
    const [format] = parseFormats(o.format);
    await renderPreview(loadPlan(slug), { short: o.index, format, at: o.at });
  });

program
  .command("make <trailer>")
  .description("Tudo de uma vez: analyze → plan → render (reaproveita análise e plano se o trailer não mudou)")
  .option("-s, --slug <slug>")
  .option("-g, --game <nome>")
  .option("-n, --count <n>", "quantos shorts", parsePositive("count"))
  .option("--heuristic", "não usa a API do Claude")
  .option("--subs <arquivo>", "legendas .srt/.vtt para usar no lugar da transcrição")
  .option("--no-sfx")
  .option("--format <lista>", "9x16,16x9", parseFormats, ["9x16", "16x9"] as FormatKey[])
  .option("-c, --concurrency <n>", "abas de render em paralelo", parsePositive("concurrency"))
  .option("--reanalyze", "refaz a análise mesmo se o trailer não mudou")
  .option("--replan", "refaz o plano (o anterior vira plan.N.json)")
  .action(async (trailer: string, o) => {
    const slug: string = o.slug ?? slugFor(trailer);
    const analysis = await analyze(trailer, slug, { force: o.reanalyze, reuse: !o.reanalyze });
    // Reaproveita o plano (local ou guardado em projects/<slug>/) feito para este mesmo trailer.
    const reuse = !o.replan && planFits(slug, analysis.source);
    const plan = reuse
        ? (console.log("• plano: reaproveitando plan.json (use --replan para refazer)"), loadPlan(slug))
        : await makePlan(analysis, { heuristic: o.heuristic, game: o.game, count: o.count, sfx: o.sfx, subs: o.subs });
    const files = await renderPlan(plan, { formats: o.format, concurrency: o.concurrency });
    console.log(`\n✓ ${files.length} vídeos prontos em ${path.relative(process.cwd(), path.join(ROOT, "out", slug)) || "."}/`);
  });

program
  .command("swap-source <slug> <arquivo>")
  .description("Troca o vídeo de um plano pronto (ex.: 360p → 1080p do mesmo trailer) mantendo roteiro e cortes")
  .option("--refit", "refaz o enquadramento 9:16 pelo foco de cada shot (bom ao subir a resolução)")
  .action(async (slug: string, file: string, o: { refit?: boolean }) => {
    await swapSource(slug, file, o);
  });

program
  .command("keep <slug>")
  .description("Guarda o plano (e a assinatura do áudio, para swap-source) em projects/<slug>/ para versionar no git")
  .action(async (slug: string) => {
    const dir = await keepProject(slug);
    console.log(`✓ guardado em ${path.relative(process.cwd(), dir) || "."}/ — faça commit para usar em outra máquina/sessão.`);
  });

program
  .command("studio [slug]")
  .description("Abre o Remotion Studio com o plano (ou a demo). Edite public/work/<slug>/plan.json e recarregue.")
  .option("-i, --index <n>", "qual short abrir (1 = primeiro)", parsePositive("index"), 1)
  .action(async (slug: string | undefined, o: { index: number }) => {
    await ensureSfx();
    const args = ["remotion", "studio", "remotion/index.ts"];
    if (slug) {
      loadPlan(slug); // valida antes de abrir
      const propsFile = workPath(slug, "studio-props.json");
      fs.writeFileSync(propsFile, JSON.stringify({ slug, shortIndex: o.index - 1 }));
      args.push(`--props=${propsFile}`);
      console.log(`• Studio: editando ${path.relative(process.cwd(), workPath(slug, "plan.json"))} — salve e recarregue a página para ver.`);
    }
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 || code === null ? resolve() : reject(new Error(`remotion studio saiu com código ${code}`))));
    });
  });

program
  .command("clean [slug]")
  .description("Apaga a pasta de trabalho de um trailer (proxy, análise, planos) — ou lista o espaço usado")
  .option("--all", "apaga todas")
  .action((slug: string | undefined, o: { all?: boolean }) => {
    const root = path.join(ROOT, "public", "work");
    const slugs = fs.existsSync(root) ? fs.readdirSync(root) : [];
    const mb = (n: number) => `${(n / 1e6).toFixed(0)} MB`;
    if (!slug && !o.all) {
      for (const s of slugs) console.log(`  ${s}: ${mb(workSize(s))}`);
      console.log("Use: clipforge clean <slug>  ou  clipforge clean --all");
      return;
    }
    for (const s of o.all ? slugs : [slug!]) {
      if (!slugs.includes(s)) throw new Error(`"${s}" não existe em public/work`);
      const size = workSize(s);
      fs.rmSync(workPath(s), { recursive: true, force: true });
      console.log(`✓ ${s} apagado (${mb(size)})`);
    }
  });

program.parseAsync().catch((err: Error) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
