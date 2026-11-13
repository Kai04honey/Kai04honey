// Vice Beach look test: Toid at his fortune table on an original Miami-style street, through the skill's post chain
// (ink -> lens blur -> bloom -> neutral tone map -> grade). inputProps { light: "day" | "golden" }.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, getInputProps, useCurrentFrame, interpolate, Easing } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "../bridge/ink";
import { LensBlur } from "../bridge/lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "../bridge/grade";
import { ViceWorld, Light } from "./world";

export const VICE_FRAMES = 90;
const lightOf = (): Light => ((getInputProps() as { light?: Light }).light ?? "day");

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.6, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new ViceWorld(), []);
  const light = useMemo(lightOf, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES[light], GRADE_STRENGTH[light]),
  }), [camera, scene, light]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  // slow creeping push-in toward Toid (every hold creeps, per the skill)
  const k = interpolate(f, [0, VICE_FRAMES - 1], [0, 1], { easing: Easing.bezier(0.45, 0, 0.55, 1) });
  const close = (getInputProps() as { shot?: string }).shot === "close";
  const pos = close ? new THREE.Vector3(0.05 + 0.1 * k, 1.5, 2.7 - 0.35 * k) : new THREE.Vector3(-1.7 + 0.3 * k, 1.55, 8.4 - 1.2 * k);
  const look = close ? new THREE.Vector3(1.2, 1.5, -1.0) : new THREE.Vector3(0.9, 2.2, -2.0);
  world.update(cam, scene, light, pos, look, close ? 36 : 40, THREE.MathUtils.degToRad(-1.5));
  noInkFallback(world.root);
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
  const toid = new THREE.Vector3(1.35, 1.6, -0.95);
  fx.lens.focus = Math.max(0.3, toid.sub(cam.position).dot(fwd));
  fx.lens.cInf = (getInputProps() as { cInf?: number }).cInf ?? 9;
  gradeFor(fx.grade, light);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      <EffectComposer multisampling={4}>
        <primitive object={fx.ink} dispose={null} />
        <primitive object={fx.lens.pre} dispose={null} />
        <primitive object={fx.lens.main} dispose={null} />
        <primitive object={fx.bloom} dispose={null} />
        <primitive object={fx.tone} dispose={null} />
        <primitive object={fx.grade} dispose={null} />
      </EffectComposer>
    </>
  );
};

export const ViceTest: React.FC = () => (
  <AbsoluteFill style={{ background: "#bfe3f2" }}>
    <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner />
    </ThreeCanvas>
  </AbsoluteFill>
);
