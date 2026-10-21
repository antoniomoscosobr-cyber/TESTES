import React from "react";
import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import { EditPlanSchema, ShortPropsSchema, type ShortProps } from "../src/schema";
import { FPS, resolveTimeline } from "../src/timeline";
import { Short } from "./compositions/Short";
import { demoPlan } from "./demo";

const calculateMetadata: CalculateMetadataFunction<ShortProps> = async ({ props, abortSignal }) => {
  let plan = props.plan;
  if (props.slug) {
    const res = await fetch(staticFile(`work/${props.slug}/plan.json`), { signal: abortSignal, cache: "no-store" });
    if (!res.ok) throw new Error(`Não achei public/work/${props.slug}/plan.json (rode clipforge plan ${props.slug}).`);
    plan = EditPlanSchema.parse(await res.json());
  }
  if (!plan) throw new Error("Sem plano: passe { plan } ou { slug } nas props.");
  const short = plan.shorts[props.shortIndex] ?? plan.shorts[0];
  return { durationInFrames: Math.max(1, resolveTimeline(short, FPS).durationInFrames), fps: FPS, props: { ...props, plan } };
};

const defaultProps: ShortProps = { plan: demoPlan, slug: "", shortIndex: 0, hideCaptions: false, audioMode: "mix" };

export const Root: React.FC = () => (
  <>
    <Composition
      id="Short916"
      component={Short}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={FPS * 30}
      schema={ShortPropsSchema}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="Short169"
      component={Short}
      width={1920}
      height={1080}
      fps={FPS}
      durationInFrames={FPS * 30}
      schema={ShortPropsSchema}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  </>
);
