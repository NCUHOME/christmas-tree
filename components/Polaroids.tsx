import React, { useMemo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { TreeMode } from "../types";

const PHOTO_COUNT = 22;

interface PolaroidsProps {
  mode: TreeMode;
  uploadedPhotos: string[];
  isFullScreen: boolean;
  selectedPhoto: string | null;
  onPhotoClick: (photoUrl: string) => void;
}

interface PhotoData {
  id: number;
  url: string;
  tapePos: THREE.Vector3; // Position for Main Page (Tree/Tape)
  scatterPos: THREE.Vector3; // REMOVED: Replaced by screenPos for camera-relative scatter
  screenPos: THREE.Vector3; // Position relative to CAMERA in Full Screen
  detailBackPos: THREE.Vector3; // Position when another photo is selected (Background)
  speed: number;
}

const PolaroidItem: React.FC<{
  data: PhotoData;
  isFullScreen: boolean;
  selectedPhoto: string | null;
  onPhotoClick: (url: string) => void;
}> = ({ data, isFullScreen, selectedPhoto, onPhotoClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Load Texture
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      data.url,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        // Calculate aspect ratio
        if (loadedTex.image) {
          setAspectRatio(loadedTex.image.width / loadedTex.image.height);
        }
        setTexture(loadedTex);
        setLoaded(true);
        setError(false);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load image: ${data.url}`, err);
        setError(true);
      }
    );
  }, [data.url]);

  const isSelected = selectedPhoto === data.url;
  const isDetailMode = !!selectedPhoto;

  // --- Dynamic Dimensions ---
  // Fix width to 1.0, adjust height
  const photoWidth = 1.0;
  const photoHeight = photoWidth / aspectRatio;

  // Frame dimensions (Polaroid Style: extra space at bottom)
  const frameWidth = photoWidth + 0.2; // 0.1 padding each side
  const frameHeight = photoHeight + 0.4; // 0.1 top, 0.3 bottom
  const frameDepth = 0.05;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const time = state.clock.elapsedTime;

    // --- 1. Target Position Logic ---
    let targetPos = new THREE.Vector3();
    let targetRot = new THREE.Quaternion();
    let targetScale = new THREE.Vector3(1, 1, 1);

    if (isSelected) {
      // Detail View: Strictly relative to CAMERA
      // Position clearly in front of the lens
      // We want to block the view partially or be the main focus
      const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        state.camera.quaternion
      );
      // Place it 5 units in front of camera
      const distance = 5;
      const worldPos = state.camera.position
        .clone()
        .add(cameraForward.multiplyScalar(distance));

      // Also slightly lower to be centered if needed, or just dead center
      // worldPos.y -= 0.5;

      // Convert worldPos to local space of parent group
      if (groupRef.current.parent) {
        targetPos = groupRef.current.parent.worldToLocal(worldPos.clone());
      } else {
        targetPos.copy(worldPos);
      }

      // Face Camera: Copy camera rotation exactly but flip 180 Y if needed?
      // Actually standard lookAt(camera.position) is safest.
      const dummy = new THREE.Object3D();
      dummy.position.copy(worldPos); // Use world pos for lookAt calculation
      dummy.lookAt(state.camera.position);
      // Depending on UV mapping, might need rotation. Usually planes face +Z.
      // lookAt makes +Z face target. So it faces camera.
      targetRot.copy(dummy.quaternion);

      // --- Dynamic Scale Calculation ---
      // We want the photo to be roughly 60-70% of the screen height
      const fov = (state.camera as THREE.PerspectiveCamera).fov;
      const visibleHeight = 2 * Math.tan((fov * Math.PI) / 360) * distance;
      // Desired height = visibleHeight * 0.7
      // Our photo frame height is ~1.5 (from boxGeometry 1.5 height)
      const scaleFactor = (visibleHeight * 0.7) / frameHeight;
      targetScale.set(scaleFactor, scaleFactor, scaleFactor);
    } else if (isDetailMode) {
      // --- Detail Background Mode ---
      // Push unrelated photos far back to create depth and avoid clipping

      const distance = 25; // Far behind the main photo (at 5)
      const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        state.camera.quaternion
      );

      // Calculate a base position far in front of camera
      const worldCenter = state.camera.position
        .clone()
        .add(cameraForward.multiplyScalar(distance));

      // Spread them out based on ID to create a "wall" or "cloud" backdrop
      // avoid the very center where the main photo is
      const spreadX = 20;
      const spreadY = 12;

      // deterministic pseudo-random based on ID
      const seed = data.id * 13.0; // simple hash
      const rX = Math.sin(seed) * spreadX;
      const rY = Math.cos(seed * 1.5) * spreadY;

      // If it's too close to center, push it out
      let x = rX;
      let y = rY;
      if (Math.abs(x) < 4) x = x > 0 ? 4 : -4;

      // Apply offset relative to camera's orientation
      // We need "Right" and "Up" vectors of camera
      const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
        state.camera.quaternion
      );
      const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
        state.camera.quaternion
      );

      const pos = worldCenter
        .add(cameraRight.multiplyScalar(x))
        .add(cameraUp.multiplyScalar(y));

      if (groupRef.current.parent) {
        targetPos = groupRef.current.parent.worldToLocal(pos.clone());
      } else {
        targetPos.copy(pos);
      }

      // Face Camera
      const dummy = new THREE.Object3D();
      dummy.position.copy(pos);
      dummy.lookAt(state.camera.position);
      targetRot.copy(dummy.quaternion);

      // Scale down background photos
      targetScale.set(0.5, 0.5, 0.5);
    } else if (isFullScreen) {
      // Full Screen: Scattered (Chaos) - CAMERA RELATIVE
      // We want them to "float" around the user's view, regardless of where they look.

      // Transform screenPos (camera local) to World Space
      // screenPos is like (x, y, z) where z is negative (in front)
      const worldPos = data.screenPos
        .clone()
        .applyMatrix4(state.camera.matrixWorld);

      // Convert to local space
      if (groupRef.current.parent) {
        targetPos = groupRef.current.parent.worldToLocal(worldPos.clone());
      } else {
        targetPos.copy(worldPos);
      }

      // Face Camera
      const dummy = new THREE.Object3D();
      dummy.position.copy(worldPos);
      dummy.lookAt(state.camera.position);
      targetRot.copy(dummy.quaternion);

      // Float animation (relative to camera frame implies they stick, maybe add local drift?)
      const wobbleX = Math.sin(time * 1.5 + data.id) * 0.1;
      const wobbleY = Math.cos(time * 1.0 + data.id) * 0.1;
      // We apply wobble in camera space logic effectively by adding to targetPos?
      // Doing it simply on targetPos (which is local):
      targetPos.x += wobbleX;
      targetPos.y += wobbleY;
    } else {
      // Main Page: Tape/Tree (Spiral) - WORLD SPACE
      const cycleSpeed = 0.2;
      const angleOffset = time * cycleSpeed;

      // Rotate original tapePos around Y axis
      const x =
        data.tapePos.x * Math.cos(angleOffset) -
        data.tapePos.z * Math.sin(angleOffset);
      const z =
        data.tapePos.x * Math.sin(angleOffset) +
        data.tapePos.z * Math.cos(angleOffset);

      targetPos.set(x, data.tapePos.y, z);

      // Face Outward (Normal tree ornament behavior)
      const dummy = new THREE.Object3D();
      dummy.position.copy(targetPos);
      dummy.lookAt(0, targetPos.y, 0);
      dummy.rotateY(Math.PI); // Flip to face out
      targetRot.copy(dummy.quaternion);
    }

    // Apply Lerp
    // Increase speed for smoother locking to camera frame
    const lerpSpeed = isDetailMode || isFullScreen ? 8 : 2;
    groupRef.current.position.lerp(targetPos, delta * lerpSpeed);
    groupRef.current.quaternion.slerp(targetRot, delta * lerpSpeed);
    groupRef.current.scale.lerp(targetScale, delta * lerpSpeed);
  });

  const handlePointerOver = () => {
    if (!isDetailMode) {
      document.body.style.cursor = "pointer";
      setHovered(true);
    }
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
    setHovered(false);
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (!isDetailMode) {
      onPhotoClick(data.url);
    }
  };

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Visual Tape/String (Only in Main Mode?) - Requirements say "Tape like dynamic" */}
      {/* We'll hide string in Detail/Scattered mode for cleaner look? Or keep it? */}
      {/* Let's keep it consistent or hide if it looks weird flying around. */}
      {/* Tape only in main mode */}
      {!isDetailMode && !isFullScreen && (
        <mesh position={[0, frameHeight / 2 + 0.4, -0.05]}>
          {/* Adjusted tape position relative to frame height */}
          <cylinderGeometry args={[0.005, 0.005, 1.5]} />
          <meshStandardMaterial
            color="#D4AF37"
            metalness={1}
            roughness={0.2}
            transparent
            opacity={0.6}
          />
        </mesh>
      )}

      {/* Frame Group - Pivot is center of group */}
      <group position={[0, 0, 0]}>
        {/* Backing (Frame) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[frameWidth, frameHeight, frameDepth]} />
          <meshStandardMaterial
            color={isSelected ? "#FFD700" : "#fdfdfd"}
            roughness={0.8}
          />
          {/* Yellow frame if selected, White otherwise */}
        </mesh>

        {/* The Photo Area (Front) */}
        {/* Position: Up shifted to leave space for bottom text area. 
            0.1 = top padding. 
            Center of box is 0. 
            Top of box is frameHeight/2.
            Top of photo should be frameHeight/2 - 0.1
            Center of photo should be frameHeight/2 - 0.1 - photoHeight/2
        */}
        <mesh position={[0, frameHeight / 2 - 0.1 - photoHeight / 2, 0.035]}>
          <planeGeometry args={[photoWidth, photoHeight]} />
          {texture && !error ? (
            <meshBasicMaterial map={texture} />
          ) : (
            <meshStandardMaterial color={error ? "#550000" : "#cccccc"} />
          )}
        </mesh>

        {/* Detail View Decoration: Yellow Frame for Center */}
        {isSelected && (
          // Scale ring based on photo size or just hide it?
          // Let's adjust ring to wrap photo roughly
          <mesh position={[0, frameHeight / 2 - 0.1 - photoHeight / 2, 0.03]}>
            <ringGeometry
              args={[
                Math.min(photoWidth, photoHeight) * 0.6,
                Math.min(photoWidth, photoHeight) * 0.65,
                4,
              ]}
            />
            <meshBasicMaterial color="#FFD700" />
          </mesh>
        )}

        {/* Decorative Tape (Top) */}
        {!isSelected && (
          <mesh
            position={[0, frameHeight / 2 - 0.05, 0.035]}
            rotation={[0, 0, 0.1]}
          >
            <boxGeometry args={[0.15, 0.04, 0.01]} />
            <meshStandardMaterial
              color="#D4AF37"
              metalness={0.8}
              roughness={0.4}
            />
          </mesh>
        )}
      </group>
    </group>
  );
};

export const Polaroids: React.FC<PolaroidsProps> = ({
  mode,
  uploadedPhotos,
  isFullScreen,
  selectedPhoto,
  onPhotoClick,
}) => {
  const photoData = useMemo(() => {
    if (uploadedPhotos.length === 0) return [];

    const data: PhotoData[] = [];
    const count = uploadedPhotos.length;

    // Unused height variable?
    // const height = 10;

    for (let i = 0; i < count; i++) {
      // --- Tape/Tree Position (Spiral) ---
      const yNorm = i / count;
      const y = 3 + yNorm * 6; // Height 3 to 9

      // Match coordinates with Foliage.tsx (Cone: Height=12, MaxRadius=5)
      const treeHeight = 12;
      const treeMaxRadius = 5;
      const treeRadiusAtY = treeMaxRadius * (1 - y / treeHeight);

      // Radius = Tree Radius + Offset to hover slightly above
      const r = treeRadiusAtY + 0.6;

      const theta = i * 2.5;

      const tapePos = new THREE.Vector3(
        r * Math.cos(theta),
        y,
        r * Math.sin(theta)
      );

      // --- Screen Position (Full Screen - Camera Relative) ---
      // We define position in "Camera Space".
      // Z should be negative (in front of camera).
      // X and Y spread to fill field of view.
      // Field of view at distance D: height = 2 * D * tan(fov/2 * PI/180)

      const dist = 6 + Math.random() * 4; // Distance 6 to 10
      // Assuming FOV ~45 deg, tan(22.5) ~= 0.41
      const visibleHeight = 2 * dist * 0.41;
      const visibleWidth = visibleHeight * 1.6; // Aspect ratio approx

      const sx = (Math.random() - 0.5) * visibleWidth * 0.8;
      const sy = (Math.random() - 0.5) * visibleHeight * 0.8;
      const sz = -dist; // Negative Z is forward in OpenGL camera space

      const screenPos = new THREE.Vector3(sx, sy, sz);

      // --- Detail Background Position ---
      // Push far back or to sides
      const bx = (Math.random() - 0.5) * 25;
      const by = Math.random() * 10;
      const bz = -5 - Math.random() * 10; // Behind tree

      const detailBackPos = new THREE.Vector3(bx, by, bz);

      data.push({
        id: i,
        url: uploadedPhotos[i],
        tapePos,
        screenPos, // New camera-relative pos
        scatterPos: new THREE.Vector3(), // Unused but kept for structure
        detailBackPos,
        speed: 1,
      });
    }
    return data;
  }, [uploadedPhotos]);

  return (
    <group>
      {photoData.map((data, i) => (
        <PolaroidItem
          key={i}
          data={data}
          isFullScreen={isFullScreen}
          selectedPhoto={selectedPhoto}
          onPhotoClick={onPhotoClick}
        />
      ))}
    </group>
  );
};
