import React from "react";
import { Composition } from "remotion";
import { IPhoneDemo } from "./IPhoneDemo";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VSMediaDemo"
    component={IPhoneDemo}
    durationInFrames={60 * 30}
    fps={60}
    width={1080}
    height={1920}
  />
);
