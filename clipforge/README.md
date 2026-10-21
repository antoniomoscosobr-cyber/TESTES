# ClipForge

Gera shorts automáticos a partir de trailers de games. Escolhe os melhores cortes e reenquadra para 9:16 seguindo a ação. Coloca legendas dinâmicas, hook, callouts e splashes animados em **GSAP** e **Three.js**, sincronizados com os beats e impactos do áudio. Junto com cada vídeo entrega o texto do post, as hashtags, um `.srt` e a capa. Renderiza com **Remotion**.

```
trailer.mp4 → analyze → plan (Claude ou heurística) → plan.json → render → out/<slug>/
                                                         ↑ revisar no preview/Studio, editar o plan.json
```

## Requisitos

- Node 20+
- `ffmpeg` e `ffprobe` 5.1+ no PATH ([download](https://ffmpeg.org/download.html))
- Opcional:
  - **Diretor com Claude** (legendas PT-BR traduzidas, cortes e textos escolhidos vendo as imagens): `ANTHROPIC_API_KEY`. Sem ela, usa o plano heurístico.
  - **Transcrição da fala** (whisper.cpp): `git`, `make` e um compilador C/C++. No macOS, `xcode-select --install`; no Linux, `build-essential`. Também precisa de acesso a `huggingface.co` para baixar o modelo. Sem isso, o pipeline segue e avisa.

```bash
cd clipforge
npm install
```

## Uso

```bash
# tudo de uma vez: 4 shorts em 9:16 e 16:9
npm run make -- ~/Downloads/trailer.mp4

# com legendas PT-BR próprias (ex.: as oficiais do trailer em .srt/.vtt)
npm run make -- ~/Downloads/trailer.mp4 --subs ~/Downloads/trailer.pt-BR.srt

# passo a passo
npm run analyze -- ~/Downloads/trailer.mp4 --slug meu-jogo
npm run plan -- meu-jogo --count 4                   # --heuristic para não usar a API
npm run preview -- meu-jogo --index 1 --at 0.5,3,10  # PNGs de frames soltos
npm run studio -- meu-jogo --index 1                 # Studio lendo o plan.json
npm run render -- meu-jogo --format 9x16 --only 1,3
npm run clean                                        # espaço usado / apagar trabalhos
```

O `make` reaproveita a análise e o plano quando o trailer não mudou. `--reanalyze` e `--replan` forçam refazer; o plano anterior vira `plan.N.json`.

Para testar sem trailer: `npm run fixture` gera `fixtures/fixture-trailer.mp4`, um trailer sintético. `npm run studio` sem slug abre um plano de demonstração.

## Short narrado com a sua voz

Preencha `narration` no short do `plan.json`: falas com `start`/`end` **no tempo do short** (não do trailer), `text` e `emphasis`. As falas viram as legendas e o trailer abaixa ~7 dB embaixo de cada uma. O render entrega, além dos vídeos:

- `short-01-roteiro.txt` (timecode, duração e ritmo de cada fala) e `short-01-narracao.srt`, para gravar
- `short-01-9x16-sem-legenda.mp4`, caso o seu ritmo não bata com as legendas
- `short-01-trilha.wav` (trailer cortado, sem ducking) e `short-01-sfx.wav`, para mixar a voz no seu editor

Começou com um trailer em baixa e chegou o mesmo em 1080p? Troque a fonte sem refazer roteiro e cortes. O áudio dos dois é alinhado por correlação, mesmo que o reupload tenha cortes:

```bash
npm run clipforge -- swap-source meu-jogo ~/Downloads/trailer-1080p.mp4 --refit   # --refit: volta a enquadrar em tela cheia
npm run clipforge -- keep meu-jogo   # guarda plano + assinatura do áudio em projects/meu-jogo/ (commit para usar em outra máquina)
```

Sem o trabalho local (`public/work/<slug>`), `render`/`swap-source` usam o que estiver em `projects/<slug>/`.

## Saída (`out/<slug>/`)

| Arquivo | Conteúdo |
|---|---|
| `short-01-9x16.mp4`, `short-01-16x9.mp4` | H.264 BT.709, áudio AAC normalizado a −14 LUFS (pico −1.5 dBTP) |
| `short-01-9x16-cover.jpg` | Capa no momento em que o hook está completo |
| `short-01.txt` | Título, descrição e hashtags prontos para colar no post |
| `short-01.json` | Metadados: hook, duração, trechos do trailer usados |
| `short-01.srt` | Legendas no tempo do short |
| `short-01-roteiro.txt`, `-narracao.srt`, `-9x16-sem-legenda.mp4`, `-trilha.wav`, `-sfx.wav` | Só em shorts com `narration` (acima) |

## Etapas

| Etapa | O que faz | Arquivos |
|---|---|---|
| **analyze** | Proxy 30fps com tarjas pretas removidas (cropdetect). Detecta cortes de cena e movimento, telas pretas, cartelas (classificação etária, logos, texto legal) e o shot do logo final. No áudio: energia, impactos, BPM, beats e trechos com voz. Por shot, estima o foco da ação para o crop 9:16. Gera contact sheets e roda a transcrição com whisper.cpp. Só refaz se o arquivo do trailer mudar. | `src/analyze/*` → `public/work/<slug>/analysis.json` |
| **plan** | Pontua janelas candidatas (energia, movimento, ritmo de cortes, impactos, fala; penaliza pretos e cartelas). O **diretor Claude** (`claude-opus-5-5`, visão + JSON estruturado) roteiriza cada short; se falhar por qualquer motivo, entra o heurístico: cold open, trecho contínuo ou montagem cortada no beat, logo do jogo no fim. Depois tudo é ajustado: cortes em troca de cena ou beat (sem "piscadas" nem cortar palavras), efeitos nos impactos, enquadramento por shot. | `src/plan/*` → `plan.json` |
| **render** | Composições Remotion `Short916` (1080×1920) e `Short169` (1920×1080), loudness, capa e arquivos do post. Sem GPU, em 4 núcleos, leva ~7–8 s por segundo de vídeo (um short de 30 s ≈ 4 min). | `remotion/*`, `src/render/*` |

O `plan.json` usa **tempos do trailer original**. `src/timeline.ts` converte para a linha do tempo do short: eventos fora dos segmentos somem e nada fica sob o card final. Dá para editar o `plan.json` à mão; ele é validado antes do render.

## Camadas visuais e de áudio

- **Vídeo** (`layers/VideoTrack.tsx`): `crop` (tela cheia seguindo `focusX`) ou `blur` (quadro inteiro sobre um fundo pré-desfocado); zoom lento contínuo.
- **Áudio** (`layers/AudioTrack.tsx`): crossfade nos saltos, câmera lenta sem esticar o som, folga de ganho com ducking sob os SFX, fade final sob o card.
- **GSAP** (`gsap/useGsapTimeline.ts`): timeline pausada e posicionada com `seek(frame/fps)` a cada frame, determinística no render paralelo. Usada em:
  - legendas palavra a palavra, hook e callouts (`badge`, `stamp`, `glitch`)
  - zoom punch e tremida nos impactos, whip zoom nos cortes, pulso no beat
  - clarões, barras de glitch e card final
- **Three.js** (`three/Splashes3D.tsx`, via `@remotion/three`): `particles` (estilhaços instanciados), `shockwave` (anéis aditivos) e `title3d` (título com extrusão em camadas).
- **SFX** sintetizados com ffmpeg em `public/sfx` (impact, whoosh, glitch, pop). Troque por samples próprios mantendo os nomes.

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Diretor com Claude |
| `CLIPFORGE_NO_WHISPER=1` | Pula a transcrição |
| `CLIPFORGE_WHISPER_MODEL` | `tiny`, `base`, `small` (padrão), `medium`… |
| `CLIPFORGE_GL` | Renderizador WebGL: padrão `angle` (GPU) no macOS/Windows e `swangle` (CPU) no Linux |
| `CLIPFORGE_BROWSER` | Chromium/Chrome Headless Shell a usar no render (senão o Remotion baixa um) |
| `REMOTION_LICENSE_KEY` | Licença Remotion (empresas com mais de 3 pessoas) |

## Testes

```bash
npm test          # node:test via tsx
npm run typecheck
```

## Licenças

Remotion é gratuito para indivíduos e empresas de até 3 pessoas; acima disso exige licença. Respeite os direitos dos trailers que você publicar.
