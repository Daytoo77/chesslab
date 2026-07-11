import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyQueue, motifTrends } from '../src/queue.js';

test('queue: empty state still suggests the core habits', () => {
  const q = buildDailyQueue({});
  const ids = q.map((t) => t.id);
  assert.ok(ids.includes('tactics-goal'));
  assert.ok(ids.includes('analyze'));
  assert.ok(ids.includes('slow-game'));
});

test('queue: due opening lines outrank everything', () => {
  const q = buildDailyQueue({ dueLines: 3, solvedToday: 0 });
  assert.equal(q[0].id, 'openings-due');
});

test('queue: recurring weakness beats a stale one', () => {
  const hot = buildDailyQueue({ topWeakness: ['hung_piece', 9], recentWeaknessCount: 4 });
  const cold = buildDailyQueue({ topWeakness: ['hung_piece', 9], recentWeaknessCount: 0 });
  const score = (q) => q.find((t) => t.id === 'weakness-drill').score;
  assert.ok(score(hot) > score(cold));
  // a hot leak should be the top item when nothing is due
  assert.equal(hot[0].id, 'weakness-drill');
});

test('queue: completed habits drop out', () => {
  const q = buildDailyQueue({ solvedToday: 10, dailyTacticGoal: 10, analyzedToday: true, slowGameToday: true });
  const ids = q.map((t) => t.id);
  assert.ok(!ids.includes('tactics-goal'));
  assert.ok(!ids.includes('analyze'));
  assert.ok(!ids.includes('slow-game'));
});

test('queue: unknown weakness key is ignored, not crashed on', () => {
  const q = buildDailyQueue({ topWeakness: ['not_a_real_motif', 5] });
  assert.ok(!q.some((t) => t.id === 'weakness-drill'));
});

test('trends: fewer recent occurrences reads as improving (down)', () => {
  const mk = (c) => ({ date: '2026-07-01', counts: c });
  const profile = { recent: [mk({ hung_piece: 2 }), mk({ hung_piece: 2 }), mk({}), mk({})] };
  const t = motifTrends(profile);
  assert.equal(t.hung_piece.dir, 'down');
});

test('trends: rising motif reads as worsening (up)', () => {
  const mk = (c) => ({ date: '2026-07-01', counts: c });
  const profile = { recent: [mk({}), mk({}), mk({ missed_fork: 1 }), mk({ missed_fork: 2 })] };
  const t = motifTrends(profile);
  assert.equal(t.missed_fork.dir, 'up');
});

test('trends: too few games -> no verdict', () => {
  assert.deepEqual(motifTrends({ recent: [{ counts: { hung_piece: 3 } }] }), {});
  assert.deepEqual(motifTrends(null), {});
});
