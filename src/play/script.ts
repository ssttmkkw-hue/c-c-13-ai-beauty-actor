import type { ExpressionName } from '../actor/expressions';
import type { ShotSpec } from '../render/Shots';
import type { BackdropId } from '../stage/backdrops';

/**
 * Demo scene 《晚风》 — a short rooftop confession between the two leads.
 * Each beat: who speaks, the line, expression, optional gesture, the shot,
 * and listener reactions. "heroine" / "hero" are slot names so any cast
 * combination can perform it.
 */

export interface Beat {
  who: 'heroine' | 'hero' | 'none';
  text: string;
  expression?: ExpressionName;
  gesture?: string | null;
  shot: ShotSpec & { subjectSlot?: 'heroine' | 'hero' };
  /** Reaction of the other lead while this line plays. */
  react?: ExpressionName;
  reactGesture?: string | null;
  rate?: number;
  /** Extra hold after the line (s). */
  hold?: number;
  ease?: number;
}

export interface Scene {
  title: string;
  subtitle: string;
  backdrop: BackdropId;
  beats: Beat[];
}

export const DEMO: Scene = {
  title: '晚风',
  subtitle: '第一集 · 天台',
  backdrop: 'night',
  beats: [
    { who: 'none', text: '', shot: { kind: 'wide', push: 0.08 }, hold: 2.6, expression: 'neutral' },
    { who: 'heroine', text: '你怎么……也在这里？', expression: 'surprised', shot: { kind: 'cu', subjectSlot: 'heroine' }, react: 'cool', rate: 3.8 },
    { who: 'hero', text: '我在等一个人。', expression: 'cool', shot: { kind: 'low', subjectSlot: 'hero' }, react: 'neutral', rate: 3.6 },
    { who: 'heroine', text: '等谁？', expression: 'neutral', shot: { kind: 'ots', subjectSlot: 'heroine' }, react: 'cool', rate: 3.6 },
    { who: 'hero', text: '等一个，每次见到我都会脸红的人。', expression: 'tender', shot: { kind: 'two', push: 0.1 }, react: 'surprised', rate: 3.9, hold: 0.6 },
    { who: 'heroine', text: '我、我才没有脸红！', expression: 'shy', shot: { kind: 'ecu', subjectSlot: 'heroine' }, react: 'happy', rate: 5.0 },
    { who: 'hero', text: '嗯，是晚风太热了。', expression: 'happy', shot: { kind: 'cu', subjectSlot: 'hero' }, react: 'shy', rate: 3.8 },
    { who: 'heroine', text: '{hero}……明天你就要走了，对不对？', expression: 'sad', shot: { kind: 'ots', subjectSlot: 'heroine' }, react: 'sad', rate: 3.5, hold: 0.4 },
    { who: 'hero', text: '对不起，我没能早点告诉你。', expression: 'sad', shot: { kind: 'profile', subjectSlot: 'hero' }, react: 'sad', rate: 3.6 },
    { who: 'heroine', text: '你总是这样，什么都一个人扛！', expression: 'angry', shot: { kind: 'cu', subjectSlot: 'heroine' }, react: 'sad', rate: 5.2 },
    { who: 'hero', text: '所以这一次，我想带上你。', expression: 'tender', gesture: 'reach', shot: { kind: 'two', push: 0.14 }, react: 'surprised', rate: 3.5, hold: 0.5 },
    { who: 'heroine', text: '……真的？', expression: 'surprised', shot: { kind: 'ecu', subjectSlot: 'heroine' }, react: 'tender', rate: 3.2, hold: 0.3 },
    { who: 'hero', text: '真的。{heroine}，跟我走吧。', expression: 'tender', gesture: 'reach', shot: { kind: 'ots', subjectSlot: 'hero' }, react: 'shy', rate: 3.6, hold: 0.4 },
    { who: 'heroine', text: '嗯。', expression: 'happy', gesture: null, shot: { kind: 'cu', subjectSlot: 'heroine', push: 0.1 }, react: 'tender', rate: 2.5, hold: 1.6 },
    { who: 'none', text: '', shot: { kind: 'wide', push: -0.1 }, expression: 'happy', hold: 3.2, ease: 2.2 },
  ],
};
