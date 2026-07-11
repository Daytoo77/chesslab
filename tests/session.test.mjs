import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, sessionProgress } from '../src/queue.js';

test('session plan: minutes sum exactly to the requested total', () => {
  for (const total of [15, 30, 45]) {
    const segs = buildSession(total);
    assert.equal(segs.reduce((a, s) => a + s.minutes, 0), total, `total ${total}`);
    assert.ok(segs.every((s) => s.minutes >= 1));
  }
});

test('session plan: tactics and review get the lion share', () => {
  const segs = buildSession(30);
  const byCat = Object.fromEntries(segs.map((s) => [s.cat, s.minutes]));
  assert.ok(byCat.tactics >= byCat.openings);
  assert.ok(byCat.analysis >= byCat.endgames);
});

test('progress: starts at segment 0, zero elapsed', () => {
  const session = { startedAt: 1000, segments: buildSession(30) };
  const p = sessionProgress(session, 1000);
  assert.equal(p.current, 0);
  assert.equal(Math.round(p.elapsedMin), 0);
  assert.equal(p.done, false);
});

test('progress: moves through segments as time passes', () => {
  const segs = buildSession(30); // seg0 ~10-11 min
  const session = { startedAt: 0, segments: segs };
  const afterSeg0 = (segs[0].minutes + 1) * 60000;
  const p = sessionProgress(session, afterSeg0);
  assert.equal(p.current, 1, 'should be in the second segment');
  assert.ok(p.pct > 0 && p.pct < 100);
});

test('progress: completes and credits every category fully', () => {
  const segs = buildSession(30);
  const session = { startedAt: 0, segments: segs };
  const p = sessionProgress(session, 31 * 60000);
  assert.equal(p.done, true);
  assert.equal(p.current, null);
  for (const seg of segs) {
    assert.ok(Math.abs(p.perCat[seg.cat] - seg.minutes) < 0.01, `${seg.cat} fully credited`);
  }
});

test('progress: partial credit matches elapsed time', () => {
  const segs = buildSession(30);
  const session = { startedAt: 0, segments: segs };
  const p = sessionProgress(session, 5 * 60000); // 5 min in
  assert.ok(Math.abs(p.perCat.tactics - 5) < 0.01);
  assert.equal(p.perCat.analysis, 0);
});
