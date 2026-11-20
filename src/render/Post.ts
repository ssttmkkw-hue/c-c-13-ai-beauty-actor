import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { LightPreset } from '../stage/backdrops';

/**
 * 漫剧 colour pipeline:
 *   scene (MSAA) → depth of field → soft bloom → "beauty grade" → output
 * The grade pass does lift/gain colour balance, saturation, contrast, a
 * soft-focus "glow" (Orton-style highlight diffusion), warm vignette and a
 * whisper of film grain — the cinematic polish of AI drama key art.
 */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    lift: { value: new THREE.Vector3() },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    saturation: { value: 1 },
    contrast: { value: 1 },
    exposure: { value: 1 },
    vignette: { value: 0.3 },
    vignetteColor: { value: new THREE.Color('#1a0f22') },
    grain: { value: 0.012 },
    time: { value: 0 },
    glow: { value: 0.1 },
    aspect: { value: 1.6 },
    letterbox: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec3 lift; uniform vec3 gain; uniform float saturation; uniform float contrast;
    uniform float exposure; uniform float vignette; uniform vec3 vignetteColor; uniform float grain; uniform float time;
    uniform float glow; uniform float aspect; uniform float letterbox;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb * exposure;
      // soft-focus glow: blur of highlights blended with screen
      vec2 px = vec2(1.0 / 900.0 * aspect, 1.0 / 900.0) * 2.5;
      vec3 b = vec3(0.0);
      b += texture2D(tDiffuse, vUv + px * vec2( 1.0, 0.0)).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2(-1.0, 0.0)).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2( 0.0, 1.0)).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2( 0.0,-1.0)).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2( 0.7, 0.7) * 2.0).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2(-0.7, 0.7) * 2.0).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2( 0.7,-0.7) * 2.0).rgb;
      b += texture2D(tDiffuse, vUv + px * vec2(-0.7,-0.7) * 2.0).rgb;
      b /= 8.0;
      vec3 bl = max(b * exposure - 0.9, 0.0) * 2.5;
      c = 1.0 - (1.0 - c) * (1.0 - bl * glow);
      // lift / gain (linear)
      c = c * gain + lift * (1.0 - c);
      // contrast around mid grey
      c = (c - 0.18) * contrast + 0.18;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      // vignette (tinted, oval)
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0) / max(aspect, 1.0);
      float v = smoothstep(0.35, 0.95, length(q) * 1.3);
      c = mix(c, c * vignetteColor * 2.0, v * vignette);
      // grain
      float n = hash(vUv * 1000.0 + time) - 0.5;
      c += n * grain * (0.6 + 0.4 * (1.0 - l));
      // cinematic letterbox
      float lb = step(vUv.y, letterbox) + step(1.0 - letterbox, vUv.y);
      c = mix(c, vec3(0.0), lb);
      gl_FragColor = vec4(max(c, 0.0), src.a);
    }`,
};

export class Post {
  composer: EffectComposer;
  render: RenderPass;
  bokeh: BokehPass;
  bloom: UnrealBloomPass;
  grade: ShaderPass;
  output: OutputPass;
  enabled = true;
  dofEnabled = true;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, w: number, h: number) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.render = new RenderPass(scene, camera);
    this.bokeh = new BokehPass(scene, camera, { focus: 2.0, aperture: 0.002, maxblur: 0.008 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.4, 0.55, 0.75);
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.composer.addPass(this.render);
    this.composer.addPass(this.bokeh);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.grade.uniforms.aspect.value = w / h;
  }

  setPreset(p: LightPreset) {
    const u = this.grade.uniforms;
    u.lift.value.set(...p.grade.lift);
    u.gain.value.set(...p.grade.gain);
    u.saturation.value = p.grade.saturation;
    u.contrast.value = p.grade.contrast;
    u.exposure.value = p.grade.exposure;
    u.vignette.value = p.grade.vignette;
    this.bloom.strength = p.bloom.strength;
    this.bloom.radius = p.bloom.radius;
    this.bloom.threshold = p.bloom.threshold;
  }

  setFocus(distance: number, aperture: number) {
    const u = this.bokeh.uniforms as unknown as Record<string, { value: number }>;
    u.focus.value = distance;
    u.aperture.value = aperture;
    u.maxblur.value = 0.012;
  }

  setLetterbox(v: number) {
    this.grade.uniforms.letterbox.value = v;
  }

  draw(time: number, scene: THREE.Scene, camera: THREE.Camera) {
    if (!this.enabled) {
      this.renderer.render(scene, camera);
      return;
    }
    this.bokeh.enabled = this.dofEnabled;
    this.grade.uniforms.time.value = time % 100;
    this.composer.render();
  }
}
