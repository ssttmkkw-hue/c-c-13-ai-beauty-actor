import * as THREE from 'three';

/**
 * Canvas-side texture operations used for costume / hair variants and the
 * blush mask. Everything works on the decoded texture image of the VRM, so the
 * shipped model files stay unmodified (license: modification allowed, but we
 * prefer runtime recolours so one file serves every outfit).
 */

export type RGB = [number, number, number];

/** Gradient stop: luminance (0..1) → colour. */
export type GradientStop = [number, string];

export interface PatternSpec {
  kind: 'sakura' | 'dots' | 'pinstripe' | 'lace' | 'goldTrim';
  color: string;
  /** Optional second colour (flower centre, trim shadow…). */
  color2?: string;
  /** Scale in texture pixels at 1024px. */
  scale?: number;
  /** UV rectangle [u0, v0, u1, v1] (image space, v from top) to confine the pattern. */
  rect?: [number, number, number, number];
  opacity?: number;
}

export interface TextureRecipe {
  /** Gradient map applied on luminance (preserves the painted folds and shading). */
  gradient?: GradientStop[];
  /** How strongly the gradient replaces the original colour (default 1). */
  gradientMix?: number;
  /** Hue-preserving tint: multiply (after gradient). */
  multiply?: string;
  /** Saturation multiplier. */
  saturation?: number;
  patterns?: PatternSpec[];
}

export function hexToRgb(hex: string): RGB {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function buildLut(stops: GradientStop[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  const s = [...stops].sort((a, b) => a[0] - b[0]).map(([t, c]) => [t, hexToRgb(c)] as [number, RGB]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const [t0, c0] = s[k];
    const [t1, c1] = s[Math.min(k + 1, s.length - 1)];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    // smoothstep keeps the gradient creamy, which matters on skin-adjacent cloth
    const g = f * f * (3 - 2 * f);
    for (let ch = 0; ch < 3; ch++) lut[i * 3 + ch] = c0[ch] + (c1[ch] - c0[ch]) * g;
  }
  return lut;
}

export function imageToCanvas(image: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  c.getContext('2d', { willReadFrequently: true })!.drawImage(image, 0, 0);
  return c;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawPattern(ctx: CanvasRenderingContext2D, w: number, h: number, p: PatternSpec) {
  const k = w / 1024;
  const scale = (p.scale ?? 40) * k;
  const [u0, v0, u1, v1] = p.rect ?? [0, 0, 1, 1];
  ctx.save();
  ctx.beginPath();
  ctx.rect(u0 * w, v0 * h, (u1 - u0) * w, (v1 - v0) * h);
  ctx.clip();
  ctx.globalAlpha = p.opacity ?? 1;
  const r = rand(1234);
  if (p.kind === 'sakura') {
    for (let y = v0 * h - scale; y < v1 * h + scale; y += scale) {
      for (let x = u0 * w - scale; x < u1 * w + scale; x += scale) {
        const jx = x + (r() - 0.5) * scale * 0.7 + ((Math.round(y / scale) % 2) * scale) / 2;
        const jy = y + (r() - 0.5) * scale * 0.7;
        const size = scale * (0.18 + r() * 0.14);
        const rot = r() * Math.PI;
        ctx.save();
        ctx.translate(jx, jy);
        ctx.rotate(rot);
        ctx.fillStyle = p.color;
        for (let i = 0; i < 5; i++) {
          ctx.rotate((Math.PI * 2) / 5);
          ctx.beginPath();
          ctx.ellipse(0, -size * 0.62, size * 0.36, size * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = p.color2 ?? '#ffe9a8';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (r() < 0.35) {
          // stray petal
          ctx.save();
          ctx.translate(jx + scale * 0.4, jy + scale * 0.3);
          ctx.rotate(r() * 6);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.22, size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  } else if (p.kind === 'dots') {
    ctx.fillStyle = p.color;
    for (let y = v0 * h; y < v1 * h + scale; y += scale) {
      for (let x = u0 * w; x < u1 * w + scale; x += scale) {
        const off = (Math.round(y / scale) % 2) * scale * 0.5;
        ctx.beginPath();
        ctx.arc(x + off, y, scale * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (p.kind === 'pinstripe') {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, scale * 0.05);
    for (let x = u0 * w; x < u1 * w; x += scale) {
      ctx.beginPath();
      ctx.moveTo(x, v0 * h);
      ctx.lineTo(x, v1 * h);
      ctx.stroke();
    }
  } else if (p.kind === 'lace') {
    // scalloped lace band along the top edge of the rect
    ctx.fillStyle = p.color;
    const y = v0 * h;
    const bandH = (v1 - v0) * h;
    ctx.fillRect(u0 * w, y, (u1 - u0) * w, bandH * 0.55);
    for (let x = u0 * w; x < u1 * w; x += scale) {
      ctx.beginPath();
      ctx.arc(x + scale / 2, y + bandH * 0.55, scale / 2, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = p.color2 ?? 'rgba(0,0,0,0.15)';
    for (let x = u0 * w; x < u1 * w; x += scale) {
      ctx.beginPath();
      ctx.arc(x + scale / 2, y + bandH * 0.4, scale * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.kind === 'goldTrim') {
    const y0 = v0 * h;
    const y1 = v1 * h;
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, p.color2 ?? '#8a6420');
    grad.addColorStop(0.5, p.color);
    grad.addColorStop(1, p.color2 ?? '#8a6420');
    ctx.fillStyle = grad;
    ctx.fillRect(u0 * w, y0, (u1 - u0) * w, y1 - y0);
  }
  ctx.restore();
}

/** Apply a recipe and return a new canvas (source untouched). */
export function applyRecipe(src: HTMLCanvasElement, recipe: TextureRecipe): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const lut = recipe.gradient ? buildLut(recipe.gradient) : null;
  const mix = recipe.gradientMix ?? 1;
  const mul = recipe.multiply ? hexToRgb(recipe.multiply) : null;
  const sat = recipe.saturation ?? 1;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (lut) {
      const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      r = r + (lut[l * 3] - r) * mix;
      g = g + (lut[l * 3 + 1] - g) * mix;
      b = b + (lut[l * 3 + 2] - b) * mix;
    }
    if (mul) {
      r = (r * mul[0]) / 255;
      g = (g * mul[1]) / 255;
      b = (b * mul[2]) / 255;
    }
    if (sat !== 1) {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  if (recipe.patterns?.length) {
    // draw patterns on a layer, then multiply by the source luminance so folds stay visible
    const layer = document.createElement('canvas');
    layer.width = c.width;
    layer.height = c.height;
    const lctx = layer.getContext('2d')!;
    for (const p of recipe.patterns) drawPattern(lctx, c.width, c.height, p);
    const shade = document.createElement('canvas');
    shade.width = c.width;
    shade.height = c.height;
    const sctx = shade.getContext('2d')!;
    sctx.drawImage(layer, 0, 0);
    sctx.globalCompositeOperation = 'multiply';
    sctx.filter = 'grayscale(1) brightness(1.15)';
    sctx.drawImage(src, 0, 0);
    sctx.filter = 'none';
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(layer, 0, 0);
    ctx.drawImage(shade, 0, 0);
    // keep the source alpha (cut-out edges of sleeves, lace…)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
  return c;
}

export function canvasTextureLike(canvas: HTMLCanvasElement, like: THREE.Texture | null): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = like ? like.flipY : false;
  t.colorSpace = like ? like.colorSpace : THREE.SRGBColorSpace;
  if (like) {
    t.wrapS = like.wrapS;
    t.wrapT = like.wrapT;
    t.magFilter = like.magFilter;
    t.minFilter = like.minFilter;
    t.channel = like.channel;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export interface BlushSpec {
  /** Cheek centres in face texture UV (image space, v from top). */
  left: [number, number];
  right: [number, number];
  /** Radii in UV units. */
  rx: number;
  ry: number;
  /** Draw anime hatch strokes (///). */
  hatch?: boolean;
}

/**
 * Blush mask, R = soft cheek gradient, G = hatch strokes. Sampled by the
 * injected face shader (see beautyMaterials.ts).
 */
export function makeBlushMask(spec: BlushSpec, size = 512): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (const [u, v] of [spec.left, spec.right]) {
    const cx = u * size, cy = v * size;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, spec.ry / spec.rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, spec.rx * size);
    g.addColorStop(0, 'rgba(255,0,0,1)');
    g.addColorStop(0.55, 'rgba(255,0,0,0.6)');
    g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, spec.rx * size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (spec.hatch !== false) {
      ctx.strokeStyle = 'rgba(0,255,0,0.95)';
      ctx.lineCap = 'round';
      ctx.lineWidth = size * 0.0065;
      const len = spec.ry * size * 0.75;
      for (let i = -1; i <= 1; i++) {
        const x = cx + i * spec.rx * size * 0.32;
        ctx.beginPath();
        ctx.moveTo(x + len * 0.35, cy - len * 0.5);
        ctx.lineTo(x - len * 0.35, cy + len * 0.5);
        ctx.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
