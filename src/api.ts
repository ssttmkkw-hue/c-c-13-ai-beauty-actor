import * as THREE from 'three';
import { BeautyActor } from './actor/BeautyActor';
import { LOOKS, lookById, type CharacterLook } from './actor/looks';
import { EXPRESSIONS, type ExpressionName } from './actor/expressions';
import { Stage } from './stage/Stage';
import type { BackdropId } from './stage/backdrops';
import { Post } from './render/Post';
import { ShotDirector, type ShotSpec } from './render/Shots';

export type { ExpressionName, ShotSpec, BackdropId, CharacterLook };
export { LOOKS, EXPRESSIONS };

export interface BeautyStageOptions {
  /** Pixel ratio cap (default 2). */
  maxPixelRatio?: number;
  /** Start with post-processing on (default true). */
  post?: boolean;
  backdrop?: BackdropId;
}

export interface LineOptions {
  expression?: ExpressionName;
  gesture?: string | null;
  /** Syllables per second. */
  rate?: number;
  /** Use Web Speech TTS when available (default false). */
  tts?: boolean;
}

/**
 * Public, embeddable API: a self-contained beautiful two-hander stage.
 *
 *   const stage = await BeautyStage.create(container);
 *   await stage.cast('heroine', 'linwan');
 *   await stage.cast('hero', 'guyan');
 *   stage.shot({ kind: 'cu', subject: 'linwan' });
 *   await stage.line('linwan', '你怎么……也在这里？', { expression: 'shy' });
 *
 * See docs/ACTOR_API.md.
 */
export class BeautyStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 60);
  readonly stage = new Stage();
  readonly post: Post;
  readonly shots: ShotDirector;
  readonly slots: Partial<Record<'heroine' | 'hero', BeautyActor>> = {};
  private clock = new THREE.Clock();
  private elapsed = 0;
  private listeners = new Set<(dt: number) => void>();
  private running = false;
  speaker: BeautyActor | null = null;
  ttsVoices: SpeechSynthesisVoice[] = [];
  frameMs = 0;

  private constructor(readonly container: HTMLElement, opts: BeautyStageOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);
    const { w, h } = this.size();
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post = new Post(this.renderer, this.stage.scene, this.camera, w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
    this.post.setSize(w, h);
    this.post.enabled = opts.post ?? true;
    this.shots = new ShotDirector(this.camera, () => this.actors());
    this.setBackdrop(opts.backdrop ?? 'night');
    new ResizeObserver(() => this.resize()).observe(container);
    if ('speechSynthesis' in window) {
      const load = () => (this.ttsVoices = speechSynthesis.getVoices().filter((v) => /zh|cmn/i.test(v.lang)));
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
    }
  }

  static async create(container: HTMLElement, opts: BeautyStageOptions = {}) {
    const s = new BeautyStage(container, opts);
    s.start();
    return s;
  }

  private size() {
    const r = this.container.getBoundingClientRect();
    return { w: Math.max(2, Math.floor(r.width)), h: Math.max(2, Math.floor(r.height)) };
  }

  resize() {
    const { w, h } = this.size();
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyViewShift();
    this.post.setSize(w, h);
  }

  private viewShift = 0;
  /** Shift the composition horizontally (px) — e.g. to keep subjects clear of a side panel. */
  setViewShift(px: number) {
    this.viewShift = px;
    this.applyViewShift();
  }

  private applyViewShift() {
    const { w, h } = this.size();
    if (this.viewShift) this.camera.setViewOffset(w, h, this.viewShift, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  actors(): BeautyActor[] {
    return [this.slots.hero, this.slots.heroine].filter(Boolean) as BeautyActor[];
  }

  actor(id: string): BeautyActor | undefined {
    return this.actors().find((a) => a.look.id === id);
  }

  setBackdrop(id: BackdropId) {
    this.stage.setBackdrop(id);
    this.post.setPreset(this.stage.preset);
    const rim = new THREE.Color(this.stage.preset.rim.color);
    for (const a of this.actors()) a.mats.setRim(rim, this.stage.preset.rim.strength);
  }

  /** Put a character into a slot (heroine = stage right, hero = stage left). */
  async cast(slot: 'heroine' | 'hero', characterId: string, onProgress?: (p: number) => void) {
    const prev = this.slots[slot];
    if (prev?.look.id === characterId) return prev;
    const actor = await new BeautyActor(lookById(characterId)).load(onProgress);
    if (prev) {
      this.stage.removeShadow(prev.root);
      prev.dispose();
    }
    this.slots[slot] = actor;
    this.stage.scene.add(actor.root);
    this.stage.addShadow(actor.root);
    actor.mats.setRim(new THREE.Color(this.stage.preset.rim.color), this.stage.preset.rim.strength);
    this.blocking();
    return actor;
  }

  /** Default blocking: the two leads face each other at a three-quarter angle to the house. */
  blocking(spacing = 0.95) {
    const he = this.slots.hero;
    const sh = this.slots.heroine;
    if (he && sh) {
      he.place(-spacing / 2, 0.1, 0.95);
      sh.place(spacing / 2, 0.1, -0.95);
    } else {
      (he ?? sh)?.place(0, 0.1, 0);
    }
    this.updateGaze();
  }

  private updateGaze() {
    const he = this.slots.hero;
    const sh = this.slots.heroine;
    if (he && sh) {
      he.lookPoint.copy(sh.eyesWorld(new THREE.Vector3()));
      sh.lookPoint.copy(he.eyesWorld(new THREE.Vector3()));
    } else {
      const a = he ?? sh;
      if (a) a.lookPoint.copy(this.camera.position);
    }
  }

  /** Make an actor look at the camera (true) or at the scene partner (false). */
  lookAtCamera = new Set<string>();

  setExpression(id: string, e: ExpressionName) {
    this.actor(id)?.setExpression(e);
  }

  setOutfit(id: string, outfit: string) {
    this.actor(id)?.setOutfit(outfit);
  }

  setHair(id: string, hair: string) {
    this.actor(id)?.setHair(hair);
  }

  shot(spec: ShotSpec, ease = 0) {
    this.shots.cut(spec, ease);
  }

  /** Speak a line: lip-sync from text timing, optional TTS. Resolves when finished. */
  line(id: string, text: string, opts: LineOptions = {}): Promise<void> {
    const a = this.actor(id);
    if (!a) return Promise.resolve();
    if (opts.expression) a.setExpression(opts.expression);
    if (opts.gesture !== undefined) a.setGesture(opts.gesture);
    this.speaker = a;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.speaker = null;
        resolve();
      };
      const rate = opts.rate ?? 4.3;
      a.say(text, { rate, onEnd: finish });
      if (opts.tts && 'speechSynthesis' in window && this.ttsVoices.length) {
        const u = new SpeechSynthesisUtterance(text.replace(/[…—]/g, '，'));
        u.voice = this.ttsVoices[0];
        u.lang = u.voice.lang;
        u.pitch = a.look.voice.pitch;
        u.rate = a.look.voice.rate * (rate / 4.3);
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }
    });
  }

  onFrame(fn: (dt: number) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.tick(Math.min(this.clock.getDelta(), 1 / 20));
    };
    loop();
  }

  stop() {
    this.running = false;
  }

  /** Advance one frame (also used by deterministic screenshot capture). */
  tick(dt: number) {
    const t0 = performance.now();
    this.elapsed += dt;
    this.updateGaze();
    for (const id of this.lookAtCamera) this.actor(id)?.lookPoint.copy(this.camera.position);
    // in single close-ups, let the subject's eyes favour the lens a little (beauty read)
    const cur = this.shots.current;
    if (cur.subject && (cur.kind === 'cu' || cur.kind === 'ecu' || cur.kind === 'low')) {
      const a = this.actor(cur.subject);
      if (a) a.lookPoint.lerp(this.camera.position, 0.45);
    }
    for (const a of this.actors()) a.update(dt);
    this.stage.update(dt, this.elapsed);
    this.shots.update(dt, this.post);
    this.stage.faceCamera(this.camera);
    for (const fn of this.listeners) fn(dt);
    this.post.draw(this.elapsed, this.stage.scene, this.camera);
    this.frameMs = performance.now() - t0;
  }
}
