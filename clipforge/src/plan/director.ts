import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PRESET, PUBLIC_DIR } from "../config";
import { CalloutStyleSchema, FitSchema, SplashKindSchema, type Analysis, type Short } from "../schema";

// O helper do SDK transforma enum em descrição; os campos abaixo chegam como texto e são normalizados.
const oneOf = <T extends readonly string[]>(values: T, fallback: T[number]) => (v: string): T[number] =>
  (values as readonly string[]).includes(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as T[number]) : fallback;
const toFit = oneOf(FitSchema.options, "crop");
const toKind = oneOf(SplashKindSchema.options, "impact");
const toStyle = oneOf(CalloutStyleSchema.options, "badge");
import type { Candidate } from "./candidates";

// Schema da resposta do Claude: sem defaults nem limites numéricos (structured outputs);
// os valores são validados e ajustados depois em snap.ts.
const DirectorSchema = z.object({
  game: z.string().describe("Nome do jogo como aparece no trailer (logo/título)"),
  shorts: z.array(
    z.object({
      title: z.string().describe("Título curto para o post, PT-BR"),
      rationale: z.string().describe("Por que esse corte funciona, 1 frase"),
      hook: z.object({
        text: z.string().describe("Gancho PT-BR em CAIXA ALTA, máx. 6 palavras"),
        sub: z.string().describe("Linha de apoio curta, pode ser vazia"),
      }),
      segments: z.array(
        z.object({
          srcStart: z.number(),
          srcEnd: z.number(),
          speed: z.number().describe("1 = normal; 0.5–0.8 câmera lenta em momentos épicos; até 1.5 para acelerar"),
          focusX: z.number().describe("Centro horizontal do assunto principal, 0 (esquerda) a 1 (direita)"),
          fit: z.string().describe("crop = tela cheia 9:16 seguindo focusX; blur = quadro inteiro com fundo desfocado"),
        }),
      ),
      captions: z.array(
        z.object({
          srcStart: z.number(),
          srcEnd: z.number(),
          text: z.string().describe("Legenda PT-BR"),
          emphasis: z.array(z.string()).describe("Palavras da legenda para destacar"),
        }),
      ),
      callouts: z.array(
        z.object({ srcTime: z.number(), duration: z.number(), text: z.string(), style: z.string().describe(CalloutStyleSchema.options.join(" | ")) }),
      ),
      splashes: z.array(
        z.object({ srcTime: z.number(), kind: z.string().describe(SplashKindSchema.options.join(" | ")), text: z.string(), intensity: z.number().describe("0 a 1") }),
      ),
      endCard: z.object({ title: z.string(), subtitle: z.string(), cta: z.string() }),
      accentColor: z.string().describe("Cor de destaque hex que combine com a paleta do jogo"),
    }),
  ),
});

const SYSTEM = `Você é editor-chefe de um canal brasileiro de games no TikTok/Reels/Shorts.
Recebe a análise técnica de um trailer (shots, energia do áudio, impactos, BPM, transcrição) e contact sheets com um keyframe por shot.
Seu trabalho: escolher os melhores cortes e roteirizar a edição de cada short.

Regras de edição:
- Cada short tem entre ${PRESET.minShortSeconds} e ${PRESET.maxShortSeconds}s (soma de (srcEnd-srcStart)/speed). Ideal: 20–35s.
- Os primeiros 2s decidem tudo: comece com um cold open forte (pode ser um shot de outro ponto do trailer) e depois siga um trecho contínuo com começo, meio e clímax.
- Corte em trocas de cena ou em beats. Evite telas pretas, cartelas de classificação etária, logos de publisher e texto legal — exceto o logo final do jogo.
- Cada short deve ser diferente dos outros (momentos, ângulo, gancho).
- Todos os tempos (srcStart, srcEnd, srcTime) estão em segundos do trailer ORIGINAL e devem cair dentro dos segmentos do short.
- fit "crop" para close-ups e ação centralizada (defina focusX olhando o keyframe); "blur" para planos abertos, HUD ou texto que não pode ser cortado.

Texto (sempre PT-BR do Brasil, tom de criador de conteúdo, sem emojis):
- Se houver transcrição, traduza/adapte as falas para PT-BR mantendo os tempos de cada frase; legendas curtas e naturais.
- Sem fala: escreva legendas de narração curtas que comentem o que aparece (sem inventar fatos sobre o jogo).
- Callouts: 1–3 por short, 1–3 palavras, nos momentos mais fortes.
- Splashes (efeitos): 3–6 por short nos maiores impactos do áudio. impact = tremida + zoom; particles = explosão de estilhaços 3D; shockwave = anel de choque; glitch = falha RGB; flash = clarão; title3d = título 3D (preencha text com o nome do jogo, sem acentos).
- endCard: nome do jogo, data/plataformas só se aparecerem no trailer, e um CTA.`;

export async function directShorts(
  a: Analysis,
  candidates: Candidate[],
  opts: { count: number; game?: string },
): Promise<{ game: string; shorts: Short[] }> {
  const client = new Anthropic();
  const r2 = (v: number) => Math.round(v * 100) / 100;

  const data = {
    trailer: { duration: a.source.duration, width: a.source.width, height: a.source.height },
    gameHint: opts.game ?? null,
    shotsWanted: opts.count,
    shots: a.shots.map((s, i) => ({ i, start: r2(s.start), end: r2(s.end), motion: r2(s.motion), energy: r2(s.energy) })),
    keyframes: a.keyframes.map((k) => ({ kf: k.index, shot: k.shot, t: r2(k.t) })),
    audio: {
      bpm: a.audio.bpm,
      beatConfidence: a.audio.beatConfidence,
      topImpacts: [...a.audio.onsets]
        .sort((x, y) => y.strength - x.strength)
        .slice(0, 50)
        .sort((x, y) => x.t - y.t),
      energyEvery05s: a.audio.energy.filter((_, i) => i % 5 === 0).map(r2),
    },
    black: a.black,
    transcript: a.transcript
      ? { language: a.transcript.language, phrases: a.transcript.phrases.map((p) => ({ start: r2(p.start), end: r2(p.end), text: p.text })) }
      : null,
    candidates: candidates.map((c) => ({ start: r2(c.start), end: r2(c.end), score: c.score, ...c.features })),
  };

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    { type: "text", text: `Análise do trailer (JSON):\n${JSON.stringify(data)}` },
  ];
  for (const sheet of a.contactSheets) {
    const first = sheet.keyframes[0];
    const last = sheet.keyframes[sheet.keyframes.length - 1];
    content.push({ type: "text", text: `Contact sheet com os keyframes #${first}–#${last} (ordem de leitura, 4 por linha):` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(path.join(PUBLIC_DIR, sheet.file)).toString("base64") },
    });
  }
  content.push({
    type: "text",
    text: `Monte ${opts.count} shorts. Use os candidatos como ponto de partida, mas ajuste livremente olhando as imagens.`,
  });

  console.log(`• diretor: enviando ${a.contactSheets.length} contact sheets para ${PRESET.claudeModel}…`);
  const stream = client.beta.messages.stream({
    model: PRESET.claudeModel,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(DirectorSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("O modelo recusou o pedido (stop_reason=refusal).");
  if (message.stop_reason === "max_tokens") throw new Error("Resposta truncada (max_tokens).");
  const out = message.parsed_output;
  if (!out) throw new Error("Resposta sem JSON válido.");
  const u = message.usage;
  console.log(`  tokens: ${u.input_tokens} in / ${u.output_tokens} out`);

  return mapDirectorOutput(out, opts.game);
}

export type DirectorOutput = z.infer<typeof DirectorSchema>;

// Converte a resposta do modelo no formato do plano, normalizando valores fora da lista.
export function mapDirectorOutput(out: DirectorOutput, gameHint?: string): { game: string; shorts: Short[] } {
  return {
    game: out.game || gameHint || "Game",
    shorts: out.shorts.map((s, n) => ({
      id: `short-${String(n + 1).padStart(2, "0")}`,
      title: s.title,
      hook: s.hook,
      segments: s.segments.map((g) => ({ ...g, fit: toFit(g.fit) })),
      captions: s.captions,
      callouts: s.callouts.map((c) => ({ ...c, style: toStyle(c.style) })),
      splashes: s.splashes.map((x) => ({ ...x, kind: toKind(x.kind), intensity: Math.min(1, Math.max(0, x.intensity)) })),
      endCard: s.endCard,
      accentColor: /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : "#ff3d3d",
    })),
  };
}
