import * as THREE from 'three';
import type { BeautyActor } from '../actor/BeautyActor';

/**
 * Camera language of AI 漫剧 — beauty-first framing:
 *  - long lenses (narrow FOV) for faces: flattens features, flatters the jaw
 *  - three-quarter angles rather than flat frontal
 *  - eyes on the upper third, generous head-room only in wides
 *  - slow push-ins while a line lands; hard cuts between shots
 *  - shallow depth of field so the backdrop melts into bokeh
 */

export type ShotKind = 'wide' | 'two' | 'cu' | 'ecu' | 'ots' | 'low' | 'full' | 'profile';

export interface ShotSpec {
  kind: ShotKind;
  /** Subject actor id for single shots; for ots the subject is the one faced. */
  subject?: string;
  /** Push-in amount over the shot (fraction of distance). */
  push?: number;
  /** Lateral drift (m). */
  drift?: number;
}

export const SHOT_LABELS: Record<ShotKind, string> = {
  wide: '全景',
  two: '双人中景',
  cu: '特写',
  ecu: '大特写',
  ots: '过肩',
  low: '仰拍',
  full: '全身',
  profile: '侧颜',
};

interface Framing {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  focus: number;
  aperture: number;
  letterbox: number;
}

export class ShotDirector {
  current: ShotSpec = { kind: 'wide' };
  private t = 0;
  private from: Framing | null = null;
  private blend = 1;
  private blendDur = 0;
  handheld = 1;

  constructor(private camera: THREE.PerspectiveCamera, private getActors: () => BeautyActor[]) {}

  cut(spec: ShotSpec, ease = 0) {
    if (ease > 0) {
      this.from = this.snapshot();
      this.blend = 0;
      this.blendDur = ease;
    } else {
      this.blend = 1;
      this.from = null;
    }
    this.current = spec;
    this.t = 0;
  }

  private snapshot(): Framing {
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).add(this.camera.position);
    return { pos: this.camera.position.clone(), look, fov: this.camera.fov, focus: 3, aperture: 0.001, letterbox: 0 };
  }

  private actor(id?: string) {
    const actors = this.getActors();
    return actors.find((a) => a.look.id === id) ?? actors[0];
  }

  private partner(a: BeautyActor) {
    return this.getActors().find((x) => x !== a);
  }

  private frame(spec: ShotSpec): Framing {
    const actors = this.getActors();
    const out: Framing = { pos: new THREE.Vector3(0, 1.4, 6), look: new THREE.Vector3(0, 1.1, 0), fov: 30, focus: 6, aperture: 0.0006, letterbox: 0 };
    if (!actors.length) return out;
    const a = this.actor(spec.subject);
    const eyes = a.eyesWorld(new THREE.Vector3());
    const fwd = a.forwardWorld(new THREE.Vector3());
    const p = this.partner(a);
    // 3/4 direction: rotate the actor's forward toward the audience (+Z)
    const toAudience = new THREE.Vector3(0, 0, 1);
    const threeQuarter = fwd.clone().lerp(toAudience, 0.68).normalize();
    const distFor = (frameH: number, fov: number) => frameH / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));

    switch (spec.kind) {
      case 'wide': {
        const c = new THREE.Vector3();
        actors.forEach((x) => c.add(x.root.position));
        c.divideScalar(actors.length);
        out.fov = 32;
        out.pos.set(c.x, 1.45, 6.4);
        out.look.set(c.x, 1.05, 0);
        out.focus = 6.3;
        out.aperture = 0.0002;
        out.letterbox = 0.06;
        break;
      }
      case 'two': {
        const c = new THREE.Vector3();
        const e = new THREE.Vector3();
        actors.forEach((x) => c.add(x.eyesWorld(e)));
        c.divideScalar(actors.length);
        out.fov = 24;
        const d = distFor(1.15, out.fov);
        out.pos.set(c.x + 0.15, c.y - 0.05, c.z + d);
        out.look.set(c.x, c.y - 0.28, c.z);
        out.focus = d;
        out.aperture = 0.0009;
        out.letterbox = 0.06;
        break;
      }
      case 'cu':
      case 'ecu':
      case 'low':
      case 'full':
      case 'profile': {
        const fov = spec.kind === 'ecu' ? 14 : spec.kind === 'cu' ? 18 : spec.kind === 'low' ? 26 : spec.kind === 'profile' ? 20 : 26;
        const frameH = spec.kind === 'ecu' ? 0.24 : spec.kind === 'cu' ? 0.5 : spec.kind === 'low' ? 1.0 : spec.kind === 'profile' ? 0.55 : 1.9;
        const d = distFor(frameH, fov);
        const dir = spec.kind === 'profile' ? fwd.clone().lerp(toAudience, 0.12).normalize() : threeQuarter;
        // profile: camera perpendicular to the actor's facing
        if (spec.kind === 'profile') dir.set(dir.z, 0, -dir.x).multiplyScalar(Math.sign(fwd.x || 1) * -1).lerp(toAudience, 0.25).normalize();
        out.fov = fov;
        const lift = spec.kind === 'low' ? -0.55 : spec.kind === 'full' ? -0.6 : spec.kind === 'ecu' ? 0 : 0.03;
        out.pos.copy(eyes).addScaledVector(dir, d).add(new THREE.Vector3(0, lift, 0));
        // eyes on the upper third: aim slightly below the eyes
        const aimDrop = spec.kind === 'ecu' ? 0.012 : spec.kind === 'cu' ? 0.085 : spec.kind === 'low' ? 0.1 : spec.kind === 'profile' ? 0.08 : 0.72;
        out.look.copy(eyes).add(new THREE.Vector3(0, -aimDrop, 0));
        out.focus = d;
        out.aperture = spec.kind === 'ecu' ? 0.004 : spec.kind === 'cu' ? 0.0032 : spec.kind === 'profile' ? 0.003 : 0.0014;
        out.letterbox = spec.kind === 'full' ? 0.0 : 0.06;
        break;
      }
      case 'ots': {
        // over the partner's shoulder, looking at the subject
        if (!p) return this.frame({ kind: 'cu', subject: a.look.id });
        const pe = p.eyesWorld(new THREE.Vector3());
        const toSubj = eyes.clone().sub(pe).setY(0).normalize();
        const side = new THREE.Vector3(toSubj.z, 0, -toSubj.x);
        // choose the shoulder that's closer to the audience
        if (side.z < 0) side.negate();
        out.fov = 22;
        out.pos.copy(pe).addScaledVector(toSubj, -0.55).addScaledVector(side, 0.32).add(new THREE.Vector3(0, 0.02, 0));
        out.look.copy(eyes).add(new THREE.Vector3(0, -0.08, 0));
        out.focus = out.pos.distanceTo(eyes);
        out.aperture = 0.0026;
        out.letterbox = 0.06;
        break;
      }
    }
    return out;
  }

  update(dt: number, post?: { setFocus(d: number, a: number): void; setLetterbox(v: number): void }) {
    this.t += dt;
    const f = this.frame(this.current);
    // slow push-in + drift
    const push = this.current.push ?? (this.current.kind === 'wide' ? 0.04 : 0.06);
    const k = 1 - Math.exp(-this.t / 7);
    const toLook = f.look.clone().sub(f.pos);
    f.pos.addScaledVector(toLook, push * k);
    f.focus *= 1 - push * k;
    const drift = this.current.drift ?? 0.05;
    const right = new THREE.Vector3().crossVectors(toLook, new THREE.Vector3(0, 1, 0)).normalize();
    f.pos.addScaledVector(right, drift * (k - 0.5));
    // subtle handheld breathing
    const h = this.handheld * (this.current.kind === 'ecu' ? 0.0015 : 0.004);
    f.pos.x += Math.sin(this.t * 0.9) * h;
    f.pos.y += Math.sin(this.t * 1.3 + 1) * h * 0.7;

    if (this.blend < 1 && this.from) {
      this.blend = Math.min(1, this.blend + dt / this.blendDur);
      const e = this.blend * this.blend * (3 - 2 * this.blend);
      f.pos.lerpVectors(this.from.pos, f.pos, e);
      f.look.lerpVectors(this.from.look, f.look, e);
      f.fov = THREE.MathUtils.lerp(this.from.fov, f.fov, e);
    }
    this.camera.position.copy(f.pos);
    this.camera.lookAt(f.look);
    if (Math.abs(this.camera.fov - f.fov) > 1e-3) {
      this.camera.fov = f.fov;
      this.camera.updateProjectionMatrix();
    }
    post?.setFocus(f.focus, f.aperture);
    post?.setLetterbox(f.letterbox);
  }
}
