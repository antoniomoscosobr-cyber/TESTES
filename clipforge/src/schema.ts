// Schemas compartilhados entre o pipeline (Node) e as composições Remotion.
// Este arquivo não pode importar módulos de Node: ele também roda no bundle do navegador.
import { z } from "zod";

// ---------- Análise ----------

export const ShotSchema = z.object({
  start: z.number(),
  end: z.number(),
  motion: z.number(), // média do scene score no shot (0..1), proxy de movimento
  energy: z.number(), // RMS médio normalizado (0..1)
});
export type Shot = z.infer<typeof ShotSchema>;

export const WordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
});
export type Word = z.infer<typeof WordSchema>;

export const PhraseSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  words: z.array(WordSchema),
});
export type Phrase = z.infer<typeof PhraseSchema>;

export const AnalysisSchema = z.object({
  version: z.literal(1),
  slug: z.string(),
  source: z.object({
    file: z.string(), // relativo a public/ (para staticFile)
    bgFile: z.string().default(""), // fundo 9:16 já desfocado (modo blur)
    duration: z.number(),
    fps: z.number(),
    width: z.number(),
    height: z.number(),
    hasAudio: z.boolean(),
  }),
  shots: z.array(ShotSchema),
  black: z.array(z.object({ start: z.number(), end: z.number() })),
  audio: z.object({
    hop: z.number(), // segundos por amostra das curvas abaixo
    energy: z.array(z.number()),
    onsetEnvelope: z.array(z.number()),
    onsets: z.array(z.object({ t: z.number(), strength: z.number() })),
    bpm: z.number().nullable(),
    beatConfidence: z.number(),
    beats: z.array(z.number()),
  }),
  transcript: z
    .object({ language: z.string(), phrases: z.array(PhraseSchema) })
    .nullable(),
  keyframes: z.array(z.object({ index: z.number(), shot: z.number(), t: z.number(), file: z.string() })),
  contactSheets: z.array(z.object({ file: z.string(), keyframes: z.array(z.number()) })),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

// ---------- Plano de edição ----------

export const FitSchema = z.enum(["crop", "blur"]);
export const SplashKindSchema = z.enum(["impact", "particles", "shockwave", "title3d", "flash", "glitch"]);
export const CalloutStyleSchema = z.enum(["badge", "stamp", "glitch"]);

export const SegmentSchema = z.object({
  srcStart: z.number(),
  srcEnd: z.number(),
  speed: z.number().default(1),
  focusX: z.number().min(0).max(1).default(0.5), // centro do crop 9:16 (0 = esquerda, 1 = direita)
  fit: FitSchema.default("crop"),
});
export type Segment = z.infer<typeof SegmentSchema>;

// Todos os eventos usam tempo da FONTE (trailer). O mapeamento para o tempo do short
// é feito por resolveTimeline(); eventos fora dos segmentos são descartados.
export const CaptionLineSchema = z.object({
  srcStart: z.number(),
  srcEnd: z.number(),
  text: z.string(),
  emphasis: z.array(z.string()).default([]),
});
export type CaptionLine = z.infer<typeof CaptionLineSchema>;

export const CalloutSchema = z.object({
  srcTime: z.number(),
  duration: z.number().default(1.2),
  text: z.string(),
  style: CalloutStyleSchema.default("badge"),
});
export type Callout = z.infer<typeof CalloutSchema>;

export const SplashSchema = z.object({
  srcTime: z.number(),
  kind: SplashKindSchema,
  text: z.string().default(""),
  intensity: z.number().min(0).max(1).default(0.8),
});
export type Splash = z.infer<typeof SplashSchema>;

export const ShortSchema = z.object({
  id: z.string(),
  title: z.string(),
  hook: z.object({ text: z.string(), sub: z.string().default("") }),
  segments: z.array(SegmentSchema).min(1),
  captions: z.array(CaptionLineSchema).default([]),
  callouts: z.array(CalloutSchema).default([]),
  splashes: z.array(SplashSchema).default([]),
  endCard: z.object({
    title: z.string(),
    subtitle: z.string().default(""),
    cta: z.string().default("Segue pra mais trailers"),
  }),
  accentColor: z.string().default("#ff3d3d"),
});
export type Short = z.infer<typeof ShortSchema>;

export const EditPlanSchema = z.object({
  version: z.literal(1),
  slug: z.string(),
  game: z.string(),
  director: z.enum(["claude", "heuristic"]),
  source: z.object({
    file: z.string(),
    bgFile: z.string().default(""),
    duration: z.number(),
    fps: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  beats: z.array(z.number()).default([]),
  sfx: z.boolean().default(true),
  shorts: z.array(ShortSchema).min(1),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

// Props das composições Remotion.
export const ShortPropsSchema = z.object({
  plan: EditPlanSchema,
  shortIndex: z.number().int().min(0),
});
export type ShortProps = z.infer<typeof ShortPropsSchema>;
