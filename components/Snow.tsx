import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = `
  uniform float uTime;
  uniform float uHeight;
  uniform float uSpeed;

  attribute float aRandom;
  attribute float aSize;

  varying float vAlpha;

  void main() {
    vec3 pos = position;
    
    // Animate Y position - falling down
    // uTime * uSpeed makes it fall
    // The mod allows it to wrap around from top to bottom
    // We add a large offset to uTime to ensure positive values if needed, 
    // but typically mod works fine or we can offset position.
    
    // Let's assume the box is from -uHeight/2 to +uHeight/2
    // We want particles to fall from + to -
    
    float fallOffset = uTime * uSpeed * (0.5 + aRandom * 0.5); // Vary speed slightly
    
    // Apply modulo to wrap around
    // original Y is in range [-height/2, height/2]
    // We want newY to slide down and wrap.
    
    float yRange = uHeight;
    float bottom = -yRange / 2.0;
    
    // Calc new Y
    float newY = pos.y - fallOffset;
    
    // Wrap logic:
    // (newY - bottom) is distance from bottom. 
    // mod(..., yRange) keeps it within [0, yRange]
    // cleanY = mod(newY - bottom, yRange) + bottom
    
    pos.y = mod(newY - bottom, yRange) + bottom;
    
    // Add wind/wobble
    // Use position and time to create some noise
    pos.x += sin(uTime * 0.5 + pos.y * 0.5 + aRandom * 10.0) * 0.5;
    pos.z += cos(uTime * 0.3 + pos.y * 0.5 + aRandom * 10.0) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size attenuation
    gl_PointSize = aSize * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // Fade out at top and bottom edges to avoid popping
    // Normalized Y from 0 (bottom) to 1 (top)
    float normY = (pos.y - bottom) / yRange;
    // Parabola or simple fade at edges
    // smoothstep(0.0, 0.1, normY) * (1.0 - smoothstep(0.9, 1.0, normY))
    float edgeAlpha = smoothstep(0.0, 0.1, normY) * (1.0 - smoothstep(0.9, 1.0, normY));
    
    vAlpha = edgeAlpha;
  }
`;

const fragmentShader = `
  varying float vAlpha;

  void main() {
    // Circular particle
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    if (distanceToCenter > 0.5) discard;

    // Soft white snow
    // float strength = 0.05 / distanceToCenter - 0.1; // Glowy style?
    // Let's stick to simple soft circle
    
    float alpha = 1.0 - (distanceToCenter * 2.0);
    alpha = pow(alpha, 1.5);

    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * alpha * 0.8);
  }
`;

interface SnowProps {
  count?: number;
  range?: number;
  height?: number;
}

export const Snow: React.FC<SnowProps> = ({
  count = 1000,
  range = 40,
  height = 40,
}) => {
  const meshRef = useRef<THREE.Points>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeight: { value: height },
      uSpeed: { value: 2.0 },
    }),
    [height]
  );

  const { positions, randoms, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const sz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Random positions within Box(range, height, range)
      pos[i * 3] = (Math.random() - 0.5) * range; // X
      pos[i * 3 + 1] = (Math.random() - 0.5) * height; // Y
      pos[i * 3 + 2] = (Math.random() - 0.5) * range; // Z

      rnd[i] = Math.random();
      sz[i] = Math.random() * 4.0 + 2.0; // Size variation
    }

    return {
      positions: pos,
      randoms: rnd,
      sizes: sz,
    };
  }, [count, range, height]);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      {/* @ts-ignore */}
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        // NormalBlending is better for physical snow, Additive for glowing sparks
        blending={THREE.NormalBlending}
      />
    </points>
  );
};
