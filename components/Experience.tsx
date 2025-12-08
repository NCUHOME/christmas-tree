import React, { useRef, useEffect } from "react";
import { Environment, OrbitControls, ContactShadows } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useFrame } from "@react-three/fiber";
import { Foliage } from "./Foliage";
import { Ornaments } from "./Ornaments";
import { Polaroids } from "./Polaroids";
import { TreeStar } from "./TreeStar";
import { TreeMode } from "../types";
import * as THREE from "three";

interface ExperienceProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  rotationSpeed: number;
  isFullScreen: boolean;
  selectedPhoto: string | null;
  onPhotoClick: (photoUrl: string) => void;
}

export const Experience: React.FC<ExperienceProps> = ({
  mode,
  uploadedPhotos,
  rotationSpeed,
  isFullScreen,
  selectedPhoto,
  onPhotoClick,
}) => {
  const controlsRef = useRef<any>(null);

  // If in Detail View (selectedPhoto exists), stop auto rotation and maybe lock focus?
  // Or just rely on OrbitControls being controlled by user or auto-rotate disabled.
  const isDetailView = !!selectedPhoto;

  // Force Chaos mode (expansion) when a photo is selected
  const effectiveMode = isDetailView ? TreeMode.CHAOS : mode;

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        minDistance={5}
        maxDistance={30}
        enableDamping
        dampingFactor={0.05}
        enabled={!isDetailView}
        autoRotate={isFullScreen && !isDetailView}
        autoRotateSpeed={rotationSpeed}
      />

      {/* Lighting Setup */}
      <Environment preset="lobby" background={false} blur={0.8} />

      <ambientLight intensity={0.2} color="#004422" />
      <spotLight
        position={[10, 20, 10]}
        angle={0.2}
        penumbra={1}
        intensity={2}
        color="#fff5cc"
        castShadow
      />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#D4AF37" />

      <group position={[0, -5, 0]}>
        <Foliage mode={effectiveMode} count={12000} />
        <Ornaments mode={effectiveMode} count={600} />
        <Polaroids
          mode={effectiveMode}
          uploadedPhotos={uploadedPhotos}
          selectedPhoto={selectedPhoto}
          onPhotoClick={onPhotoClick}
          isFullScreen={isFullScreen}
        />
        <TreeStar mode={effectiveMode} />

        {/* Floor Reflections */}
        <ContactShadows
          opacity={0.7}
          scale={30}
          blur={2}
          far={4.5}
          color="#000000"
        />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom
          luminanceThreshold={0.8}
          mipmapBlur
          intensity={1.5}
          radius={0.6}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.7} />
        <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
