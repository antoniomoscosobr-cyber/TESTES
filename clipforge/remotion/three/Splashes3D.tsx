import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { ResolvedTimeline } from "../../src/timeline";
import { FONT_DISPLAY } from "../fonts";
import { seeded, useLayout } from "../layout";

type Splash = ResolvedTimeline["splashes"][number];
const DURATION: Record<string, number> = { particles: 1.3, shockwave: 1.0, title3d: 1.8 };

// Cada splash 3D roda num ThreeCanvas transparente só durante o efeito.
export const Splashes3D: React.FC<{ tl: ResolvedTimeline; accent: string }> = ({ tl, accent }) => {
  const { fps } = useVideoConfig();
  const { width, height } = useLayout();
  return (
    <>
      {tl.splashes
        .filter((s) => s.kind in DURATION)
        .map((s) => (
          <Sequence key={s.index} from={Math.round(s.t * fps)} durationInFrames={Math.round(DURATION[s.kind] * fps)} name={`3d ${s.kind}`} layout="none">
            <ThreeCanvas
              width={width}
              height={height}
              style={{ position: "absolute", inset: 0 }}
              gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
              camera={{ fov: 50, position: [0, 0, 10] }}
            >
              <ambientLight intensity={0.6} />
              <directionalLight position={[4, 6, 8]} intensity={2.2} />
              <pointLight position={[-6, -2, 6]} intensity={40} color={accent} />
              {s.kind === "particles" ? <ParticleBurst splash={s} accent={accent} /> : null}
              {s.kind === "shockwave" ? <Shockwave splash={s} accent={accent} /> : null}
              {s.kind === "title3d" ? <Title3D splash={s} accent={accent} /> : null}
            </ThreeCanvas>
          </Sequence>
        ))}
    </>
  );
};

const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const useProgress = (seconds: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.min(1, frame / (seconds * fps));
};

// Explosão de estilhaços: InstancedMesh com trajetória, giro e gravidade determinísticos.
const ParticleBurst: React.FC<{ splash: Splash; accent: string }> = ({ splash, accent }) => {
  const p = useProgress(DURATION.particles);
  const { vertical } = useLayout();
  const count = 140;
  const shards = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rand = seeded(splash.index + 3);
    return Array.from({ length: count }, () => {
      const a = rand() * Math.PI * 2;
      const z = rand() * 2 - 1;
      const r = Math.sqrt(1 - z * z);
      return {
        dir: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * (vertical ? 1.4 : 0.9), z * 0.6),
        speed: 4 + rand() * 7 * (0.6 + splash.intensity),
        spin: new THREE.Vector3(rand(), rand(), rand()).normalize(),
        size: 0.08 + rand() * 0.22,
        spark: rand() > 0.6,
      };
    });
  }, [splash.index, splash.intensity, vertical]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const travel = easeOutExpo(p);
    let iShard = 0;
    let iSpark = 0;
    for (const s of seeds) {
      dummy.position.copy(s.dir).multiplyScalar(s.speed * travel);
      dummy.position.y -= 3.5 * p * p;
      dummy.rotation.set(s.spin.x * p * 12, s.spin.y * p * 12, s.spin.z * p * 12);
      const fade = Math.pow(1 - p, 1.6);
      dummy.scale.setScalar(s.size * fade * (s.spark ? 0.5 : 1) + 1e-4);
      dummy.updateMatrix();
      if (s.spark) sparks.current?.setMatrixAt(iSpark++, dummy.matrix);
      else shards.current?.setMatrixAt(iShard++, dummy.matrix);
    }
    if (shards.current) shards.current.instanceMatrix.needsUpdate = true;
    if (sparks.current) sparks.current.instanceMatrix.needsUpdate = true;
  }, [p, seeds]);

  const nSparks = seeds.filter((s) => s.spark).length;
  return (
    <group>
      <instancedMesh ref={shards} args={[undefined, undefined, count - nSparks]}>
        <tetrahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} metalness={0.4} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={sparks} args={[undefined, undefined, nSparks]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  );
};

// Anel de choque duplo com blending aditivo.
const Shockwave: React.FC<{ splash: Splash; accent: string }> = ({ splash, accent }) => {
  const p = useProgress(DURATION.shockwave);
  const ring = (delay: number, color: string, thickness: number) => {
    const q = Math.max(0, Math.min(1, (p - delay) / (1 - delay)));
    const scale = 0.2 + easeOutExpo(q) * 9 * (0.6 + splash.intensity * 0.6);
    return (
      <mesh scale={[scale, scale, scale]} rotation={[-0.35, 0, 0]}>
        <ringGeometry args={[1 - thickness, 1, 96]} />
        <meshBasicMaterial color={color} transparent opacity={Math.pow(1 - q, 2)} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    );
  };
  return (
    <group>
      {ring(0, accent, 0.18)}
      {ring(0.12, "#ffffff", 0.06)}
      {ring(0.22, accent, 0.03)}
    </group>
  );
};

// Título "3D": texto desenhado num canvas (aceita acentos e usa a fonte Anton) empilhado
// em camadas para simular extrusão; entra voando e girando.
const Title3D: React.FC<{ splash: Splash; accent: string }> = ({ splash, accent }) => {
  const p = useProgress(DURATION.title3d);
  const { vertical } = useLayout();
  const text = (splash.text || "").toUpperCase();
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 360;
    do {
      ctx.font = `${size}px ${FONT_DISPLAY}`;
      size -= 10;
    } while (ctx.measureText(text).width > canvas.width * 0.92 && size > 60);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.04);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);

  const enter = easeOutExpo(Math.min(1, p / 0.45));
  const exit = p > 0.8 ? (p - 0.8) / 0.2 : 0;
  const w = vertical ? 7 : 11;
  const layers = 16;
  return (
    <group
      position={[0, vertical ? 2.2 : 0.4, -30 * (1 - enter) + 4 * exit]}
      rotation={[(1 - enter) * 1.2 - 0.12, (1 - enter) * -2.2 + Math.sin(p * Math.PI) * 0.25, 0]}
      scale={1 + exit * 0.4}
    >
      {Array.from({ length: layers }, (_, i) => {
        const front = i === layers - 1;
        const shade = 0.25 + (i / layers) * 0.5;
        return (
          <mesh key={i} position={[0, 0, (i - layers) * 0.035]}>
            <planeGeometry args={[w, w / 4]} />
            <meshBasicMaterial
              map={texture}
              transparent
              opacity={1 - exit}
              depthWrite={false}
              color={front ? "#ffffff" : new THREE.Color(accent).multiplyScalar(shade)}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};
