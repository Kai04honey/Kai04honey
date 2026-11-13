import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { ViceTest, VICE_FRAMES } from "./videos/vice/Vice";

export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ViceTest" component={ViceTest} durationInFrames={VICE_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
