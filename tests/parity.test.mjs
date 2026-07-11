import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeParityMetrics, parityPasses } from '../src/parity.js';

test('parity metrics: computes deltas for accuracy/rating/tags', () => {
  const expected = {
    accuracy: { w: 70, b: 52 },
    rating: { w: 900, b: 600 },
    counts: { w: { best: 3, blunder: 1 }, b: { best: 2, blunder: 2 } },
  };
  const actual = {
    accuracy: { w: 67, b: 50 },
    rating: { w: 840, b: 640 },
    counts: { w: { best: 2, blunder: 2 }, b: { best: 2, blunder: 1 } },
  };
  const m = computeParityMetrics(expected, actual);
  assert.equal(m.accuracyDelta.w, 3);
  assert.equal(m.accuracyDelta.b, 2);
  assert.equal(m.ratingDelta.w, 60);
  assert.equal(m.ratingDelta.b, 40);
  assert.equal(m.tagDeltaTotal, 3);
});

test('parity gate: fails when any tolerance is exceeded', () => {
  const metrics = {
    accuracyDelta: { w: 4, b: 3 },
    ratingDelta: { w: 80, b: 75 },
    tagDeltaTotal: 9,
  };
  const tol = { accuracyMaxDelta: 5, ratingMaxDelta: 100, tagDeltaTotalMax: 8 };
  assert.equal(parityPasses(metrics, tol), false);
});
