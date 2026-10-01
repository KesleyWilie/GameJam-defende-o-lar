import { sheetPose } from './facing.js';

/* Defende o Lar — Tôin não entrega a casa.
   Sprites do projeto. Áudio procedural. */
export function mount(cv, images) {
const UNIT = 44, VW = 960, VH = 540, S = 3, PX = S / UNIT;
const ctx = cv.getContext('2d');
cv.width = VW; cv.height = VH;
ctx.imageSmoothingEnabled = false;

const DEV = /(?:\?|&)dev=1(?:&|$)/.test(location.search);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const hyp = Math.hypot;
const nrm = (x, y) => { const l = hyp(x, y) || 1; return { x: x / l, y: y / l }; };
const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- Áudios Externos (Berrante) ---------------- */
const horns = [
  new Audio(new URL('./assets/berrante_1.mp3', import.meta.url).href),
  new Audio(new URL('./assets/berrante_2.mp3', import.meta.url).href)
];

const shootSound = new Audio(new URL('./assets/tiro.mp3', import.meta.url).href);
const musicaFundo = new Audio(new URL('./assets/musicafundo.mp3', import.meta.url).href);
musicaFundo.loop = true;
musicaFundo.volume =  0.10;

const bossFightMusica = new Audio(new URL('./assets/boss_fight.mp3', import.meta.url).href);
bossFightMusica.loop = true;
bossFightMusica.volume =  0.10;

horns.forEach(h => {
  h.volume = 0.6;
  h.preload = 'auto'; // Força o navegador a pré-carregar os arquivos m4a
});

/* ---------------- Áudio procedural ---------------- */
let AC = null, music = null;

function audioInit() {
  if (AC) return;
  try { 
    AC = new (window.AudioContext || window.webkitAudioContext)(); 
  } catch (e) { 
    AC = null; 
  }

  // Pré-desbloqueia o áudio dos berrantes e tiro no primeiro clique/tecla do jogador
  [...horns, shootSound, musicaFundo].forEach(sound => {
    sound.play().then(() => {
      sound.pause();
      sound.currentTime = 0;
    }).catch(() => {});
  });
}
function tone(f, d, type, vol, slide) { sched(AC ? AC.currentTime : 0, f, d, type, vol, slide); }
function sched(when, f, d, type, vol, slide) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, when);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), when + d);
    g.gain.setValueAtTime(Math.max(0.0001, vol || 0.05), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    o.connect(g); g.connect(AC.destination);
    o.start(when); o.stop(when + d + 0.02);
  } catch (e) {}
}
function sfx(n) {
  switch (n) {
    case 'swing': tone(220, .08, 'triangle', .05, -80); break;
    case 'hit': tone(140, .08, 'square', .05); break;
    case 'shoot': {
      const shot = shootSound.cloneNode();
    shot.volume = 0.5;
    shot.play().catch(() => {});
    break;
    }
    case 'hurt': tone(110, .2, 'sawtooth', .08, -60); break;
    case 'horn': {
      const chosenHorn = horns[Math.floor(Math.random() * horns.length)];
      // Pausa e reseta a agulha de tempo com garantia antes do play
      chosenHorn.pause();
      chosenHorn.currentTime = 0;
      chosenHorn.play().catch(err => console.log('Bloqueio no berrante:', err));
      break;
    }
    case 'pick': tone(660, .08, 'square', .05); setTimeout(() => tone(880, .1, 'square', .05), 80); break;
    case 'reload': tone(300, .05, 'square', .04); break;
    case 'yell': tone(300, .35, 'sawtooth', .06, 200); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .18, 'triangle', .06), i * 120)); break;
    case 'talk': tone(380 + Math.random() * 90, .03, 'square', .02); break;
    case 'carta': [220, 277, 330, 440].forEach((f, i) => setTimeout(() => tone(f, 1.5, 'triangle', .028), i * 50)); break;
    default: break;
  }
}
function bossTension() {
  return enemies.some(e => e.boss && !e.dead && e.active);
}
function updateMusic() {
  // Se estiver no menu, pausado ou na tela de fim de jogo, pausa a música
  if (G.state === 'menu' || G.state === 'pause' || G.state === 'end' || G.state === 'over') {
    if (!musicaFundo.paused) {
      musicaFundo.pause();
    }
    return;
  }

  // Toca a música durante a gameplay se o áudio já tiver sido inicializado
  if (musicaFundo.paused && AC) {
    musicaFundo.play().catch(() => {});
  }
}

/* ---------------- Assets ---------------- */
const IMG = {}, tintCache = {};
function tinted(key, col) {
  const ck = key + col;
  if (tintCache[ck]) return tintCache[ck];
  const src = IMG[key];
  if (!src) return null;
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
  return (tintCache[ck] = c);
}

/* ---------------- Input ---------------- */
const keys = {}, pressed = new Set(), mouse = { pressed: false };
const pointer = { x: VW / 2, y: VH / 2, inside: false };
let wheel = 0, consumed = false, shakeMag = 0;
const pad = { lx: 0, ly: 0, rx: 0, ry: 0, attack: false, pause: false };
const padDown = [];
function canvasPointer(e) {
  const r = cv.getBoundingClientRect();
  pointer.x = (e.clientX - r.left) * (VW / (r.width || VW));
  pointer.y = (e.clientY - r.top) * (VH / (r.height || VH));
  pointer.inside = true;
}
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  const hold = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code);
  if (!e.repeat || (hold && G.state === 'options')) pressed.add(e.code);
  keys[e.code] = true; audioInit();
});
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('mousedown', e => { canvasPointer(e); if (e.button === 0) mouse.pressed = true; audioInit(); cv.focus(); });
cv.addEventListener('mousemove', canvasPointer);
cv.addEventListener('mouseleave', () => { pointer.inside = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('touchstart', e => { if (e.touches[0]) canvasPointer(e.touches[0]); mouse.pressed = true; audioInit(); }, { passive: true });
cv.addEventListener('wheel', e => { wheel += e.deltaY; e.preventDefault(); }, { passive: false });
const wasPressed = (...c) => c.some(k => pressed.has(k));
function pollPad() {
  pad.lx = pad.ly = pad.rx = pad.ry = 0;
  pad.attack = pad.pause = false;
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let g = null;
  if (list) for (const x of list) if (x) g = x;
  if (!g) return;
  pad.lx = g.axes[0] || 0; pad.ly = g.axes[1] || 0;
  pad.rx = g.axes[2] || 0; pad.ry = g.axes[3] || 0;
  const edge = i => {
    const d = !!(g.buttons[i] && g.buttons[i].pressed);
    const e = d && !padDown[i];
    padDown[i] = d;
    return e;
  };
  pad.attack = edge(2) || edge(7);
  pad.pause = edge(9);
}
function getAim() {
  if (pad.rx * pad.rx + pad.ry * pad.ry > 0.09) return nrm(pad.rx, pad.ry);
  if (pointer.inside && P) {
    const wx = cam.x + (pointer.x - VW / 2) / UNIT;
    const wy = cam.y + (pointer.y - VH / 2) / UNIT;
    if (hyp(wx - P.x, wy - P.y) > 0.08) return nrm(wx - P.x, wy - P.y);
  }
  return null;
}

/* ---------------- Estado global ---------------- */
const G = { state: 'menu', day: 1, locked: false, god: false, fade: 0, fadeDir: 0, fadeCb: null, hint: null, banner: null, pauseSel: 0, carta: false, optSel: 0, optFrom: 'menu' };
const CFG = { hp: 8, melee: 5, gun: 4, boss: 1, spread: 28 };
function loadCfg() {
  try {
    if (typeof localStorage === 'undefined') return;
    const s = JSON.parse(localStorage.getItem('defende-cfg') || 'null');
    if (!s) return;
    CFG.hp = clamp(s.hp | 0, 3, 12) || 8;
    CFG.melee = clamp(s.melee | 0, 2, 10) || 5;
    CFG.gun = clamp(s.gun | 0, 1, 8) || 4;
    CFG.boss = [0.5, 1, 2].includes(s.boss) ? s.boss : 1;
    CFG.spread = clamp(s.spread | 0, 8, 48) || 28;
  } catch (e) {}
}
function saveCfg() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('defende-cfg', JSON.stringify(CFG)); } catch (e) {}
}
function bossLife(base) { return Math.max(1, Math.round(base * CFG.boss)); }
function applyCfg() {
  saveCfg();
  if (P) { P.max = CFG.hp; P.hp = Math.min(Math.max(P.hp, 1), CFG.hp); }
  for (const e of enemies) if (e.boss) {
    const base = String(e.name).includes('Corisco') ? 10 : 8;
    const next = bossLife(base);
    const ratio = e.max ? e.hp / e.max : 1;
    e.max = next;
    e.hp = Math.max(1, Math.min(next, Math.round(next * ratio)));
  }
}
loadCfg();
let T = 0, L = null, P = null;
let comps = [], enemies = [], shots = [], oxen = [], warns = [], fxs = [], pickups = [], cos = [], trig = [];
let finishing = false, overAt = 0;
const cam = { x: 0, y: 0 };

/* ---------------- Coroutines ---------------- */
function startCo(gen, owner, pauseOnLock) { const c = { gen, wait: 0, cond: null, done: false, owner, pauseOnLock }; cos.push(c); return c; }
function stepCos(dt) {
  for (let i = 0; i < cos.length; i++) {
    const c = cos[i];
    if (c.done) continue;
    if (c.owner && c.owner.dead) { c.done = true; continue; }
    if (c.pauseOnLock && G.locked) continue;
    if (c.cond) { if (!c.cond()) continue; c.cond = null; }
    c.wait -= dt;
    if (c.wait > 0) continue;
    const r = c.gen.next();
    if (r.done) { c.done = true; continue; }
    if (typeof r.value === 'function') c.cond = r.value; else c.wait = r.value || 0;
  }
  cos = cos.filter(c => !c.done);
}

/* ---------------- Dialogo ---------------- */
const DLG = { active: false, lines: [], i: 0, shown: 0, timer: 0, cb: null, wait: 0 };
function say(lines, cb) {
  if (DLG.active) return false;
  if (!lines || !lines.length) { if (cb) cb(); return true; }
  DLG.active = true; DLG.lines = lines; DLG.i = 0; DLG.shown = 0; DLG.timer = 0; DLG.cb = cb || null; DLG.wait = 1;
  G.locked = true; return true;
}
function updateDialogue(dt) {
  if (!DLG.active) return;
  if (DLG.wait > 0) { DLG.wait--; return; }
  const ln = DLG.lines[DLG.i];
  const adv = wasPressed('Space', 'Enter', 'KeyE') || mouse.pressed;
  if (adv) consumed = true;
  if (DLG.shown < ln.t.length) {
    if (adv) DLG.shown = ln.t.length;
    else {
      DLG.timer += dt;
      while (DLG.timer >= 0.03 && DLG.shown < ln.t.length) { DLG.timer -= 0.03; DLG.shown++; if (DLG.shown % 3 === 0) sfx('talk'); }
    }
  } else if (adv) {
    DLG.i++; DLG.shown = 0; DLG.timer = 0;
    if (DLG.i >= DLG.lines.length) { DLG.active = false; G.locked = false; const cb = DLG.cb; DLG.cb = null; if (cb) cb(); }
  }
}

/* ---------------- Mundo ---------------- */
function blocked(x, y, r) {
  if (!L) return false;
  for (const o of L.obs) {
    const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}
function move(e, dx, dy) {
  if (e.ghost) { e.x += dx; e.y += dy; }
  else {
    if (!blocked(e.x + dx, e.y, e.r)) e.x += dx;
    if (!blocked(e.x, e.y + dy, e.r)) e.y += dy;
  }
  e.x = clamp(e.x, e.r, L.w - e.r); e.y = clamp(e.y, e.r, L.h - e.r);
}
function bump(n) { shakeMag = Math.max(shakeMag, n); }

/* ---------------- Personagens ---------------- */
function mkChar(o) {
  return Object.assign({ x: 0, y: 0, r: 0.3, face: { x: 0, y: 1 }, hp: 1, max: 1, inv: 0.1, invUntil: 0, flash: 0, dead: false,
    tint: '#ffffff', hat: 'leather', hatCol: null, moving: false, alpha: 1, animOff: Math.random() * 4, atkStart: -9, atkUntil: -9,
    scale: 1, hitAt: 0, hitRange: 1.3, hitDmg: 1 }, o);
}
function hurt(e, n) {
  if (!e || e.dead || T < e.invUntil) return false;
  if (e.isPlayer && G.god) return false;
  e.hp = Math.max(0, e.hp - n);
  e.invUntil = T + e.inv; e.flash = T + 0.1;
  sfx(e.isPlayer ? 'hurt' : 'hit');
  if (e.isPlayer) bump(0.28);
  fxs.push({ type: 'spark', x: e.x, y: e.y - 0.6, until: T + 0.2, t0: T });
  if (e.onHurt) e.onHurt(e);
  if (e.hp === 0) { e.dead = true; e.removeAt = T + 0.35; if (e.onDie) e.onDie(e); }
  return true;
}

const KINDS = {
  facao: { hp: 3, speed: 2.0, tint: '#a85a3c', ranged: false },
  fuzil: { hp: 2, speed: 1.6, tint: '#7a4036', ranged: true }
};
function spawnEnemy(kind, x, y, o) {
  const k = KINDS[kind];
  const e = mkChar(Object.assign({
    x, y, r: 0.32, hp: k.hp, max: k.hp, inv: 0.1, tint: k.tint, hat: 'leather', isEnemy: true, speed: k.speed,
    detect: 8, atkRange: 1, atkCd: 1, windup: 0.3, dmg: 1, ranged: k.ranged, rRange: 6, shotCd: 1.6,
    nextAtk: 0, nextShot: T + rnd(0.3, 1.2), counts: true, drop: 0.3
  }, o || {}));
  e.onDie = onEnemyDied;
  enemies.push(e);
  return e;
}
function onEnemyDied(e) {
  if (e.drop && Math.random() <= e.drop) pickups.push({ x: e.x, y: e.y, type: 'garapa' });
}

/* ---------------- Chefes ---------------- */
function makeBoss(cfg) {
  const e = mkChar({
    x: cfg.x, y: cfg.y, r: 0.42, hp: cfg.hp, max: cfg.hp, inv: 0.1, tint: cfg.tint, hat: cfg.hat, hatCol: cfg.hatCol,
    alpha: cfg.alpha || 1, scale: cfg.scale || 1.2, isEnemy: true, boss: true, ghost: true, name: cfg.name, cfg,
    moveSpeed: cfg.speed, atkCd: cfg.attackCooldown, active: false, busy: false, chasing: false, nextPick: 0, nextMelee: 0,
    dest: { x: cfg.arena.x, y: cfg.arena.y }, counts: true, drop: 0, floaty: !!cfg.floaty, revealed: false, enraged: false, form: 0
  });
  e.onHurt = b => {
    if (!b.enraged && !b.dead && b.hp <= b.max * 0.5) {
      b.enraged = true; b.moveSpeed *= 1.5; b.atkCd *= 0.6;
      fxs.push({ type: 'text', x: b.x, y: b.y - 2, text: 'ENFURECIDO!', until: T + 1.5, t0: T, color: '#ff6a4a' });
    }
  };
  e.onDie = b => { oxen = []; warns = []; if (cfg.onDie) cfg.onDie(b); };
  enemies.push(e);
  startCo(bossLoop(e), e, true);
  return e;
}
function* bossLoop(b) {
  const c = b.cfg;
  yield () => dist(P, b) <= c.activation && !G.locked;
  b.active = true;
  yield c.firstDelay;
  while (!b.dead) {
    yield () => !G.locked;
    b.busy = true;
    const a = c.attacks[Math.floor(Math.random() * c.attacks.length)];
    if (a === 'stampede') yield* stampede(b);
    else if (a === 'shoot') yield* bossShoot(b);
    else if (a === 'summon') yield* summon(b);
    else if (a === 'lunge') yield* bossLunge(b);
    b.busy = false;
    yield b.atkCd;
  }
}
function* stampede(b) {
  const c = b.cfg.stampede, a = b.cfg.arena;
  sfx('horn'); bump(0.42);
  fxs.push({ type: 'ring', x: b.x, y: b.y, until: T + 1.2, t0: T });
  fxs.push({ type: 'text', x: b.x, y: b.y - 2.2, text: '♪ BERRANTE! ♪', until: T + 1.3, t0: T, color: '#f4efe6' });
  const tel = b.enraged ? 0.65 : c.telegraph;
  const spd = b.enraged ? c.speed * 1.12 : c.speed;
  let useX;
  if (b.enraged) { b.form = b.form ? 0 : 1; useX = b.form === 1; }
  else useX = Math.random() < 0.5;
  const hx = a.hx + 2, hy = a.hy + 2;
  let starts, dirs, travel;
  if (useX) {
    starts = [{ x: a.x - hx, y: a.y - hy }, { x: a.x + hx, y: a.y - hy }];
    dirs = [nrm(hx, hy), nrm(-hx, hy)];
    travel = hyp(2 * hx, 2 * hy);
  } else {
    const down = Math.random() < 0.5, y = down ? a.y - hy : a.y + hy, d = { x: 0, y: down ? 1 : -1 };
    starts = [{ x: a.x - c.lane, y }, { x: a.x + c.lane, y }];
    dirs = [d, d]; travel = 2 * hy;
  }
  for (let i = 0; i < 2; i++) {
    warns.push({ x: starts[i].x + dirs[i].x * travel / 2, y: starts[i].y + dirs[i].y * travel / 2, dx: dirs[i].x, dy: dirs[i].y, len: travel, w: c.width, until: T + tel });
  }
  yield tel;
  if (b.dead) return;
  warns = [];
  const life = (travel + c.count * c.spacing) / spd + 0.5;
  for (let h = 0; h < 2; h++) {
    const d = dirs[h], perp = { x: -d.y, y: d.x };
    for (let i = 0; i < c.count; i++) {
      const j = rnd(-0.4, 0.4);
      oxen.push({ x: starts[h].x - d.x * i * c.spacing + perp.x * j, y: starts[h].y - d.y * i * c.spacing + perp.y * j, dx: d.x, dy: d.y, speed: spd, life, dmg: c.dmg, anim: Math.random() * 6 });
    }
  }
  yield travel / spd;
}
function* bossShoot(b) {
  const c = b.cfg.shoot;
  const tel = c.telegraph || 0.55;
  for (let k = 0; k < c.bursts; k++) {
    if (b.dead) return;
    const aim = nrm(P.x - b.x, P.y - b.y);
    b.face = aim;
    warns.push({ kind: 'cone', x: b.x, y: b.y, dx: aim.x, dy: aim.y, len: 6.8, spread: c.spread, until: T + tel });
    yield tel;
    if (b.dead) return;
    for (let i = 0; i < c.shots; i++) {
      const off = c.shots === 1 ? 0 : (-c.spread + (2 * c.spread) * i / (c.shots - 1)) * Math.PI / 180;
      const cs = Math.cos(off), sn = Math.sin(off);
      const d = { x: aim.x * cs - aim.y * sn, y: aim.x * sn + aim.y * cs };
      shots.push({ x: b.x + d.x * 0.6, y: b.y + d.y * 0.6, dx: d.x, dy: d.y, speed: c.speed, life: 2.2, dmg: c.dmg, from: 'enemy' });
    }
    sfx('shoot');
    if (k < c.bursts - 1) yield c.delay;
  }
}
function* bossLunge(b) {
  if (b.dead) return;
  const aim = nrm(P.x - b.x, P.y - b.y);
  b.face = aim;
  sfx('yell');
  for (let i = 0; i < 4; i++) {
    b.x = clamp(b.x - aim.x * 0.22, 1.2, L.w - 1.2);
    b.y = clamp(b.y - aim.y * 0.22, 1.2, L.h - 1.2);
    yield 0.05;
  }
  if (b.dead) return;
  const len = 4.4;
  warns.push({ x: b.x + aim.x * len / 2, y: b.y + aim.y * len / 2, dx: aim.x, dy: aim.y, len, w: 1.1, until: T + 0.5 });
  yield 0.5;
  if (b.dead) return;
  const steps = 8, stepLen = len / steps;
  for (let i = 0; i < steps; i++) {
    b.x = clamp(b.x + aim.x * stepLen, 1.2, L.w - 1.2);
    b.y = clamp(b.y + aim.y * stepLen, 1.2, L.h - 1.2);
    b.face = aim;
    if (P && !P.dead && dist(b, P) < b.r + P.r + 0.15) hurt(P, 1);
    yield 0.03;
  }
  if (b.enraged && !b.dead) yield* bossShoot(b);
}
function* summon(b) {
  const c = b.cfg.summon;
  sfx('yell');
  fxs.push({ type: 'text', x: b.x, y: b.y - 2.2, text: 'ÔÔ, RAPAZIADA!', until: T + 1.3, t0: T, color: '#f4efe6' });
  yield 0.35;
  if (b.dead) return;
  const spawned = [];
  for (let i = 0; i < c.count; i++) {
    const ang = Math.PI * 2 / c.count * i + 0.4;
    const e = spawnEnemy('fuzil', clamp(b.x + Math.cos(ang) * c.radius, 1.2, L.w - 1.2), clamp(b.y + Math.sin(ang) * c.radius, 1.2, L.h - 1.2),
      { counts: false, drop: 0, speed: 0, detect: 0, holdFire: true, expireAt: T + 4 });
    e.ghost = true;
    spawned.push(e);
  }
  const tel = 0.45;
  for (const e of spawned) {
    const aim = nrm(P.x - e.x, P.y - e.y);
    e.face = aim; e._aim = aim;
    warns.push({ x: e.x + aim.x * 3, y: e.y + aim.y * 3, dx: aim.x, dy: aim.y, len: 6, w: 0.42, until: T + tel });
  }
  yield tel;
  if (b.dead) return;
  for (const e of spawned) {
    if (e.dead) continue;
    const d = e._aim;
    shots.push({ x: e.x + d.x * 0.5, y: e.y + d.y * 0.5, dx: d.x, dy: d.y, speed: 8, life: 1.8, dmg: 1, from: 'enemy' });
  }
  sfx('shoot');
  yield 0.25;
  for (const e of spawned) { if (!e.dead) { e.dead = true; e.removeAt = T + 0.25; } }
}
function updateBoss(e, dt) {
  e.moving = false;
  const c = e.cfg;
  if (!e.revealed && dist(P, e) <= (c.reveal || 9)) e.revealed = true;
  if (e.dead || !e.active || e.busy || G.locked) return;
  if (T >= e.nextPick) {
    e.chasing = Math.random() < c.chase;
    e.nextPick = T + (e.chasing ? c.chaseTime : c.wander);
    e.dest = { x: c.arena.x + rnd(-c.arena.hx, c.arena.hx), y: c.arena.y + rnd(-c.arena.hy, c.arena.hy) };
  }
  const g = e.chasing ? P : e.dest, dx = g.x - e.x, dy = g.y - e.y, d = hyp(dx, dy);
  if (d >= 0.2) { e.face = { x: dx / d, y: dy / d }; move(e, e.face.x * e.moveSpeed * dt, e.face.y * e.moveSpeed * dt); e.moving = true; }
  if (c.melee && T >= e.nextMelee && dist(e, P) <= c.melee.range) {
    e.nextMelee = T + c.melee.cd; e.hitAt = T + c.melee.windup; e.hitRange = c.melee.range * 1.3; e.hitDmg = c.melee.dmg;
  }
}
function bossTouch() {
  if (G.locked || !P || P.dead) return;
  for (const e of enemies) {
    if (!e.boss || e.dead || !e.active || !e.cfg.touch) continue;
    if (dist(e, P) < e.r + P.r + 0.05) hurt(P, e.cfg.touch);
  }
}

/* ---------------- Inimigo comum ---------------- */
function updateEnemy(e, dt) {
  if (e.boss) { updateBoss(e, dt); return; }
  e.moving = false;
  if (e.dead) return;
  if (e.expireAt && T >= e.expireAt) { e.dead = true; e.removeAt = T + 0.3; return; }
  if (e.flee) {
    e.face = { x: 1, y: 0 }; e.moving = true;
    e.fleeT = (e.fleeT || 0) + dt;
    move(e, 11 * dt, 0);
    if (e.x >= L.w - e.r - 0.08 || e.fleeT > 2.2) { e.dead = true; e.removeAt = T + 0.12; }
    return;
  }
  if (e.holdFire || G.locked) return;
  const dx = P.x - e.x, dy = P.y - e.y, d = hyp(dx, dy);
  if (d > e.detect || d < 0.001) return;
  const dir = { x: dx / d, y: dy / d };
  e.face = dir;
  if (e.ranged && d <= e.rRange && d > e.atkRange) {
    if (T >= e.nextShot) {
      e.nextShot = T + e.shotCd;
      shots.push({ x: e.x + dir.x * 0.6, y: e.y + dir.y * 0.6, dx: dir.x, dy: dir.y, speed: 8, life: 2, dmg: 1, from: 'enemy' });
      sfx('shoot');
    }
    return;
  }
  if (d > e.atkRange) { if (e.speed > 0) { move(e, dir.x * e.speed * dt, dir.y * e.speed * dt); e.moving = true; } return; }
  if (T >= e.nextAtk) { e.nextAtk = T + e.atkCd; e.hitAt = T + e.windup; e.hitRange = e.atkRange * 1.3; e.hitDmg = e.dmg; }
}

/* ---------------- Jogador ---------------- */
function reloadDur() { return comps.some(c => c.role === 'ze' && c.active) ? 1.0 : 1.5; }
function attack() {
  const aim = getAim() || { x: P.face.x, y: P.face.y };
  if (P.weapon === 'melee') {
    if (T < P.nextMelee) return;
    P.strike = { x: aim.x, y: aim.y };
    P.swingKind = 'melee';
    P.nextMelee = T + 0.24; P.atkStart = T; P.atkUntil = T + 0.26;
    sfx('swing');
    const cx = P.x + P.strike.x * 0.85, cy = P.y + P.strike.y * 0.85;
    fxs.push({ type: 'arc', x: P.x, y: P.y, ang: Math.atan2(P.strike.y, P.strike.x), until: T + 0.16, t0: T });
    for (const e of enemies) if (!e.dead && hyp(e.x - cx, e.y - cy) <= 0.62 + e.r) hurt(e, CFG.melee);
  } else {
    if (P.reloading || T < P.nextShot || P.ammo <= 0) return;
    P.nextShot = T + 0.28;
    const base = Math.atan2(aim.y, aim.x);
    const spread = CFG.spread * Math.PI / 180;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5);
      const ang = base + t * spread;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const center = i === 2;
      shots.push({ x: P.x + dx * 0.55, y: P.y + dy * 0.55, dx, dy, speed: 13, life: 0.7, dmg: center ? CFG.gun : Math.max(1, Math.round(CFG.gun / 3)), from: 'player', radius: 0.38 });
    }
    sfx('shoot');
    fxs.push({ type: 'flash', x: P.x + aim.x * 0.95, y: P.y - 0.4 + aim.y * 0.95, until: T + 0.08, t0: T });
    P.ammo--;
    if (P.ammo <= 0) {
      P.reloading = true; P.reloadEnd = T + reloadDur();
      if (G.day === 2 && L && !L.zeLine && comps.some(c => c.role === 'ze' && c.active)) {
        L.zeLine = true;
        const z = comps.find(c => c.role === 'ze');
        fxs.push({ type: 'text', x: z.x, y: z.y - 1.4, text: 'Pega bala, cumpade.', until: T + 1.6, t0: T, color: '#f4efe6' });
      }
    }
  }
}
function updatePlayer(dt) {
  P.moving = false;
  if (P.reloading && T >= P.reloadEnd) { P.ammo = 6; P.reloading = false; sfx('reload'); }
  if (G.locked || P.dead) return;
  let ix = 0, iy = 0;
  if (keys.KeyW || keys.ArrowUp) iy -= 1;
  if (keys.KeyS || keys.ArrowDown) iy += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (Math.abs(pad.lx) > 0.2) ix += pad.lx;
  if (Math.abs(pad.ly) > 0.2) iy += pad.ly;
  const m = hyp(ix, iy);
  if (m > 0.08) {
    const d = { x: ix / m, y: iy / m };
    P.moveDir = d;
    P.face = d;
    const spd = (T < P.atkUntil ? 3.4 : 4) * Math.min(1, m);
    P.moving = true;
    move(P, d.x * spd * dt, d.y * spd * dt);
  }
  const gun = G.day >= 2;
  if (wasPressed('Digit1', 'Numpad1')) P.weapon = 'melee';
  else if (wasPressed('Digit2', 'Numpad2') && gun) P.weapon = 'ranged';
  else if (wasPressed('Tab')) P.weapon = (P.weapon === 'melee' && gun) ? 'ranged' : 'melee';
  if (wheel < -5) P.weapon = 'melee'; else if (wheel > 5 && gun) P.weapon = 'ranged';
  if (wasPressed('KeyJ') || pad.attack || (mouse.pressed && !consumed)) attack();
}

/* ---------------- Fases ---------------- */
function obs(x, y, w, h) { L.obs.push({ x, y, w, h }); }
function prop(key, x, y, wu, col) { L.props.push({ key, x, y, wu, col }); if (col) obs(x - col[0] / 2, y - col[1], col[0], col[1]); }
function house(x, y, w, h) { L.houses.push({ x, y, w, h }); obs(x, y + h * 0.4, w, h * 0.6); }
function fence(x, y, w, h) { L.fences.push({ x, y, w, h }); obs(x, y, w, h); }
const PROP_TYPES = [
  { key: 'rock', wu: 2.2, col: [1.7, 0.7] }, { key: 'rock2', wu: 1.4, col: [1.0, 0.5] },
  { key: 'cactus', wu: 1.1, col: [0.45, 0.35] }, { key: 'cactus2', wu: 0.9, col: [0.4, 0.3] },
  { key: 'barrel', wu: 1.0, col: [0.7, 0.4] }, { key: 'barrel2', wu: 1.0, col: [0.7, 0.4] }
];
const DECO_TYPES = [{ key: 'plant', wu: 0.8 }, { key: 'plant2', wu: 1.0 }, { key: 'twig', wu: 0.7 }, { key: 'skull', wu: 0.8 }, { key: 'plant', wu: 0.6 }];
function scatter(seed, n, keep, types, isDeco) {
  const r = mulberry(seed); let placed = 0, tries = 0;
  while (placed < n && tries < n * 40) {
    tries++;
    const x = 1 + r() * (L.w - 2), y = 2 + r() * (L.h - 2.5);
    if (!keep(x, y)) continue;
    const t = types[Math.floor(r() * types.length)];
    if (isDeco) L.props.push({ key: t.key, x, y, wu: t.wu }); else prop(t.key, x, y, t.wu, t.col);
    placed++;
  }
}
function newLevel(w, h) {
  enemies = []; shots = []; oxen = []; warns = []; fxs = []; pickups = []; cos = []; trig = []; comps = [];
  finishing = false; overAt = 0; G.locked = false; DLG.active = false; G.hint = null; shakeMag = 0;
  L = { w, h, obs: [], props: [], houses: [], fences: [], road: null, uses: null, cave: null, intro: [], outro: [], objective: '', botija: null, hold: false, healed: false, zeLine: false, fled: false, introDone: false, siege: false, poteSeen: false };
}
function mkPlayer(x, y) {
  P = mkChar({ x, y, r: 0.32, hp: CFG.hp, max: CFG.hp, inv: 1.05, tint: '#8d5a3c', hat: 'straw', hatCol: '#c4b48a', isPlayer: true, weapon: 'melee', ammo: 6, reloading: false, reloadEnd: 0, nextMelee: 0, nextShot: 0, moveDir: { x: 0, y: 1 }, strike: { x: 0, y: 1 }, swingKind: '' });
  P.onDie = () => { if (finishing) return; G.locked = true; overAt = T + 0.9; };
}
function mkComp(x, y, tint, hatCol, active, name, role) {
  const c = mkChar({ x, y, r: 0.3, tint, hat: 'straw', hatCol, active, name, role: role || '', nextShot: 0 });
  comps.push(c); return c;
}
const L_ = t => ({ s: t[0], t: t[1] });

function buildDay(n) {
  G.day = n; G.state = 'play';
  if (n === 1) buildDay1(); else if (n === 2) buildDay2(); else buildDay3();
  cam.x = P.x; cam.y = P.y;
  const dayTitles = { 1: 'DIA 1 — A BOTIJA', 2: 'DIA 2 — OS COBRADORES', 3: 'DIA 3 — O DIABO LOIRO' };
  G.banner = { text: dayTitles[n], until: T + 3 };
  const hints = {
    1: 'WASD anda, mouse mira a arma, J ou clique ataca, Esc pausa',
    2: 'Trabuco: 2 ou Tab. O Zé recarrega mais rápido.',
    3: 'O trabuco espalha. A trilha é a investida. A carta fica no chão.'
  };
  say(L.intro, () => { L.introDone = true; G.hint = { text: hints[n], until: T + 8 }; });
}

function buildPrologue() {
  G.day = 0; G.state = 'play';
  newLevel(22, 14);
  L.hold = true;
  L.salt = true;
  L.saltT = 0;
  L.saltSkip = false;
  mkPlayer(8.2, 8.2);
  G.locked = true;
  house(1.4, 2.0, 5.2, 3.8);
  L.objective = 'Olhe o pote. Depois pegue o facão na parede.';
  L.uses = [
    { id: 'pote', x: 6.1, y: 8.5, r: 1.35, label: 'Pote de feijão', lines: [L_(['Tôin', 'Esse pote fica. É da casa. Nem um grão de feijão.'])], cb: () => { L.poteSeen = true; L.objective = 'Agora pegue o facão na parede.'; } },
    { id: 'facao', x: 3.7, y: 6.55, r: 1.4, label: 'Facão', need: 'poteSeen', deny: [L_(['Tôin', 'Esse facão eu pego já. Antes quero olhar o que eu vou defender.'])], lines: [L_(['Tôin', 'Vou chamar os cumpadres. Sozinho eu não seguro esse bando.'])], cb: () => { G.locked = true; fadeTo(() => startDay(1)); } }
  ];
  scatter(4, 7, (x, y) => x > 12, DECO_TYPES, true);
  const mulher = mkComp(20.4, 8.1, '#c4a494', '#d4c4b4', false, 'Mulher', 'npc');
  cam.x = P.x; cam.y = P.y;
  L.intro = [
    L_(['A mulher', 'Lampião passou na minha casa. Obrigou um subordinado a comer um quilo de sal.']),
    L_(['A mulher', 'O bando vem pra essa comunidade. Eu corri o sertão inteiro pra avisar.']),
    L_(['Tôin', 'Cangaceiro nenhum leva o que é meu.'])
  ];
  startCo((function* () {
    const t0 = T;
    while (!L.saltSkip && (T - t0) < 12) {
      if ((T - t0) > 25) break;
      yield 0.05;
    }
    L.salt = false;
    G.fade = 1;
    G.fadeDir = -1;
    G.banner = { text: 'O QUINTAL', until: T + 3 };
    const tx = 11.2, ty = 8.1;
    while (hyp(mulher.x - tx, mulher.y - ty) > 0.25) {
      const d = nrm(tx - mulher.x, ty - mulher.y);
      mulher.x += d.x * 0.28; mulher.y += d.y * 0.28; mulher.moving = true; mulher.face = d;
      yield 0.05;
    }
    mulher.moving = false; mulher.face = { x: -1, y: 0 };
    say(L.intro, () => { L.introDone = true; G.hint = { text: 'Chegue perto e aperte E no pote, depois no facão.', until: T + 9 }; });
  })(), null, false);
}

function buildDay1() {
  newLevel(42, 16);
  mkPlayer(4.2, 9);
  house(1.2, 1.6, 4.2, 3.3);
  house(13.0, 1.6, 4.2, 3.3);
  const ze = mkComp(15.3, 8.15, '#6d8a52', '#8aa878', false, 'Zé', 'ze');
  L.objective = 'Procure o cumpadre Zé, a leste.';
  L.road = [{ x0: 5, x1: 40, y: 9, h: 2.2 }];
  L.cave = { x: 34.2, y: 8.7 };
  const clear = (x, y) => {
    if (Math.abs(y - 9) < 1.7 && x > 3.5 && x < 40) return false;
    if (x < 8 && y < 12) return false;
    if (x > 11.5 && x < 19 && y < 12) return false;
    if (x > 26 && x < 40 && y > 3.5 && y < 14) return false;
    return true;
  };
  scatter(11, 12, clear, PROP_TYPES);
  scatter(12, 16, (x, y) => !(x > 27 && x < 40 && y > 4 && y < 14), DECO_TYPES, true);
  L.botija = { x: 34.2, y: 9.1, open: false };
  L.props.push({ key: 'sign', x: 21.5, y: 7.5, wu: 1.0 });
  L.props.push({ key: 'skull', x: 26.6, y: 6.1, wu: 0.9 }, { key: 'skull', x: 26.6, y: 11.9, wu: 0.9 });
  L.intro = [
    L_(['Tôin', 'O Zé mora adiante. A botija que ele falou está mais pra leste.'])
  ];
  trig.push({ x: 11.5, y: 5, w: 6, h: 8, lines: [
    L_(['Zé', 'Cumpade Tôin! Que cara é essa? O cangaço chegou, foi?']),
    L_(['Tôin', 'Chegou, Zé. Querem levar tudo que eu tenho. Preciso de ajuda, e de dinheiro pra me armar.']),
    L_(['Zé', 'A botija do velho boiadeiro! Dizem que a alma dele ainda vigia o ouro. Vambora, eu vou contigo.'])
  ], cb: () => { ze.active = true; L.objective = 'Siga a leste até a botija.'; } });
  trig.push({ x: 25.2, y: 3, w: 2.4, h: 10, lines: [
    L_(['Alma do Boiadeiro', 'Quem ousa mexer no ouro deste vaqueiro?']),
    L_(['Alma do Boiadeiro', 'Escute o meu berrante... e CORRA!'])
  ], cb: () => { L.objective = 'Saia da faixa vermelha. O berrante avisa.'; G.hint = { text: 'Faixa acesa no chão: espere e saia.', until: T + 7 }; } });
  makeBoss({
    name: 'Alma do Boiadeiro', x: 34, y: 9, hp: bossLife(8), tint: '#a8d8ff', hat: 'boiadeiro', alpha: 0.78, scale: 1.3, floaty: true,
    speed: 2.1, attackCooldown: 2.7, activation: 8, firstDelay: 0.7, wander: 1.5, chase: 0.2, chaseTime: 1.3,
    arena: { x: 33.2, y: 9, hx: 6.2, hy: 4 }, attacks: ['stampede'],
    stampede: { count: 5, spacing: 1.15, speed: 7.2, lane: 2.3, telegraph: 1.35, width: 1.4, dmg: 1 },
    touch: 1, reveal: 10,
    onDie: () => { L.botija.open = true; }
  });
  L.outro = [
    L_(['Narrador', 'O fantasma se desfaz em poeira. O ouro da botija brilha debaixo da terra.']),
    L_(['Zé', 'Eita, cumpade! Tem ouro pra armar meio sertão!']),
    L_(['Narrador', 'Recompensa: dinheiro da botija e a ajuda do cumpadre Zé.'])
  ];
}

function buildDay2() {
  newLevel(50, 28);
  mkPlayer(4, 14);
  mkComp(3, 15.2, '#6d8a52', '#8aa878', true, 'Zé', 'ze');
  const nono = mkComp(25.2, 13.2, '#7d6e96', '#a89bb8', false, 'Nonô', 'atirador');
  const luzia = mkComp(26.1, 15.4, '#b47b70', '#c4a098', false, 'Luzia', 'rezador');
  L.objective = 'Ache Nonô e Luzia. O cerco está no leste.';
  const groups = [{ x: 16, y: 13 }, { x: 22, y: 16 }, { x: 32, y: 14 }, { x: 25.5, y: 14 }];
  const near = (x, y, p, r) => hyp(x - p.x, y - p.y) < r;
  scatter(21, 28, (x, y) => !near(x, y, { x: 4, y: 14 }, 5) && !groups.some(g => near(x, y, g, 3.4)), PROP_TYPES);
  scatter(22, 30, (x, y) => !groups.some(g => near(x, y, g, 2.2)), DECO_TYPES, true);
  fence(18.2, 11.4, 3.2, 0.28);
  fence(20.4, 17.2, 0.28, 2.4);
  fence(28.5, 12.2, 2.8, 0.28);
  spawnEnemy('facao', 15.2, 12.2); spawnEnemy('facao', 16.8, 15.4);
  spawnEnemy('facao', 21.4, 15.2); spawnEnemy('fuzil', 23.2, 17.4);
  spawnEnemy('fuzil', 31.2, 12.4, { survivor: true });
  spawnEnemy('fuzil', 32.4, 15.6, { survivor: true });
  spawnEnemy('facao', 33.2, 13.6, { survivor: true });
  L.intro = [
    L_(['Narrador', 'Armado com o ouro da botija, Tôin segue com Zé atrás dos outros cumpadres.']),
    L_(['Zé', 'Nonô e Luzia moram no leste. Ouvi que os cobradores estão em cima deles.']),
    L_(['Tôin', 'Então é pra lá. O trabuco eu troco na tecla 2.'])
  ];
  trig.push({ x: 8, y: 9, w: 4, h: 10, lines: [
    L_(['Cangaceiro', 'Entrega o que tu tem, matuto! É ordem do Capitão!']),
    L_(['Nonô', 'Acuda, Tôin! Eles querem levar até a minha rede!']),
    L_(['Luzia', 'Eu fico com vocês. Quem sangrar, eu cuido.'])
  ], cb: () => { nono.active = true; luzia.active = true; L.siege = true; L.objective = 'Livre o cerco. O Nonô atira, a Luzia cuida.'; } });
  L.beforeOutro = () => {
    nono.active = true; luzia.active = true;
    if (L.fled) L.outro.splice(2, 0, L_(['Narrador', 'Três cangaceiros escapam pro mato. Vão se juntar ao Diabo Loiro.']));
  };
  L.outro = [
    L_(['Nonô', 'Brigado, cumpade. Conte com o meu tiro.']),
    L_(['Luzia', 'E com a minha garapa. Quem cai, eu levanto.']),
    L_(['Narrador', 'Recompensa: armas, roupas e o dinheiro dos cobradores.']),
    L_(['Tôin', 'Vocês buscam reforço no povoado. Eu volto pra defender a minha casa.'])
  ];
}

function buildDay3() {
  newLevel(30, 20);
  mkPlayer(15, 14);
  house(12.5, 0.6, 5, 4);
  L.objective = 'Defenda a sua casa. Você está sozinho.';
  scatter(31, 10, (x, y) => (x < 4 || x > 26 || y < 5 || y > 17) && !(x > 10 && x < 20 && y < 6), PROP_TYPES);
  scatter(32, 18, () => true, DECO_TYPES, true);
  L.props.push({ key: 'cactus', x: 23.3, y: 7.4, wu: 1.6, col: [0.6, 0.4] });
  L.intro = [
    L_(['Narrador', 'Dia 3. Zé, Nonô e Luzia foram buscar reforço. Tôin volta sozinho pra casa.']),
    L_(['Tôin', 'Tem um chapéu atrás do cacto. E um barulho que não é vento.']),
    L_(['Corisco', 'Virou o rosto, homem! Tô no meio do serviço!']),
    L_(['Tôin', 'Diabo Loiro... cagando no meu quintal?']),
    L_(['Corisco', 'Um cristão não pode nem fazer as necessidades em paz?!']),
    L_(['Corisco', 'Já que viu, sobrou pra tu. Vem, rapaziada!'])
  ];
  makeBoss({
    name: 'Corisco — o Diabo Loiro', x: 23.1, y: 7.8, hp: bossLife(10), tint: '#e6c36a', hat: 'leather', scale: 1.2,
    speed: 2.3, attackCooldown: 2.15, activation: 40, firstDelay: 0.6, wander: 1.6, chase: 0.45, chaseTime: 1.6,
    reveal: 16, arena: { x: 15, y: 11, hx: 10, hy: 6 },
    attacks: ['shoot', 'lunge', 'summon', 'lunge'],
    melee: { range: 1.15, windup: 0.4, cd: 1.35, dmg: 1 },
    shoot: { bursts: 1, shots: 4, spread: 24, delay: 0.3, speed: 7.6, dmg: 1, telegraph: 0.7 },
    summon: { count: 3, radius: 2.3, life: 1 },
    onDie: (b) => { L.letterDrop = { x: b.x, y: b.y + 0.45 }; }
  });
  L.outro = [
    L_(['Corisco', 'Ugh... tu ganhou essa, Tôin. Mas o Capitão já vem aí.']),
    L_(['Corisco', 'A carta caiu no chão. Lê, se tiver coragem.']),
    L_(['Tôin', 'Que venham. Eu defendo a minha casa.'])
  ];
}

/* ---------------- Fluxo ---------------- */
function fadeTo(cb) { G.fadeDir = 1; G.fadeCb = cb; }
function startDay(n) { buildDay(n); }
function* finishRoutine() {
  yield 1.5;
  yield () => !DLG.active;
  if (L.beforeOutro) L.beforeOutro();
  sfx('win');
  let done = false;
  say(L.outro, () => { done = true; });
  yield () => done;
  if (G.day >= 3) {
    L.letter = L.letterDrop || { x: P.x + 0.9, y: P.y };
    L.letterGot = false;
    L.objective = 'Pegue a carta no chão.';
    G.locked = false;
    yield () => L.letterGot;
    G.locked = true;
    fadeTo(() => { G.state = 'end'; G.locked = false; if (!G.carta) { G.carta = true; sfx('carta'); } });
  } else {
    G.locked = true;
    fadeTo(() => startDay(G.day + 1));
  }
}
function updateFade(dt) {
  if (!G.fadeDir) return;
  G.fade += G.fadeDir * dt * 2.5;
  if (G.fadeDir > 0 && G.fade >= 1) { G.fade = 1; const cb = G.fadeCb; G.fadeCb = null; G.fadeDir = -1; if (cb) cb(); }
  else if (G.fadeDir < 0 && G.fade <= 0) { G.fade = 0; G.fadeDir = 0; }
}
function pauseItems() {
  return ['Continuar', 'Recomeçar o dia', G.god ? 'Invencível: ligado' : 'Invencível: desligado', 'Pular a luta', 'Os ajuste', 'Menu'];
}
function confirmPause() {
  const i = G.pauseSel || 0;
  if (i === 0) G.state = 'play';
  else if (i === 1) { if (G.day <= 0) buildPrologue(); else startDay(G.day); }
  else if (i === 2) G.god = !G.god;
  else if (i === 3) { devSkip(); G.state = 'play'; }
  else if (i === 4) openOptions('pause');
  else { G.locked = false; DLG.active = false; G.state = 'menu'; }
}
function handlePause() {
  const n = pauseItems().length;
  if (wasPressed('Escape')) { G.state = 'play'; return; }
  if (wasPressed('ArrowUp', 'KeyW')) G.pauseSel = (G.pauseSel + n - 1) % n;
  if (wasPressed('ArrowDown', 'KeyS')) G.pauseSel = (G.pauseSel + 1) % n;
  if (wasPressed('Enter', 'Space')) { confirmPause(); return; }
  if (mouse.pressed) {
    const items = pauseItems();
    for (let i = 0; i < items.length; i++) {
      const y = 188 + i * 48;
      if (Math.abs(pointer.x - VW / 2) < 190 && pointer.y > y - 28 && pointer.y < y + 16) { G.pauseSel = i; confirmPause(); return; }
    }
  }
}
function tryInteract() {
  if (!L || !L.uses || !L.introDone || G.locked || consumed || !wasPressed('KeyE')) return;
  const u = L.uses.find(it => !it.used && dist(P, it) <= it.r);
  if (!u) return;
  if (u.need && !L[u.need]) { say(u.deny); return; }
  u.used = true;
  say(u.lines, u.cb);
}
function updateCompanions(dt) {
  for (const c of comps) {
    c.moving = false;
    if (!c.active || G.locked) continue;
    const d = dist(c, P);
    if (d > 1.8) {
      const nx = (P.x - c.x) / d, ny = (P.y - c.y) / d, st = Math.min(3.1 * dt, d - 1.5);
      if (st > 0) { c.x += nx * st; c.y += ny * st; c.face = { x: nx, y: ny }; c.moving = true; }
    }
    c.x = clamp(c.x, 0.4, L.w - 0.4); c.y = clamp(c.y, 0.4, L.h - 0.4);
    if (c.role === 'atirador' && T >= (c.nextShot || 0)) {
      let best = null, bd = 7;
      for (const e of enemies) {
        if (e.dead || e.boss) continue;
        const dd = dist(c, e);
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) {
        c.nextShot = T + 2.5;
        const a = nrm(best.x - c.x, best.y - c.y);
        c.face = a;
        shots.push({ x: c.x + a.x * 0.5, y: c.y + a.y * 0.5, dx: a.x, dy: a.y, speed: 11, life: 1.3, dmg: 1, from: 'ally' });
        sfx('shoot');
      }
    }
  }
  const luzia = comps.find(c => c.role === 'rezador' && c.active);
  if (luzia && !G.locked && L && !L.healed && P && P.hp > 0 && P.hp <= 2) {
    L.healed = true;
    pickups.push({ x: P.x + 0.4, y: P.y, type: 'garapa' });
    fxs.push({ type: 'text', x: luzia.x, y: luzia.y - 1.5, text: 'Toma a garapa, meu fio.', until: T + 1.6, t0: T, color: '#d8f0a8' });
  }
}
function maybeFlee() {
  if (!L || G.day !== 2 || L.fled || finishing) return;
  const alive = enemies.filter(e => !e.dead && e.counts);
  if (!alive.length || alive.some(e => !e.survivor)) return;
  L.fled = true;
  for (const e of alive) {
    e.counts = false; e.flee = true; e.drop = 0; e.holdFire = true;
    if (e.x < P.x + 4) e.x = Math.min(L.w - 3, P.x + 6);
  }
}
function openOptions(from) { G.optFrom = from; G.optSel = 0; G.state = 'options'; }
function closeOptions() { applyCfg(); G.state = G.optFrom === 'pause' ? 'pause' : 'menu'; }
function optRows() {
  const chefes = ['manso', 'danado', 'cão nos coro'];
  const tiro = ['juntinho', 'no peito', 'esparramado'];
  const bossIx = CFG.boss < 1 ? 0 : CFG.boss > 1 ? 2 : 1;
  const shotIx = CFG.spread <= 14 ? 0 : CFG.spread >= 36 ? 2 : 1;
  return [
    { label: 'Chapéu do Tôin', value: String(CFG.hp) },
    { label: 'Corte do facão', value: String(CFG.melee) },
    { label: 'Chumbo do trabuco', value: String(CFG.gun) },
    { label: 'Os chefe', value: chefes[bossIx] },
    { label: 'A chumbada', value: tiro[shotIx] },
    { label: 'Arre, voltar', value: '' }
  ];
}
function tweakOpt(i, dir) {
  if (i === 0) {
    CFG.hp = clamp(CFG.hp + dir, 3, 12);
    if (P) { P.max = CFG.hp; P.hp = CFG.hp; }
  } else if (i === 1) CFG.melee = clamp(CFG.melee + dir, 2, 10);
  else if (i === 2) CFG.gun = clamp(CFG.gun + dir, 1, 8);
  else if (i === 3) {
    const steps = [0.5, 1, 2];
    let k = CFG.boss < 1 ? 0 : CFG.boss > 1 ? 2 : 1;
    k = clamp(k + dir, 0, 2);
    CFG.boss = steps[k];
  } else if (i === 4) CFG.spread = clamp(CFG.spread + dir * 8, 8, 48);
  else return;
  try { applyCfg(); } catch (e) {}
}
function handleOptions() {
  const rows = optRows();
  const n = rows.length;
  if (wasPressed('Escape', 'KeyO', 'Digit0', 'Numpad0')) { closeOptions(); return; }
  if (wasPressed('ArrowUp', 'KeyW')) G.optSel = (G.optSel + n - 1) % n;
  if (wasPressed('ArrowDown', 'KeyS')) G.optSel = (G.optSel + 1) % n;
  const dir = (wasPressed('ArrowRight', 'KeyD') ? 1 : 0) + (wasPressed('ArrowLeft', 'KeyA') ? -1 : 0);
  if (dir) tweakOpt(G.optSel, dir);
  if (wasPressed('Enter', 'Space') && G.optSel === n - 1) { closeOptions(); return; }
  if (!mouse.pressed) return;
  for (let i = 0; i < n; i++) {
    const y = 150 + i * 58;
    if (pointer.y < y - 26 || pointer.y > y + 22) continue;
    if (pointer.x < 80 || pointer.x > 880) continue;
    G.optSel = i;
    if (i === n - 1) { closeOptions(); return; }
    if (pointer.x >= 820 && pointer.x <= 890) tweakOpt(i, 1);
    else if (pointer.x >= 560 && pointer.x <= 630) tweakOpt(i, -1);
    return;
  }
}
function takeLetter() {
  if (!L || !L.letter || L.letterGot || !P || P.dead || G.locked) return;
  const d = dist(P, L.letter);
  if (d < 0.6 || (d < 1.2 && wasPressed('KeyE'))) {
    L.letterGot = true;
    sfx('pick');
    fxs.push({ type: 'text', x: P.x, y: P.y - 1.4, text: 'A carta do Capitão.', until: T + 1.4, t0: T, color: '#f4efe6' });
  }
}
function devSkip() {
  if (G.day <= 0) { fadeTo(() => startDay(1)); return; }
  enemies.forEach(e => { if (e.counts && !e.dead) { e.dead = true; e.removeAt = T; if (e.onDie) e.onDie(e); } });
}

/* ---------------- Update ---------------- */
function update(dt) {
  pollPad();
  updateMusic();
  shakeMag = Math.max(0, shakeMag - dt * 1.5);
  updateFade(dt);
  consumed = false;
  if (G.state === 'options') { handleOptions(); return; }
  if (G.state === 'menu') {
    const wantOpt = wasPressed('KeyO', 'Digit0', 'Numpad0');
    const hit = menuButtonAt(pointer.x, pointer.y);
    if (wantOpt || (mouse.pressed && hit === 'opt')) { openOptions('menu'); return; }
    if (wasPressed('Digit1', 'Numpad1') || (mouse.pressed && hit === 'd1')) startDay(1);
    else if (wasPressed('Digit2', 'Numpad2') || (mouse.pressed && hit === 'd2')) startDay(2);
    else if (wasPressed('Digit3', 'Numpad3') || (mouse.pressed && hit === 'd3')) startDay(3);
    else if (wasPressed('Enter', 'Space') || (mouse.pressed && hit === 'play')) buildPrologue();
    return;
  }
  if (G.state === 'end') {
    if (wasPressed('Enter', 'Space') || mouse.pressed) { G.carta = false; G.state = 'menu'; }
    return;
  }
  if (G.state === 'over') {
    if (wasPressed('KeyR', 'Enter', 'Space') || mouse.pressed) { if (G.day <= 0) buildPrologue(); else startDay(G.day); }
    else if (wasPressed('KeyM', 'Escape')) G.state = 'menu';
    return;
  }
  if (G.state === 'pause') { handlePause(); return; }
  if ((wasPressed('Escape') || pad.pause) && !G.fadeDir) { G.state = 'pause'; G.pauseSel = 0; return; }
  if (DEV && wasPressed('KeyP')) G.god = !G.god;
  if (DEV && wasPressed('KeyN') && !finishing && !G.fadeDir && !DLG.active) devSkip();

  if (L && L.salt) {
    if (wasPressed('Enter', 'Space') || mouse.pressed) L.saltSkip = true;
    if (L.saltT > 25) L.saltSkip = true;
    L.saltT += dt;
  }
  updateDialogue(dt);
  stepCos(dt);
  if (L && L.salt) return;
  updatePlayer(dt);
  updateCompanions(dt);
  for (const e of enemies) updateEnemy(e, dt);
  for (const e of enemies) {
    if (e.hitAt && T >= e.hitAt) { e.hitAt = 0; if (!e.dead && !G.locked && dist(e, P) <= e.hitRange) hurt(P, e.hitDmg); }
  }
  bossTouch();
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    if (a.dead || b.dead || a.boss || b.boss || a.ghost || b.ghost) continue;
    const d = dist(a, b);
    if (d > 0 && d < 0.6) { const px = (a.x - b.x) / d * 0.02, py = (a.y - b.y) / d * 0.02; move(a, px, py); move(b, -px, -py); }
  }
  enemies = enemies.filter(e => !(e.dead && T >= e.removeAt));

  if (!G.locked) {
    for (const s of shots) {
      s.x += s.dx * s.speed * dt; s.y += s.dy * s.speed * dt; s.life -= dt;
      if (blocked(s.x, s.y, 0.05)) { s.life = 0; continue; }
      if (s.from === 'player' || s.from === 'ally') {
        const rad = s.radius || 0.12;
        for (const e of enemies) if (!e.dead && hyp(e.x - s.x, e.y - s.y) <= e.r + rad) { hurt(e, s.dmg); s.life = 0; break; }
      } else if (!P.dead && hyp(P.x - s.x, P.y - s.y) <= P.r + 0.12) { hurt(P, s.dmg); s.life = 0; }
    }
    shots = shots.filter(s => s.life > 0);
    for (const o of oxen) {
      o.x += o.dx * o.speed * dt; o.y += o.dy * o.speed * dt; o.life -= dt; o.anim += dt * 14;
      if (!P.dead && hyp(o.x - P.x, o.y - P.y) < 0.55) hurt(P, o.dmg);
    }
    oxen = oxen.filter(o => o.life > 0);
  }
  fxs = fxs.filter(f => f.until > T);
  warns = warns.filter(w => w.until > T);

  for (const p of pickups) {
    if (!p.got && !P.dead && hyp(p.x - P.x, p.y - P.y) < 0.7 && P.hp < P.max) {
      P.hp++; p.got = true; sfx('pick');
      fxs.push({ type: 'text', x: P.x, y: P.y - 1.6, text: '+1 chapéu', until: T + 0.9, t0: T, color: '#9be07a' });
    }
  }
  pickups = pickups.filter(p => !p.got);
  tryInteract();
  takeLetter();

  maybeFlee();
  const waveClear = L && !L.hold && !P.dead && !enemies.some(e => e.counts && !e.dead);
  if (!finishing && waveClear) { finishing = true; startCo(finishRoutine()); }
  else if (!G.locked && !finishing) {
    for (const t of trig) {
      if (!t.played && P.x >= t.x && P.x <= t.x + t.w && P.y >= t.y && P.y <= t.y + t.h) { t.played = true; say(t.lines, t.cb); break; }
    }
  }
  if (overAt && T >= overAt && !finishing) { overAt = 0; G.state = 'over'; }

  const k = Math.min(1, 5 * dt);
  cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * k;
  const hw = VW / UNIT / 2, hh = VH / UNIT / 2;
  cam.x = L.w <= hw * 2 ? L.w / 2 : clamp(cam.x, hw, L.w - hw);
  cam.y = L.h <= hh * 2 ? L.h / 2 : clamp(cam.y, hh, L.h - hh);
}

/* ---------------- Desenho ---------------- */
function drawHat(type, u, col) {
  ctx.save();
  if (type === 'straw') {
    ctx.fillStyle = col || '#c4b48a';
    ctx.beginPath(); ctx.ellipse(0, 0, 9 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -0.4 * u, 4.6 * u, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#6b3b1e'; ctx.fillRect(-4.6 * u, -1.9 * u, 9.2 * u, 1.3 * u);
  } else if (type === 'leather') {
    ctx.fillStyle = '#6f431f';
    ctx.beginPath(); ctx.ellipse(0, 0, 9.5 * u, 2.8 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a5428';
    ctx.beginPath(); ctx.arc(0, -0.2 * u, 5 * u, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8d7352';
    for (const dx of [-3.2, 0, 3.2]) { ctx.beginPath(); ctx.arc(dx * u, (-1.4 - (dx === 0 ? 1.6 : 0)) * u, 0.75 * u, 0, Math.PI * 2); ctx.fill(); }
  } else {
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath(); ctx.ellipse(0, 0, 10.5 * u, 2.6 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-4.2 * u, -5 * u, 8.4 * u, 5 * u);
    ctx.fillStyle = '#6b4a30'; ctx.fillRect(-4.2 * u, -1.8 * u, 8.4 * u, 1.2 * u);
  }
  ctx.restore();
}
function drawChar(e) {
  let key = 'idle', fr;
  const swinging = e.isPlayer && e.swingKind === 'melee' && T < e.atkUntil;
  const dir = swinging && e.strike ? e.strike : e.face;
  if (swinging) {
    key = 'attack';
    const dur = Math.max(0.01, e.atkUntil - e.atkStart);
    fr = Math.min(6, Math.floor((T - e.atkStart) / dur * 7));
  } else if (e.moving) { key = 'walk'; fr = Math.floor(T * 8 + e.animOff) % 4; }
  else fr = Math.floor(T * 3 + e.animOff) % 4;
  const col = (T < e.flash) ? '#ff4040' : e.tint;
  const img = tinted(key, col);
  if (!img) return;
  const pose = sheetPose(dir);
  const row = pose.row, flip = pose.flip;
  const sc = e.scale;
  const fl = e.floaty ? -0.35 + Math.sin(T * 2.2) * 0.1 : 0;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = 0.28 * (e.dead ? Math.max(0, (e.removeAt - T) / 0.35) : 1);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0.02, 0.42 * sc, 0.16 * sc, 0, 0, Math.PI * 2); ctx.fill();
  let a = e.alpha;
  if (e.dead) a *= Math.max(0, (e.removeAt - T) / 0.35);
  if (e.expireAt && !e.dead) a *= Math.min(1, (e.expireAt - T) / 0.6 + 0.3);
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.translate(0, fl);
  ctx.scale(sc * (flip ? -1 : 1), sc);
  ctx.drawImage(img, fr * 32, row * 32, 32, 32, -16 * PX, -30 * PX, 32 * PX, 32 * PX);
  ctx.translate(0, (9 - 30) * PX);
  drawHat(e.hat, PX, e.hatCol);
  ctx.restore();
  if (e.hitAt && T < e.hitAt && !e.dead) {
    ctx.save(); ctx.fillStyle = '#ff3b2f'; ctx.fillRect(e.x - 0.06, e.y - 2.15 * sc, 0.12, 0.3); ctx.fillRect(e.x - 0.06, e.y - 1.75 * sc, 0.12, 0.12); ctx.restore();
  }
  if (e.isEnemy && !e.boss && !e.dead && e.hp < e.max) {
    ctx.fillStyle = '#000a'; ctx.fillRect(e.x - 0.4, e.y - 1.95, 0.8, 0.11);
    ctx.fillStyle = '#e0453a'; ctx.fillRect(e.x - 0.4, e.y - 1.95, 0.8 * e.hp / e.max, 0.11);
  }
}
function drawOx(o) {
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(Math.atan2(o.dy, o.dx));
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0.05, 0.08, 0.62, 0.36, 0, 0, Math.PI * 2); ctx.fill();
  const step = Math.sin(o.anim) * 0.09;
  ctx.fillStyle = '#3b2415';
  ctx.fillRect(-0.3 + step, -0.34, 0.2, 0.1); ctx.fillRect(0.2 - step, -0.34, 0.2, 0.1);
  ctx.fillRect(-0.3 - step, 0.24, 0.2, 0.1); ctx.fillRect(0.2 + step, 0.24, 0.2, 0.1);
  ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.ellipse(0, 0, 0.56, 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a06a3c'; ctx.beginPath(); ctx.ellipse(-0.05, -0.05, 0.4, 0.16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6d4526'; ctx.beginPath(); ctx.ellipse(0.52, 0, 0.23, 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.5, -0.12); ctx.quadraticCurveTo(0.62, -0.42, 0.78, -0.3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.5, 0.12); ctx.quadraticCurveTo(0.62, 0.42, 0.78, 0.3); ctx.stroke();
  ctx.strokeStyle = '#3b2415'; ctx.beginPath(); ctx.moveTo(-0.55, 0); ctx.lineTo(-0.78, 0.1 + step); ctx.stroke();
  ctx.restore();
}
function drawProp(p) {
  const im = IMG[p.key]; if (!im) return;
  const w = p.wu, h = w * im.height / im.width;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.02, w * 0.42, Math.min(0.3, h * 0.12), 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(im, p.x - w / 2, p.y - h, w, h);
}
function drawHouse(hs) {
  const { x, y, w, h } = hs;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 0.25, y + h - 0.12, w, 0.38);
  ctx.fillStyle = '#b7a090'; ctx.fillRect(x, y + h * 0.26, w, h * 0.74);
  ctx.fillStyle = '#8d7b6c'; ctx.fillRect(x, y + h * 0.26, 0.25, h * 0.74); ctx.fillRect(x + w - 0.25, y + h * 0.26, 0.25, h * 0.74);
  ctx.fillStyle = '#8e3a32'; ctx.fillRect(x - 0.2, y, w + 0.4, h * 0.3);
  ctx.fillStyle = '#6e2c28'; ctx.fillRect(x - 0.2, y + h * 0.26, w + 0.4, 0.12);
  ctx.fillStyle = '#7a342e'; for (let i = 0; i < w; i += 0.9) ctx.fillRect(x + i, y + 0.08, 0.06, h * 0.2);
  ctx.fillStyle = '#4a2a16'; ctx.fillRect(x + w / 2 - 0.5, y + h - 1.35, 1.0, 1.35);
  ctx.fillStyle = '#2f3e52'; ctx.fillRect(x + 0.6, y + h * 0.5, 0.75, 0.75); ctx.fillRect(x + w - 1.35, y + h * 0.5, 0.75, 0.75);
  ctx.fillStyle = '#f3e3c3'; ctx.fillRect(x + 0.6, y + h * 0.5 + 0.35, 0.75, 0.06);
}
function drawUseItem(u) {
  ctx.save(); ctx.translate(u.x, u.y);
  if (u.id === 'pote') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0.05, 0.32, 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a85a32'; ctx.beginPath(); ctx.ellipse(0, -0.22, 0.3, 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9844a'; ctx.fillRect(-0.22, -0.5, 0.44, 0.26);
    ctx.fillStyle = '#6a3a22'; ctx.fillRect(-0.16, -0.58, 0.32, 0.08);
    ctx.fillStyle = '#e6c56a'; ctx.fillRect(-0.12, -0.36, 0.24, 0.08);
  } else {
    ctx.rotate(-0.7);
    ctx.fillStyle = '#d5dbe0'; ctx.fillRect(0, -0.07, 0.78, 0.1);
    ctx.fillStyle = '#6b3a1e'; ctx.fillRect(-0.22, -0.1, 0.26, 0.18);
    ctx.fillStyle = '#c9a06a'; ctx.fillRect(-0.04, -0.06, 0.08, 0.08);
  }
  const pulse = 0.45 + 0.35 * Math.sin(T * 5);
  ctx.strokeStyle = `rgba(244, 239, 230, ${pulse})`; ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.arc(0, -0.3, 0.62 + Math.sin(T * 4) * 0.05, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function drawBotija(b) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0.05, 0.6, 0.22, 0, 0, Math.PI * 2); ctx.fill();
  if (!b.open) {
    ctx.fillStyle = '#a8562b'; ctx.beginPath(); ctx.ellipse(0, -0.45, 0.46, 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a4422'; ctx.fillRect(-0.2, -1.05, 0.4, 0.25);
    ctx.fillStyle = '#c8733a'; ctx.beginPath(); ctx.ellipse(-0.15, -0.55, 0.1, 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,.25)'; ctx.beginPath(); ctx.arc(0, -0.5, 0.8 + Math.sin(T * 3) * 0.08, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#ffd24a';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 2.1) * 0.35, -0.15 + Math.sin(i * 1.7) * 0.15, 0.13, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,220,120,.3)'; ctx.beginPath(); ctx.arc(0, -0.2, 0.8 + Math.sin(T * 4) * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function drawGarapa(p) {
  const by = Math.sin(T * 4 + p.x) * 0.06;
  ctx.save(); ctx.translate(p.x, p.y + by);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0.06 - by, 0.25, 0.09, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b8a2a'; ctx.beginPath(); ctx.ellipse(0, -0.28, 0.2, 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4e6a1c'; ctx.fillRect(-0.06, -0.62, 0.12, 0.16);
  ctx.fillStyle = '#e8d070'; ctx.fillRect(-0.12, -0.32, 0.24, 0.12);
  ctx.restore();
}
function drawFences() {
  for (const f of L.fences) {
    ctx.fillStyle = '#6b4328'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#d7c09a';
    if (f.w >= f.h) { ctx.fillRect(f.x, f.y, f.w, 0.05); ctx.fillRect(f.x, f.y + f.h - 0.05, f.w, 0.05); }
    else { ctx.fillRect(f.x, f.y, 0.05, f.h); ctx.fillRect(f.x + f.w - 0.05, f.y, 0.05, f.h); }
  }
}
function sandSet() {
  return [IMG.sand0, IMG.sand1, IMG.sand2, IMG.sand3].filter(Boolean);
}
function sandAt(ix, iy) {
  const sands = sandSet();
  if (!sands.length) return IMG.tile || null;
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  return sands[n % sands.length];
}
function drawGround() {
  const sands = sandSet();
  const ts = sands.length ? 2 : 4;
  const t0 = sands[0] || IMG.tile;
  if (!t0) return;
  const x0 = Math.floor((cam.x - VW / UNIT / 2) / ts) * ts, y0 = Math.floor((cam.y - VH / UNIT / 2) / ts) * ts;
  for (let x = x0; x < cam.x + VW / UNIT / 2 + ts; x += ts) {
    for (let y = y0; y < cam.y + VH / UNIT / 2 + ts; y += ts) {
      const im = sandAt(Math.round(x / ts), Math.round(y / ts)) || t0;
      ctx.drawImage(im, x, y, ts + 0.02, ts + 0.02);
    }
  }
  ctx.fillStyle = 'rgba(70, 82, 58, 0.28)';
  ctx.fillRect(0, 0, L.w, L.h);
  if (L.road) {
    for (const r of L.road) {
      ctx.fillStyle = '#6a4a32';
      ctx.fillRect(r.x0, r.y - r.h / 2, r.x1 - r.x0, r.h);
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(r.x0, r.y - 0.08, r.x1 - r.x0, 0.16);
    }
  }
  if (L.cave) {
    ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(L.cave.x, L.cave.y, 3.3, 2.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#120c09'; ctx.beginPath(); ctx.ellipse(L.cave.x, L.cave.y + 0.15, 2.1, 1.55, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#2a1a0c';
  ctx.fillRect(-20, -20, L.w + 40, 20); ctx.fillRect(-20, L.h, L.w + 40, 20); ctx.fillRect(-20, 0, 20, L.h); ctx.fillRect(L.w, 0, 20, L.h);
}
function drawFx(f) {
  const p = (T - f.t0) / (f.until - f.t0);
  if (f.type === 'arc') {
    ctx.save(); ctx.translate(f.x, f.y - 0.5); ctx.rotate(f.ang);
    ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 0.72, -0.8 + p * 0.4, 0.8 + p * 0.4); ctx.stroke(); ctx.restore();
  } else if (f.type === 'spark') {
    ctx.fillStyle = `rgba(255,240,180,${1 - p})`;
    for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, d = 0.15 + p * 0.45; ctx.fillRect(f.x + Math.cos(a) * d - 0.05, f.y + Math.sin(a) * d - 0.05, 0.1, 0.1); }
  } else if (f.type === 'flash') {
    ctx.fillStyle = `rgba(244,239,230,${1 - p})`; ctx.beginPath(); ctx.arc(f.x, f.y, 0.38, 0, Math.PI * 2); ctx.fill();
  } else if (f.type === 'ring') {
    ctx.strokeStyle = `rgba(255,233,168,${1 - p})`; ctx.lineWidth = 0.09;
    for (let i = 0; i < 3; i++) { const q = clamp(p * 1.4 - i * 0.22, 0, 1); ctx.beginPath(); ctx.arc(f.x, f.y - 0.8, 0.5 + q * 3.2, 0, Math.PI * 2); ctx.stroke(); }
  } else if (f.type === 'after') {
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - p);
    ctx.fillStyle = '#ffe0a8'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 0.55, 0.22, 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function drawWarn(w) {
  const pulse = 0.38 + 0.22 * Math.sin(T * 18);
  if (w.kind === 'cone') {
    const spread = (w.spread || 20) * Math.PI / 180;
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(Math.atan2(w.dy, w.dx));
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, w.len, -spread, spread); ctx.closePath();
    ctx.fillStyle = `rgba(230, 50, 30, ${pulse})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 140, .85)'; ctx.lineWidth = 0.06; ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(Math.atan2(w.dy, w.dx));
  ctx.fillStyle = `rgba(220,40,30,${pulse})`; ctx.fillRect(-w.len / 2, -w.w / 2, w.len, w.w);
  ctx.strokeStyle = 'rgba(255, 220, 160, .8)'; ctx.lineWidth = 0.05; ctx.strokeRect(-w.len / 2, -w.w / 2, w.len, w.w);
  ctx.restore();
}
function w2s(x, y) { return { x: (x - cam.x) * UNIT + VW / 2, y: (y - cam.y) * UNIT + VH / 2 }; }
function text(str, x, y, size, col, align, shadow) {
  ctx.font = `bold ${size}px "Courier New", monospace`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
  if (shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = col || '#fff'; ctx.fillText(str, x, y);
}
function wrap(str, maxW) {
  const words = str.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

function renderWorld() {
  if (!L || !P) return;
  ctx.save();
  const jx = shakeMag ? (Math.random() - 0.5) * shakeMag * UNIT * 1.3 : 0;
  const jy = shakeMag ? (Math.random() - 0.5) * shakeMag * UNIT * 1.3 : 0;
  ctx.translate(VW / 2 - cam.x * UNIT + jx, VH / 2 - cam.y * UNIT + jy);
  ctx.scale(UNIT, UNIT);
  ctx.imageSmoothingEnabled = false;
  drawGround();
  for (const w of warns) if (w.until > T) drawWarn(w);
  const list = [];
  for (const p of L.props) list.push({ y: p.y, f: () => drawProp(p) });
  for (const h of L.houses) list.push({ y: h.y + h.h, f: () => drawHouse(h) });
  if (L.fences.length) list.push({ y: 0, f: drawFences });
  if (L.botija) list.push({ y: L.botija.y, f: () => drawBotija(L.botija) });
  if (L.uses) for (const u of L.uses) if (!u.used) list.push({ y: u.y, f: () => drawUseItem(u) });
  if (L.letter && !L.letterGot) list.push({ y: L.letter.y, f: () => drawLetter(L.letter) });
  for (const p of pickups) list.push({ y: p.y, f: () => drawGarapa(p) });
  for (const c of comps) list.push({ y: c.y, f: () => drawChar(c) });
  for (const e of enemies) list.push({ y: e.y, f: () => drawChar(e) });
  for (const o of oxen) list.push({ y: o.y, f: () => drawOx(o) });
  list.push({ y: P.y, f: () => drawChar(P) });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) it.f();
  if (P.swingKind === 'melee' && T < P.atkUntil && P.strike && !P.dead) {
    const d = P.strike;
    const dur = Math.max(0.01, P.atkUntil - P.atkStart);
    const u = clamp((T - P.atkStart) / dur, 0, 1);
    const sweep = u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    const base = Math.atan2(d.y, d.x);
    const blade = IMG.facao;
    const len = 1.05;
    const drawBlade = (ang, alpha, scale) => {
      ctx.save();
      ctx.translate(P.x + Math.cos(ang) * 0.28, P.y - 0.42 + Math.sin(ang) * 0.28);
      ctx.rotate(ang);
      ctx.globalAlpha = alpha;
      if (blade) {
        const w = len * scale * blade.width / blade.height;
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(blade, -w / 2, -len * scale, w, len * scale);
      } else {
        ctx.fillStyle = '#d7dde2';
        ctx.fillRect(0.02, -0.04, 0.7 * scale, 0.08);
      }
      ctx.restore();
    };
    drawBlade(base + 1.15 - sweep * 1.9, 0.28, 0.82);
    drawBlade(base + 0.85 - sweep * 1.9, 0.45, 0.92);
    drawBlade(base + 1.05 - sweep * 1.85, 1, 1);
  }
  for (const s of shots) {
    ctx.save(); ctx.translate(s.x, s.y - 0.5); ctx.rotate(Math.atan2(s.dy, s.dx));
    if (s.from === 'player') {
      ctx.fillStyle = 'rgba(244,239,230,.4)';
      ctx.fillRect(-1.05, -0.03, 0.55, 0.06);
      ctx.fillStyle = '#f4efe6';
      ctx.fillRect(-0.48, -0.045, 0.72, 0.09);
    } else {
      ctx.fillStyle = s.from === 'ally' ? '#c6e68a' : '#ff8a5a';
      ctx.fillRect(-0.16, -0.05, 0.32, 0.1);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, -0.03, 0.14, 0.06);
    }
    ctx.restore();
  }
  if (P.weapon === 'ranged' && !P.dead && G.day >= 2) {
    const aim = getAim() || P.face;
    ctx.save();
    ctx.translate(P.x + aim.x * 0.28, P.y - 0.5 + aim.y * 0.28);
    ctx.rotate(Math.atan2(aim.y, aim.x));
    ctx.fillStyle = '#3a3532';
    ctx.fillRect(0, -0.04, 0.95, 0.08);
    ctx.fillStyle = '#2a2624';
    ctx.fillRect(0.78, -0.055, 0.2, 0.11);
    ctx.fillStyle = '#6a5348';
    ctx.fillRect(-0.14, -0.07, 0.22, 0.14);
    ctx.restore();
  }
  for (const f of fxs) if (f.type !== 'text') drawFx(f);
  ctx.restore();
  for (const f of fxs) if (f.type === 'text') { const s = w2s(f.x, f.y - (T - f.t0) * 0.6); text(f.text, s.x, s.y, 16, f.color, 'center'); }
}
function drawHatIcon(x, y, full) {
  ctx.save(); ctx.translate(x, y);
  if (full) drawHat('straw', 3.4, '#e0b15a');
  else { ctx.globalAlpha = 0.35; drawHat('straw', 3.4, '#3a3a3a'); }
  ctx.restore();
}
function renderHUD() {
  if (!P || !L) return;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(10, 10, P.max * 36 + 18, 44);
  for (let i = 0; i < P.max; i++) drawHatIcon(32 + i * 36, 38, i < P.hp);
  if (G.day >= 1) {
    const slots = [['Zé', 'ze'], ['Nonô', 'atirador'], ['Luzia', 'rezador']];
    slots.forEach((s, i) => {
      const on = comps.some(c => c.role === s[1] && c.active);
      const x = 10 + i * 72, y = 60;
      ctx.fillStyle = on ? '#7a3e2a' : '#24180f';
      ctx.fillRect(x, y, 68, 16);
      text(s[0], x + 34, y + 12, 11, on ? '#f4efe6' : '#8a7560', 'center', false);
    });
  }
  ctx.font = 'bold 15px "Courier New", monospace';
  const objW = Math.min(520, ctx.measureText(L.objective).width + 28);
  ctx.fillStyle = 'rgba(20,12,6,.82)';
  ctx.fillRect(VW / 2 - objW / 2, 4, objW, 24);
  text(L.objective, VW / 2, 22, 15, '#f4efe6', 'center', false);
  const gun = G.day >= 2;
  if (!DLG.active) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(10, VH - 58, 520, 46);
    text('[1] Facão', 22, VH - 28, 15, P.weapon === 'melee' ? '#f4efe6' : '#8d7f72');
    text('[2] Trabuco', 150, VH - 28, 15, P.weapon === 'ranged' ? '#f4efe6' : '#8d7f72');
    if (gun) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = (!P.reloading && i < P.ammo) ? '#f4efe6' : '#3a322c';
        ctx.fillRect(300 + i * 16, VH - 38, 10, 16);
      }
      if (P.reloading) text('recarregando...', 404, VH - 26, 13, '#f4efe6');
    } else text('(dia 2)', 300, VH - 28, 14, '#8d7f72');
  }
  for (const e of enemies) if (e.boss && e.revealed && !e.dead) {
    const w = 380, x = VW / 2 - w / 2, y = 86;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - 4, y - 22, w + 8, 38);
    text(e.name, VW / 2, y - 6, 14, '#f4efe6', 'center', false);
    ctx.fillStyle = '#3a1512'; ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = e.enraged ? '#ff5a2a' : '#d43a30'; ctx.fillRect(x, y, w * e.hp / e.max, 10);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 10);
  }
  if (G.banner && T < G.banner.until) {
    const a = clamp(Math.min(G.banner.until - T, 1), 0, 1);
    ctx.font = 'bold 28px "Courier New", monospace';
    const bw = Math.min(VW - 80, ctx.measureText(G.banner.text).width + 40);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,12,6,.82)';
    ctx.fillRect(VW / 2 - bw / 2, 104, bw, 36);
    text(G.banner.text, VW / 2, 132, 28, '#f4efe6', 'center', false);
    ctx.globalAlpha = 1;
  }
  if (G.hint && T < G.hint.until && !DLG.active && G.state !== 'pause') {
    ctx.font = 'bold 13px "Courier New", monospace';
    const tw = Math.min(VW - 40, ctx.measureText(G.hint.text).width + 28);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(VW / 2 - tw / 2, VH - 96, tw, 30);
    text(G.hint.text, VW / 2, VH - 75, 13, '#f4efe6', 'center', false);
  }
  if (L.letter && !L.letterGot && !DLG.active && !G.locked && dist(P, L.letter) < 1.2) {
    const s = w2s(L.letter.x, L.letter.y - 0.8);
    text('E  Carta', s.x, s.y, 15, '#f4efe6', 'center');
  }
  if (L.uses && L.introDone && !DLG.active && !G.locked) {
    for (const u of L.uses) {
      if (u.used || dist(P, u) > u.r) continue;
      const s = w2s(u.x, u.y - 1.25);
      text('E  ' + u.label, s.x, s.y, 15, '#f4efe6', 'center');
      break;
    }
  }
  if (DLG.active) {
    const ln = DLG.lines[DLG.i], bx = 40, bw = VW - 80, bh = 150, by = VH - bh - 18;
    ctx.fillStyle = 'rgba(20,12,6,.92)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#7a3e2a'; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
    text(ln.s, bx + 20, by + 30, 18, '#f4efe6', 'left');
    ctx.font = 'bold 18px "Courier New", monospace';
    const lines = wrap(ln.t.substring(0, DLG.shown), bw - 40);
    lines.forEach((l, i) => text(l, bx + 20, by + 62 + i * 26, 18, '#f4efe6', 'left', false));
    if (DLG.shown >= ln.t.length && Math.floor(T * 2) % 2 === 0) text('▼', bx + bw - 28, by + bh - 14, 16, '#c4b6a4', 'left', false);
  }
}
function drawLetter(c) {
  const by = Math.sin(T * 3) * 0.04;
  ctx.save();
  ctx.translate(c.x, c.y + by);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 0.08 - by, 0.28, 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(-0.15);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(-0.22, -0.32, 0.44, 0.52);
  ctx.fillStyle = '#7a3e2a';
  ctx.fillRect(-0.14, -0.22, 0.28, 0.04);
  ctx.fillRect(-0.14, -0.12, 0.2, 0.03);
  ctx.fillRect(-0.14, -0.04, 0.24, 0.03);
  ctx.fillStyle = '#8e3a32';
  ctx.beginPath(); ctx.arc(0.08, -0.28, 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function menuButtons() {
  return [
    { id: 'play', label: 'Bora começar', y: 268 },
    { id: 'd1', label: 'Dia 1 — a botija', y: 322 },
    { id: 'd2', label: 'Dia 2 — os cobrador', y: 376 },
    { id: 'd3', label: 'Dia 3 — o diabo loiro', y: 430 },
    { id: 'opt', label: 'Os ajuste', y: 492 }
  ];
}
function menuButtonAt(x, y) {
  if (!pointer.inside && !mouse.pressed) return '';
  for (const b of menuButtons()) {
    if (Math.abs(x - VW / 2) < 220 && y > b.y - 24 && y < b.y + 16) return b.id;
  }
  return '';
}
function renderMenu() {
  ctx.fillStyle = '#1a1612'; ctx.fillRect(0, 0, VW, VH);
  const t = IMG.sand0 || IMG.tile;
  if (t) for (let x = 0; x < VW; x += 176) for (let y = 0; y < VH; y += 176) ctx.drawImage(t, x, y, 176, 176);
  ctx.fillStyle = 'rgba(70, 82, 58, 0.28)'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(20,16,12,.78)'; ctx.fillRect(0, 0, VW, VH);
  text('DEFENDE O LAR', VW / 2, 78, 46, '#f4efe6', 'center');
  text('Tôin não entrega a casa', VW / 2, 112, 18, '#c4b6a4', 'center');
  if (IMG.idle) {
    ctx.save(); ctx.translate(150, 210); ctx.scale(1.15, 1.15);
    const img = tinted('idle', '#8d5a3c'); const fr = Math.floor(T * 3) % 4;
    if (img) ctx.drawImage(img, fr * 32, 0, 32, 32, -16 * S, -30 * S, 32 * S, 32 * S);
    ctx.translate(0, (9 - 30) * S); drawHat('straw', S, '#c4b48a'); ctx.restore();
  }
  const hover = menuButtonAt(pointer.x, pointer.y);
  menuButtons().forEach((b) => {
    const on = hover === b.id;
    ctx.fillStyle = b.id === 'opt' ? (on ? '#e0b15a' : '#7a3e2a') : (on ? '#7a3e2a' : '#2a1c12');
    ctx.fillRect(VW / 2 - 210, b.y - 26, 420, 44);
    text(b.label, VW / 2, b.y + 2, b.id === 'play' ? 22 : 18, b.id === 'opt' && !on ? '#f4efe6' : (on && b.id === 'opt' ? '#24180f' : '#f4efe6'), 'center', false);
  });
}
function renderOptions() {
  ctx.fillStyle = '#1a1612'; ctx.fillRect(0, 0, VW, VH);
  const t = IMG.sand0 || IMG.tile;
  if (t) for (let x = 0; x < VW; x += 176) for (let y = 0; y < VH; y += 176) ctx.drawImage(t, x, y, 176, 176);
  ctx.fillStyle = 'rgba(20,16,12,.88)'; ctx.fillRect(0, 0, VW, VH);
  text('OS AJUSTE', VW / 2, 64, 40, '#f4efe6', 'center');
  text('Clica no menos ou no mais. Segura A ou D.', VW / 2, 98, 14, '#c4b6a4', 'center');
  optRows().forEach((row, i) => {
    const y = 150 + i * 58;
    const on = G.optSel === i;
    ctx.fillStyle = on ? '#7a3e2a' : '#2a1c12';
    ctx.fillRect(80, y - 26, 800, 48);
    text(i < 5 ? row.label : '', 110, y + 4, 20, '#f4efe6', 'left', false);
    if (i < 5) {
      ctx.fillStyle = on ? '#e0b15a' : '#3a2a22';
      ctx.fillRect(560, y - 16, 70, 32);
      ctx.fillRect(820, y - 16, 70, 32);
      text('menos', 595, y + 4, 14, on ? '#24180f' : '#f4efe6', 'center', false);
      text(row.value, 725, y + 4, 18, on ? '#e0b15a' : '#f4efe6', 'center', false);
      text('mais', 855, y + 4, 14, on ? '#24180f' : '#f4efe6', 'center', false);
    } else {
      text(row.label, VW / 2, y + 4, 20, on ? '#e0b15a' : '#f4efe6', 'center', false);
    }
  });
}
function drawSilhouette(x, y, maria) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#140c08';
  if (maria) {
    ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(34, 8); ctx.lineTo(-34, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -96, 13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -108, 16, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-3, -118, 6, 14);
  } else {
    ctx.fillRect(-12, -78, 24, 52);
    ctx.beginPath(); ctx.arc(0, -92, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-40, -108, 80, 8);
    ctx.fillRect(-18, -122, 36, 16);
    ctx.save(); ctx.rotate(-0.4); ctx.fillRect(6, -70, 58, 5); ctx.restore();
  }
  ctx.restore();
}
function renderEnd() {
  const sky = ctx.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, '#24160f'); sky.addColorStop(0.45, '#4a2c18'); sky.addColorStop(1, '#100904');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#1a100a'; ctx.fillRect(0, 390, VW, VH);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(VW / 2, 408, 240, 16, 0, 0, Math.PI * 2); ctx.fill();
  drawSilhouette(VW / 2 - 100, 455, false);
  drawSilhouette(VW / 2 + 100, 462, true);
  text('A CARTA', VW / 2, 78, 18, '#c4b6a4', 'center');
  text('Lampião chega ao amanhecer.', VW / 2, 124, 26, '#f4efe6', 'center');
  text('Maria Bonita vem com ele. O desfecho fica aberto.', VW / 2, 168, 16, '#d4cbbd', 'center');
  if (Math.floor(T * 2) % 2 === 0) text('ENTER para voltar ao menu', VW / 2, 520, 16, '#c4b6a4', 'center');
}
function renderOver() {
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(0, 0, VW, VH);
  text('TÔIN CAIU...', VW / 2, 230, 50, '#e0453a', 'center');
  text('R / Enter / clique: tentar o dia de novo', VW / 2, 290, 20, '#f4efe6', 'center');
  text('M: voltar ao menu', VW / 2, 322, 16, '#c4b6a4', 'center');
}
function renderPause() {
  ctx.fillStyle = 'rgba(8,5,3,.82)'; ctx.fillRect(0, 0, VW, VH);
  text('PAUSA', VW / 2, 108, 40, '#f4efe6', 'center');
  pauseItems().forEach((label, i) => {
    const y = 188 + i * 48;
    ctx.fillStyle = G.pauseSel === i ? '#7a3e2a' : '#2a1c12';
    ctx.fillRect(VW / 2 - 200, y - 28, 400, 40);
    text(label, VW / 2, y, 20, G.pauseSel === i ? '#e0b15a' : '#f4efe6', 'center');
  });
  text('W/S escolhe  ·  Enter confirma  ·  Esc continua', VW / 2, 460, 14, '#c4b6a4', 'center');
}
function renderSalt() {
  const t = L.saltT || 0;
  const sky = ctx.createLinearGradient(0, 0, 0, VH);
  sky.addColorStop(0, '#070b14');
  sky.addColorStop(0.55, '#141820');
  sky.addColorStop(1, '#1c140e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#c8c2b4';
  ctx.beginPath(); ctx.arc(760, 90, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#070b14';
  ctx.beginPath(); ctx.arc(748, 82, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 400, VW, 140);
  ctx.fillStyle = '#1a1612';
  ctx.fillRect(0, 388, VW, 16);
  drawSilhouette(250, 430, false);
  const sackX = 430;
  ctx.fillStyle = '#f7f4ee';
  ctx.beginPath(); ctx.ellipse(sackX, 404, 28, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e7e0d6';
  ctx.fillRect(sackX - 10, 368, 20, 24);
  ctx.fillStyle = '#7a3e2a';
  ctx.fillRect(sackX - 12, 386, 24, 5);
  let kx = 545, ky = 378, rot = 0;
  if (t < 4.2) {
    ky = 378;
  } else if (t < 7.0) {
    const u = (t - 4.2) / 2.8;
    kx += Math.sin(t * 8) * (14 + u * 22);
    rot = Math.sin(t * 6) * 0.35 * u;
  } else {
    const u = clamp((t - 7.0) / 1.6, 0, 1);
    rot = u * 1.4;
    ky = 378 + u * 36;
    kx = 545 + 28 * u;
  }
  ctx.save();
  ctx.translate(kx, ky);
  ctx.rotate(rot);
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.moveTo(-40, 2); ctx.lineTo(34, 2); ctx.lineTo(16, -18); ctx.lineTo(-22, -18); ctx.closePath(); ctx.fill();
  ctx.fillRect(-13, -58, 26, 42);
  ctx.beginPath(); ctx.arc(2, -70, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-24, -82, 50, 7);
  ctx.fillRect(-10, -96, 22, 16);
  ctx.restore();
  if (t > 8.4 && t < 11.3) {
    const u = (t - 8.4) / 2.8;
    const wx = 560 + u * 480;
    const bob = Math.sin(u * 22) * 5;
    ctx.save();
    ctx.globalAlpha = u > 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
    ctx.translate(wx, 408 + bob);
    ctx.fillStyle = '#24180f';
    ctx.beginPath(); ctx.moveTo(0, -68); ctx.lineTo(20, 0); ctx.lineTo(-20, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -80, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (t > 10.6) {
    ctx.fillStyle = `rgba(0,0,0,${clamp((t - 10.6) / 1.4, 0, 1)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  text('Enter, Espaço ou clique pula para o quintal', VW / 2, 36, 14, '#f4efe6', 'center');
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  if (G.state === 'menu') renderMenu();
  else if (G.state === 'options') renderOptions();
  else if (G.state === 'end') renderEnd();
  else if (L && L.salt) { renderSalt(); if (G.state === 'pause') renderPause(); }
  else { renderWorld(); renderHUD(); if (G.state === 'over') renderOver(); if (G.state === 'pause') renderPause(); }
  if (G.fade > 0 && !(L && L.salt)) { ctx.fillStyle = `rgba(0,0,0,${G.fade})`; ctx.fillRect(0, 0, VW, VH); }
}

/* ---------------- Loop ---------------- */
let last = performance.now(), ready = false;
function frame(now) {
  if (window.__halt) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.state !== 'pause') T += dt;
  update(dt); render();
  pressed.clear(); mouse.pressed = false; wheel = 0;
  requestAnimationFrame(frame);
}
function boot() { ready = true; requestAnimationFrame(frame); }
window.__dbg = {
  G, DEV, startDay, buildPrologue,
  step: dt => { T += dt; update(dt); render(); pressed.clear(); mouse.pressed = false; wheel = 0; },
  st: () => ({ P, enemies, oxen, shots, comps, L, DLG, finishing, T, warns, G, shakeMag, cam }),
  keys, press: c => pressed.add(c), setT: v => { T = v; },
  setPointer: (x, y) => { pointer.x = x; pointer.y = y; pointer.inside = true; },
  ready: () => ready
};
Object.assign(IMG, images);
boot();
}