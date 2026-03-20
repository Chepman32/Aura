import React, { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useFrameCallback,
  useDerivedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 260;
const PARTICLE_COUNT = 24;

const BASE_SPEED = 0.6;
const MAX_EXTRA_SPEED = 2.0;
const DRIFT_AMPLITUDE = 0.5;

// ---------------------------------------------------------------------------
// Worklet helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  'worklet';
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ParticleEffectProps {
  progress: number;
  dominantColor: string;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating particle effect rendered entirely on the Skia/Reanimated UI thread.
 *
 * Architecture:
 *   - PARTICLE_COUNT = 24 particles.
 *   - Each particle owns 5 scalar shared values (cx, cy, r, opacity, speed)
 *     plus phase values packed into two more (driftPhase, driftFreq).
 *   - A single useFrameCallback advances every particle each frame.
 *   - Skia reads shared values directly — zero React re-renders, zero bridge.
 *
 * Particle speed is scaled by export progress: at progress=1 particles move
 * ~3.3× faster than at progress=0.
 */
export default function ParticleEffect({
  progress,
  dominantColor,
  active = true,
}: ParticleEffectProps): React.JSX.Element {
  // ── Shared control values ───────────────────────────────────────────────
  const progressSV = useSharedValue(progress);
  const activeSV = useSharedValue(active ? 1 : 0);
  const tick = useSharedValue(0);

  useEffect(() => { progressSV.value = progress; }, [progress, progressSV]);
  useEffect(() => { activeSV.value = active ? 1 : 0; }, [active, activeSV]);

  // ── Per-particle shared values ───────────────────────────────────────────
  // All hooks at the top level — we call them unconditionally in fixed count.
  // cx/cy are positions; r is radius; op is opacity (0-1); sp is speed;
  // dp is drift phase; df is drift frequency.

  const cx0 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx1 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx2 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx3 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx4 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx5 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx6 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx7 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx8 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx9 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx10 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx11 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx12 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx13 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx14 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx15 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx16 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx17 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx18 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx19 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx20 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx21 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx22 = useSharedValue(rand(16, CANVAS_WIDTH - 16));
  const cx23 = useSharedValue(rand(16, CANVAS_WIDTH - 16));

  const cy0 = useSharedValue((0 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy1 = useSharedValue((1 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy2 = useSharedValue((2 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy3 = useSharedValue((3 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy4 = useSharedValue((4 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy5 = useSharedValue((5 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy6 = useSharedValue((6 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy7 = useSharedValue((7 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy8 = useSharedValue((8 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy9 = useSharedValue((9 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy10 = useSharedValue((10 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy11 = useSharedValue((11 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy12 = useSharedValue((12 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy13 = useSharedValue((13 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy14 = useSharedValue((14 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy15 = useSharedValue((15 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy16 = useSharedValue((16 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy17 = useSharedValue((17 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy18 = useSharedValue((18 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy19 = useSharedValue((19 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy20 = useSharedValue((20 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy21 = useSharedValue((21 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy22 = useSharedValue((22 / PARTICLE_COUNT) * CANVAS_HEIGHT);
  const cy23 = useSharedValue((23 / PARTICLE_COUNT) * CANVAS_HEIGHT);

  const r0 = useSharedValue(rand(2, 5));
  const r1 = useSharedValue(rand(2, 5));
  const r2 = useSharedValue(rand(2, 5));
  const r3 = useSharedValue(rand(2, 5));
  const r4 = useSharedValue(rand(2, 5));
  const r5 = useSharedValue(rand(2, 5));
  const r6 = useSharedValue(rand(2, 5));
  const r7 = useSharedValue(rand(2, 5));
  const r8 = useSharedValue(rand(2, 5));
  const r9 = useSharedValue(rand(2, 5));
  const r10 = useSharedValue(rand(2, 5));
  const r11 = useSharedValue(rand(2, 5));
  const r12 = useSharedValue(rand(2, 5));
  const r13 = useSharedValue(rand(2, 5));
  const r14 = useSharedValue(rand(2, 5));
  const r15 = useSharedValue(rand(2, 5));
  const r16 = useSharedValue(rand(2, 5));
  const r17 = useSharedValue(rand(2, 5));
  const r18 = useSharedValue(rand(2, 5));
  const r19 = useSharedValue(rand(2, 5));
  const r20 = useSharedValue(rand(2, 5));
  const r21 = useSharedValue(rand(2, 5));
  const r22 = useSharedValue(rand(2, 5));
  const r23 = useSharedValue(rand(2, 5));

  const op0 = useSharedValue(rand(0.35, 0.85));
  const op1 = useSharedValue(rand(0.35, 0.85));
  const op2 = useSharedValue(rand(0.35, 0.85));
  const op3 = useSharedValue(rand(0.35, 0.85));
  const op4 = useSharedValue(rand(0.35, 0.85));
  const op5 = useSharedValue(rand(0.35, 0.85));
  const op6 = useSharedValue(rand(0.35, 0.85));
  const op7 = useSharedValue(rand(0.35, 0.85));
  const op8 = useSharedValue(rand(0.35, 0.85));
  const op9 = useSharedValue(rand(0.35, 0.85));
  const op10 = useSharedValue(rand(0.35, 0.85));
  const op11 = useSharedValue(rand(0.35, 0.85));
  const op12 = useSharedValue(rand(0.35, 0.85));
  const op13 = useSharedValue(rand(0.35, 0.85));
  const op14 = useSharedValue(rand(0.35, 0.85));
  const op15 = useSharedValue(rand(0.35, 0.85));
  const op16 = useSharedValue(rand(0.35, 0.85));
  const op17 = useSharedValue(rand(0.35, 0.85));
  const op18 = useSharedValue(rand(0.35, 0.85));
  const op19 = useSharedValue(rand(0.35, 0.85));
  const op20 = useSharedValue(rand(0.35, 0.85));
  const op21 = useSharedValue(rand(0.35, 0.85));
  const op22 = useSharedValue(rand(0.35, 0.85));
  const op23 = useSharedValue(rand(0.35, 0.85));

  // Per-particle simulation params packed into a single shared value each.
  // Format: [speed, driftPhase, driftFrequency, baseOpacity]
  const sp0 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp1 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp2 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp3 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp4 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp5 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp6 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp7 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp8 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp9 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp10 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp11 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp12 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp13 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp14 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp15 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp16 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp17 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp18 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp19 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp20 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp21 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp22 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);
  const sp23 = useSharedValue<[number, number, number, number]>([rand(0.4,1.0), rand(0,Math.PI*2), rand(0.01,0.04), rand(0.35,0.85)]);

  // Collect into arrays for the frame callback.
  const cxArr = [cx0,cx1,cx2,cx3,cx4,cx5,cx6,cx7,cx8,cx9,cx10,cx11,cx12,cx13,cx14,cx15,cx16,cx17,cx18,cx19,cx20,cx21,cx22,cx23];
  const cyArr = [cy0,cy1,cy2,cy3,cy4,cy5,cy6,cy7,cy8,cy9,cy10,cy11,cy12,cy13,cy14,cy15,cy16,cy17,cy18,cy19,cy20,cy21,cy22,cy23];
  const rArr  = [r0,r1,r2,r3,r4,r5,r6,r7,r8,r9,r10,r11,r12,r13,r14,r15,r16,r17,r18,r19,r20,r21,r22,r23];
  const opArr = [op0,op1,op2,op3,op4,op5,op6,op7,op8,op9,op10,op11,op12,op13,op14,op15,op16,op17,op18,op19,op20,op21,op22,op23];
  const spArr = [sp0,sp1,sp2,sp3,sp4,sp5,sp6,sp7,sp8,sp9,sp10,sp11,sp12,sp13,sp14,sp15,sp16,sp17,sp18,sp19,sp20,sp21,sp22,sp23];

  // ── Frame callback ───────────────────────────────────────────────────────
  useFrameCallback(() => {
    'worklet';
    if (!activeSV.value) {
      return;
    }
    tick.value += 1;
    const t = tick.value;
    const pm = progressSV.value;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const params = spArr[i].value; // [speed, driftPhase, driftFreq, baseOpacity]
      const speed = params[0];
      const driftPhase = params[1];
      const driftFreq = params[2];
      const baseOp = params[3];

      const newY = cyArr[i].value - speed * (0.5 + pm * 1.5);
      const drift = Math.sin(t * driftFreq + driftPhase) * DRIFT_AMPLITUDE;
      const newX = cxArr[i].value + drift;

      const fadeThreshold = CANVAS_HEIGHT * 0.3;
      const newOp =
        newY < fadeThreshold
          ? baseOp * Math.max(0, newY / fadeThreshold)
          : baseOp;

      if (newY < -12) {
        // Respawn at bottom.
        cxArr[i].value = rand(16, CANVAS_WIDTH - 16);
        cyArr[i].value = CANVAS_HEIGHT + rand(0, 20);
        rArr[i].value = rand(2, 5);
        const newSpeed = (BASE_SPEED + pm * MAX_EXTRA_SPEED) * rand(0.6, 1.4);
        const newBaseOp = rand(0.35, 0.85);
        spArr[i].value = [newSpeed, rand(0, Math.PI * 2), rand(0.01, 0.04), newBaseOp];
        opArr[i].value = newBaseOp;
      } else {
        cyArr[i].value = newY;
        cxArr[i].value = newX;
        opArr[i].value = Math.max(0, newOp);
      }
    }
  });

  // ── Parse dominant color once ────────────────────────────────────────────
  const [red, green, blue] = useMemo(() => {
    const clean = dominantColor.replace('#', '');
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  }, [dominantColor]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Canvas style={styles.canvas} pointerEvents="none">
      <ParticleCircle cx={cxArr[0]}  cy={cyArr[0]}  r={rArr[0]}  opacity={opArr[0]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[1]}  cy={cyArr[1]}  r={rArr[1]}  opacity={opArr[1]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[2]}  cy={cyArr[2]}  r={rArr[2]}  opacity={opArr[2]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[3]}  cy={cyArr[3]}  r={rArr[3]}  opacity={opArr[3]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[4]}  cy={cyArr[4]}  r={rArr[4]}  opacity={opArr[4]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[5]}  cy={cyArr[5]}  r={rArr[5]}  opacity={opArr[5]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[6]}  cy={cyArr[6]}  r={rArr[6]}  opacity={opArr[6]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[7]}  cy={cyArr[7]}  r={rArr[7]}  opacity={opArr[7]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[8]}  cy={cyArr[8]}  r={rArr[8]}  opacity={opArr[8]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[9]}  cy={cyArr[9]}  r={rArr[9]}  opacity={opArr[9]}  red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[10]} cy={cyArr[10]} r={rArr[10]} opacity={opArr[10]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[11]} cy={cyArr[11]} r={rArr[11]} opacity={opArr[11]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[12]} cy={cyArr[12]} r={rArr[12]} opacity={opArr[12]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[13]} cy={cyArr[13]} r={rArr[13]} opacity={opArr[13]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[14]} cy={cyArr[14]} r={rArr[14]} opacity={opArr[14]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[15]} cy={cyArr[15]} r={rArr[15]} opacity={opArr[15]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[16]} cy={cyArr[16]} r={rArr[16]} opacity={opArr[16]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[17]} cy={cyArr[17]} r={rArr[17]} opacity={opArr[17]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[18]} cy={cyArr[18]} r={rArr[18]} opacity={opArr[18]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[19]} cy={cyArr[19]} r={rArr[19]} opacity={opArr[19]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[20]} cy={cyArr[20]} r={rArr[20]} opacity={opArr[20]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[21]} cy={cyArr[21]} r={rArr[21]} opacity={opArr[21]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[22]} cy={cyArr[22]} r={rArr[22]} opacity={opArr[22]} red={red} green={green} blue={blue} />
      <ParticleCircle cx={cxArr[23]} cy={cyArr[23]} r={rArr[23]} opacity={opArr[23]} red={red} green={green} blue={blue} />
    </Canvas>
  );
}

// ---------------------------------------------------------------------------
// ParticleCircle
// ---------------------------------------------------------------------------

interface ParticleCircleProps {
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  r: SharedValue<number>;
  opacity: SharedValue<number>;
  red: number;
  green: number;
  blue: number;
}

function ParticleCircle({
  cx,
  cy,
  r,
  opacity,
  red,
  green,
  blue,
}: ParticleCircleProps): React.JSX.Element {
  const color = useDerivedValue(
    () => `rgba(${red},${green},${blue},${opacity.value.toFixed(2)})`,
  );
  return <Circle cx={cx} cy={cy} r={r} color={color} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'absolute',
  },
});
