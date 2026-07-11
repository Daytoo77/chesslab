import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachContext, buildOpeningContext } from '../src/coach.js';

const FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

test('coach context: carries FEN, side to move, eval and engine lines', () => {
  const ctx = buildCoachContext({
    fen: FEN,
    lines: [{ sans: [{ san: 'e5' }, { san: 'Nf3' }], cpWhite: 32 }],
    evalWhite: 32,
    moves: [{ san: 'e4', tag: 'book' }],
    cursor: 1,
    playerColor: 'w',
  });
  assert.ok(ctx.includes(FEN));
  assert.ok(/Side to move: Black/.test(ctx));
  assert.ok(/\+0\.32/.test(ctx));
  assert.ok(/Engine line 1/.test(ctx) && ctx.includes('e5 Nf3'));
});

test('coach context: mate lines are spelled out', () => {
  const ctx = buildCoachContext({ fen: FEN, lines: [{ sans: [{ san: 'Qxf7#' }], mate: 1 }] });
  assert.ok(/mate in 1 for White/.test(ctx));
});

test('coach context: notes the better engine move after a mistake', () => {
  const ctx = buildCoachContext({
    fen: FEN,
    lines: [],
    moves: [{ san: 'Qh5', tag: 'mistake', bestSan: 'Nf3' }],
    cursor: 1,
    playerColor: 'w',
  });
  assert.ok(ctx.includes('the engine preferred Nf3'));
});

test('opening context: FEN + repertoire notes + intended next move', () => {
  const ctx = buildOpeningContext({
    fen: FEN,
    openingName: 'Vienna Game',
    lineName: 'Main line',
    summary: 'The gambit that wins club games.',
    moves: [{ san: 'e4', why: 'stake the center' }, { san: 'e5' }, { san: 'Nc3', why: 'the Vienna move' }],
    ply: 1,
    userColor: 'w',
  });
  assert.ok(ctx.includes('OPENING TRAINER'));
  assert.ok(ctx.includes('Vienna Game — Main line'));
  assert.ok(ctx.includes('stake the center'));            // note on the last move
  assert.ok(ctx.includes('next intended move is e5'));    // continuation
  assert.ok(/student plays White/.test(ctx));
});

test('opening context: end of line -> middlegame handoff', () => {
  const ctx = buildOpeningContext({
    fen: FEN, openingName: 'Vienna Game', moves: [{ san: 'e4' }], ply: 1, userColor: 'w',
  });
  assert.ok(/end of the prepared theory/.test(ctx));
});
