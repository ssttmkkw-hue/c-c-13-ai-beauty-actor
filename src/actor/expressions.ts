/**
 * Emotional presets. Each preset is a recipe across several channels so an
 * emotion reads on a beautiful face without looking rubbery:
 *  - VRM expression weights (kept moderate: full-strength presets distort faces)
 *  - blush (custom shader channel)
 *  - head attitude (tilt / nod / turn) and gaze behaviour
 *  - a body pose from poses.ts
 *  - eye-sparkle boost (catch-light intensity)
 */

export type ExpressionName = 'neutral' | 'happy' | 'shy' | 'tender' | 'sad' | 'surprised' | 'angry' | 'cool';

export interface ExpressionPreset {
  label: string;
  /** VRM expression weights keyed by VRM1 preset names. */
  weights: Partial<Record<'happy' | 'relaxed' | 'sad' | 'angry' | 'surprised', number>>;
  blush: number;
  /** Head pitch (+ = look down), roll (+ = tilt toward the actor's right shoulder), yaw (+ = turn to actor's left). */
  head: [number, number, number];
  /** Gaze: 'partner' looks at the scene partner / camera; 'away' looks down-aside; 'down' looks down. */
  gaze: 'partner' | 'away' | 'down' | 'up';
  pose: string;
  sparkle: number;
  /** Blink frequency multiplier. */
  blinkRate: number;
  /** Mouth openness multiplier while speaking. */
  mouth: number;
}

export const EXPRESSIONS: Record<ExpressionName, ExpressionPreset> = {
  neutral: { label: '平静', weights: { relaxed: 0.12 }, blush: 0.12, head: [0, 0, 0], gaze: 'partner', pose: 'idle', sparkle: 1, blinkRate: 1, mouth: 1 },
  happy: { label: '开心', weights: { happy: 0.5, relaxed: 0.3 }, blush: 0.35, head: [-0.03, 0.06, 0], gaze: 'partner', pose: 'open', sparkle: 1.3, blinkRate: 0.8, mouth: 1.05 },
  shy: { label: '害羞', weights: { relaxed: 0.45, sad: 0.12 }, blush: 1, head: [0.16, 0.12, -0.12], gaze: 'away', pose: 'shy', sparkle: 1.25, blinkRate: 1.6, mouth: 0.7 },
  tender: { label: '温柔', weights: { relaxed: 0.55, happy: 0.1 }, blush: 0.45, head: [0.04, 0.09, 0], gaze: 'partner', pose: 'tender', sparkle: 1.35, blinkRate: 0.7, mouth: 0.8 },
  sad: { label: '难过', weights: { sad: 0.65 }, blush: 0.25, head: [0.13, -0.05, 0], gaze: 'down', pose: 'sad', sparkle: 1.5, blinkRate: 1.3, mouth: 0.75 },
  surprised: { label: '惊讶', weights: { surprised: 0.7 }, blush: 0.2, head: [-0.08, 0, 0], gaze: 'partner', pose: 'surprised', sparkle: 1.2, blinkRate: 0.3, mouth: 1.15 },
  angry: { label: '生气', weights: { angry: 0.6 }, blush: 0.4, head: [0.05, -0.04, 0], gaze: 'partner', pose: 'angry', sparkle: 1.1, blinkRate: 0.6, mouth: 1.15 },
  cool: { label: '冷峻', weights: { angry: 0.14, relaxed: 0.12 }, blush: 0, head: [-0.05, 0, 0], gaze: 'partner', pose: 'cool', sparkle: 0.9, blinkRate: 0.6, mouth: 0.85 },
};

export const EXPRESSION_ORDER: ExpressionName[] = ['neutral', 'happy', 'shy', 'tender', 'sad', 'surprised', 'angry', 'cool'];
