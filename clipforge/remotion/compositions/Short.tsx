import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { ShortProps } from "../../src/schema";
import { FPS, resolveTimeline } from "../../src/timeline";
import { useFonts } from "../fonts";
import { Callouts } from "../layers/Callout";
import { Captions } from "../layers/Captions";
import { EndCard } from "../layers/EndCard";
import { HookTitle } from "../layers/HookTitle";
import { FlashLayer, ProgressBar, SfxTrack } from "../layers/Overlays";
import { VideoFx } from "../layers/VideoFx";
import { VideoTrack } from "../layers/VideoTrack";
import { Splashes3D } from "../three/Splashes3D";

export const Short: React.FC<ShortProps> = ({ plan, shortIndex }) => {
  useFonts();
  const short = plan.shorts[shortIndex] ?? plan.shorts[0];
  const tl = useMemo(() => resolveTimeline(short, FPS), [short]);
  const accent = short.accentColor;

  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <VideoFx tl={tl}>
        <VideoTrack tl={tl} src={plan.source.file} bgSrc={plan.source.bgFile} srcWidth={plan.source.width} srcHeight={plan.source.height} />
      </VideoFx>
      <FlashLayer tl={tl} accent={accent} />
      <Splashes3D tl={tl} accent={accent} />
      <Captions pages={tl.pages} accent={accent} />
      <Callouts items={tl.callouts} accent={accent} />
      <HookTitle text={short.hook.text} sub={short.hook.sub} accent={accent} />
      <EndCard title={short.endCard.title} subtitle={short.endCard.subtitle} cta={short.endCard.cta} accent={accent} totalFrames={tl.durationInFrames} />
      <ProgressBar accent={accent} totalFrames={tl.durationInFrames} />
      {plan.sfx ? <SfxTrack tl={tl} /> : null}
    </AbsoluteFill>
  );
};
