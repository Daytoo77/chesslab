// review-core engine adapter backed by the app's Stockfish Web Workers
// (UciEngine in stockfish.js). This is the only place the review knows how
// the engine is loaded and spoken to.
import { getStockfishPool } from './stockfish.js';

// One UciEngine -> { name, analyse(fen, { multipv, movetime }) }.
// If MultiPV fails or yields nothing, fall back to a single-PV search.
export function stockfishAdapter(eng) {
  return {
    name: eng.name,
    async analyse(fen, { multipv = 1, movetime = 300 } = {}) {
      let lines = [];
      try { lines = await eng.analyzeMulti(fen, movetime, multipv); } catch { /* fallback below */ }
      if (!lines.length) {
        const r = await eng.analyze(fen, movetime);
        lines = [{ cp: r.cp, mate: r.mate, pv: r.pv || (r.best ? [r.best] : []), depth: r.depth || 0, wdl: r.wdl || null }];
      }
      return lines;
    },
  };
}

// The game-analysis worker pool, as review-core adapters.
export async function getReviewEngines(max = 3) {
  return (await getStockfishPool(max)).map(stockfishAdapter);
}
