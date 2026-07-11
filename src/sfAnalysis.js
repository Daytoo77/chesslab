// Single-pass game analysis with Stockfish: one evaluation per position gives
// every move's grade for BOTH colors, accuracy %, ACPL and estimated rating.
// Consistent by construction: the eval that judges your move is the same one
// that judges the position your opponent inherited.
import { Chess } from 'chess.js';
import { getStockfish, getStockfishPool } from './stockfish.js';
import { calibratedWinPct, winPct, moveAccuracy, gameAccuracy, capsAccuracy, volatilityWeight, estimateElo, tagFromWinDrop, classifyMove } from './accuracy.js';
import { bookContinuations } from './data/openingNames.js';
import { VAL } from './engine.js';
import { classifyMotifs, parseClocks, tallyMotifs } from './motifs.js';
import { PARITY_CONFIG } from './parityConfig.js';

const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const stripSan = (s) => s.replace(/[+#?!]/g, '');

// Net material (centipawns) the side that just moved hands to the opponent:
// the most the opponent can win with a single capture, minus our best
// immediate recapture on that square. A real sacrifice => >= ~200.
function sacInvestment(fenAfterMove) {
  let worst = 0;
  try {
    const g = new Chess(fenAfterMove); // opponent to move
    for (const c of g.moves({ verbose: true })) {
      if (!c.captured) continue;
      const lose = VAL[c.captured] || 0;
      const g2 = new Chess(fenAfterMove);
      g2.move(c.san);
      let recap = 0;
      for (const r of g2.moves({ verbose: true })) if (r.to === c.to && r.captured) recap = Math.max(recap, VAL[r.captured] || 0);
      worst = Math.max(worst, lose - recap);
    }
  } catch { /* ignore */ }
  return worst;
}

function uciToMove(fen, uci) {
  if (!uci) return null;
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    return { from: m.from, to: m.to, san: m.san, captured: m.captured || null, piece: m.piece };
  } catch { return null; }
}

function sanToMove(fen, san) {
  try {
    const g = new Chess(fen);
    const m = g.move(san);
    return { from: m.from, to: m.to, san: m.san, captured: m.captured || null, piece: m.piece, color: m.color };
  } catch { return null; }
}

function pvToSan(fen, pvUcis, n = 4) {
  const out = [];
  try {
    const g = new Chess(fen);
    for (const u of (pvUcis || []).slice(0, n)) {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      out.push({ from: m.from, to: m.to, san: m.san, color: m.color });
    }
  } catch { /* truncate on parse issue */ }
  return out;
}

function explain(playedSan, best, missedMate, replyCapture) {
  if (!best) return `${playedSan} gives too much away.`;
  if (missedMate) return `You had a forced mate starting with ${best.san} and let it slip.`;
  if (replyCapture) return `After ${playedSan}, the strongest reply simply takes the ${PIECE_NAMES[replyCapture.captured]} on ${replyCapture.to} — it was left with too few defenders.`;
  if (best.captured) return `You missed a tactic: ${best.san} wins the ${PIECE_NAMES[best.captured]} on ${best.to}. Scan checks, captures and threats — in that order.`;
  return `${playedSan} loses ground. ${best.san} keeps the pieces coordinated and avoids the concession.`;
}

export async function analyzeWithStockfish(pgn, color, { movetime = 300, onProgress, engine } = {}) {
  const full = new Chess();
  full.loadPgn(pgn); // throws on bad pgn
  const history = full.history({ verbose: true });
  if (!history.length) throw new Error('empty');
  const clocks = parseClocks(pgn); // per-ply remaining seconds, or null
  const pool = engine ? [engine] : await getStockfishPool(3);
  const sf = pool[0];
  const cfg = PARITY_CONFIG.analysis;
  const adaptiveMt = Math.max(movetime, history.length <= 24 ? Math.round(movetime * 1.35) : movetime);

  const sim = new Chess();
  const positions = [sim.fen()];
  for (const m of history) { sim.move(m.san); positions.push(sim.fen()); }

  // one MultiPV eval per position — alternatives power "only-move" / Great
  // detection. Parallelized across the engine pool. Consistent by construction.
  const lineCp = (line) => (line.mate != null ? (line.mate > 0 ? 10000 - Math.abs(line.mate) : -10000 + Math.abs(line.mate)) : (line.cp ?? 0));
  const evals = new Array(positions.length);
  let done = 0;
  await Promise.all(pool.map(async (eng, k) => {
    for (let i = k; i < positions.length; i += pool.length) {
      let lines = [];
      try { lines = await eng.analyzeMulti(positions[i], adaptiveMt, cfg.multipv); } catch { /* fallback below */ }
      if (!lines.length) {
        const r = await eng.analyze(positions[i], adaptiveMt);
        lines = [{ cp: r.cp, mate: r.mate, pv: r.pv || (r.best ? [r.best] : []), depth: r.depth || 0, wdl: r.wdl || null }];
      }
      const stm = positions[i].split(' ')[1];
      const best = lines[0] || { cp: 0, mate: null, pv: [], depth: 0 };
      const cpBest = lineCp(best);
      const cpSecond = lines[1] ? lineCp(lines[1]) : null;
      const bestWin = calibratedWinPct({ cp: cpBest, wdl: best.wdl || null, fen: positions[i] });
      const secondWin = lines[1] ? calibratedWinPct({ cp: cpSecond, wdl: lines[1].wdl || null, fen: positions[i] }) : null;
      evals[i] = {
        white: stm === 'w' ? cpBest : -cpBest,
        whiteSecond: cpSecond == null ? null : (stm === 'w' ? cpSecond : -cpSecond),
        whiteWin: stm === 'w' ? bestWin : 100 - bestWin,
        whiteSecondWin: secondWin == null ? null : (stm === 'w' ? secondWin : 100 - secondWin),
        best: best.pv && best.pv[0] ? best.pv[0] : null,
        pv: best.pv || [], depth: best.depth || 0, mate: best.mate, stm,
      };
      done++;
      if (onProgress) onProgress(done / positions.length);
    }
  }));

  // white-POV win% at every position — powers the volatility weighting
  const winWhiteSeq = evals.map((e, i) => (e.whiteWin != null ? e.whiteWin : calibratedWinPct({ cp: e.white, fen: positions[i] })));

  const records = [];
  const accs = { w: [], b: [] }; // [{ acc, weight }]
  const cpls = { w: [], b: [] };
  const sansSoFar = [];
  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    const pov = (x) => (mv.color === 'w' ? x : -x);
    const before = pov(evals[i].white);
    const after = pov(evals[i + 1].white);
    const wb = mv.color === 'w' ? evals[i].whiteWin : (100 - evals[i].whiteWin);
    const wa = mv.color === 'w' ? evals[i + 1].whiteWin : (100 - evals[i + 1].whiteWin);
    const playedUci = mv.from + mv.to + (mv.promotion || '');
    const isBest = playedUci === evals[i].best;
    const winDrop = isBest ? 0 : Math.max(0, wb - wa);
    const cpl = isBest ? 0 : Math.max(0, Math.min(1000, before - after));

    const secondWin = evals[i].whiteSecondWin == null ? null : (mv.color === 'w' ? evals[i].whiteSecondWin : (100 - evals[i].whiteSecondWin));
    // net material invested = what the opponent can win back minus what this
    // move itself captured (so Bxd8 winning a rook is not a "sacrifice")
    const sacInvest = sacInvestment(positions[i + 1]) - (VAL[mv.captured] || 0);
    let legalCount = 99;
    try { legalCount = new Chess(positions[i]).moves().length; } catch { /* keep default */ }
    const inBook = i < cfg.maxBookPly && bookContinuations(sansSoFar).map(stripSan).includes(stripSan(mv.san));
    const mateForMover = evals[i].mate != null && evals[i].mate > 0;
    const keptMate = evals[i + 1].mate != null && evals[i + 1].mate < 0;
    const prevWasError = i > 0 && ['mistake', 'blunder', 'miss'].includes(records[i - 1].tag);

    const tag = classifyMove({ isBest, winBefore: wb, winAfter: wa, secondWin, sacInvest, legalCount, inBook, mateForMover, keptMate, prevWasError });

    const bestMove = uciToMove(positions[i], evals[i].best);
    const missedMate = mateForMover && !isBest && !keptMate;
    const moveAcc = isBest ? 100 : moveAccuracy(wb, wa);
    const weight = volatilityWeight(winWhiteSeq.slice(Math.max(0, i - 2), Math.min(winWhiteSeq.length, i + 3)));
    accs[mv.color].push({ acc: moveAcc, weight });
    cpls[mv.color].push(cpl);
    records.push({
      san: mv.san, color: mv.color, index: i, fenBefore: positions[i],
      cpl, winDrop: Math.round(winDrop * 10) / 10, tag, acc: Math.round(moveAcc * 10) / 10,
      bestSan: bestMove ? bestMove.san : null, missedMate,
      _uci: playedUci, _sac: sacInvest,
    });
    sansSoFar.push(mv.san);
  }

  // Re-verify brilliancies at higher depth. A speculative sac (Greek gift,
  // etc.) that only works if the opponent errs looks "best + sound" at shallow
  // depth but isn't — deep search finds the refutation and we demote it, the
  // way chess.com does. Brilliants are rare, so the extra cost is tiny.
  const deepMt = Math.max(1100, movetime * 3);
  for (const r of records) {
    if (r.tag !== 'brilliant') continue;
    const i = r.index;
    try {
      const [Li, Lj] = await Promise.all([
        sf.analyzeMulti(positions[i], deepMt, 1),
        sf.analyzeMulti(positions[i + 1], deepMt, 1),
      ]);
      const stmI = positions[i].split(' ')[1];
      const stmJ = positions[i + 1].split(' ')[1];
      const povR = (x) => (r.color === 'w' ? x : -x);
      const cpiW = Li[0] ? (stmI === 'w' ? lineCp(Li[0]) : -lineCp(Li[0])) : 0;
      const cpjW = Lj[0] ? (stmJ === 'w' ? lineCp(Lj[0]) : -lineCp(Lj[0])) : 0;
      const wbD = calibratedWinPct({ cp: povR(cpiW), wdl: Li[0]?.wdl || null, fen: positions[i] });
      const waD = calibratedWinPct({ cp: povR(cpjW), wdl: Lj[0]?.wdl || null, fen: positions[i + 1] });
      const isBestD = Li[0] && Li[0].pv && Li[0].pv[0] === r._uci;
      const stillBrilliant = r._sac >= 150 && isBestD && waD >= 50 && waD <= 97 && wbD <= 97;
      if (!stillBrilliant) {
        const wl = isBestD ? 0 : Math.max(0, wbD - waD);
        r.tag = (isBestD || wl < 0.5) ? 'best' : wl < 2 ? 'excellent' : wl < 5 ? 'good' : wl < 10 ? 'inaccuracy' : wl < 20 ? 'mistake' : 'blunder';
        r.winDrop = Math.round(wl * 10) / 10;
      }
    } catch { /* keep as-is on failure */ }
  }
  for (const r of records) { delete r._uci; delete r._sac; }

  const KEEP_MISTAKE = new Set(['mistake', 'blunder', 'miss']);
  const mistakes = records
    .filter((r) => r.color === color && r.winDrop >= 10 && KEEP_MISTAKE.has(r.tag))
    .sort((a, b) => b.winDrop - a.winDrop)
    .slice(0, 5)
    .sort((a, b) => a.index - b.index)
    .map((r) => {
      const best = uciToMove(r.fenBefore, evals[r.index].best);
      const pv = pvToSan(r.fenBefore, evals[r.index].pv, 4);
      // does the engine's line start by punishing a hanging piece?
      const reply = pvToSan(positions[r.index + 1], evals[r.index + 1].pv, 1)[0];
      const replyMove = reply ? uciToMove(positions[r.index + 1], evals[r.index + 1].pv[0]) : null;
      const replyCapture = replyMove && replyMove.captured && VAL[replyMove.captured] >= 300 ? replyMove : null;
      // concrete "why it was bad" motif tags (engine-free heuristics)
      const playedMove = sanToMove(r.fenBefore, r.san);
      const oppMateAfter = evals[r.index + 1].mate != null && evals[r.index + 1].mate > 0 && !r.missedMate;
      const motifs = classifyMotifs({
        fenBefore: r.fenBefore, fenAfter: positions[r.index + 1], playedMove,
        bestMove: best, replyMove, missedMate: r.missedMate, oppMateAfter,
        clkSeconds: clocks ? clocks[r.index] : null,
      });
      return {
        index: r.index, san: r.san, moveNumber: Math.floor(r.index / 2) + 1,
        cpl: r.cpl, winDrop: r.winDrop, missedMate: r.missedMate, motifs,
        bestSan: best ? best.san : null, bestMove: best, fenBefore: r.fenBefore, pv,
        explanation: explain(r.san, best, r.missedMate, replyCapture),
      };
    });

  const counts = { w: {}, b: {} };
  for (const r of records) counts[r.color][r.tag] = (counts[r.color][r.tag] || 0) + 1;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const avgDepth = Math.round(avg(evals.map((e) => e.depth)) || 0);

  return {
    engine: `${sf.name || 'Stockfish'}${pool.length > 1 ? ` ×${pool.length} workers` : ''} · avg depth ${avgDepth}`,
    moves: records,
    mistakes,
    motifCounts: tallyMotifs(mistakes.map((m) => m.motifs)), // cross-game weakness signal
    hasClocks: !!clocks,
    summary: {
      acc: { w: capsAccuracy(accs.w), b: capsAccuracy(accs.b) },
      acpl: { w: Math.round(avg(cpls.w) ?? 0), b: Math.round(avg(cpls.b) ?? 0) },
      elo: { w: estimateElo(avg(cpls.w)), b: estimateElo(avg(cpls.b)) },
      counts,
      evals: evals.map((e) => Math.max(-cfg.evalClampCp, Math.min(cfg.evalClampCp, e.white))),
    },
  };
}

// Adapt the offline local-engine result to the same shape (user color only).
export function localToUnified(res, color) {
  const userMoves = res.moves.filter((m) => m.color === color && m.cpl != null);
  const cpls = userMoves.map((m) => Math.min(1000, m.cpl));
  const accs = userMoves.map((m) => moveAccuracy(50, 50 - (winPct(Math.min(1000, m.cpl)) - 50)));
  const counts = { w: {}, b: {} };
  for (const m of res.moves) if (m.tag) counts[m.color][m.tag] = (counts[m.color][m.tag] || 0) + 1;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return {
    engine: 'Coach engine (offline fallback)',
    moves: res.moves.map((m) => ({ ...m, winDrop: m.cpl != null ? Math.round((winPct(Math.min(1000, m.cpl)) - 50) * 10) / 10 : null })),
    mistakes: res.mistakes,
    summary: {
      acc: { [color]: gameAccuracy(accs), [color === 'w' ? 'b' : 'w']: null },
      acpl: { [color]: Math.round(avg(cpls) ?? 0), [color === 'w' ? 'b' : 'w']: null },
      elo: { [color]: estimateElo(avg(cpls)), [color === 'w' ? 'b' : 'w']: null },
      counts,
      evals: null,
    },
  };
}
