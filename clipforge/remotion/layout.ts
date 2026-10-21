import { useVideoConfig } from "remotion";

// Medidas relativas ao formato: tudo escala a partir de um lado menor de 1080px.
export function useLayout() {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const u = Math.min(width, height) / 1080;
  return {
    width,
    height,
    vertical,
    u,
    captionY: vertical ? height * 0.72 : height * 0.82,
    hookY: vertical ? height * 0.1 : height * 0.08,
    calloutY: vertical ? height * 0.24 : height * 0.2,
  };
}

// Pseudo-aleatório determinístico (mesmo valor em qualquer frame/aba de render).
export function seeded(seed: number) {
  let s = Math.floor(seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
