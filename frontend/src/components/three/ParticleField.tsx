'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ─── Floating particles ─── */
function Particles({ count = 500 }: { count?: number }) {
  const meshRef = useRef<THREE.Points>(null!);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const primary = new THREE.Color('#6C63FF');
    const accent = new THREE.Color('#00D9FF');
    const dim = new THREE.Color('#2A2A3E');

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 5;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi) - 2;

      const rnd = Math.random();
      const c = rnd > 0.7 ? accent : rnd > 0.3 ? primary : dim;
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.03;
    meshRef.current.rotation.x = Math.sin(t * 0.02) * 0.1;

    const posArr = meshRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(t * 0.5 + i * 0.01) * 0.001;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/* ─── Floating wireframe shapes ─── */
function FloatingGeometry() {
  const group = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.getElapsedTime() * 0.05;
  });

  return (
    <group ref={group}>
      <mesh position={[3, 1, -2]} rotation={[0.5, 0, 0.3]}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshBasicMaterial color="#6C63FF" wireframe transparent opacity={0.15} />
      </mesh>
      <mesh position={[-3, -1, -3]} rotation={[0.3, 0.5, 0]}>
        <torusGeometry args={[0.6, 0.2, 8, 16]} />
        <meshBasicMaterial color="#00D9FF" wireframe transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 2.5, -4]} rotation={[0, 0.7, 0.2]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial color="#8B83FF" wireframe transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

/* ─── Connection lines ─── */
function ConnectionLines({ lineCount = 80 }: { lineCount?: number }) {
  const ref = useRef<THREE.LineSegments>(null!);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pts = new Float32Array(lineCount * 6);
    for (let i = 0; i < lineCount; i++) {
      const i6 = i * 6;
      const r1 = 2 + Math.random() * 4;
      const r2 = 2 + Math.random() * 4;
      const t1 = Math.random() * Math.PI * 2;
      const t2 = t1 + (Math.random() - 0.5) * 0.8;
      const p1 = Math.random() * Math.PI;
      const p2 = p1 + (Math.random() - 0.5) * 0.5;

      pts[i6] = r1 * Math.sin(p1) * Math.cos(t1);
      pts[i6 + 1] = r1 * Math.sin(p1) * Math.sin(t1);
      pts[i6 + 2] = r1 * Math.cos(p1) - 2;
      pts[i6 + 3] = r2 * Math.sin(p2) * Math.cos(t2);
      pts[i6 + 4] = r2 * Math.sin(p2) * Math.sin(t2);
      pts[i6 + 5] = r2 * Math.cos(p2) - 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [lineCount]);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.getElapsedTime() * 0.02;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#6C63FF" transparent opacity={0.06} />
    </lineSegments>
  );
}

/* ─── Main Export ─── */
export function ParticleField() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        dpr={[1, 1.5]}
        style={{ position: 'absolute', inset: 0 }}
        gl={{ antialias: false, alpha: true }}
      >
        <Particles count={500} />
        <FloatingGeometry />
        <ConnectionLines />
      </Canvas>
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50 pointer-events-none" />
    </div>
  );
}
