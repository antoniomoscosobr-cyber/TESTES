import fs from "node:fs";
import { parseSrt, parseVtt } from "@remotion/captions";
import { gameNameFromFile, PRESET, workPath } from "../config";
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

export function loadPlan(slug: string): EditPlan {
  const file = workPath(slug, "plan.json");
  if (!fs.existsSync(file)) throw new Error(`Sem plano para "${slug}". Rode: clipforge plan ${slug}`);
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
