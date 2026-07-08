// ChessLab engine v2 — PeSTO tapered evaluation + negamax/alpha-beta with
// transposition table, MVV-LVA ordering, delta-pruned quiescence and PV
// extraction. Designed to run inside a Web Worker (see engineWorker.js).
import { Chess } from 'chess.js';
import { MG, EG, MG_VALUE, EG_VALUE, PHASE } from './pesto.js';

export const MATE = 100000;
export const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// ---------- evaluation (PeSTO, parsed straight from the FEN) ----------
export function evaluate(game) {
  const placement = game.fen().split(' ', 1)[0];
  let mgW = 0, mgB = 0, egW = 0, egB = 0, phase = 0, idx = 0;
  for (let i = 0; i < placement.length; i++) {
    const c = placement.charCodeAt(i);
    if (c === 47) continue;            // '/'
    if (c >= 49 && c <= 56) { idx += c - 48; continue; } // digits
    const ch = placement[i];
    if (ch >= 'a') {                   // black piece
      const t = ch;
      const sq = idx ^ 56;
      mgB += MG_VALUE[t] + MG[t][sq];
      egB += EG_VALUE[t] + EG[t][sq];
      phase += PHASE[t];
    } else {                           // white piece
      const t = ch.toLowerCase();
      mgW += MG_VALUE[t] + MG[t][idx];
      egW += EG_VALUE[t] + EG[t][idx];
      phase += PHASE[t];
    }
    idx++;
  }
  if (phase > 24) phase = 24;
  const score = (((mgW - mgB) * phase + (egW - egB) * (24 - phase)) / 24) | 0;
  return (game.turn() === 'w' ? score : -score) + 8; // small tempo bonus
}

function orderedMoves(game, capturesOnly = false) {
  const all = game.moves({ verbose: true });
  const list = capturesOnly ? all.filter((m) => m.captured || m.promotion) : all;
  return list.sort((a, b) => {
    const va = (a.captured ? VAL[a.captured] * 10 - VAL[a.piece] : 0) + (a.promotion ? 900 : 0);
    const vb = (b.captured ? VAL[b.captured] * 10 - VAL[b.piece] : 0) + (b.promotion ? 900 : 0);
    return vb - va;
  });
}

function qsearch(game, alpha, beta, ply, deadline) {
  if (deadline && Date.now() > deadline) throw new Error('timeout');
  const stand = evaluate(game);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (ply > 3) return alpha;
  const caps = orderedMoves(game, true);
  for (let i = 0; i < caps.length && i < 5; i++) {
    const m = caps[i];
    // delta pruning: even winning this piece can't raise alpha
    if (m.captured && stand + VAL[m.captured] + 150 < alpha) continue;
    game.move(m);
    const score = -qsearch(game, -beta, -alpha, ply + 1, deadline);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(game, depth, alpha, beta, ply, deadline, tt) {
  if (deadline && Date.now() > deadline) throw new Error('timeout');
  if (game.isCheckmate()) return -(MATE - ply);
  if (game.isDraw() || game.isStalemate()) return 0;
  if (depth === 0) return qsearch(game, alpha, beta, 0, deadline);
  const key = game.fen().split(' ').slice(0, 3).join(' ');
  const hit = tt.get(key);
  if (hit && hit.depth >= depth) return hit.score;
  let best = -Infinity;
  for (const m of orderedMoves(game)) {
    game.move(m);
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, deadline, tt);
    game.undo();
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  if (tt.size < 300000) tt.set(key, { depth, score: best });
  return best;
}

// Search a position. opts: { depth } fixed-depth, or { timeMs } iterative deepening.
export function searchPosition(fen, opts = {}) {
  const { depth = 2, timeMs = 0, tt: sharedTT = null } = opts;
  const game = new Chess(fen);
  let moves = orderedMoves(game);
  if (moves.length === 0) {
    return { move: null, score: game.isCheckmate() ? -MATE : 0 };
  }
  const deadline = timeMs ? Date.now() + timeMs : null;
  const maxDepth = timeMs && !opts.depth ? 24 : depth;
  const tt = sharedTT || new Map();
  let best = null;
  for (let d = 1; d <= maxDepth; d++) {
    try {
      let iterBest = null;
      let alpha = -Infinity;
      for (const m of moves) {
        game.move(m);
        const score = -negamax(game, d - 1, -Infinity, -alpha, 1, deadline, tt);
        game.undo();
        if (!iterBest || score > iterBest.score) iterBest = { move: m, score };
        if (score > alpha) alpha = score;
      }
      best = iterBest;
      // put the best move first for the next iteration
      moves = [best.move, ...moves.filter((m) => m !== best.move)];
      if (best.score > MATE - 200) break;
    } catch {
      break; // timeout — keep last completed depth
    }
  }
  return best || { move: moves[0], score: 0 };
}

export function isMateScore(s) { return Math.abs(s) > MATE - 300; }

// Principal variation: walk the line with shallow searches (for arrows).
export function getPv(fen, plies = 3, depth = 2) {
  const tt = new Map();
  const pv = [];
  const game = new Chess(fen);
  for (let i = 0; i < plies; i++) {
    if (game.isGameOver()) break;
    const r = searchPosition(game.fen(), { depth, timeMs: 220, tt });
    if (!r.move) break;
    const m = game.move(r.move.san);
    pv.push({ from: m.from, to: m.to, san: m.san, color: m.color });
  }
  return pv;
}

// ---------- game analysis ----------
const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const strip = (s) => s.replace(/[+#!?]/g, '');

function tagMove(san, best, cpl, sacrifice) {
  if (best && strip(san) === strip(best)) return sacrifice ? 'brilliant' : 'best';
  if (cpl < 50) return 'good';
  if (cpl < 120) return 'inaccuracy';
  if (cpl < 300) return 'mistake';
  return 'blunder';
}

function explainMistake(played, best, replyCapture, missedMate) {
  const parts = [];
  if (missedMate) {
    parts.push(`You had a forced mate starting with ${best.move.san} and let it slip.`);
  } else if (replyCapture) {
    parts.push(`After ${played}, the strongest reply simply takes the ${PIECE_NAMES[replyCapture.captured]} on ${replyCapture.to} — it was left with too few defenders.`);
  } else if (best.move && best.move.captured) {
    parts.push(`You missed a tactic: ${best.move.san} wins the ${PIECE_NAMES[best.move.captured]} on ${best.move.to}. Scan checks, captures and threats — in that order — before every move.`);
  } else {
    parts.push(`${played} loses ground. ${best.move ? best.move.san : '—'} keeps the pieces coordinated and avoids the concession.`);
  }
  return parts.join(' ');
}

// Analyze a PGN for `color`. Classifies every move of that color and extracts
// the 3 worst mistakes with PV arrows. Runs synchronously (call in a worker).
export function analyzeGame(pgn, color, onProgress) {
  const full = new Chess();
  full.loadPgn(pgn);
  const history = full.history({ verbose: true });
  const sim = new Chess();
  const records = [];
  const tt = new Map(); // shared across the whole game: huge overlap between positions

  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    const rec = { san: mv.san, color: mv.color, fenBefore: sim.fen(), index: i };
    if (mv.color === color) {
      if (tt.size > 250000) tt.clear();
      const best = searchPosition(sim.fen(), { depth: 2, timeMs: 240, tt });
      sim.move(mv.san);
      const after = searchPosition(sim.fen(), { depth: 2, timeMs: 200, tt });
      const actual = -after.score;
      const cpl = Math.max(0, best.score - actual);
      // sacrifice detection for "brilliant": moved piece can be taken by a cheaper unit
      let sacrifice = false;
      if (VAL[mv.piece] >= 300) {
        const oppMoves = sim.moves({ verbose: true });
        sacrifice = oppMoves.some((x) => x.to === mv.to && x.captured && VAL[x.piece] < VAL[mv.piece] - 100);
      }
      rec.cpl = cpl;
      rec.bestSan = best.move ? best.move.san : null;
      rec.bestFrom = best.move ? best.move.from : null;
      rec.bestTo = best.move ? best.move.to : null;
      rec.bestCaptured = best.move ? best.move.captured || null : null;
      rec.bestScore = best.score;
      rec.tag = tagMove(mv.san, rec.bestSan, cpl, sacrifice && cpl <= 40);
      rec.missedMate = isMateScore(best.score) && best.score > 0 && !isMateScore(actual);
      rec.replyCapture = after.move && after.move.captured && VAL[after.move.captured] >= 300
        ? { captured: after.move.captured, to: after.move.to, from: after.move.from } : null;
    } else {
      sim.move(mv.san);
    }
    records.push(rec);
    if (onProgress) onProgress((i + 1) / history.length);
  }

  const mistakes = records
    .filter((r) => r.color === color && r.cpl >= 120)
    .sort((a, b) => b.cpl - a.cpl)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((r) => ({
      index: r.index,
      san: r.san,
      moveNumber: Math.floor(r.index / 2) + 1,
      cpl: r.cpl,
      missedMate: r.missedMate,
      bestSan: r.bestSan,
      bestMove: r.bestSan ? { from: r.bestFrom, to: r.bestTo, san: r.bestSan } : null,
      fenBefore: r.fenBefore,
      pv: getPv(r.fenBefore, 3, 2),
      explanation: explainMistake(r.san, { move: r.bestSan ? { san: r.bestSan, captured: r.bestCaptured, to: r.bestTo } : null }, r.replyCapture, r.missedMate),
    }));

  // strip to plain serializable objects
  return {
    moves: records.map((r) => ({
      san: r.san, color: r.color, index: r.index, fenBefore: r.fenBefore,
      cpl: r.cpl, tag: r.tag, bestSan: r.bestSan,
    })),
    mistakes,
  };
}

// ---------- endgame helpers ----------
export function oppositionInfo(fen) {
  const game = new Chess(fen);
  const board = game.board();
  let wk, bk;
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === 'k') { if (p.color === 'w') wk = [f, 7 - r]; else bk = [f, 7 - r]; }
    }
  if (!wk || !bk) return null;
  const dx = Math.abs(wk[0] - bk[0]), dy = Math.abs(wk[1] - bk[1]);
  const direct = (dx === 0 && dy === 2) || (dy === 0 && dx === 2);
  return { direct, holder: direct ? (game.turn() === 'w' ? 'b' : 'w') : null };
}

export function pieceCount(fen) {
  return fen.split(' ')[0].replace(/[^a-zA-Z]/g, '').length;
}
