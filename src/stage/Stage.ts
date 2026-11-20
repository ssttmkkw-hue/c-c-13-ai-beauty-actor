import * as THREE from 'three';
import { paintBackdrop, PRESETS, type BackdropId, type LightPreset } from './backdrops';

/**
 * The set: a curved painted cyclorama, a soft-lit circular stage, a key /
 * fill / back light rig tuned for MToon, blob shadows, and drifting
 * particles (petals, light motes or sparkles).
 */
export class Stage {
  readonly scene = new THREE.Scene();
  readonly key = new THREE.DirectionalLight();
  readonly fill = new THREE.DirectionalLight();
  readonly back = new THREE.DirectionalLight();
  readonly hemi = new THREE.HemisphereLight();
  backdropId: BackdropId = 'night';
  preset: LightPreset = PRESETS.night;
  private cyclo: THREE.Mesh;
  private cycloMat: THREE.MeshBasicMaterial;
  private floorMat: THREE.ShaderMaterial;
  private textures = new Map<BackdropId, THREE.Texture>();
  private particles: THREE.InstancedMesh;
  private particleMat: THREE.MeshBasicMaterial;
  private pData: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; s: number; w: number }[] = [];
  private beams: THREE.Mesh[] = [];
  private shadows: THREE.Mesh[] = [];
  private shadowTex: THREE.Texture;

  constructor() {
    const s = this.scene;
    s.add(this.key, this.fill, this.back, this.hemi);
    this.key.target.position.set(0, 1.2, 0);
    this.fill.target.position.set(0, 1.2, 0);
    this.back.target.position.set(0, 1.2, 0);
    s.add(this.key.target, this.fill.target, this.back.target);

    // curved cyclorama (inside of a cylinder segment)
    const geo = new THREE.CylinderGeometry(9, 9, 9, 64, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    geo.scale(-1, 1, 1); // render inside
    this.cycloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false, side: THREE.FrontSide, toneMapped: false });
    this.cyclo = new THREE.Mesh(geo, this.cycloMat);
    this.cyclo.position.set(0, 3.3, 2.2);
    this.cyclo.renderOrder = -10;
    s.add(this.cyclo);

    // stage floor: radial pool of light + soft edge ring
    this.floorMat = new THREE.ShaderMaterial({
      uniforms: { cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() }, time: { value: 0 } },
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform vec3 cA; uniform vec3 cB; uniform float time;
        void main(){
          vec2 p = vUv - 0.5; float d = length(p) * 2.0;
          vec3 c = mix(cA, cB, smoothstep(0.0, 1.0, d));
          float ring = smoothstep(0.86, 0.9, d) * (1.0 - smoothstep(0.9, 0.94, d));
          c += ring * cA * 0.9;
          float pool = exp(-d * d * 4.0) * 0.16;
          c += pool * mix(vec3(1.0), cA * 2.0, 0.5);
          float a = 1.0 - smoothstep(0.94, 1.0, d);
          gl_FragColor = vec4(c, a);
        }`,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 96), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -5;
    s.add(floor);

    // contact shadow texture
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sctx = sc.getContext('2d')!;
    const sg = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sg.addColorStop(0, 'rgba(20,10,30,0.55)');
    sg.addColorStop(0.5, 'rgba(20,10,30,0.25)');
    sg.addColorStop(1, 'rgba(20,10,30,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 128, 128);
    this.shadowTex = new THREE.CanvasTexture(sc);

    // light beams (fake volumetric cones)
    for (const x of [-1.6, 1.6]) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 7, 32, 1, true),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: { color: { value: new THREE.Color('#ffd6e8') }, strength: { value: 0.08 } },
          vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
          fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform vec3 color; uniform float strength;
            void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float fade = smoothstep(0.0, 0.9, vUv.y); gl_FragColor = vec4(color * f * fade * strength, 1.0); }`,
        }),
      );
      cone.position.set(x, 3.5, -0.6);
      cone.rotation.z = x > 0 ? 0.28 : -0.28;
      this.beams.push(cone);
      s.add(cone);
    }

    // particles
    const pg = new THREE.PlaneGeometry(1, 1);
    this.particleMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, map: this.particleTexture('petal') });
    this.particles = new THREE.InstancedMesh(pg, this.particleMat, 140);
    this.particles.frustumCulled = false;
    s.add(this.particles);
    for (let i = 0; i < 140; i++) {
      this.pData.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 9, Math.random() * 5, -3 + Math.random() * 6),
        v: new THREE.Vector3(),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        s: 0.03 + Math.random() * 0.035,
        w: Math.random() * 10,
      });
    }

    this.setBackdrop('night');
  }

  private particleTexture(kind: 'petal' | 'mote' | 'sparkle') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    if (kind === 'petal') {
      const g = ctx.createLinearGradient(0, 0, 64, 64);
      g.addColorStop(0, '#fff2f6');
      g.addColorStop(1, '#f6a6c1');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(32, 4);
      ctx.bezierCurveTo(60, 18, 52, 52, 32, 60);
      ctx.bezierCurveTo(12, 52, 4, 18, 32, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(28, 4);
      ctx.lineTo(32, 12);
      ctx.lineTo(36, 4);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(kind === 'mote' ? 0.25 : 0.12, 'rgba(255,230,240,0.6)');
      g.addColorStop(1, 'rgba(255,200,230,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      if (kind === 'sparkle') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(31, 2, 2, 60);
        ctx.fillRect(2, 31, 60, 2);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  setBackdrop(id: BackdropId) {
    this.backdropId = id;
    const p = (this.preset = PRESETS[id]);
    let tex = this.textures.get(id);
    if (!tex) {
      tex = new THREE.CanvasTexture(paintBackdrop(id));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.textures.set(id, tex);
    }
    this.cycloMat.map = tex;
    this.cycloMat.color.setScalar(p.bg);
    this.cycloMat.needsUpdate = true;
    this.key.color.set(p.key.color);
    this.key.intensity = p.key.intensity;
    this.key.position.set(...p.key.pos);
    this.fill.color.set(p.fill.color);
    this.fill.intensity = p.fill.intensity;
    this.fill.position.set(...p.fill.pos);
    this.back.color.set(p.back.color);
    this.back.intensity = p.back.intensity;
    this.back.position.set(...p.back.pos);
    this.hemi.color.set(p.hemi.sky);
    this.hemi.groundColor.set(p.hemi.ground);
    this.hemi.intensity = p.hemi.intensity;
    this.scene.fog = new THREE.Fog(p.fog, 9, 26);
    this.scene.background = new THREE.Color(p.fog);
    (this.floorMat.uniforms.cA.value as THREE.Color).set(p.floor[0]);
    (this.floorMat.uniforms.cB.value as THREE.Color).set(p.floor[1]);
    for (const b of this.beams) {
      const m = b.material as THREE.ShaderMaterial;
      m.uniforms.color.value.set(p.back.color);
      m.uniforms.strength.value = id === 'sakura' ? 0.05 : 0.09;
    }
    const kind = p.particles === 'petals' ? 'petal' : p.particles === 'motes' ? 'mote' : 'sparkle';
    this.particleMat.map = this.particleTexture(kind);
    this.particleMat.blending = kind === 'petal' ? THREE.NormalBlending : THREE.AdditiveBlending;
    this.particleMat.needsUpdate = true;
  }

  /** Register a blob shadow that follows an object. */
  addShadow(follow: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.003;
    m.renderOrder = -4;
    m.userData.follow = follow;
    this.shadows.push(m);
    this.scene.add(m);
  }

  removeShadow(follow: THREE.Object3D) {
    this.shadows = this.shadows.filter((m) => {
      if (m.userData.follow === follow) {
        m.removeFromParent();
        return false;
      }
      return true;
    });
  }

  update(dt: number, t: number) {
    const kind = this.preset.particles;
    const dummy = new THREE.Object3D();
    this.pData.forEach((d, i) => {
      if (kind === 'petals') {
        d.v.set(0.25 + Math.sin(t * 0.7 + d.w) * 0.15, -0.32 - Math.sin(d.w) * 0.08, Math.cos(t * 0.5 + d.w) * 0.1);
        d.r.x += dt * 1.7;
        d.r.y += dt * 1.1;
      } else {
        d.v.set(Math.sin(t * 0.3 + d.w) * 0.05, 0.06 + Math.sin(d.w) * 0.03, Math.cos(t * 0.25 + d.w) * 0.04);
      }
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < -0.1) d.p.y = 5;
      if (d.p.y > 5) d.p.y = 0;
      if (d.p.x > 4.5) d.p.x = -4.5;
      dummy.position.copy(d.p);
      if (kind === 'petals') dummy.rotation.copy(d.r);
      else dummy.rotation.set(0, 0, 0);
      const tw = kind === 'petals' ? 1 : 0.6 + 0.4 * Math.sin(t * 2 + d.w * 3);
      dummy.scale.setScalar(d.s * (kind === 'petals' ? 1 : 0.7) * tw);
      dummy.updateMatrix();
      this.particles.setMatrixAt(i, dummy.matrix);
    });
    this.particles.instanceMatrix.needsUpdate = true;
    for (const m of this.shadows) {
      const f = m.userData.follow as THREE.Object3D;
      m.position.x = f.position.x;
      m.position.z = f.position.z;
    }
  }

  /** Billboard flat particles (motes/sparkles) toward the camera. */
  faceCamera(cam: THREE.Camera) {
    if (this.preset.particles === 'petals') return;
    const dummy = new THREE.Object3D();
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.pData.length; i++) {
      this.particles.getMatrixAt(i, m);
      dummy.position.setFromMatrixPosition(m);
      dummy.scale.setFromMatrixScale(m);
      dummy.quaternion.copy(cam.quaternion);
      dummy.updateMatrix();
      this.particles.setMatrixAt(i, dummy.matrix);
    }
  }
}
