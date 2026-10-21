import fs from "node:fs";
import path from "node:path";
import { parseSrt, parseVtt } from "@remotion/captions";
import { gameNameFromFile, PRESET, projectPath, workPath } from "../config";
import { EditPlanSchema, type Analysis, type EditPlan, type Phrase } from "../schema";
import { resolveTimeline, FPS } from "../timeline";
import { findCandidates } from "./candidates";
import { directShorts } from "./director";
import { heuristicShorts } from "./heuristic";
import { snapPlan } from "./snap";

export type PlanOptions = {
  heuristic?: boolean;
  game?: string;
  count?: number;
  sfx?: boolean;
  subs?: string; // arquivo .srt/.vtt com legendas (ex.: PT-BR) para usar no lugar da transcrição
};

export async function makePlan(input: Analysis, opts: PlanOptions = {}): Promise<EditPlan> {
  const count = opts.count ?? PRESET.shortsPerTrailer;
  let a = input;
  if (opts.subs) {
    const phrases = loadSubtitles(opts.subs);
    console.log(`• plano: ${phrases.length} legendas carregadas de ${opts.subs}`);
    a = { ...a, transcript: { language: "pt (legendas do usuário)", phrases }, transcriptStatus: "ok" };
  }
  const candidates = findCandidates(a, { count: Math.max(12, count * 3) });
  if (candidates.length < count) console.warn(`⚠ só ${candidates.length} trecho(s) bom(ns) para ${count} shorts pedidos.`);
  const fallbackGame = opts.game ?? (a.sourceName ? gameNameFromFile(a.sourceName) : a.slug);

  let director: EditPlan["director"] = "heuristic";
  let plan: EditPlan | null = null;
  const base = {
    version: 1 as const,
    slug: a.slug,
    source: {
      file: a.source.file,
      bgFile: a.source.bgFile,
      duration: a.source.duration,
      fps: a.source.fps,
      width: a.source.width,
      height: a.source.height,
    },
    beats: a.audio.beatConfidence >= 0.4 ? a.audio.beats : [],
    sfx: opts.sfx ?? true,
  };

  // Sem credenciais o SDK falha logo na criação do client; qualquer falha (rede, recusa,
  // resposta fora do formato) cai no plano heurístico em vez de derrubar o comando.
  if (!opts.heuristic) {
    try {
      const res = await directShorts(a, candidates, { count, game: opts.game });
      const parsed = EditPlanSchema.safeParse({ ...base, game: opts.game ?? res.game, director: "claude", shorts: res.shorts });
      if (!parsed.success) throw new Error(`plano inválido: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      plan = parsed.data;
      director = "claude";
    } catch (err) {
      console.warn(`⚠ diretor Claude indisponível (${(err as Error).message}). Usando plano heurístico.`);
    }
  }
  if (!plan) {
    const phrases = a.transcript?.phrases;
    plan = EditPlanSchema.parse({ ...base, game: fallbackGame, director, shorts: heuristicShorts(a, candidates, fallbackGame, count, { phrases }) });
    warnCaptions(a, !!opts.subs);
  }

  const snapped = EditPlanSchema.parse(snapPlan(plan, a));
  savePlan(a.slug, snapped);
  console.log(`✓ plano (${director}): ${snapped.shorts.length} shorts → ${workPath(a.slug, "plan.json")}`);
  printDurations(snapped);
  return snapped;
}

function warnCaptions(a: Analysis, userSubs: boolean) {
  if (userSubs) return;
  if (a.transcriptStatus === "unavailable") {
    console.warn("⚠ sem legendas: a fala não foi transcrita (whisper indisponível). Use --subs legendas.srt ou o diretor Claude (ANTHROPIC_API_KEY).");
  } else if (a.transcriptStatus === "ok" && a.transcript && !a.transcript.language.startsWith("pt")) {
    console.warn(`⚠ legendas no idioma original (${a.transcript.language}); PT-BR precisa do diretor Claude ou de --subs.`);
  }
}

// Lê .srt ou .vtt (ex.: legendas oficiais do trailer em PT-BR) como frases com tempo.
export function loadSubtitles(file: string): Phrase[] {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const { captions } = file.toLowerCase().endsWith(".vtt") ? parseVtt({ input: text }) : parseSrt({ input: text });
  return captions
    .map((c) => ({ text: c.text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(), start: c.startMs / 1000, end: c.endMs / 1000, words: [] }))
    .filter((p) => p.text && p.end > p.start);
}

// Mantém o plano anterior como backup (plan.1.json, plan.2.json…) antes de sobrescrever:
// edições feitas à mão não se perdem num novo `plan`/`make`.
export function savePlan(slug: string, plan: EditPlan) {
  const file = workPath(slug, "plan.json");
  if (fs.existsSync(file)) {
    let n = 1;
    while (fs.existsSync(workPath(slug, `plan.${n}.json`))) n++;
    fs.copyFileSync(file, workPath(slug, `plan.${n}.json`));
  }
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));
}

type SourceShape = { duration: number; width: number; height: number };
// Mesmo arquivo de trailer (resolução e duração iguais): um plano feito para um vale para o outro.
export const sameSource = (a: SourceShape, b: SourceShape) => a.width === b.width && a.height === b.height && Math.abs(a.duration - b.duration) < 0.15;

const readSource = (file: string): SourceShape | null => {
  try {
    return (JSON.parse(fs.readFileSync(file, "utf8")) as { source?: SourceShape }).source ?? null;
  } catch {
    return null;
  }
};

// O plano deste slug (o local ou, sem ele, o guardado em projects/) foi feito para esta fonte?
export function planFits(slug: string, source: SourceShape): boolean {
  const work = workPath(slug, "plan.json");
  const src = readSource(fs.existsSync(work) ? work : projectPath(slug, "plan.json"));
  return !!src && sameSource(src, source);
}

// Sem plano local, usa o guardado em projects/<slug>/ (copiando para o trabalho, salvo restore:false).
// O plano precisa ser da mesma fonte que está no trabalho local, senão os cortes caem no lugar
// errado; anySource pula essa checagem (swap-source, que existe justamente para isso).
export function loadPlan(slug: string, opts: { anySource?: boolean; restore?: boolean } = {}): EditPlan {
  const work = workPath(slug, "plan.json");
  const kept = projectPath(slug, "plan.json");
  let file = work;
  if (!fs.existsSync(work)) {
    if (!fs.existsSync(kept)) throw new Error(`Sem plano para "${slug}". Rode: clipforge plan ${slug}`);
    file = kept;
  }
  if (!opts.anySource) {
    if (fs.existsSync(workPath(slug, "swap-pending.json"))) {
      throw new Error(`A troca de fonte de "${slug}" não terminou. Rode de novo: clipforge swap-source ${slug} <arquivo>`);
    }
    const analysisFile = workPath(slug, "analysis.json");
    const local = fs.existsSync(analysisFile) ? readSource(analysisFile) : null;
    const planSource = readSource(file);
    const name = file === kept ? `projects/${slug}/plan.json` : "plan.json";
    if (local && planSource && !sameSource(planSource, local)) {
      throw new Error(
        `${name} foi feito para outra versão do trailer (${planSource.width}x${planSource.height}, ${planSource.duration.toFixed(1)}s) e não para a analisada (${local.width}x${local.height}, ${local.duration.toFixed(1)}s). Para usar com ela: clipforge swap-source ${slug} <arquivo>`,
      );
    }
    if (!local && file === kept && fs.existsSync(workPath(slug, "source.mp4"))) {
      throw new Error(`A análise de "${slug}" não terminou. Rode clipforge analyze de novo antes de usar o plano guardado.`);
    }
  }
  if (file === kept && opts.restore !== false) {
    fs.mkdirSync(path.dirname(work), { recursive: true });
    fs.copyFileSync(kept, work);
    console.log(`• plano restaurado de projects/${slug}/plan.json`);
    file = work;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`plan.json não é um JSON válido: ${(err as Error).message}`);
  }
  const parsed = EditPlanSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`plan.json com problemas:\n${issues}`);
  }
  return validatePlan(parsed.data);
}

// Checagens de um plano (inclusive editado à mão) antes do render: tempos dentro do trailer e
// duração final de cada short. Corrige o que dá (clamps) e avisa o resto.
export function validatePlan(plan: EditPlan): EditPlan {
  const dur = plan.source.duration;
  for (const s of plan.shorts) {
    s.segments = s.segments
      .map((g) => ({ ...g, srcStart: Math.max(0, Math.min(g.srcStart, dur)), srcEnd: Math.max(0, Math.min(g.srcEnd, dur)) }))
      .filter((g) => g.srcEnd - g.srcStart >= 0.1);
    if (s.segments.length === 0) throw new Error(`${s.id}: nenhum segmento dentro do trailer (0–${dur.toFixed(1)}s).`);
    const total = resolveTimeline(s, FPS).duration;
    if (total < PRESET.minShortSeconds - 0.5 || total > PRESET.hardMaxShortSeconds + 0.5) {
      console.warn(`⚠ ${s.id}: ${total.toFixed(1)}s (fora de ${PRESET.minShortSeconds}–${PRESET.hardMaxShortSeconds}s).`);
    }
  }
  return plan;
}

function printDurations(plan: EditPlan) {
  for (const s of plan.shorts) {
    const tl = resolveTimeline(s, FPS);
    console.log(`  ${s.id}: ${tl.duration.toFixed(1)}s, ${s.segments.length} segmento(s), ${tl.pages.length} legenda(s), ${tl.splashes.length} efeito(s) — "${s.hook.text}"`);
  }
}
