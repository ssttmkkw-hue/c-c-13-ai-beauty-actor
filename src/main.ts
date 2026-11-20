import './style.css';
import { BeautyStage } from './api';
import { LOOKS, lookById } from './actor/looks';
import { EXPRESSIONS, EXPRESSION_ORDER, type ExpressionName } from './actor/expressions';
import { POSE_LABELS } from './actor/poses';
import { SHOT_LABELS, type ShotKind } from './render/Shots';
import { PRESETS, type BackdropId } from './stage/backdrops';
import { DEMO } from './play/script';
import { Player, type PlayerUI } from './play/Player';

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

if (params.get('clean') === '1') document.body.classList.add('clean');

const loadingBar = $('.loading-bar div');
const setLoad = (p: number) => (loadingBar.style.width = `${Math.round(p * 100)}%`);

const stage = await BeautyStage.create($('#viewport'), {
  post: params.get('post') !== '0',
  backdrop: (params.get('bg') as BackdropId) || 'night',
});

// ------------------------------------------------------------------ casting
let heroineId = params.get('heroine') || 'linwan';
let heroId = params.get('hero') || 'guyan';
let focus: 'heroine' | 'hero' = 'heroine';

await Promise.all([
  stage.cast('heroine', heroineId, (p) => setLoad(p * 0.5)),
  stage.cast('hero', heroId, (p) => setLoad(0.5 + p * 0.5)),
]);
setLoad(1);
stage.shot({ kind: 'two' });

// ------------------------------------------------------------------ UI bits
const subtitle = $('#subtitle');
const titleCard = $('#title-card');
const transport = $('#transport');

const ui: PlayerUI = {
  subtitle(name, text, side) {
    subtitle.classList.remove('hidden', 'left', 'right', 'center');
    subtitle.classList.add(side);
    $('.sub-name').textContent = name;
    const box = $('.sub-text');
    box.innerHTML = '';
    Array.from(text).forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      s.style.transitionDelay = `${i * 45}ms`;
      box.appendChild(s);
    });
    requestAnimationFrame(() => box.querySelectorAll('.ch').forEach((c) => c.classList.add('on')));
  },
  clearSubtitle() {
    subtitle.classList.add('hidden');
  },
  title(main, sub, show) {
    if (show) {
      $('.title-main').textContent = main;
      $('.title-sub').textContent = sub;
    }
    titleCard.classList.toggle('hidden', !show);
  },
  progress(i, n) {
    $('.progress-bar').style.width = `${(Math.min(i, n) / n) * 100}%`;
  },
  state(s) {
    transport.classList.toggle('playing', s === 'playing');
  },
};

const player = new Player(stage, DEMO, ui);
$('.scene-label').textContent = `《${DEMO.title}》 ${DEMO.subtitle}`;

function chip(label: string, on: boolean, onClick: () => void, swatch?: string) {
  const b = document.createElement('button');
  b.className = 'chip' + (on ? ' on' : '');
  if (swatch) {
    const s = document.createElement('span');
    s.className = 'swatch';
    s.style.background = swatch;
    b.appendChild(s);
  }
  b.appendChild(document.createTextNode(label));
  b.addEventListener('click', onClick);
  return b;
}

function fillChips(el: HTMLElement, items: { label: string; on: boolean; click: () => void; swatch?: string; title?: string }[]) {
  el.innerHTML = '';
  for (const it of items) {
    const c = chip(it.label, it.on, it.click, it.swatch);
    if (it.title) c.title = it.title;
    el.appendChild(c);
  }
}

const focusedActor = () => stage.slots[focus]!;

let busy = false;
async function recast(slot: 'heroine' | 'hero', id: string) {
  if (busy) return;
  busy = true;
  player.stop();
  $('#loading').classList.remove('done');
  $('.loading-text').textContent = `${lookById(id).name} 化妆中…`;
  setLoad(0);
  await stage.cast(slot, id, setLoad);
  if (slot === 'heroine') heroineId = id;
  else heroId = id;
  $('#loading').classList.add('done');
  busy = false;
  render();
}

const SWATCH: Record<string, string> = {
  brown: '#7a5242', ink: '#1f1d29', honey: '#d8b48e', umber: '#5e4136', teal: '#1aa3bf', navy: '#22304f', gold: '#f1e7b8', silver: '#e6e9f4', rose: '#e39ab6',
};

function render() {
  fillChips(
    $('#cast-heroine'),
    LOOKS.filter((l) => l.role === 'heroine').map((l) => ({ label: l.name, on: l.id === heroineId, click: () => recast('heroine', l.id), title: l.tagline })),
  );
  fillChips(
    $('#cast-hero'),
    LOOKS.filter((l) => l.role === 'hero').map((l) => ({ label: l.name, on: l.id === heroId, click: () => recast('hero', l.id), title: l.tagline })),
  );
  const tabs = $('#focus-tabs');
  tabs.innerHTML = '';
  for (const slot of ['heroine', 'hero'] as const) {
    const b = document.createElement('button');
    b.textContent = `${slot === 'heroine' ? '女主' : '男主'} · ${stage.slots[slot]?.look.name ?? ''}`;
    b.className = slot === focus ? 'on' : '';
    b.onclick = () => {
      focus = slot;
      render();
    };
    tabs.appendChild(b);
  }
  const a = focusedActor();
  $('#actor-card').innerHTML = `<div><span class="nm">${a.look.name}</span><span class="en">${a.look.nameEn}</span></div><div class="tl">${a.look.tagline}</div>`;
  fillChips(
    $('#outfits'),
    a.look.outfits.map((o) => ({ label: o.label, on: o.id === a.outfitId, title: o.note, click: () => (a.setOutfit(o.id), render()) })),
  );
  fillChips(
    $('#hairs'),
    a.look.hairs.map((h) => ({ label: h.label, on: h.id === a.hairId, swatch: SWATCH[h.id], click: () => (a.setHair(h.id), render()) })),
  );
  fillChips(
    $('#expressions'),
    EXPRESSION_ORDER.map((e) => ({ label: EXPRESSIONS[e].label, on: e === a.expression, click: () => (a.setExpression(e), render()) })),
  );
  fillChips($('#gestures'), [
    { label: '随表情', on: a.gesture === null, click: () => (a.setGesture(null), render()) },
    ...Object.entries(POSE_LABELS).map(([id, label]) => ({ label, on: a.gesture === id, click: () => (a.setGesture(id), render()) })),
  ]);
  const shotKinds: ShotKind[] = ['wide', 'two', 'cu', 'ecu', 'ots', 'profile', 'low', 'full'];
  fillChips(
    $('#shots'),
    shotKinds.map((k) => ({
      label: SHOT_LABELS[k],
      on: stage.shots.current.kind === k,
      click: () => {
        stage.shot({ kind: k, subject: a.look.id });
        render();
      },
    })),
  );
  fillChips(
    $('#backdrops'),
    (Object.keys(PRESETS) as BackdropId[]).map((id) => ({ label: PRESETS[id].label, on: stage.stage.backdropId === id, click: () => (stage.setBackdrop(id), render()) })),
  );
}
render();

// ------------------------------------------------------------------ controls
$('#btn-play').addEventListener('click', () => player.toggle());
$('#btn-restart').addEventListener('click', () => player.restart());
$('#btn-stop').addEventListener('click', () => player.stop());
const syncShift = () => {
  const open = !$('#panel').classList.contains('collapsed') && !document.body.classList.contains('clean') && innerWidth > 760;
  stage.setViewShift(open ? ($('#panel').offsetWidth + 16) / 2 : 0);
};
$('#panel-toggle').addEventListener('click', () => {
  $('#panel').classList.toggle('collapsed');
  syncShift();
});
addEventListener('resize', syncShift);
syncShift();
$('#say-btn').addEventListener('click', () => {
  const text = $<HTMLInputElement>('#say-input').value.trim();
  if (!text) return;
  const a = focusedActor();
  ui.subtitle(a.look.name, text, focus === 'heroine' ? 'right' : 'left');
  stage.line(a.look.id, text, { tts: $<HTMLInputElement>('#t-tts').checked }).then(() => setTimeout(() => ui.clearSubtitle(), 900));
});
$<HTMLInputElement>('#t-post').addEventListener('change', (e) => (stage.post.enabled = (e.target as HTMLInputElement).checked));
$<HTMLInputElement>('#t-dof').addEventListener('change', (e) => (stage.post.dofEnabled = (e.target as HTMLInputElement).checked));
$<HTMLInputElement>('#t-wind').addEventListener('change', (e) => {
  const on = (e.target as HTMLInputElement).checked;
  for (const a of stage.actors()) a.wind = on ? 1 : 0;
});
$<HTMLInputElement>('#t-tts').addEventListener('change', (e) => (player.tts = (e.target as HTMLInputElement).checked));
$<HTMLInputElement>('#t-post').checked = stage.post.enabled;

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    player.toggle();
  } else if (e.key === 'r') player.restart();
  else if (e.key === 's') player.stop();
  else if (e.key === 'h') {
    $('#panel').classList.toggle('collapsed');
    syncShift();
  }
});

// ------------------------------------------------------------------ fps overlay
if (params.get('fps') === '1') {
  const el = $('#fps');
  el.classList.remove('hidden');
  let frames = 0;
  let acc = 0;
  let last = performance.now();
  stage.onFrame(() => {
    frames++;
    acc += stage.frameMs;
    const now = performance.now();
    if (now - last > 1000) {
      const fps = (frames * 1000) / (now - last);
      const info = stage.renderer.info;
      el.textContent = `FPS ${fps.toFixed(1)}\nframe ${(acc / frames).toFixed(1)} ms (cpu+submit)\ncalls ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(0)}k`;
      (window as unknown as { __fps: unknown }).__fps = { fps, frameMs: acc / frames };
      frames = 0;
      acc = 0;
      last = now;
    }
  });
}

$('#loading').classList.add('done');

// apply optional URL state (handy for sharing a look)
const expr = params.get('expr') as ExpressionName | null;
if (expr && EXPRESSIONS[expr]) stage.actors().forEach((a) => a.setExpression(expr));
if (params.get('autoplay') === '1') player.restart();

// debugging / automation handle
Object.assign(window, { __beauty: { stage, player, ui, render } });
