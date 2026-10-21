import type { Analysis, Short } from "../schema";
import type { Candidate } from "./candidates";

const HOOKS: { text: string; sub: string }[] = [
  { text: "VOCÊ NÃO ESTÁ PRONTO PRA ISSO", sub: "assiste até o final" },
  { text: "OLHA O NÍVEL DESSE JOGO", sub: "trailer novo" },
  { text: "ISSO AQUI VAI SER ENORME", sub: "presta atenção nos detalhes" },
  { text: "O TRAILER QUE TODO MUNDO TÁ COMENTANDO", sub: "e com razão" },
  { text: "PARA TUDO E ASSISTE ISSO", sub: "" },
];
const CALLOUTS = ["OLHA ISSO", "BRUTAL", "QUE ISSO?!", "INSANO", "SEGURA ESSA"];
const SPLASH_KINDS = ["impact", "particles", "shockwave", "glitch"] as const;
const CALLOUT_STYLES = ["stamp", "badge", "glitch"] as const;
const ACCENTS = ["#ff3d3d", "#00e5ff", "#b6ff00", "#ff9f1c", "#c084fc"];

// Plano sem IA: cada candidato vira um short com cold open (o shot mais forte de outro
// trecho do trailer), legendas da transcrição original e efeitos nos maiores impactos.
export function heuristicShorts(a: Analysis, candidates: Candidate[], game: string, count: number): Short[] {
  const impacts = [...a.audio.onsets].sort((x, y) => y.strength - x.strength);
  return candidates.slice(0, count).map((c, n) => {
    const hookShot = pickColdOpen(a, c);
    const segments: Short["segments"] = [];
    if (hookShot) {
      segments.push({ srcStart: hookShot.start, srcEnd: Math.min(hookShot.end, hookShot.start + 2), speed: 1, focusX: 0.5, fit: "crop" });
    }
    segments.push({ srcStart: c.start, srcEnd: c.end, speed: 1, focusX: 0.5, fit: "blur" });

    const inside = (t: number) => segments.some((s) => t >= s.srcStart + 0.3 && t <= s.srcEnd - 0.3);
    const top = impacts.filter((o) => inside(o.t));
    const spaced: typeof top = [];
    for (const o of top) {
      if (spaced.every((s) => Math.abs(s.t - o.t) > 2.5)) spaced.push(o);
      if (spaced.length >= 5) break;
    }
    spaced.sort((x, y) => x.t - y.t);

    const captions = (a.transcript?.phrases ?? [])
      .filter((p) => segments.some((s) => p.end > s.srcStart && p.start < s.srcEnd))
      .map((p) => ({ srcStart: p.start, srcEnd: p.end, text: p.text, emphasis: [] as string[] }));

    return {
      id: `short-${String(n + 1).padStart(2, "0")}`,
      title: `${game} — corte ${n + 1}`,
      hook: HOOKS[n % HOOKS.length],
      segments,
      captions,
      callouts: spaced.slice(1, 3).map((o, i) => ({
        srcTime: o.t,
        duration: 1.2,
        text: CALLOUTS[(n + i) % CALLOUTS.length],
        style: CALLOUT_STYLES[(n + i) % CALLOUT_STYLES.length],
      })),
      splashes: spaced.map((o, i) => ({
        srcTime: o.t,
        kind: SPLASH_KINDS[(n + i) % SPLASH_KINDS.length],
        text: "",
        intensity: Math.min(1, 0.5 + o.strength / 2),
      })),
      endCard: { title: game.toUpperCase(), subtitle: "Trailer oficial", cta: "Segue pra mais trailers" },
      accentColor: ACCENTS[n % ACCENTS.length],
    };
  });
}

function pickColdOpen(a: Analysis, c: Candidate) {
  const blackAt = (t: number) => a.black.some((b) => t >= b.start && t <= b.end);
  let best: Analysis["shots"][number] | null = null;
  let bestScore = 0;
  for (const s of a.shots) {
    if (s.end > c.start - 1 && s.start < c.end + 1) continue; // fora da janela principal
    if (s.end - s.start < 0.6 || blackAt((s.start + s.end) / 2)) continue;
    const score = s.energy * 0.6 + s.motion * 0.4;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return bestScore > 0.35 ? best : null;
}
