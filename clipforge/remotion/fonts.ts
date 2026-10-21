import "@fontsource/anton/400.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

export const FONT_DISPLAY = "Anton, Impact, sans-serif";
export const FONT_BODY = "Montserrat, Arial, sans-serif";

// Segura o render até as fontes carregarem (senão os primeiros frames saem com fallback).
export function useFonts() {
  const [handle] = useState(() => delayRender("Carregando fontes"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('400 100px "Anton"', "ÁÉÍÓÚÃÕÇ"),
      document.fonts.load('800 100px "Montserrat"', "ÁÉÍÓÚÃÕÇ"),
      document.fonts.load('900 100px "Montserrat"', "ÁÉÍÓÚÃÕÇ"),
    ])
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [handle]);
}
