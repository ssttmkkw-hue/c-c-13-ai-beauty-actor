import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { MToonMaterial } from '@pixiv/three-vrm';
import type { CharacterLook, MaterialOp } from './looks';
import { applyRecipe, canvasTextureLike, imageToCanvas, makeBlushMask } from './textureOps';

/**
 * Material layer of the beauty actor:
 *  - finds MToon materials (surface + outline clones)
 *  - applies the "beauty tuning" (rosy skin shadows, soft toony ramp, warm
 *    outlines, fresnel rim, sparkling eye highlights)
 *  - injects a blush channel into the face shader
 *  - applies outfit / hair variants as runtime texture recolours
 */

type M = MToonMaterial & THREE.Material;

interface Original {
  map: THREE.Texture | null;
  shadeMultiplyTexture: THREE.Texture | null;
  color: THREE.Color;
  shade: THREE.Color;
  outline: THREE.Color;
  matcap: THREE.Color;
  emissive: THREE.Color;
}

export interface BlushHandle {
  amount: { value: number };
  hatch: { value: number };
}

export function isMToon(m: THREE.Material): m is M {
  return (m as unknown as { isMToonMaterial?: boolean }).isMToonMaterial === true;
}

export class BeautyMaterials {
  readonly all: M[] = [];
  private originals = new Map<M, Original>();
  private canvasCache = new Map<string, THREE.Texture>();
  private sourceCanvas = new Map<THREE.Texture, HTMLCanvasElement>();
  blush: BlushHandle = { amount: { value: 0 }, hatch: { value: 0 } };
  private highlight: M[] = [];
  private irises: M[] = [];
  rimStrength = 1;

  constructor(vrm: VRM, private look: CharacterLook) {
    const seen = new Set<M>();
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) if (isMToon(m) && !seen.has(m)) { seen.add(m); this.all.push(m); }
    });
    for (const m of this.all) {
      this.originals.set(m, {
        map: m.map ?? null,
        shadeMultiplyTexture: m.shadeMultiplyTexture ?? null,
        color: m.color.clone(),
        shade: m.shadeColorFactor.clone(),
        outline: m.outlineColorFactor.clone(),
        matcap: m.matcapFactor.clone(),
        emissive: m.emissive.clone(),
      });
    }
    this.tune();
    this.injectBlush();
  }

  private isOutline(m: M) {
    return (m as unknown as { isOutline?: boolean }).isOutline === true;
  }

  private tune() {
    const skinShade = new THREE.Color(this.look.skinShade);
    for (const m of this.all) {
      const n = m.name;
      const outline = this.isOutline(m);
      if (/SKIN/.test(n)) {
        // rosy, soft-edged skin shadow — the core of the anime "beauty" read
        m.shadeColorFactor.copy(skinShade);
        m.shadingToonyFactor = 0.82;
        m.shadingShiftFactor = -0.08;
        if (!outline) m.parametricRimColorFactor.set('#ffd6cc');
        m.parametricRimFresnelPowerFactor = 4.5;
        m.parametricRimLiftFactor = 0.0;
        m.rimLightingMixFactor = 0.6;
        // warm brown-rose line instead of black: reads softer and more expensive
        m.outlineColorFactor.set('#6b3a3a');
      } else if (/HAIR/.test(n)) {
        m.shadingToonyFactor = 0.9;
        m.parametricRimColorFactor.set(this.look.hairRim);
        m.parametricRimFresnelPowerFactor = 3.2;
        m.parametricRimLiftFactor = 0.05;
        m.rimLightingMixFactor = 0.7;
      } else if (/CLOTH/.test(n)) {
        m.shadingToonyFactor = 0.85;
        m.parametricRimColorFactor.set('#e8e4ff');
        m.parametricRimFresnelPowerFactor = 4.0;
        m.parametricRimLiftFactor = 0.0;
        m.rimLightingMixFactor = 0.8;
      }
      if (/EyeHighlight/.test(n)) this.highlight.push(m);
      if (/EyeIris/.test(n)) this.irises.push(m);
      // a slightly thinner outline flatters close-ups on 1080p screens
      if (outline) m.outlineWidthFactor *= 0.85;
    }
    for (const m of this.highlight) {
      m.emissive.set('#ffffff');
      m.emissiveIntensity = 3.0;
    }
    for (const m of this.irises) {
      // "jewel" eyes: a hint of self-illumination keeps irises bright in shade
      m.emissive.set('#ffffff');
      m.emissiveIntensity = 0.0;
      m.emissiveMap = m.map;
      m.needsUpdate = true;
    }
  }

  /** Eye sparkle / iris glow (1 = default). */
  setSparkle(k: number) {
    for (const m of this.highlight) m.emissiveIntensity = 3.0 * k;
    for (const m of this.irises) m.emissiveIntensity = 0.12 * Math.max(0, k - 0.6);
  }

  setRim(color: THREE.Color, strength: number) {
    for (const m of this.all) {
      if (this.isOutline(m)) continue;
      const n = m.name;
      const base = /HAIR/.test(n) ? new THREE.Color(this.look.hairRim) : /SKIN/.test(n) ? new THREE.Color('#ffd6cc') : /CLOTH/.test(n) ? new THREE.Color('#e8e4ff') : null;
      if (!base) continue;
      m.parametricRimColorFactor.copy(base).multiply(color).multiplyScalar(strength * (/HAIR/.test(n) ? 0.35 : /SKIN/.test(n) ? 0.16 : 0.2));
    }
  }

  private injectBlush() {
    const face = this.all.filter((m) => /Face_00_SKIN/.test(m.name) && !this.isOutline(m));
    if (!face.length) return;
    const mask = makeBlushMask(this.look.blush);
    const tint = new THREE.Color('#ff6f86');
    for (const m of face) {
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader, renderer) => {
        prev?.call(m, shader, renderer);
        shader.uniforms.blushMask = { value: mask };
        shader.uniforms.blushAmount = this.blush.amount;
        shader.uniforms.blushHatch = this.blush.hatch;
        shader.uniforms.blushTint = { value: tint };
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform sampler2D blushMask;\nuniform float blushAmount;\nuniform float blushHatch;\nuniform vec3 blushTint;\nvoid main() {')
          .replace(
            'diffuseColor *= sampledDiffuseColor;',
            `diffuseColor *= sampledDiffuseColor;
    {
      vec2 bm = texture2D( blushMask, mapUv ).rg;
      float b = bm.r * blushAmount;
      diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * blushTint, clamp( b * 0.55, 0.0, 1.0 ) );
      diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.3, 0.38 ) * diffuseColor.rgb, clamp( bm.g * blushHatch, 0.0, 1.0 ) * 0.7 );
    }`,
          );
      };
      const prevKey = m.customProgramCacheKey.bind(m);
      m.customProgramCacheKey = () => prevKey() + '|blush';
      m.needsUpdate = true;
    }
  }

  private recolored(src: THREE.Texture, key: string, op: MaterialOp): THREE.Texture {
    const k = key + '|' + JSON.stringify(op.recipe);
    let t = this.canvasCache.get(k);
    if (t) return t;
    let canvas = this.sourceCanvas.get(src);
    if (!canvas) {
      canvas = imageToCanvas(src.image as HTMLCanvasElement);
      this.sourceCanvas.set(src, canvas);
    }
    t = canvasTextureLike(applyRecipe(canvas, op.recipe!), src);
    this.canvasCache.set(k, t);
    return t;
  }

  /** Restore originals, then apply hair ops and outfit ops. */
  applyVariants(...variants: MaterialOp[][]) {
    for (const m of this.all) {
      const o = this.originals.get(m)!;
      if (m.map !== o.map) m.map = o.map;
      if (m.shadeMultiplyTexture !== o.shadeMultiplyTexture) m.shadeMultiplyTexture = o.shadeMultiplyTexture;
      m.color.copy(o.color);
      m.matcapFactor.copy(o.matcap);
      if (!/Eye/.test(m.name)) m.emissive.copy(o.emissive);
      // skin shade is part of the beauty tuning; keep it
      if (!/SKIN/.test(m.name)) m.shadeColorFactor.copy(o.shade);
    }
    for (const ops of variants) {
      for (const op of ops) {
        for (const m of this.all) {
          if (!op.match.test(m.name)) continue;
          const o = this.originals.get(m)!;
          if (op.recipe && o.map) {
            const t = this.recolored(o.map, m.name.replace(/ \(Outline\)$/, ''), op);
            m.map = t;
            if (o.shadeMultiplyTexture) m.shadeMultiplyTexture = o.shadeMultiplyTexture === o.map ? t : this.recolored(o.shadeMultiplyTexture, m.name + '#shade', op);
            m.color.set('#ffffff');
          }
          if (op.color) m.color.set(op.color);
          if (op.shade) m.shadeColorFactor.set(op.shade);
          if (op.outline) m.outlineColorFactor.set(op.outline);
          if (op.matcap) m.matcapFactor.set(op.matcap);
          if (op.emissive) m.emissive.set(op.emissive);
          m.needsUpdate = true;
        }
      }
    }
  }
}
