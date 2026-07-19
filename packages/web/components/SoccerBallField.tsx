"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const BALL_COUNT = 7;
const BOUNDS = { x: 7, y: 4.2, z: 3.5 };

/** Procedurally draws a classic black/white pentagon soccer-ball pattern onto a canvas texture. */
function makeBallTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f2ef";
  ctx.fillRect(0, 0, size, size);

  const drawPentagon = (cx: number, cy: number, r: number, rotation: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = rotation + (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  const r = size * 0.14;
  ctx.fillStyle = "#15181a";
  drawPentagon(size * 0.5, size * 0.3, r, 0);
  drawPentagon(size * 0.18, size * 0.62, r, 0);
  drawPentagon(size * 0.82, size * 0.62, r, 0);
  drawPentagon(size * 0.5, size * 0.92, r, 0);
  drawPentagon(0, size * 0.15, r, 0);
  drawPentagon(size, size * 0.15, r, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface BallState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationAxis: THREE.Vector3;
  rotationSpeed: number;
  scale: number;
}

function Balls({ speedMultiplier }: { speedMultiplier: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => makeBallTexture(), []);

  const balls = useMemo<BallState[]>(() => {
    const arr: BallState[] = [];
    for (let i = 0; i < BALL_COUNT; i++) {
      arr.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * BOUNDS.x * 2,
          (Math.random() - 0.5) * BOUNDS.y * 2,
          -1 - Math.random() * BOUNDS.z
        ),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.18, 0),
        rotationAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
        rotationSpeed: 0.15 + Math.random() * 0.25,
        scale: 0.35 + Math.random() * 0.4,
      });
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05) * speedMultiplier;

    balls.forEach((ball, i) => {
      ball.position.addScaledVector(ball.velocity, dt);
      // wrap around so balls always stay in frame
      if (ball.position.x > BOUNDS.x) ball.position.x = -BOUNDS.x;
      if (ball.position.x < -BOUNDS.x) ball.position.x = BOUNDS.x;
      if (ball.position.y > BOUNDS.y) ball.position.y = -BOUNDS.y;
      if (ball.position.y < -BOUNDS.y) ball.position.y = BOUNDS.y;

      const mesh = group.children[i] as THREE.Mesh | undefined;
      if (!mesh) return;
      mesh.position.copy(ball.position);
      mesh.rotateOnAxis(ball.rotationAxis, ball.rotationSpeed * dt);
    });
  });

  return (
    <group ref={groupRef}>
      {balls.map((ball, i) => (
        <mesh key={i} position={ball.position} scale={ball.scale}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial map={texture} roughness={0.85} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Ambient drifting soccer balls behind the game UI (§6 style layer, not core game state).
 * Fixed, full-viewport, pointer-events disabled, dark pitch clear color doubles as the
 * page background. `speedMultiplier` lets the danger tier nudge drift speed subtly —
 * never anything shake-like, per the no-screen-shake accessibility decision.
 */
export function SoccerBallField({ speedMultiplier = 1 }: { speedMultiplier?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor("#050b08", 1)}
      >
        <fog attach="fog" args={["#050b08", 4, 11]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={0.6} color="#dfe8e2" />
        <pointLight position={[-4, -2, 2]} intensity={0.3} color="#2563eb" />
        <Balls speedMultiplier={speedMultiplier} />
      </Canvas>
    </div>
  );
}
