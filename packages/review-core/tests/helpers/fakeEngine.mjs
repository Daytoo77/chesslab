// Deterministic stand-in for Stockfish, for tests. A 1-ply material search
// plus hash noise: cheap, fully reproducible, and it exercises every branch
// the real engine does (best/second lines, mates, re-verification at a longer
// movetime). Each adapter keeps a call counter in its noise seed, so results
// depend on WHICH engine of a pool saw WHICH position, in what order — the
// same order-sensitivity a real engine's hash table has.
import { Chess } from 'chess.js';

const V = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function materialFor(g, color) {
  let s = 0;
  for (const row of g.board()) for (const sq of row) if (sq) s += sq.color === color ? V[sq.type] : -V[sq.type];
  return s;
}

const uciOf = (m) => m.from + m.to + (m.promotion || '');

// favour: { [fen]: uci } — moves the engine should rank first (to stage
// sacrifices). At long movetimes half of them are "refuted", so the deep
// brilliant re-verification has something to demote.
export function fakeLines(fen, { multipv = 1, movetime = 300, salt = '', favour = {} } = {}) {
  const g = new Chess(fen);
  const me = g.turn();
  const moves = g.moves({ verbose: true });
  if (!moves.length) return [];
  const fav = favour[fen];
  const favOn = fav && (movetime < 1000 || hash(fen) % 2 === 0);
  const scored = moves.map((m) => {
    g.move(m);
    try {
      if (g.inCheck() && g.isCheckmate()) return { m, mate: 1, key: 1e9 };
      // most valuable piece of ours the opponent attacks (pins ignored — cheap)
      let hang = 0;
      for (const row of g.board()) for (const sq of row) if (sq && sq.color === me && g.isAttacked(sq.square, g.turn())) hang = Math.max(hang, V[sq.type]);
      const noise = (hash(`${fen}|${uciOf(m)}|${movetime}|${salt}`) % 81) - 40;
      const cp = materialFor(g, me) - hang + noise;
      return { m, cp, key: cp };
    } finally { g.undo(); }
  });
  if (favOn) {
    const top = Math.max(...scored.map((s) => s.key));
    for (const s of scored) if (uciOf(s.m) === fav && s.mate == null) { s.cp = Math.min(900, top + 30); s.key = top + 30; }
  }
  scored.sort((a, b) => b.key - a.key || (uciOf(a.m) < uciOf(b.m) ? -1 : 1));
  return scored.slice(0, multipv).map((s) => ({
    depth: 10 + Math.floor(movetime / 100),
    cp: s.mate != null ? null : s.cp,
    mate: s.mate != null ? s.mate : null,
    pv: [uciOf(s.m)],
    wdl: null,
  }));
}

// review-core engine adapter backed by fakeLines
export function makeFakeAdapter(id = 0, favour = {}) {
  let calls = 0;
  return {
    name: 'FakeFish',
    async analyse(fen, { multipv = 1, movetime = 300 } = {}) {
      calls++;
      return fakeLines(fen, { multipv, movetime, salt: `${id}:${calls}`, favour });
    },
  };
}

// favour map that makes the engine prefer every move one side actually played
export function favourPlayed(pgn, color) {
  const g = new Chess();
  g.loadPgn(pgn);
  const out = {};
  const sim = new Chess();
  for (const m of g.history({ verbose: true })) {
    if (m.color === color) out[sim.fen()] = uciOf(m);
    sim.move(m.san);
  }
  return out;
}

export const GAMES = {
  opera: '[Event "Paris"]\n[White "Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0',
  century: '[Event "Third Rosenwald Trophy"]\n[White "Donald Byrne"]\n[Black "Robert James Fischer"]\n[Result "0-1"]\n\n1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1',
  scholar: '1. e4 {[%clk 0:03:00]} e5 {[%clk 0:02:58]} 2. Qh5 {[%clk 0:02:55]} Nc6 {[%clk 0:02:50]} 3. Bc4 {[%clk 0:02:45]} Nf6 {[%clk 0:00:09]} 4. Qxf7# {[%clk 0:02:40]} 1-0',
};

// the cases the golden fixture was recorded from (pre-extraction code)
export const CASES = [
  { id: 'opera-w-fav', game: 'opera', color: 'w', favour: 'w', pool: 1, movetime: 300 },
  { id: 'opera-b', game: 'opera', color: 'b', favour: null, pool: 2, movetime: 300 },
  { id: 'century-b-fav', game: 'century', color: 'b', favour: 'b', pool: 3, movetime: 600 },
  { id: 'century-w', game: 'century', color: 'w', favour: null, pool: 3, movetime: 300 },
  { id: 'scholar-b', game: 'scholar', color: 'b', favour: null, pool: 1, movetime: 300 },
  { id: 'scholar-w', game: 'scholar', color: 'w', favour: 'w', pool: 3, movetime: 1200 },
];
