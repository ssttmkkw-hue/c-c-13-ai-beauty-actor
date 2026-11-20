import type { BeautyStage } from '../api';
import type { Scene, Beat } from './script';

export interface PlayerUI {
  subtitle(name: string, text: string, side: 'left' | 'right' | 'center'): void;
  clearSubtitle(): void;
  title(main: string, sub: string, show: boolean): void;
  progress(i: number, n: number): void;
  state(s: 'playing' | 'paused' | 'stopped' | 'ended'): void;
}

/**
 * Runs a Scene on a BeautyStage. Time only advances while playing, so
 * pause / resume freezes lip-sync, holds and camera moves consistently.
 */
export class Player {
  private beat = -1;
  private wait = 0;
  private waitingLine = false;
  playing = false;
  ended = false;
  private off: () => void;
  tts = false;

  constructor(private stage: BeautyStage, private scene: Scene, private ui: PlayerUI) {
    this.off = stage.onFrame((dt) => this.frame(dt));
  }

  get index() {
    return this.beat;
  }

  dispose() {
    this.off();
  }

  play() {
    if (this.ended || this.beat < 0) return this.restart();
    this.playing = true;
    for (const a of this.stage.actors()) a.paused = false;
    if ('speechSynthesis' in window) speechSynthesis.resume();
    this.ui.state('playing');
  }

  pause() {
    this.playing = false;
    for (const a of this.stage.actors()) a.paused = true;
    if ('speechSynthesis' in window) speechSynthesis.pause();
    this.ui.state('paused');
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  restart() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    for (const a of this.stage.actors()) {
      a.stopSpeaking();
      a.paused = false;
      a.setGesture(null);
      a.setExpression('neutral');
    }
    this.stage.setBackdrop(this.scene.backdrop);
    this.beat = -1;
    this.ended = false;
    this.playing = true;
    this.ui.state('playing');
    this.next();
  }

  stop() {
    this.playing = false;
    this.ended = false;
    this.beat = -1;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    for (const a of this.stage.actors()) {
      a.stopSpeaking();
      a.paused = false;
    }
    this.ui.clearSubtitle();
    this.ui.title('', '', false);
    this.ui.state('stopped');
  }

  /** Jump directly to a beat (used by screenshot capture). */
  seek(i: number) {
    this.beat = i - 1;
    this.playing = true;
    this.ended = false;
    this.next();
  }

  private name(slot: 'heroine' | 'hero') {
    return this.stage.slots[slot]?.look.name ?? '';
  }

  private fill(text: string) {
    return text.replace('{hero}', this.name('hero')).replace('{heroine}', this.name('heroine'));
  }

  private next() {
    this.beat++;
    const beats = this.scene.beats;
    this.ui.progress(Math.max(0, this.beat), beats.length);
    if (this.beat >= beats.length) {
      this.playing = false;
      this.ended = true;
      this.ui.clearSubtitle();
      this.ui.title('未完待续', `《${this.scene.title}》 ${this.scene.subtitle}`, true);
      this.ui.state('ended');
      return;
    }
    this.run(beats[this.beat]);
  }

  private run(b: Beat) {
    const st = this.stage;
    const speaker = b.who === 'none' ? null : st.slots[b.who];
    const other = b.who === 'hero' ? st.slots.heroine : b.who === 'heroine' ? st.slots.hero : null;
    const subj = b.shot.subjectSlot ? st.slots[b.shot.subjectSlot]?.look.id : undefined;
    st.shot({ ...b.shot, subject: subj }, b.ease ?? 0);
    if (this.beat === 0) this.ui.title(`《${this.scene.title}》`, this.scene.subtitle, true);
    else this.ui.title('', '', false);
    if (b.who === 'none') {
      for (const a of st.actors()) {
        if (b.expression) a.setExpression(b.expression);
        a.setGesture(null);
      }
      this.ui.clearSubtitle();
      this.wait = b.hold ?? 1;
      this.waitingLine = false;
      return;
    }
    if (other) {
      if (b.react) other.setExpression(b.react);
      other.setGesture(b.reactGesture ?? null);
    }
    if (speaker) {
      const text = this.fill(b.text);
      const side = b.who === 'heroine' ? 'right' : 'left';
      this.ui.subtitle(speaker.look.name, text, side);
      this.waitingLine = true;
      st.line(speaker.look.id, text, { expression: b.expression, gesture: b.gesture ?? null, rate: b.rate, tts: this.tts }).then(() => {
        if (this.scene.beats[this.beat] !== b) return;
        this.waitingLine = false;
        this.wait = (b.hold ?? 0) + 0.45;
      });
    }
  }

  private frame(dt: number) {
    if (!this.playing || this.ended || this.beat < 0) return;
    if (this.waitingLine) return;
    this.wait -= dt;
    if (this.wait <= 0) this.next();
  }
}
