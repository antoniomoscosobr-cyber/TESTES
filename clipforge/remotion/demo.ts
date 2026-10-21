import type { EditPlan } from "../src/schema";

// Plano de demonstração para abrir o Studio sem trailer: o vídeo vira um fundo animado
// e todas as camadas (hook, legendas, callouts, splashes 2D/3D, end card) aparecem.
export const demoPlan: EditPlan = {
  version: 1,
  slug: "demo",
  game: "Demo Game",
  director: "heuristic",
  source: { file: "", bgFile: "", duration: 60, fps: 30, width: 1920, height: 1080 },
  beats: [],
  sfx: true,
  shorts: [
    {
      id: "short-01",
      title: "Demo",
      description: "Plano de demonstração.",
      hashtags: ["#demo"],
      hook: { text: "VOCÊ NÃO ESTÁ PRONTO PRA ISSO", sub: "assiste até o final" },
      segments: [
        { srcStart: 40, srcEnd: 42, speed: 1, focusX: 0.5, fit: "crop" },
        { srcStart: 10, srcEnd: 24, speed: 1, focusX: 0.3, fit: "blur" },
        { srcStart: 30, srcEnd: 33, speed: 0.6, focusX: 0.7, fit: "crop" },
      ],
      captions: [
        { srcStart: 11, srcEnd: 14, text: "O mundo inteiro está em guerra", emphasis: ["guerra"] },
        { srcStart: 14.5, srcEnd: 18, text: "e só você pode decidir o que vem depois", emphasis: ["você"] },
        { srcStart: 19, srcEnd: 23, text: "Prepare-se para a inacreditável batalha final!", emphasis: ["inacreditável", "final"] },
      ],
      narration: [],
      callouts: [
        { srcTime: 15.5, duration: 1.2, text: "OLHA ISSO", style: "badge" },
        { srcTime: 20, duration: 1.2, text: "BRUTAL", style: "stamp" },
        { srcTime: 23, duration: 1, text: "INSANO", style: "glitch" },
      ],
      splashes: [
        { srcTime: 41, kind: "particles", text: "", intensity: 0.9 },
        { srcTime: 12.5, kind: "impact", text: "", intensity: 0.9 },
        { srcTime: 16.8, kind: "shockwave", text: "", intensity: 0.8 },
        { srcTime: 19.5, kind: "title3d", text: "THE ELDER SCROLLS VI", intensity: 0.8 },
        { srcTime: 22.2, kind: "glitch", text: "", intensity: 0.8 },
        { srcTime: 30.2, kind: "flash", text: "", intensity: 1 },
      ],
      endCard: { title: "THE ELDER SCROLLS VI", subtitle: "Disponível em 2027", cta: "Segue pra mais trailers" },
      accentColor: "#ff3d3d",
    },
  ],
};
