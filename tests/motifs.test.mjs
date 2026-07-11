import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMotifs, parseClocks, tallyMotifs, MOTIF_META } from '../src/motifs.js';

test('parseClocks: extracts remaining seconds per ply', () => {
  const pgn = '1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:55]} 2. Qh5 {[%clk 0:00:12]} *';
  const clocks = parseClocks(pgn);
  assert.equal(clocks[0], 180);
  assert.equal(clocks[1], 175);
  assert.equal(clocks[2], 12);
});

test('parseClocks: PGN without clocks -> null/empty', () => {
  const clocks = parseClocks('1. e4 e5 2. Nf3 *');
  assert.ok(!clocks || clocks.length === 0);
});

test('tallyMotifs: aggregates motif lists', () => {
  const t = tallyMotifs([['hung_piece', 'time_trouble'], ['hung_piece'], []]);
  assert.equal(t.hung_piece, 2);
  assert.equal(t.time_trouble, 1);
});

test('classifyMotifs: the hung-queen blunder is tagged', () => {
  // 1.e4 e5 2.Qh5 Nc6 3.Qxe5+?? Nxe5 — the queen grabs a pawn and hangs
  const tags = classifyMotifs({
    fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3',
    fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4Q3/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 0 3',
    playedMove: { san: 'Qxe5+', from: 'h5', to: 'e5', piece: 'q', captured: 'p', color: 'w' },
    bestMove: 'Nf3',
    replyMove: { san: 'Nxe5', from: 'c6', to: 'e5', piece: 'n', captured: 'q', color: 'b' },
    clkSeconds: 12,
  });
  assert.ok(tags.includes('hung_piece'), `expected hung_piece in ${tags}`);
  assert.ok(tags.includes('time_trouble'), `expected time_trouble in ${tags}`);
});

test('every motif key has complete metadata', () => {
  for (const [key, m] of Object.entries(MOTIF_META)) {
    assert.ok(m.label && m.advice && m.icon, `motif ${key} is missing metadata`);
  }
});
