import assert from 'node:assert/strict';
import test from 'node:test';
import { rowFor, sheetPose } from '../src/facing.js';

test('faixas da folha: baixo, diagonal, lado, cima', () => {
  assert.equal(rowFor({ x: 0, y: 1 }), 0);
  assert.equal(rowFor({ x: 0.1, y: -1 }), 4);
  assert.equal(rowFor({ x: 1, y: 0 }), 2);
  assert.equal(rowFor({ x: -1, y: 0 }), 2);
  assert.equal(rowFor({ x: 1, y: 1 }), 1);
  assert.equal(rowFor({ x: -1, y: 1 }), 1);
  assert.equal(rowFor({ x: 1, y: -1 }), 3);
  assert.equal(rowFor({ x: -0.8, y: -0.8 }), 3);
});

test('esquerda espelha as faixas de lado e diagonal', () => {
  assert.equal(sheetPose({ x: 1, y: 0 }).flip, false);
  assert.equal(sheetPose({ x: -1, y: 0 }).flip, true);
  assert.equal(sheetPose({ x: -1, y: 1 }).flip, true);
  assert.equal(sheetPose({ x: -1, y: -1 }).flip, true);
  assert.equal(sheetPose({ x: 0, y: 1 }).flip, false);
  assert.equal(sheetPose({ x: 0, y: -1 }).flip, false);
});
