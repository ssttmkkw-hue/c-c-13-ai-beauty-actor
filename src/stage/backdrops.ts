/**
 * Painted 漫剧 backdrops, generated on a canvas at start-up (no image assets
 * to license). Each painter draws a 2:1 panorama that wraps a curved
 * cyclorama behind the stage. Out-of-focus "bokeh" lights are painted in, so
 * even without a heavy DOF pass the background has that dreamy lens look.
 */

export type BackdropId = 'night' | 'sakura' | 'studio';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bokeh(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  // soft-edged disc with a faint brighter rim, like a real fast lens
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', String(alpha * 0.7)));
  g.addColorStop(0.8, color.replace('A', String(alpha * 0.8)));
  g.addColorStop(0.93, color.replace('A', String(alpha * 0.9)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function blurInPlace(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx.canvas;
  const tmp = document.createElement('canvas');
  tmp.width = c.width;
  tmp.height = c.height;
  const t = tmp.getContext('2d')!;
  t.filter = `blur(${px}px)`;
  t.drawImage(c, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(tmp, 0, 0);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function skyline(ctx: CanvasRenderingContext2D, W: number, base: number, maxH: number, fill: string, windows: string[] | null, r: () => number, density = 1) {
  let x = -20;
  while (x < W + 20) {
    const w = (30 + r() * 90) / density;
    const h = maxH * (0.25 + r() * 0.75);
    ctx.fillStyle = fill;
    ctx.fillRect(x, base - h, w, h + 400);
    if (r() < 0.25) {
      // antenna / stepped crown
      ctx.fillRect(x + w * 0.4, base - h - 18 - r() * 30, 3, 40);
      ctx.fillRect(x + w * 0.15, base - h - 10, w * 0.7, 12);
    }
    if (windows) {
      for (let wy = base - h + 8; wy < base - 4; wy += 7) {
        for (let wx = x + 4; wx < x + w - 5; wx += 6) {
          if (r() < 0.22) {
            ctx.globalAlpha = 0.35 + r() * 0.45;
            ctx.fillStyle = windows[Math.floor(r() * windows.length)];
            ctx.fillRect(wx, wy, 2.5, 3);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    x += w + r() * 6;
  }
}

function paintNight(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const r = rng(7);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#070a1f');
  sky.addColorStop(0.35, '#16173d');
  sky.addColorStop(0.58, '#3b2458');
  sky.addColorStop(0.72, '#7a3a6a');
  sky.addColorStop(0.82, '#c4687a');
  sky.addColorStop(1, '#2a1830');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 420; i++) {
    const y = r() * H * 0.55;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7 * (1 - y / (H * 0.6))})`;
    const s = r() < 0.05 ? 2.2 : 1.1;
    ctx.fillRect(r() * W, y, s, s);
  }
  // moon with halo
  glow(ctx, W * 0.66, H * 0.2, 260, 'rgba(255,220,235,0.28)');
  glow(ctx, W * 0.66, H * 0.2, 120, 'rgba(255,240,245,0.5)');
  ctx.fillStyle = '#fff6ee';
  ctx.beginPath();
  ctx.arc(W * 0.66, H * 0.2, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,214,220,0.6)';
  ctx.beginPath();
  ctx.arc(W * 0.66 + 12, H * 0.2 - 8, 9, 0, Math.PI * 2);
  ctx.arc(W * 0.66 - 14, H * 0.2 + 12, 6, 0, Math.PI * 2);
  ctx.fill();
  // thin clouds across the moon
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 6; i++) {
    const y = H * (0.15 + r() * 0.25);
    const g = ctx.createLinearGradient(0, y - 10, 0, y + 10);
    g.addColorStop(0, 'rgba(180,140,200,0)');
    g.addColorStop(0.5, 'rgba(200,150,210,0.5)');
    g.addColorStop(1, 'rgba(180,140,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(r() * W * 0.6, y - 10, 400 + r() * 600, 20);
  }
  ctx.globalAlpha = 1;
  // city layers
  const horizon = H * 0.8;
  skyline(ctx, W, horizon, H * 0.22, '#4a2b55', null, r, 1.3);
  glow(ctx, W * 0.5, horizon, W * 0.6, 'rgba(255,140,150,0.18)');
  skyline(ctx, W, horizon + 20, H * 0.3, '#22183a', ['#ffd9a0', '#ffc27a', '#a6d8ff', '#ffe6c2'], r, 1);
  skyline(ctx, W, horizon + 60, H * 0.2, '#120d22', ['#ffcf8a', '#ff9db0'], r, 0.7);
  blurInPlace(ctx, 2.2);
  // bokeh city lights (painted out of focus)
  const colors = ['rgba(255,190,120,A)', 'rgba(255,140,170,A)', 'rgba(150,200,255,A)', 'rgba(255,230,170,A)', 'rgba(210,160,255,A)'];
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const y = H * (0.5 + r() * 0.45);
    bokeh(ctx, r() * W, y, 14 + r() * 46, colors[Math.floor(r() * colors.length)], 0.08 + r() * 0.16);
  }
  ctx.globalCompositeOperation = 'source-over';
  // rooftop railing silhouette
  ctx.fillStyle = '#0b0814';
  ctx.fillRect(0, H * 0.905, W, 6);
  for (let x = 0; x < W; x += 46) ctx.fillRect(x, H * 0.905, 4, H * 0.1);
  ctx.fillRect(0, H * 0.955, W, 4);
}

function branch(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, depth: number, r: () => number, tips: [number, number][]) {
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  ctx.strokeStyle = '#3a2228';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2 + (r() - 0.5) * len * 0.3, x2, y2);
  ctx.stroke();
  if (depth <= 0 || w < 1.2) {
    tips.push([x2, y2]);
    return;
  }
  const n = 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    branch(ctx, x2, y2, ang + (r() - 0.5) * 1.1, len * (0.62 + r() * 0.2), w * 0.66, depth - 1, r, tips);
  }
  if (depth < 3) tips.push([x2, y2]);
}

function blossomCluster(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, r: () => number) {
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const s = 4 + r() * 6;
    const tone = r();
    ctx.fillStyle = tone < 0.3 ? '#ffe9f0' : tone < 0.7 ? '#ffc4d6' : '#f29bb8';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(r() * 6.28);
    for (let p = 0; p < 5; p++) {
      ctx.rotate(1.2566);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.6, s * 0.38, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffdd88';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.18, 0, 6.28);
    ctx.fill();
    ctx.restore();
  }
}

function paintSakura(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const r = rng(21);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6f6fb8');
  sky.addColorStop(0.3, '#c99ac8');
  sky.addColorStop(0.55, '#f6b8b8');
  sky.addColorStop(0.72, '#ffd4a8');
  sky.addColorStop(0.85, '#ffc7a0');
  sky.addColorStop(1, '#d99a9a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.42, H * 0.7, 520, 'rgba(255,236,200,0.75)');
  glow(ctx, W * 0.42, H * 0.7, 140, 'rgba(255,250,235,0.9)');
  // soft clouds
  for (let i = 0; i < 14; i++) {
    const x = r() * W, y = H * (0.2 + r() * 0.45);
    for (let k = 0; k < 6; k++) glow(ctx, x + (r() - 0.5) * 180, y + (r() - 0.5) * 30, 60 + r() * 80, 'rgba(255,235,240,0.18)');
  }
  // distant hills + town
  ctx.fillStyle = 'rgba(170,120,160,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.82);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.78 - Math.sin(x * 0.004) * 30 - Math.sin(x * 0.013) * 12);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  skyline(ctx, W, H * 0.86, H * 0.08, 'rgba(120,80,120,0.7)', ['rgba(255,230,190,0.9)'], r, 1.6);
  // bokeh in pink/gold
  ctx.globalCompositeOperation = 'lighter';
  const colors = ['rgba(255,200,220,A)', 'rgba(255,230,180,A)', 'rgba(255,170,200,A)'];
  blurInPlace(ctx, 1.6);
  for (let i = 0; i < 60; i++) bokeh(ctx, r() * W, H * (0.3 + r() * 0.6), 14 + r() * 44, colors[i % 3], 0.08 + r() * 0.15);
  ctx.globalCompositeOperation = 'source-over';
  // sakura trees from both sides
  const tips: [number, number][] = [];
  branch(ctx, -40, H * 0.15, 0.25, 260, 26, 6, r, tips);
  branch(ctx, W + 40, H * 0.1, Math.PI - 0.3, 280, 28, 6, r, tips);
  branch(ctx, W * 0.5 - 300, -40, 1.2, 160, 14, 5, r, tips);
  for (const [x, y] of tips) blossomCluster(ctx, x, y, 34 + r() * 30, r);
  // drifting petals painted in
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,${190 + Math.floor(r() * 40)},${210 + Math.floor(r() * 30)},${0.5 + r() * 0.5})`;
    ctx.save();
    ctx.translate(r() * W, r() * H);
    ctx.rotate(r() * 6.28);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3 + r() * 3, 5 + r() * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintStudio(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const r = rng(3);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.6);
  g.addColorStop(0, '#fbe9f1');
  g.addColorStop(0.35, '#e6c6dc');
  g.addColorStop(0.7, '#9f86b8');
  g.addColorStop(1, '#3e3460');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // light rays
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = W * (0.2 + i * 0.075);
    const lg = ctx.createLinearGradient(x, 0, x + 200, H);
    lg.addColorStop(0, 'rgba(255,240,250,0.16)');
    lg.addColorStop(1, 'rgba(255,240,250,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 40 + r() * 30, 0);
    ctx.lineTo(x + 380, H);
    ctx.lineTo(x + 220, H);
    ctx.fill();
  }
  const colors = ['rgba(255,255,255,A)', 'rgba(255,200,230,A)', 'rgba(220,200,255,A)', 'rgba(255,235,200,A)'];
  for (let i = 0; i < 70; i++) bokeh(ctx, r() * W, r() * H, 8 + r() * 30, colors[i % 4], 0.06 + r() * 0.12);
  ctx.globalCompositeOperation = 'source-over';
  // fine sparkle
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.6})`;
    ctx.fillRect(r() * W, r() * H, 1.5, 1.5);
  }
}

export function paintBackdrop(id: BackdropId, W = 2048, H = 1024): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  if (id === 'night') paintNight(ctx, W, H);
  else if (id === 'sakura') paintSakura(ctx, W, H);
  else paintStudio(ctx, W, H);
  return c;
}

export interface LightPreset {
  label: string;
  key: { color: string; intensity: number; pos: [number, number, number] };
  fill: { color: string; intensity: number; pos: [number, number, number] };
  back: { color: string; intensity: number; pos: [number, number, number] };
  hemi: { sky: string; ground: string; intensity: number };
  rim: { color: string; strength: number };
  fog: string;
  floor: [string, string];
  grade: { lift: [number, number, number]; gain: [number, number, number]; saturation: number; contrast: number; exposure: number; vignette: number };
  bloom: { strength: number; radius: number; threshold: number };
  particles: 'petals' | 'motes' | 'sparkle';
  /** Backdrop brightness multiplier (keeps LDR paintings below bloom threshold). */
  bg: number;
}

export const PRESETS: Record<BackdropId, LightPreset> = {
  night: {
    label: '夜色天台',
    key: { color: '#fff4f0', intensity: 1.95, pos: [1.6, 3.2, 3.2] },
    fill: { color: '#9aa8ff', intensity: 0.45, pos: [-3, 1.6, 2] },
    back: { color: '#ffc4dc', intensity: 1.15, pos: [0.5, 2.6, -3] },
    hemi: { sky: '#b4b0e0', ground: '#4a3442', intensity: 0.55 },
    rim: { color: '#ffb3d1', strength: 1.15 },
    fog: '#1b1433',
    floor: ['#2a2040', '#0b0814'],
    grade: { lift: [0.01, 0.0, 0.03], gain: [1.02, 0.99, 1.02], saturation: 1.02, contrast: 1.06, exposure: 1.0, vignette: 0.26 },
    bloom: { strength: 0.5, radius: 0.5, threshold: 1.3 },
    particles: 'motes',
    bg: 0.95,
  },
  sakura: {
    label: '樱花黄昏',
    key: { color: '#fff0de', intensity: 2.0, pos: [-1.2, 3.0, 3.0] },
    fill: { color: '#ffd0e0', intensity: 0.5, pos: [3, 1.5, 2] },
    back: { color: '#ffdcb0', intensity: 1.2, pos: [-0.6, 2.4, -3] },
    hemi: { sky: '#ffe6ee', ground: '#8a6a74', intensity: 0.6 },
    rim: { color: '#ffd8a8', strength: 1.1 },
    fog: '#f0b8c0',
    floor: ['#c99aa6', '#6a4656'],
    grade: { lift: [0.02, 0.01, 0.02], gain: [1.02, 0.99, 0.98], saturation: 0.98, contrast: 1.04, exposure: 0.98, vignette: 0.3 },
    bloom: { strength: 0.35, radius: 0.5, threshold: 1.3 },
    particles: 'petals',
    bg: 0.78,
  },
  studio: {
    label: '写真棚',
    key: { color: '#fff4ee', intensity: 2.0, pos: [1.2, 2.8, 3.4] },
    fill: { color: '#e6dcff', intensity: 0.55, pos: [-2.6, 1.4, 2.4] },
    back: { color: '#ffd8ec', intensity: 1.1, pos: [0, 2.8, -2.6] },
    hemi: { sky: '#ffeaf4', ground: '#7c6a90', intensity: 0.7 },
    rim: { color: '#ffe0f0', strength: 1.0 },
    fog: '#c9b1d3',
    floor: ['#d9c3da', '#5e4c78'],
    grade: { lift: [0.015, 0.01, 0.025], gain: [1.0, 0.99, 1.01], saturation: 0.98, contrast: 1.05, exposure: 0.97, vignette: 0.28 },
    bloom: { strength: 0.3, radius: 0.5, threshold: 1.3 },
    particles: 'sparkle',
    bg: 0.8,
  },
};
