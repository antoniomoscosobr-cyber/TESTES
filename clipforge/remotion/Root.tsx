import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { ShortPropsSchema, type ShortProps } from "../src/schema";
import { FPS, resolveTimeline } from "../src/timeline";
import { Short } from "./compositions/Short";
import { demoPlan } from "./demo";

const calculateMetadata: CalculateMetadataFunction<ShortProps> = ({ props }) => {
  const short = props.plan.shorts[props.shortIndex] ?? props.plan.shorts[0];
  return { durationInFrames: Math.max(1, resolveTimeline(short, FPS).durationInFrames), fps: FPS };
};

const defaultProps: ShortProps = { plan: demoPlan, shortIndex: 0 };

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
