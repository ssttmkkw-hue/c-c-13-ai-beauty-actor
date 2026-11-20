/**
 * Body poses in VRM 1.0 normalized-bone convention (model faces +Z, its left
 * hand on +X). Euler 'XYZ' in radians. For arms the intrinsic order makes
 *   x = twist along the bone, y = swing forward/back (left: − = forward),
 *   z = raise/lower (left: − = down).
 * Poses are authored for the LEFT side where symmetrical; `mirror()` builds
 * the right side (negate y and z). BeautyActor converts to VRM0 space itself.
 */

export type Euler3 = [number, number, number];
export type Pose = Partial<Record<string, Euler3>>;

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const;
const SEGS = ['Proximal', 'Intermediate', 'Distal'] as const;

function fingers(side: 'left' | 'right', curl: number, spread = 0.0): Pose {
  const s = side === 'left' ? -1 : 1;
  const p: Pose = {};
  FINGERS.forEach((f, fi) => {
    SEGS.forEach((seg, si) => {
      const name = `${side}${f}${f === 'Thumb' ? (['Metacarpal', 'Proximal', 'Distal'] as const)[si] : seg}`;
      if (f === 'Thumb') {
        p[name] = [0, s * -0.25 * curl, s * 0.12 * curl];
      } else {
        // graceful cascade: little finger curls most (classic anime hand)
        const k = curl * (0.75 + fi * 0.12) * (si === 0 ? 0.8 : 1.05);
        p[name] = [0, s * (fi - 2) * spread * (si === 0 ? 1 : 0), s * k];
      }
    });
  });
  return p;
}

function arm(side: 'left' | 'right', upper: Euler3, lower: Euler3, hand: Euler3, shoulder: Euler3 = [0, 0, 0]): Pose {
  const m = (e: Euler3): Euler3 => (side === 'left' ? e : [e[0], -e[1], -e[2]]);
  return {
    [`${side}Shoulder`]: m(shoulder),
    [`${side}UpperArm`]: m(upper),
    [`${side}LowerArm`]: m(lower),
    [`${side}Hand`]: m(hand),
  };
}

const relaxedHands = { ...fingers('left', 0.28, 0.05), ...fingers('right', 0.28, 0.05) };

// Arm angles below were solved with a small FK search (scratch IK, see
// docs/DESIGN.md §Gestures) against target hand positions in body space.
export const POSES: Record<string, Pose> = {
  idle: {
    ...arm('left', [0.1, -0.65, -1.4], [0, -0.25, 0], [0, 0, -0.08]),
    ...arm('right', [0.1, -0.6, -1.4], [0, -0.3, 0], [0, 0, -0.08]),
    ...relaxedHands,
    spine: [0.02, 0, 0],
  },
  open: {
    ...arm('left', [0, -0.4, -1.25], [0, -0.3, 0], [0, 0, -0.15]),
    ...arm('right', [0, -0.4, -1.27], [0, -0.28, 0], [0, 0, -0.15]),
    ...fingers('left', 0.18, 0.12),
    ...fingers('right', 0.18, 0.12),
    spine: [-0.03, 0, 0],
    chest: [-0.03, 0, 0],
  },
  shy: {
    // right hand rests on the chest, left arm hangs close to the body
    ...arm('right', [0, -0.9, -1.4], [0, -2.1, 0], [0, 0, -0.15]),
    ...arm('left', [0, -0.6, -1.5], [0, -0.35, 0], [0, 0, -0.05]),
    ...fingers('left', 0.38),
    ...fingers('right', 0.5),
    spine: [0.06, 0, 0],
    chest: [0.04, 0, 0],
  },
  tender: {
    ...arm('left', [-0.4, -0.35, -1.3], [0, -0.6, 0], [0.5, 0, -0.1]),
    ...arm('right', [0.1, -0.6, -1.4], [0, -0.3, 0], [0, 0, -0.08]),
    ...fingers('left', 0.2, 0.1),
    ...fingers('right', 0.3),
    spine: [0.03, 0, 0],
  },
  sad: {
    ...arm('left', [0, -0.6, -1.5], [0, -0.3, 0], [0, 0, -0.05], [0, 0, -0.04]),
    ...arm('right', [0, -0.6, -1.5], [0, -0.3, 0], [0, 0, -0.05], [0, 0, -0.04]),
    ...fingers('left', 0.42),
    ...fingers('right', 0.42),
    spine: [0.08, 0, 0],
    chest: [0.06, 0, 0],
  },
  surprised: {
    ...arm('left', [-0.1, -0.35, -1.35], [0, -2.2, 0], [0, 0, 0.15]),
    ...arm('right', [-0.1, -0.35, -1.35], [0, -2.2, 0], [0, 0, 0.15]),
    ...fingers('left', 0.15, 0.2),
    ...fingers('right', 0.15, 0.2),
    spine: [-0.06, 0, 0],
  },
  angry: {
    ...arm('left', [0.3, -0.75, -1.25], [0, -0.3, 0], [0, 0, 0], [0, 0, 0.05]),
    ...arm('right', [0.3, -0.75, -1.25], [0, -0.3, 0], [0, 0, 0], [0, 0, 0.05]),
    ...fingers('left', 1.0),
    ...fingers('right', 1.0),
    spine: [0.05, 0, 0],
    chest: [-0.04, 0, 0],
  },
  cool: {
    // left hand tucked behind the back, weight shifted
    ...arm('left', [1.5, -1.2, -0.45], [0, -1.1, 0], [0, 0, -0.2]),
    ...arm('right', [0.1, -0.6, -1.42], [0, -0.22, 0], [0, 0, -0.08]),
    ...fingers('left', 0.6),
    ...fingers('right', 0.3),
    spine: [-0.02, 0.04, 0],
    hips: [0, -0.05, 0.03],
  },
  reach: {
    ...arm('right', [0, -1.45, -0.3], [0, -0.15, 0], [0.9, 0, -0.05]),
    ...arm('left', [0.1, -0.6, -1.4], [0, -0.3, 0], [0, 0, -0.08]),
    ...fingers('right', 0.12, 0.08),
    ...fingers('left', 0.3),
    spine: [0.04, -0.06, 0],
  },
};

export const POSE_LABELS: Record<string, string> = {
  idle: '自然站姿',
  open: '舒展',
  shy: '手抚胸口',
  tender: '轻轻伸手',
  sad: '低落',
  surprised: '惊讶抬手',
  angry: '握拳',
  cool: '单手背后',
  reach: '伸手邀请',
};
