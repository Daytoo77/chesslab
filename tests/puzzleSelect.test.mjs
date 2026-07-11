import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, tierOf, filterByTier, pickNext, pushRecent } from '../src/puzzleSelect.js';

const elo = (p) => p.elo;
const mk = (id, elo) => ({ id, elo });

test('tierOf: covers the full range with no gaps', () => {
  assert.equal(tierOf(0).id, 'beginner');
  assert.equal(tierOf(899).id, 'beginner');
  assert.equal(tierOf(900).id, 'club');
  assert.equal(tierOf(1399).id, 'club');
  assert.equal(tierOf(1400).id, 'advanced');
  assert.equal(tierOf(1899).id, 'advanced');
  assert.equal(tierOf(1900).id, 'master');
  assert.equal(tierOf(5000).id, 'master');
});

test('filterByTier: "all" and unknown tiers pass everything through', () => {
  const puzzles = [mk('a', 700), mk('b', 1600)];
  assert.equal(filterByTier(puzzles, elo, 'all').length, 2);
  assert.equal(filterByTier(puzzles, elo, undefined).length, 2);
  assert.equal(filterByTier(puzzles, elo, 'nonsense').length, 2);
});

test('filterByTier: keeps only the requested band', () => {
  const puzzles = [mk('a', 700), mk('b', 1000), mk('c', 1600), mk('d', 2000)];
  const club = filterByTier(puzzles, elo, 'club');
  assert.deepEqual(club.map((p) => p.id), ['b']);
});

test('pickNext: empty pool returns -1', () => {
  assert.equal(pickNext([], []), -1);
});

test('pickNext: avoids recently-shown ids when alternatives exist', () => {
  const puzzles = [mk('a', 1000), mk('b', 1000), mk('c', 1000)];
  for (let i = 0; i < 20; i++) {
    const idx = pickNext(puzzles, ['a', 'b']);
    assert.equal(puzzles[idx].id, 'c', 'should always pick the only non-recent one');
  }
});

test('pickNext: falls back to the full pool when everything is recent', () => {
  const puzzles = [mk('a', 1000), mk('b', 1000)];
  const idx = pickNext(puzzles, ['a', 'b']);
  assert.ok(idx === 0 || idx === 1, 'never stuck with nothing to offer');
});

test('pushRecent: caps at the given size, dropping the oldest', () => {
  let recent = [];
  for (let i = 0; i < 10; i++) recent = pushRecent(recent, `id${i}`, 4);
  assert.equal(recent.length, 4);
  assert.deepEqual(recent, ['id6', 'id7', 'id8', 'id9']);
});

test('TIERS: exactly 4 bands, contiguous', () => {
  assert.equal(TIERS.length, 4);
  for (let i = 1; i < TIERS.length; i++) assert.equal(TIERS[i].min, TIERS[i - 1].max);
});
