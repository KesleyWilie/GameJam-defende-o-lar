import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { sheetPose } from '../src/facing.js';

function mock2d() {
  const grad = { addColorStop() {} };
  const ctx = new Proxy({ imageSmoothingEnabled: false }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 80 });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
  return ctx;
}

function installDom() {
  const ctx = mock2d();
  const canvas = {
    width: 960,
    height: 540,
    style: {},
    addEventListener() {},
    getContext() { return ctx; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
    focus() {}
  };
  const set = (name, value) => {
    try { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
    catch { /* já existe e é só leitura */ }
  };
  set('window', globalThis);
  set('location', { search: '' });
  set('performance', { now: () => 0 });
  set('requestAnimationFrame', () => 0);
  set('addEventListener', () => {});
  set('document', {
    createElement() {
      return { width: 32, height: 32, getContext: () => mock2d() };
    }
  });
  return canvas;
}

test('loop do jogo: sal, caminhada, armas, dias e chefe', async () => {
  const canvas = installDom();
  const { mount } = await import('../src/game.js');
  const images = {};
  for (const key of ['walk', 'idle', 'attack', 'tile', 'rock', 'rock2', 'cactus', 'cactus2', 'barrel', 'barrel2', 'skull', 'crate', 'sign', 'tree', 'tree2', 'plant', 'plant2', 'twig']) {
    images[key] = { width: key === 'attack' ? 224 : 128, height: key === 'tile' ? 128 : 160 };
  }
  mount(canvas, images);
  const dbg = globalThis.__dbg;
  const step = (dt = 0.05) => dbg.step(dt);
  const st = () => dbg.st();

  dbg.press('Enter');
  step(0.016);
  assert.equal(st().G.state, 'play');
  assert.equal(st().L.salt, true);
  assert.equal(st().G.locked, true);

  for (const mark of [2, 5, 8, 11]) {
    while (st().L.salt && st().L.saltT < mark) step(0.1);
    step(0.016);
  }
  assert.equal(st().L.salt, true);

  dbg.press('Enter');
  step(0.05);
  assert.equal(st().L.salt, false);
  assert.equal(st().G.locked, true);

  let opened = false;
  for (let i = 0; i < 250 && !opened; i++) {
    dbg.press('Enter');
    step(0.05);
    opened = st().L.introDone;
  }
  assert.equal(opened, true);
  assert.equal(st().G.locked, false);

  const move = (code, expect) => {
    st().P && (dbg.keys[code] = true);
    const before = { x: st().P.x, y: st().P.y };
    step(0.12);
    dbg.keys[code] = false;
    const face = st().P.face;
    const pose = sheetPose(face);
    assert.equal(pose.row, expect.row, code);
    assert.equal(pose.flip, expect.flip, code);
    assert.ok(st().P.moving || st().P.x !== before.x || st().P.y !== before.y, code);
  };
  move('KeyS', { row: 0, flip: false });
  move('KeyW', { row: 4, flip: false });
  move('KeyD', { row: 2, flip: false });
  move('KeyA', { row: 2, flip: true });
  dbg.keys.KeyS = true;
  dbg.keys.KeyD = true;
  step(0.12);
  dbg.keys.KeyS = false;
  dbg.keys.KeyD = false;
  assert.equal(sheetPose(st().P.face).row, 1);
  assert.equal(st().P.moveDir.x > 0 && st().P.moveDir.y > 0, true);

  const faceBefore = { ...st().P.face };
  dbg.setPointer(120, 270);
  dbg.press('KeyJ');
  step(0.016);
  assert.ok(st().P.strike.x < 0);
  assert.equal(st().P.face.x, faceBefore.x);
  assert.equal(st().P.face.y, faceBefore.y);
  assert.equal(st().P.swingKind, 'melee');
  assert.equal(st().P.dashLeft, undefined);
  assert.equal(st().G.hitStop, undefined);

  const x0 = st().P.x;
  dbg.keys.ShiftLeft = true;
  dbg.press('ShiftLeft');
  step(0.1);
  dbg.keys.ShiftLeft = false;
  assert.ok(Math.abs(st().P.x - x0) < 0.02);

  dbg.startDay(2);
  st().G.locked = false;
  st().DLG.active = false;
  const foe = st().enemies.find(e => !e.boss && !e.dead);
  st().P.x = foe.x - 0.65;
  st().P.y = foe.y;
  st().cam.x = st().P.x;
  st().cam.y = st().P.y;
  dbg.setPointer(800, 270);
  const hp = foe.hp;
  dbg.press('KeyJ');
  step(0.016);
  assert.ok(foe.hp <= hp - 3 || foe.dead);

  st().P.weapon = 'ranged';
  st().P.ammo = 1;
  st().P.reloading = false;
  st().P.nextShot = 0;
  dbg.press('KeyJ');
  step(0.02);
  assert.equal(st().P.ammo, 0);
  assert.equal(st().P.reloading, true);
  assert.ok(Math.abs((st().P.reloadEnd - st().T) - 1) < 0.05);
  const shot = st().shots.find(s => s.from === 'player');
  assert.ok(shot);

  dbg.startDay(3);
  assert.equal(st().comps.length, 0);
  const corisco = st().enemies.find(e => e.boss);
  assert.match(corisco.name, /Corisco/);
  assert.ok(corisco.cfg.attacks.includes('lunge'));
  st().G.state = 'end';
  step(0.016);

  dbg.startDay(1);
  const alma = st().enemies.find(e => e.boss);
  assert.ok(alma.cfg.attacks.includes('stampede'));

  st().G.locked = false;
  st().DLG.active = false;
  st().P.weapon = 'ranged';
  st().P.ammo = 1;
  st().P.reloading = false;
  st().P.nextShot = 0;
  dbg.press('KeyJ');
  step(0.02);
  assert.ok(Math.abs((st().P.reloadEnd - st().T) - 1.5) < 0.05);
});

test('texto de tela não pede dash nem o título antigo', () => {
  const src = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /dash/i);
  assert.doesNotMatch(src, /Shift/);
  assert.doesNotMatch(src, /hitStop/);
  assert.doesNotMatch(src, /A DEFESA DA CASA/);
  assert.match(src, /DEFENDE O LAR/);
  assert.match(src, /Tôin não entrega a casa/);
  assert.match(html, /Defende o Lar/);
  assert.match(html, /Tôin não entrega a casa/);
  assert.doesNotMatch(html, /dash/i);
  assert.match(src, /#8d5a3c/);
  assert.match(src, /#6d8a52/);
  assert.match(src, /#7d6e96/);
  assert.match(src, /#b47b70/);
  assert.match(src, /#a85a3c/);
  assert.match(src, /#7a4036/);
  assert.match(src, /rgba\(70, 82, 58, 0\.28\)/);
  assert.match(src, /#6a4a32/);
  assert.match(src, /#b7a090/);
  assert.match(src, /recarregando\.\.\./);
  assert.match(src, /Lampião/);
});
