import React from "react";
import { Composition } from "remotion";
import { IPhoneDemo } from "./IPhoneDemo";
import { HydrationBreak } from "./HydrationBreak";
import { HydrationBreakOverlay } from "./HydrationBreakOverlay";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="VSMediaDemo"
      component={IPhoneDemo}
      durationInFrames={60 * 30}
      fps={60}
      width={1080}
      height={1920}
    />
    <Composition
      id="HydrationBreak"
      component={HydrationBreak}
      durationInFrames={30 * 10}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="HydrationBreakOverlay"
      component={HydrationBreakOverlay}
      durationInFrames={30 * 8}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
