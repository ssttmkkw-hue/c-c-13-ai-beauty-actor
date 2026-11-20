import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';
import { BeautyMaterials } from './beautyMaterials';
import { EXPRESSIONS, type ExpressionName } from './expressions';
import { POSES, type Pose, type Euler3 } from './poses';
import { buildVisemeTrack, sampleVisemes, type Viseme, type VisemeTrack } from './lipsync';
import type { CharacterLook } from './looks';

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const EMO_KEYS = ['happy', 'relaxed', 'sad', 'angry', 'surprised'] as const;
type EmoKey = (typeof EMO_KEYS)[number];
const VISEMES: Viseme[] = ['aa', 'ih', 'ou', 'ee', 'oh'];
const PROCEDURAL_BONES: VRMHumanBoneName[] = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftShoulder', 'rightShoulder'];

function damp(a: number, b: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** Smooth 1D value noise for organic micro-motion. */
function noise1(t: number, seed: number) {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number) => {
    const x = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  const u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}

export interface SayOptions {
  /** Syllables per second. */
  rate?: number;
  /** Called when the mouth track ends. */
  onEnd?: () => void;
}

/**
 * One beautiful VRM actor: loading, beauty materials, outfits, expressions,
 * blink, breathing, gaze, wind in the hair, gestures and lip-sync.
 */
export class BeautyActor {
  readonly root = new THREE.Group();
  readonly gazeTarget = new THREE.Object3D();
  vrm!: VRM;
  mats!: BeautyMaterials;
  isVRM0 = false;

  expression: ExpressionName = 'neutral';
  outfitId = '';
  hairId = '';
  poseId = 'idle';
  /** Optional explicit gesture that overrides the expression's pose. */
  gesture: string | null = null;

  /** World-space point the actor looks at when gaze = partner. */
  lookPoint = new THREE.Vector3(0, 1.4, 3);

  private emo: Record<EmoKey, number> = { happy: 0, relaxed: 0, sad: 0, angry: 0, surprised: 0 };
  private vis: Record<Viseme, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private visTarget: Record<Viseme, number> = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
  private blushV = 0;
  private hatchV = 0;
  private headV = new THREE.Vector3();
  private sparkleV = 1;
  private blinkT = 2;
  private blinkPhase = -1;
  private time = Math.random() * 100;
  private seed = Math.random() * 100;
  private speech: { track: VisemeTrack; t: number; onEnd?: () => void } | null = null;
  private poseCur = new Map<string, THREE.Quaternion>();
  private poseBlend = 1;
  private posePrev = new Map<string, THREE.Quaternion>();
  private springBase: { joint: { settings: { gravityDir: THREE.Vector3; gravityPower: number } }; dir: THREE.Vector3; power: number }[] = [];
  private gazeJitter = new THREE.Vector3();
  private gazeJitterT = 0;
  private expressionNames = new Map<string, string>();
  wind = 1;
  speaking = false;
  /** Freeze lip-sync time (play paused). */
  paused = false;

  constructor(readonly look: CharacterLook) {}

  async load(onProgress?: (p: number) => void) {
    const gltf = await loader.loadAsync(this.look.model, (e) => {
      if (e.total) onProgress?.(e.loaded / e.total);
    });
    const vrm = gltf.userData.vrm as VRM;
    this.isVRM0 = vrm.meta.metaVersion === '0';
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    vrm.scene.traverse((o) => {
      o.frustumCulled = false;
    });
    this.vrm = vrm;
    this.root.add(vrm.scene);
    this.root.add(this.gazeTarget);
    if (this.look.scale) vrm.scene.scale.setScalar(this.look.scale);
    if (vrm.lookAt) {
      vrm.lookAt.target = this.gazeTarget;
      vrm.lookAt.autoUpdate = true;
    }
    this.mats = new BeautyMaterials(vrm, this.look);
    // resolve expression names (VRoid VRM0 exports "Surprised" as a custom clip)
    const em = vrm.expressionManager;
    if (em) {
      for (const k of [...EMO_KEYS, ...VISEMES, 'blink', 'blinkLeft', 'blinkRight']) {
        const cand = [k, k[0].toUpperCase() + k.slice(1)];
        const found = cand.find((c) => em.getExpression(c));
        if (found) this.expressionNames.set(k, found);
      }
    }
    // spring-bone wind
    const sbm = vrm.springBoneManager;
    if (sbm) {
      for (const j of sbm.joints) {
        const s = (j as unknown as { settings: { gravityDir: THREE.Vector3; gravityPower: number } }).settings;
        this.springBase.push({ joint: j as never, dir: s.gravityDir.clone(), power: s.gravityPower });
      }
    }
    this.setOutfit(this.look.outfits[0].id);
    this.setHair(this.look.hairs[0].id);
    this.applyPoseImmediate(POSES.idle);
    vrm.update(0);
    vrm.springBoneManager?.reset();
    return this;
  }

  // ---------------------------------------------------------------- looks
  setOutfit(id: string) {
    if (!this.look.outfits.find((o) => o.id === id)) return;
    this.outfitId = id;
    this.applyLooks();
  }

  setHair(id: string) {
    if (!this.look.hairs.find((o) => o.id === id)) return;
    this.hairId = id;
    this.applyLooks();
  }

  private applyLooks() {
    if (!this.mats) return;
    const hair = this.look.hairs.find((h) => h.id === this.hairId)?.ops ?? [];
    const outfit = this.look.outfits.find((o) => o.id === this.outfitId)?.ops ?? [];
    this.mats.applyVariants(hair, outfit);
  }

  // ---------------------------------------------------------- performance
  setExpression(name: ExpressionName) {
    if (!EXPRESSIONS[name]) return;
    this.expression = name;
    const pose = this.gesture ?? EXPRESSIONS[name].pose;
    this.setPose(pose);
  }

  /** Force a gesture (pose id) regardless of expression; null returns to the expression's pose. */
  setGesture(id: string | null) {
    this.gesture = id && POSES[id] ? id : null;
    this.setPose(this.gesture ?? EXPRESSIONS[this.expression].pose);
  }

  private setPose(id: string) {
    if (!POSES[id] || id === this.poseId) return;
    this.poseId = id;
    // snapshot current blended rotations as the "from" pose
    this.posePrev = new Map();
    for (const [bone, q] of this.poseCur) this.posePrev.set(bone, q.clone());
    this.poseBlend = 0;
  }

  say(text: string, opts: SayOptions = {}) {
    const track = buildVisemeTrack(text, opts.rate ?? 4.3);
    this.speech = { track, t: 0, onEnd: opts.onEnd };
    this.speaking = true;
    return track.duration;
  }

  stopSpeaking() {
    this.speech = null;
    this.speaking = false;
  }

  /** Position + yaw on stage. */
  place(x: number, z: number, yaw: number) {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = yaw;
    // re-seat spring bones so hair doesn't whip after a teleport
    this.root.updateMatrixWorld(true);
    this.vrm?.springBoneManager?.reset();
  }

  headWorld(out = new THREE.Vector3()) {
    const head = this.vrm?.humanoid.getNormalizedBoneNode('head');
    if (!head) return out.copy(this.root.position).setY(1.4);
    head.getWorldPosition(out);
    return out;
  }

  /** Approximate eye position (between the eyes). */
  eyesWorld(out = new THREE.Vector3()) {
    const l = this.vrm?.humanoid.getRawBoneNode('leftEye');
    const r = this.vrm?.humanoid.getRawBoneNode('rightEye');
    if (l && r) {
      const a = new THREE.Vector3();
      l.getWorldPosition(a);
      r.getWorldPosition(out);
      return out.add(a).multiplyScalar(0.5);
    }
    return this.headWorld(out).add(new THREE.Vector3(0, 0.06, 0));
  }

  forwardWorld(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
  }

  // --------------------------------------------------------------- update
  private toModelSpace(e: Euler3): Euler3 {
    return this.isVRM0 ? [-e[0], e[1], -e[2]] : e;
  }

  private applyPoseImmediate(pose: Pose) {
    for (const [bone, e] of Object.entries(pose)) {
      if (!e) continue;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...this.toModelSpace(e)));
      this.poseCur.set(bone, q);
    }
    this.posePrev = new Map(this.poseCur);
  }

  private setExpr(key: string, w: number) {
    const name = this.expressionNames.get(key);
    if (name) this.vrm.expressionManager?.setValue(name, w);
  }

  update(dt: number) {
    if (!this.vrm) return;
    this.time += dt;
    const t = this.time;
    const preset = EXPRESSIONS[this.expression];
    const humanoid = this.vrm.humanoid;

    // ---- pose blend (ease-in-out over ~0.55s)
    this.poseBlend = Math.min(1, this.poseBlend + dt / 0.55);
    const k = this.poseBlend < 0.5 ? 2 * this.poseBlend * this.poseBlend : 1 - Math.pow(-2 * this.poseBlend + 2, 2) / 2;
    const target = POSES[this.poseId];
    const allBones = new Set([...Object.keys(target), ...this.posePrev.keys()]);
    const tmpQ = new THREE.Quaternion();
    for (const bone of allBones) {
      const e = target[bone];
      const to = e ? tmpQ.setFromEuler(new THREE.Euler(...this.toModelSpace(e))) : new THREE.Quaternion();
      const from = this.posePrev.get(bone) ?? new THREE.Quaternion();
      const cur = this.poseCur.get(bone) ?? new THREE.Quaternion();
      cur.slerpQuaternions(from, to, k);
      this.poseCur.set(bone, cur);
    }
    // reset every procedurally driven bone, then lay the pose on top
    for (const bone of PROCEDURAL_BONES) humanoid.getNormalizedBoneNode(bone)?.quaternion.identity();
    for (const [bone, q] of this.poseCur) {
      const node = humanoid.getNormalizedBoneNode(bone as VRMHumanBoneName);
      if (node) node.quaternion.copy(q);
    }

    // ---- breathing + idle sway (applied on top of the pose)
    const sx = this.isVRM0 ? -1 : 1; // x/z sign for VRM0
    const breath = Math.sin(t * ((Math.PI * 2) / 4.2));
    const add = (bone: VRMHumanBoneName, x: number, y: number, z: number) => {
      const n = humanoid.getNormalizedBoneNode(bone);
      if (!n) return;
      n.quaternion.multiply(tmpQ.setFromEuler(new THREE.Euler(x * sx, y, z * sx)));
    };
    add('chest', -breath * 0.012, 0, 0);
    add('upperChest', -breath * 0.01, 0, 0);
    add('leftShoulder', 0, 0, breath * 0.012);
    add('rightShoulder', 0, 0, -breath * 0.012);
    add('spine', noise1(t * 0.25, this.seed) * 0.012, noise1(t * 0.2, this.seed + 3) * 0.02, noise1(t * 0.3, this.seed + 1) * 0.015);
    add('hips', 0, noise1(t * 0.15, this.seed + 7) * 0.025, noise1(t * 0.18, this.seed + 9) * 0.012);

    // ---- head attitude: expression + micro motion + speech nods
    const ht = new THREE.Vector3(...preset.head);
    let nod = 0;
    if (this.speech) {
      const env = this.vis.aa + this.vis.oh + this.vis.ee * 0.6;
      nod = env * 0.025 + Math.sin(t * 5.3) * 0.006 * Math.min(1, env * 2);
    }
    this.headV.x = damp(this.headV.x, ht.x, 4, dt);
    this.headV.y = damp(this.headV.y, ht.y, 4, dt);
    this.headV.z = damp(this.headV.z, ht.z, 4, dt);
    // head pitch +x = down; roll stored as z; yaw y
    add('neck', this.headV.x * 0.4 + noise1(t * 0.4, this.seed + 11) * 0.015, this.headV.z * 0.4, -this.headV.y * 0.4);
    add('head', this.headV.x * 0.6 + nod + noise1(t * 0.5, this.seed + 13) * 0.02, this.headV.z * 0.6 + noise1(t * 0.33, this.seed + 17) * 0.03, -this.headV.y * 0.6 + noise1(t * 0.27, this.seed + 19) * 0.02);

    // ---- expressions
    const speakDamp = this.speech ? 0.75 : 1;
    for (const key of EMO_KEYS) {
      const w = (preset.weights[key] ?? 0) * (key === 'happy' || key === 'surprised' ? speakDamp : 1);
      this.emo[key] = damp(this.emo[key], w, 6, dt);
      this.setExpr(key, this.emo[key]);
    }
    this.blushV = damp(this.blushV, preset.blush, 2.2, dt);
    this.hatchV = damp(this.hatchV, preset.blush > 0.8 ? 1 : 0, 2, dt);
    this.mats.blush.amount.value = this.blushV;
    this.mats.blush.hatch.value = this.hatchV;
    this.sparkleV = damp(this.sparkleV, preset.sparkle, 3, dt);
    this.mats.setSparkle(this.sparkleV);

    // ---- blink (suppressed while eyes are already smiling-closed)
    this.blinkT -= dt * preset.blinkRate;
    if (this.blinkT <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkT = 2.2 + Math.random() * 3.5;
      if (Math.random() < 0.18) this.blinkT = 0.35; // occasional double blink
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      blink = this.blinkPhase < 0.45 ? this.blinkPhase / 0.45 : Math.max(0, 1 - (this.blinkPhase - 0.45) / 0.55);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    const eyeClosedBias = this.emo.happy * 0.9;
    this.setExpr('blink', Math.min(1 - eyeClosedBias, blink));

    // ---- lip-sync
    if (this.speech) {
      if (!this.paused) this.speech.t += dt;
      sampleVisemes(this.speech.track, this.speech.t, this.visTarget);
      if (this.speech.t > this.speech.track.duration) {
        const cb = this.speech.onEnd;
        this.speech = null;
        this.speaking = false;
        cb?.();
      }
    } else {
      for (const v of VISEMES) this.visTarget[v] = 0;
    }
    for (const v of VISEMES) {
      this.vis[v] = damp(this.vis[v], this.visTarget[v] * preset.mouth, 22, dt);
      this.setExpr(v, this.vis[v] * (v === 'aa' ? 0.8 : 0.7));
    }

    // ---- gaze
    this.gazeJitterT -= dt;
    if (this.gazeJitterT <= 0) {
      // micro-saccades keep the eyes alive
      this.gazeJitter.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.04, 0);
      this.gazeJitterT = 0.6 + Math.random() * 1.8;
    }
    const g = new THREE.Vector3().copy(this.lookPoint);
    const head = this.headWorld(new THREE.Vector3());
    const fwd = this.forwardWorld(new THREE.Vector3());
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    if (preset.gaze === 'away') g.copy(head).addScaledVector(fwd, 1.2).addScaledVector(right, -0.5).add(new THREE.Vector3(0, -0.45, 0));
    else if (preset.gaze === 'down') g.copy(head).addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, -0.6, 0));
    else if (preset.gaze === 'up') g.copy(head).addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, 0.5, 0));
    g.add(this.gazeJitter);
    this.root.worldToLocal(g);
    this.gazeTarget.position.lerp(g, 1 - Math.exp(-12 * dt));

    // ---- wind in the hair & skirt
    const w = this.wind;
    // zero-mean gusts: a gentle sway, never a constant sideways pull
    const wind = new THREE.Vector3(
      noise1(t * 0.45, this.seed + 21) * 0.035 * w,
      Math.max(0, noise1(t * 0.3, this.seed + 25)) * 0.01 * w,
      noise1(t * 0.37, this.seed + 23) * 0.025 * w,
    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.root.rotation.y);
    for (const s of this.springBase) {
      const v = s.dir.clone().multiplyScalar(s.power).add(wind);
      const len = v.length();
      s.joint.settings.gravityPower = len;
      if (len > 1e-5) s.joint.settings.gravityDir.copy(v.divideScalar(len));
    }

    this.vrm.update(dt);
  }

  dispose() {
    this.root.removeFromParent();
    VRMUtils.deepDispose(this.vrm.scene);
  }
}
