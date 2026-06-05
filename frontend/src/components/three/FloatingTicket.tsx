'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* Floating, slowly-rotating ticket NFT shape */
function TicketShape() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.3;
      meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;
      meshRef.current.position.y = Math.sin(t * 0.8) * 0.1;
    }
    if (glowRef.current) {
      glowRef.current.rotation.y = t * 0.3;
      glowRef.current.rotation.x = Math.sin(t * 0.5) * 0.15;
      glowRef.current.position.y = Math.sin(t * 0.8) * 0.1;
      const scale = 1.05 + Math.sin(t * 2) * 0.02;
      glowRef.current.scale.set(scale, scale, scale);
    }
  });

  const ticketShape = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 1.6, h = 1, r = 0.08, notchR = 0.12;

    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, -notchR);
    shape.arc(0, 0, notchR, -Math.PI / 2, Math.PI / 2, true);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, notchR);
    shape.arc(0, 0, notchR, Math.PI / 2, -Math.PI / 2, true);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    return shape;
  }, []);

  const extrudeSettings = useMemo(
    () => ({ depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 }),
    [],
  );

  return (
    <group>
      <mesh ref={meshRef} position={[0, 0, -0.02]}>
        <extrudeGeometry args={[ticketShape, extrudeSettings]} />
        <meshStandardMaterial
          color="#6C63FF"
          metalness={0.6}
          roughness={0.3}
          emissive="#6C63FF"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh ref={glowRef} position={[0, 0, -0.02]}>
        <extrudeGeometry args={[ticketShape, extrudeSettings]} />
        <meshBasicMaterial color="#6C63FF" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* Orbiting dots */
function OrbitDots({ count = 30 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 1.8 + Math.random() * 0.3;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [count]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.getElapsedTime() * 0.2;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.03}
        color="#00D9FF"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function FloatingTicket3D({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%', minHeight: 280 }}>
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 3]} intensity={1} color="#6C63FF" />
        <pointLight position={[-3, -1, 2]} intensity={0.5} color="#00D9FF" />
        <TicketShape />
        <OrbitDots />
      </Canvas>
    </div>
  );
}
