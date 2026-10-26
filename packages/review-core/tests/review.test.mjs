import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzePgn, reviewGame } from '../index.js';
import { makeFakeAdapter, favourPlayed, GAMES, CASES } from './helpers/fakeEngine.mjs';

// Recorded from the app's analyzeWithStockfish BEFORE the extraction, driven by
// the same deterministic fake engine. Any drift here is a behaviour change.
const GOLDEN = JSON.parse(fs.readFileSync(new URL('./fixtures/golden.json', import.meta.url), 'utf8'));

const poolFor = (c) => {
  const favour = c.favour ? favourPlayed(GAMES[c.game], c.favour) : {};
  return Array.from({ length: c.pool }, (_, id) => makeFakeAdapter(id, favour));
};

for (const c of CASES) {
  test(`golden: ${c.id} matches the pre-extraction analysis exactly`, async () => {
    const res = await analyzePgn(GAMES[c.game], c.color, { movetime: c.movetime, engine: poolFor(c) });
    assert.deepEqual(JSON.parse(JSON.stringify(res)), GOLDEN[c.id]);
  });
}

test('golden fixture exercises the interesting classifications', () => {
  const seen = new Set();
  for (const r of Object.values(GOLDEN)) for (const m of r.moves) seen.add(m.tag);
  for (const t of ['book', 'forced', 'best', 'great', 'brilliant', 'inaccuracy', 'mistake', 'blunder']) assert.ok(seen.has(t), `missing ${t}`);
});

test('reviewGame: plain JSON with per-move data, sides, weaknesses, coach context', async () => {
  const review = await reviewGame(GAMES.scholar, { engine: makeFakeAdapter(0), color: 'b' });
  assert.deepEqual(JSON.parse(JSON.stringify(review)), review);
  assert.equal(review.moves.length, 7);
  const m = review.moves[5]; // 3...Nf6??
  assert.equal(m.san, 'Nf6');
  assert.equal(m.classification, 'blunder');
  assert.equal(typeof m.evalAfter, 'number');
  assert.ok(Array.isArray(m.motifs) && m.motifs.length > 0);
  for (const c of ['w', 'b']) {
    assert.equal(typeof review.sides[c].accuracy, 'number');
    assert.equal(typeof review.sides[c].rating, 'number');
  }
  assert.ok(review.sides.w.accuracy > review.sides.b.accuracy);
  assert.equal(review.weaknesses.mistakes.length, 1);
  assert.ok(review.weaknesses.topMotifs.length > 0);
  assert.ok(review.weaknesses.mistakes[0].coachContext.includes('FEN:'));
  assert.ok(review.coachContext.includes('Side to move: Black'));
  assert.equal(review.opening, "King's Pawn Game");
});

test('reviewGame: accepts a pool and agrees with analyzePgn', async () => {
  const c = CASES.find((x) => x.id === 'century-w');
  const review = await reviewGame(GAMES.century, { engine: poolFor(c), color: 'w', movetime: c.movetime });
  const g = GOLDEN[c.id];
  assert.deepEqual(review.moves.map((m) => m.classification), g.moves.map((m) => m.tag));
  assert.equal(review.sides.w.accuracy, g.summary.acc.w);
  assert.equal(review.sides.b.accuracy, g.summary.acc.b);
});

test('reviewGame: rejects a missing or malformed engine adapter', async () => {
  await assert.rejects(reviewGame(GAMES.scholar, {}), /engine adapter/);
  await assert.rejects(reviewGame(GAMES.scholar, { engine: { analyze() {} } }), /engine adapter/);
});
