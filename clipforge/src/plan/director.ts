import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { PRESET, PUBLIC_DIR } from "../config";
import { CalloutStyleSchema, FitSchema, SplashKindSchema, type Analysis, type Short } from "../schema";
import type { Candidate } from "./candidates";

// O helper do SDK transforma enum em descrição; os campos abaixo chegam como texto e são normalizados.
const oneOf = <T extends readonly string[]>(values: T, fallback: T[number]) => (v: string): T[number] =>
  (values as readonly string[]).includes(v.trim().toLowerCase()) ? (v.trim().toLowerCase() as T[number]) : fallback;
const toFit = oneOf(FitSchema.options, "crop");
const toKind = oneOf(SplashKindSchema.options, "impact");
const toStyle = oneOf(CalloutStyleSchema.options, "badge");
const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

// Schema da resposta do Claude: sem defaults nem limites numéricos (o parser do SDK rejeitaria a
// resposta inteira); os valores são ajustados em mapDirectorOutput e depois em snap.ts.
const DirectorSchema = z.object({
  game: z.string().describe("Nome do jogo como aparece no trailer (logo/título)"),
  shorts: z
    .array(
      z.object({
        title: z.string().describe("Título curto para o post, PT-BR"),
        description: z.string().describe("Legenda do post (1–2 frases PT-BR, sem hashtags)"),
        hashtags: z.array(z.string()).describe("4–8 hashtags relevantes, sem espaços"),
        rationale: z.string().describe("Por que esse corte funciona, 1 frase"),
        hook: z.object({
          text: z.string().describe("Gancho PT-BR em CAIXA ALTA, máx. 6 palavras"),
          sub: z.string().describe("Linha de apoio curta, pode ser vazia"),
        }),
        segments: z
          .array(
            z.object({
              srcStart: z.number(),
              srcEnd: z.number(),
              speed: z.number().describe("1 = normal; 0.5–0.8 câmera lenta em momentos épicos; até 1.5 para acelerar"),
              focusX: z.number().describe("Centro horizontal do assunto principal, 0 (esquerda) a 1 (direita)"),
              fit: z.string().describe("crop = tela cheia 9:16 seguindo focusX; blur = quadro inteiro com fundo desfocado"),
            }),
          )
          .min(1),
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
    )
    .min(1),
});

const SYSTEM = `Você é editor-chefe de um canal brasileiro de games no TikTok/Reels/Shorts.
Recebe a análise técnica de um trailer (shots, energia do áudio, impactos, beats, trechos com voz, transcrição) e contact sheets com um keyframe por shot.
Seu trabalho: escolher os melhores cortes e roteirizar a edição de cada short.

Regras de edição:
- Cada short tem entre ${PRESET.minShortSeconds} e ${PRESET.maxShortSeconds}s (soma de (srcEnd-srcStart)/speed). Ideal: 20–35s.
- Os primeiros 2s decidem tudo: comece com um cold open forte (pode ser um shot de outro ponto do trailer) e depois siga um trecho com começo, meio e clímax.
- Corte nos beats da música (lista "beats") ou em trocas de cena. Não corte no meio de uma fala (veja "speech").
- Evite telas pretas e os trechos em "cards" (classificação etária, logos de publisher, texto legal). Se houver "logoShot", ele é ótimo como último segmento (fica sob o card final).
- Cada short deve ser diferente dos outros (momentos, ângulo, gancho).
- Todos os tempos (srcStart, srcEnd, srcTime) estão em segundos do trailer ORIGINAL e devem cair dentro dos segmentos do short.
- fit "crop" para close-ups e ação centralizada; "blur" para planos abertos, HUD ou texto que não pode ser cortado. Para focusX, parta do focusX do shot (estimado pelo movimento) e corrija olhando o keyframe.
- Os primeiros ~2.6s têm o hook no topo e os últimos ~2.8s têm o card final: não coloque callouts nem splashes nesses intervalos.

Texto (sempre PT-BR do Brasil, tom de criador de conteúdo, sem emojis):
- transcriptStatus "ok": traduza/adapte as falas para PT-BR mantendo os tempos de cada frase; legendas curtas e naturais.
- transcriptStatus "no-speech": pode escrever legendas curtas de comentário sobre o que aparece (sem inventar fatos sobre o jogo).
- transcriptStatus "unavailable": a fala NÃO foi transcrita; não presuma que não há fala. Não legende os trechos em "speech"; fora deles, só comentários curtos, ou deixe captions vazio.
- Callouts: 1–3 por short, 1–3 palavras, nos momentos mais fortes.
- Splashes (efeitos): 3–6 por short nos maiores impactos do áudio. impact = tremida + zoom; particles = explosão de estilhaços 3D; shockwave = anel de choque; glitch = falha RGB; flash = clarão; title3d = título 3D (preencha text com o nome do jogo, sem acentos).
- endCard: nome do jogo, data/plataformas só se aparecerem no trailer, e um CTA.
- description e hashtags: prontos para postar.`;

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
    shots: a.shots.map((s, i) => ({
      i,
      start: r2(s.start),
      end: r2(s.end),
      motion: r2(s.motion),
      energy: r2(s.energy),
      focusX: r2(s.focusX),
      focusConfidence: r2(s.focusConfidence),
    })),
    keyframes: a.keyframes.map((k) => ({ kf: k.index, shot: k.shot, t: r2(k.t) })),
    audio: {
      bpm: a.audio.bpm,
      beatConfidence: a.audio.beatConfidence,
      beats: a.audio.beatConfidence >= 0.3 ? a.audio.beats.map(r2) : [],
      topImpacts: [...a.audio.onsets]
        .sort((x, y) => y.strength - x.strength)
        .slice(0, 50)
        .sort((x, y) => x.t - y.t),
      energyEvery05s: a.audio.energy.filter((_, i) => i % 5 === 0).map(r2),
    },
    black: a.black,
    cards: a.cards,
    logoShot: a.logoShot,
    speech: a.speech,
    transcriptStatus: a.transcriptStatus,
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
  // finalMessage() já tenta validar o JSON; resposta truncada ou fora do schema lança aqui.
  let message: Awaited<ReturnType<typeof stream.finalMessage>>;
  try {
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw err;
    const msg = (err as Error).message.split("\n")[0];
    if (/authentication method|api[_ ]?key/i.test(msg)) throw new Error("sem credenciais da API (defina ANTHROPIC_API_KEY)");
    throw new Error(`resposta inválida do modelo: ${msg}`);
  }

  if (message.stop_reason === "refusal") throw new Error("O modelo recusou o pedido (stop_reason=refusal).");
  if (message.stop_reason === "max_tokens") throw new Error("Resposta truncada (max_tokens).");
  const out = message.parsed_output;
  if (!out) throw new Error("Resposta sem JSON válido.");
  const u = message.usage;
  console.log(`  tokens: ${u.input_tokens} in / ${u.output_tokens} out`);

  return mapDirectorOutput(out, { game: opts.game, count: opts.count, duration: a.source.duration });
}

export type DirectorOutput = z.infer<typeof DirectorSchema>;

// Converte a resposta do modelo no formato do plano: normaliza valores fora da lista, limita
// números a faixas válidas e descarta o que não dá para renderizar (shorts sem segmento válido).
export function mapDirectorOutput(
  out: DirectorOutput,
  opts: { game?: string; count?: number; duration?: number } = {},
): { game: string; shorts: Short[] } {
  const game = (out.game || opts.game || "Game").trim();
  const maxT = opts.duration ?? Infinity;
  const shorts = out.shorts
    .map((s) => {
      const segments = s.segments
        .map((g) => {
          const srcStart = clamp(g.srcStart, 0, maxT);
          return {
            srcStart,
            srcEnd: clamp(g.srcEnd, 0, maxT),
            speed: clamp(g.speed || 1, 0.5, 2),
            focusX: clamp(g.focusX, 0, 1),
            fit: toFit(g.fit),
          };
        })
        .filter((g) => g.srcEnd - g.srcStart >= 0.3);
      const hookWords = s.hook.text.trim().split(/\s+/).filter(Boolean);
      return {
        title: s.title.trim() || game,
        description: s.description.trim(),
        hashtags: normalizeHashtags(s.hashtags),
        hook: { text: hookWords.slice(0, 7).join(" "), sub: s.hook.sub.trim() },
        segments,
        captions: s.captions.filter((c) => c.text.trim() && c.srcEnd > c.srcStart),
        callouts: s.callouts
          .filter((c) => c.text.trim())
          .map((c) => ({ ...c, duration: clamp(c.duration || 1.2, 0.4, 2.5), style: toStyle(c.style) })),
        splashes: s.splashes.map((x) => {
          const kind = toKind(x.kind);
          const text = kind === "title3d" && !x.text.trim() ? game : x.text;
          return { ...x, kind, text, intensity: clamp(x.intensity, 0, 1) };
        }),
        endCard: { title: s.endCard.title.trim() || game, subtitle: s.endCard.subtitle, cta: s.endCard.cta.trim() || "Segue pra mais trailers" },
        accentColor: /^#[0-9a-f]{6}$/i.test(s.accentColor) ? s.accentColor : "#ff3d3d",
      };
    })
    .filter((s) => s.segments.length > 0)
    .slice(0, opts.count ?? Infinity)
    .map((s, n) => ({ id: `short-${String(n + 1).padStart(2, "0")}`, ...s }));
  return { game, shorts };
}

export function normalizeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/[#\s]+/g, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(`#${tag}`);
  }
  return out.slice(0, 10);
}
