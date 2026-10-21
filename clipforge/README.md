# ClipForge

Gera shorts automáticos a partir de trailers de games: escolhe os melhores cortes, reenquadra para 9:16, coloca legendas dinâmicas PT-BR, hooks, callouts e splashes animados em **GSAP** e **Three.js**, sincronizados com os beats e impactos do áudio. Renderiza com **Remotion**.

```
trailer.mp4 → analyze → plan (Claude ou heurística) → plan.json → render → out/<slug>/short-01-9x16.mp4
                                                         ↑ revisar/ajustar no Remotion Studio
```

## Requisitos

- Node 20+ e `ffmpeg`/`ffprobe` no PATH
- Opcional: `ANTHROPIC_API_KEY` (ou `ant auth login`) para o diretor com Claude. Sem credenciais, usa o plano heurístico.
- Opcional: acesso a `huggingface.co` para baixar o modelo Whisper (transcrição da fala). Sem ele, o pipeline segue sem legendas da fala original.

```bash
cd clipforge
npm install
```

## Uso

```bash
# tudo de uma vez: 4 shorts em 9:16 e 16:9
npx tsx src/cli.ts make ~/Downloads/trailer.mp4 --game "Nome do Jogo"

# ou passo a passo
npx tsx src/cli.ts analyze ~/Downloads/trailer.mp4 --slug meu-jogo
npx tsx src/cli.ts plan meu-jogo --count 4            # --heuristic para não usar a API
npx tsx src/cli.ts studio meu-jogo --index 1          # revisar no Remotion Studio
npx tsx src/cli.ts render meu-jogo --format 9x16 --only 1,3
```

Para testar sem trailer: `npm run fixture` gera `fixtures/fixture-trailer.mp4` (sintético) e `npm run studio` abre o Studio com um plano de demonstração.

## Etapas

| Etapa | O que faz | Arquivos |
|---|---|---|
| **analyze** | Proxy 30fps; cortes de cena e movimento (`scene` score do ffmpeg); telas pretas; energia, onsets/impactos, BPM e beats (spectral flux + DP beat tracking); 1 keyframe por shot e contact sheets 4×4; transcrição com whisper.cpp | `src/analyze/*`, saída `public/work/<slug>/analysis.json` |
| **plan** | Janelas candidatas pontuadas (energia, movimento, ritmo de cortes, impactos, fala, pretos). O **diretor Claude** (`claude-opus-5-5`, visão + JSON estruturado) vê os contact sheets e a análise e roteiriza cada short: segmentos, reenquadramento, legendas PT-BR, hook, callouts, splashes e end card. Depois tudo é "snapado" a cortes de cena/beats/impactos | `src/plan/*`, saída `plan.json` |
| **render** | Composições Remotion `Short916` (1080×1920) e `Short169` (1920×1080) | `remotion/*`, `src/render/*` |

O `plan.json` usa **tempos do trailer original**; `src/timeline.ts` converte para a linha do tempo do short (eventos fora dos segmentos são descartados). Dá para editar o `plan.json` à mão e renderizar de novo.

## Camadas visuais

- **Vídeo** (`layers/VideoTrack.tsx`): `crop` (tela cheia seguindo `focusX`) ou `blur` (quadro inteiro com fundo desfocado); zoom lento contínuo; crossfade de áudio nos saltos.
- **GSAP** (`gsap/useGsapTimeline.ts`): timeline pausada e posicionada com `seek(frame/fps)` a cada frame — determinístico no render paralelo. Usado em legendas palavra a palavra, hook, callouts (`badge`, `stamp`, `glitch`), zoom punch/tremida nos impactos, whip zoom nos cortes, clarões, barras de glitch e end card.
- **Three.js** (`three/Splashes3D.tsx`, via `@remotion/three`): `particles` (estilhaços instanciados), `shockwave` (anéis aditivos) e `title3d` (título com extrusão em camadas).
- **SFX** sintetizados com ffmpeg em `public/sfx` (impact, whoosh, glitch, pop). Troque por samples próprios mantendo os nomes.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Diretor com Claude |
| `CLIPFORGE_NO_WHISPER=1` | Pula a transcrição |
| `CLIPFORGE_WHISPER_MODEL` | `tiny`, `base`, `small` (padrão), `medium`… |
| `CLIPFORGE_BROWSER` | Chromium/Chrome Headless Shell a usar no render |
| `REMOTION_LICENSE_KEY` | Licença Remotion (empresas com mais de 3 pessoas) |

## Testes

```bash
npm test          # node:test via tsx
npm run typecheck
```

## Licenças

Remotion é gratuito para indivíduos e empresas de até 3 pessoas; acima disso exige licença. Respeite os direitos dos trailers que você publicar.
