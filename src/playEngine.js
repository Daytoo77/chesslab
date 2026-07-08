// One door for "the coach plays a move": Stockfish if available (optionally
// strength-limited for sparring), built-in engine as a fallback.
// Uses the DEDICATED play engine so moves never queue behind game analysis.
import { Chess } from 'chess.js';
import { getPlayEngine } from './stockfish.js';
import { engineBest } from './engineClient.js';

export async function coachMove(fen, { movetime = 400, elo = null } = {}) {
  try {
    const sf = await getPlayEngine();
    const r = await sf.analyze(fen, movetime, { elo });
    if (r.best) {
      const g = new Chess(fen);
      const m = g.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] || undefined });
      const score = r.mate != null ? (r.mate > 0 ? 9999 : -9999) : (r.cp ?? 0);
      return { san: m.san, from: m.from, to: m.to, score, engine: sf.name };
    }
  } catch { /* fall through */ }
  const r = await engineBest(fen, { timeMs: movetime + 300 });
  return r.move ? { san: r.move.san, from: r.move.from, to: r.move.to, score: r.score, engine: 'coach' } : null;
}

// A bot's move at a given strength profile (see data/bots.js).
// params: { elo?, skill?, depth?, movetime?, random? }
export async function botMove(fen, params = {}) {
  const g = new Chess(fen);
  // pure-randomness share of the weakest bots — but never throw away a mate in 1
  if (params.random && Math.random() < params.random) {
    const moves = g.moves({ verbose: true });
    const mate = moves.find((mv) => { g.move(mv.san); const isMate = g.isCheckmate(); g.undo(); return isMate; });
    const pick = mate || moves[Math.floor(Math.random() * moves.length)];
    if (pick) {
      const m = g.move(pick.san);
      return { san: m.san, from: m.from, to: m.to, score: 0 };
    }
  }
  try {
    const sf = await getPlayEngine();
    const r = await sf.analyze(fen, params.movetime || 200, { elo: params.elo, skill: params.skill, depth: params.depth });
    if (r.best) {
      const m = g.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] || undefined });
      const score = r.mate != null ? (r.mate > 0 ? 9999 : -9999) : (r.cp ?? 0);
      return { san: m.san, from: m.from, to: m.to, score };
    }
  } catch { /* fall through */ }
  const r = await engineBest(fen, { timeMs: (params.movetime || 300) + 300 });
  return r.move ? { san: r.move.san, from: r.move.from, to: r.move.to, score: r.score } : null;
}
