import fs from "node:fs";
import { PRESET, workPath } from "../config";
import { EditPlanSchema, type Analysis, type EditPlan } from "../schema";
import { findCandidates } from "./candidates";
import { directShorts } from "./director";
import { heuristicShorts } from "./heuristic";
import { snapPlan } from "./snap";

export type PlanOptions = { heuristic?: boolean; game?: string; count?: number; sfx?: boolean };

export async function makePlan(a: Analysis, opts: PlanOptions = {}): Promise<EditPlan> {
  const count = opts.count ?? PRESET.shortsPerTrailer;
  const candidates = findCandidates(a, { count: Math.max(12, count * 3) });
  const fallbackGame = opts.game ?? titleCase(a.slug);

  let director: EditPlan["director"] = "heuristic";
  let game = fallbackGame;
  let shorts: EditPlan["shorts"] | null = null;

  // Sem credenciais o SDK falha logo na criação do client e caímos no plano heurístico.
  if (!opts.heuristic) {
    try {
      const res = await directShorts(a, candidates, { count, game: opts.game });
      game = opts.game ?? res.game;
      shorts = res.shorts;
      director = "claude";
    } catch (err) {
      console.warn(`⚠ diretor Claude falhou (${(err as Error).message}). Usando plano heurístico.`);
    }
  }
  if (!shorts) shorts = heuristicShorts(a, candidates, game, count);

  const plan = EditPlanSchema.parse({
    version: 1,
    slug: a.slug,
    game,
    director,
    source: {
      file: a.source.file,
      bgFile: a.source.bgFile,
      duration: a.source.duration,
      fps: a.source.fps,
      width: a.source.width,
      height: a.source.height,
    },
    beats: a.audio.beats,
    sfx: opts.sfx ?? true,
    shorts,
  });
  const snapped = EditPlanSchema.parse(snapPlan(plan, a));
  fs.writeFileSync(workPath(a.slug, "plan.json"), JSON.stringify(snapped, null, 2));
  console.log(`✓ plano (${director}): ${snapped.shorts.length} shorts → ${workPath(a.slug, "plan.json")}`);
  return snapped;
}

export function loadPlan(slug: string): EditPlan {
  const file = workPath(slug, "plan.json");
  if (!fs.existsSync(file)) throw new Error(`Sem plano para "${slug}". Rode: clipforge plan ${slug}`);
  return EditPlanSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

const titleCase = (slug: string) =>
  slug
    .split("-")
    .filter((w) => !/^(trailer|official|oficial|gameplay|reveal|teaser|4k|hd|\d+p)$/i.test(w))
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Game";
