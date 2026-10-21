import gsap from "gsap";
import { useLayoutEffect, useRef, type DependencyList } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// GSAP determinístico no Remotion: a timeline é criada pausada e, a cada frame,
// posicionada com seek(frame / fps). Nada depende do ticker/requestAnimationFrame,
// então qualquer frame renderizado isoladamente (render paralelo) sai idêntico.
// O seek sempre parte do zero para que tweens sobrepostos no mesmo alvo sejam
// aplicados na ordem da timeline, inclusive ao voltar no tempo no Studio.
// immediateRender fica desligado: o estado antes do primeiro tween de cada elemento
// vem do estilo inicial no JSX (ou de um tl.set no tempo 0).
export function useGsapTimeline<T extends HTMLElement = HTMLDivElement>(
  build: (tl: gsap.core.Timeline, root: T) => void,
  deps: DependencyList,
) {
  const ref = useRef<T>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeRef = useRef(frame / fps);
  timeRef.current = frame / fps;

  useLayoutEffect(() => {
    if (!ref.current) return;
    const root = ref.current;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true, defaults: { immediateRender: false } });
      build(tl, root);
      seekFromStart(tl, timeRef.current);
      tlRef.current = tl;
    }, root);
    return () => {
      tlRef.current = null;
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useLayoutEffect(() => {
    if (tlRef.current) seekFromStart(tlRef.current, frame / fps);
  }, [frame, fps]);

  return ref;
}

function seekFromStart(tl: gsap.core.Timeline, t: number) {
  tl.seek(0, true);
  tl.seek(t, true);
}
