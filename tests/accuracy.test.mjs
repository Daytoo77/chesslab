import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winPct } from '../src/accuracy.js';

test('winPct: equal position is 50%', () => {
  assert.ok(Math.abs(winPct(0) - 50) < 0.001);
});

test('winPct: monotonic in the eval', () => {
  let prev = -1;
  for (const cp of [-1000, -300, -100, 0, 100, 300, 1000]) {
    const w = winPct(cp);
    assert.ok(w > prev, `winPct(${cp})=${w} not > ${prev}`);
    prev = w;
  }
});

test('winPct: bounded to (0, 100)', () => {
  assert.ok(winPct(10000) <= 100);
  assert.ok(winPct(-10000) >= 0);
});

test('winPct: symmetric around 50', () => {
  assert.ok(Math.abs(winPct(150) + winPct(-150) - 100) < 0.01);
});
