// Cheap, engine-free heuristics that label WHY a flagged move was bad, in
// concrete tactical terms — the way a coach would ("you hung a piece", "you
// missed a fork", "back-rank weakness"). Pure geometry over the FENs we already
// have; no extra engine calls. Inspired by tintin's-chess-analysis motif tags.
import { Chess } from 'chess.js';
import { VAL } from './engine.js';

// Friendly metadata for every motif — label, one-line coaching, chip colour
// class (reuses the classification palette), icon. Shared by the analyzer
// mistake cards, the cross-game weakness profile and the Training Plan.
export const MOTIF_META = {
  hung_piece:     { label: 'Hung piece',     short: 'hung a piece',         advice: 'Run a blunder-check every move: after my move, is anything of mine left undefended?', cls: 'tag-blunder', icon: '🎯' },
  pawn_grab:      { label: 'Greedy pawn',    short: 'grabbed a pawn',        advice: 'Don\'t grab pawns while behind in development — count the tempo cost first.',          cls: 'tag-inacc',   icon: '🪤' },
  missed_capture: { label: 'Missed material', short: 'missed free material',  advice: 'Scan for undefended enemy pieces — captures and checks come before quiet moves.',       cls: 'tag-miss',    icon: '💰' },
  missed_fork:    { label: 'Missed fork',    short: 'missed a fork',         advice: 'Look for one move that hits two targets — knight and queen forks especially.',            cls: 'tag-miss',    icon: '🍴' },
  missed_mate:    { label: 'Missed mate',    short: 'missed a forced mate',  advice: 'When you sense an attack, calculate every check first — the mate hides among them.',      cls: 'tag-miss',    icon: '♔' },
  allowed_fork:   { label: 'Allowed fork',   short: 'allowed a fork',        advice: 'Watch the squares your opponent\'s knight or queen can jump to next move.',               cls: 'tag-mistake', icon: '🍴' },
  allowed_mate:   { label: 'Allowed mate',   short: 'allowed a forced mate', advice: 'King safety first — don\'t open lines or strip pawns in front of your own king.',         cls: 'tag-blunder', icon: '⚠' },
  back_rank:      { label: 'Back rank',      short: 'back-rank weakness',    advice: 'Make luft (h3 / h6) for your king once the major pieces are active.',                     cls: 'tag-blunder', icon: '🔒' },
  time_trouble:   { label: 'Time trouble',   short: 'low on the clock',      advice: 'Bank time in simple positions so you can think in the critical ones.',                    cls: 'tag-inacc',   icon: '⏰' },
};

const fileIdx = (sq) => sq.charCodeAt(0) - 97;
const rankIdx = (sq) => sq.charCodeAt(1) - 49;       // 0 = rank 1
const sqFR = (f, r) => String.fromCharCode(97 + f) + (r + 1);
const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function boardMap(fen) {
  const map = {};
  try {
    for (const row of new Chess(fen).board()) for (const cell of row) if (cell) map[cell.square] = cell;
  } catch { /* ignore */ }
  return map;
}

function applyMove(fen, mv) {
  if (!fen || !mv) return null;
  try {
    const g = new Chess(fen);
    g.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
    return g.fen();
  } catch { return null; }
}

// Enemy-occupied squares a piece of `type`/`color` standing on `from` attacks,
// computed from board geometry (rays blocked by the first piece they hit).
function attackedSquares(map, from, type, color) {
  const f = fileIdx(from), r = rankIdx(from);
  const hits = [];
  const enemyAt = (ff, rr) => { const p = map[sqFR(ff, rr)]; return p && p.color !== color ? sqFR(ff, rr) : null; };
  if (type === 'n') {
    for (const [df, dr] of KNIGHT) { if (!onBoard(f + df, r + dr)) continue; const e = enemyAt(f + df, r + dr); if (e) hits.push(e); }
  } else if (type === 'k') {
    for (const [df, dr] of [...DIAG, ...ORTH]) { if (!onBoard(f + df, r + dr)) continue; const e = enemyAt(f + df, r + dr); if (e) hits.push(e); }
  } else if (type === 'p') {
    const dr = color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) { if (!onBoard(f + df, r + dr)) continue; const e = enemyAt(f + df, r + dr); if (e) hits.push(e); }
  } else {
    const dirs = type === 'b' ? DIAG : type === 'r' ? ORTH : [...DIAG, ...ORTH]; // q = both
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (onBoard(ff, rr)) {
        const occ = map[sqFR(ff, rr)];
        if (occ) { if (occ.color !== color) hits.push(sqFR(ff, rr)); break; }
        ff += df; rr += dr;
      }
    }
  }
  return hits;
}

// Of the attacked enemy squares, which hold a "valuable" target (>= a knight,
// or the king) — i.e. the makings of a fork.
function valuableTargets(map, from, type, color) {
  return attackedSquares(map, from, type, color).filter((sq) => {
    const p = map[sq];
    return p && (p.type === 'k' || (VAL[p.type] || 0) >= 300);
  });
}

// Is `victimColor`'s king boxed on its own back rank (pawns/pieces blocking the
// squares directly in front)? The structural precondition for a back-rank mate.
function backRankTrapped(fen, victimColor) {
  const map = boardMap(fen);
  const backR = victimColor === 'w' ? 0 : 7;
  let kingSq = null;
  for (const sq of Object.keys(map)) { const p = map[sq]; if (p.type === 'k' && p.color === victimColor) { kingSq = sq; break; } }
  if (!kingSq || rankIdx(kingSq) !== backR) return false;
  const f = fileIdx(kingSq);
  const fwd = victimColor === 'w' ? 1 : -1;
  // every in-front square the king could flee to is occupied (no luft)
  let escapes = 0;
  for (const df of [-1, 0, 1]) {
    const ff = f + df, rr = backR + fwd;
    if (!onBoard(ff, rr)) continue;
    const p = map[sqFR(ff, rr)];
    if (!p || p.color !== victimColor) escapes++; // an empty/enemy square = a flight square
  }
  return escapes === 0;
}

// Parse [%clk h:mm:ss] comments out of a PGN, in move order. Returns an array
// of remaining seconds per ply (index 0 = White's 1st move), null where absent.
export function parseClocks(pgn) {
  if (!pgn || !/%clk/.test(pgn)) return null;
  const out = [];
  const re = /%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(pgn))) out.push((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]));
  return out.length ? out : null;
}

// Classify one flagged move. All inputs are things the analyzer already has.
//   fenBefore   position before the played move (mover to move)
//   fenAfter    position after the played move (opponent to move)
//   playedMove  { from,to,san,captured,piece }
//   bestMove    engine's best { from,to,san,captured,piece } (may equal played)
//   replyMove   opponent's best reply after the played move { from,to,san,captured,... }
//   missedMate  bool — a forced mate was thrown away
//   oppMateAfter bool — opponent has a forced mate after the played move
//   clkSeconds  seconds left on the mover's clock after the move (or null)
export function classifyMotifs({ fenBefore, fenAfter, playedMove, bestMove, replyMove, missedMate, oppMateAfter, clkSeconds }) {
  const tags = [];
  const victim = playedMove ? playedMove.color : null;

  if (clkSeconds != null && clkSeconds < 30) tags.push('time_trouble');
  if (missedMate) tags.push('missed_mate');
  else if (oppMateAfter) tags.push('allowed_mate');

  // hung piece — the opponent's best reply just takes a >= minor you left
  if (replyMove && replyMove.captured && (VAL[replyMove.captured] || 0) >= 300) tags.push('hung_piece');

  // allowed fork — the reply lands forking your valuable pieces
  if (fenAfter && replyMove) {
    const after = applyMove(fenAfter, replyMove);
    const map = after && boardMap(after);
    const piece = map && map[replyMove.to];
    if (piece && valuableTargets(map, replyMove.to, piece.type, piece.color).length >= 2) tags.push('allowed_fork');
  }

  // missed tactics — the engine's move you skipped won material or forked
  const skippedBest = bestMove && playedMove && (bestMove.from + bestMove.to) !== (playedMove.from + playedMove.to);
  if (skippedBest) {
    if (bestMove.captured && (VAL[bestMove.captured] || 0) >= 300) tags.push('missed_capture');
    const after = applyMove(fenBefore, bestMove);
    const map = after && boardMap(after);
    const piece = map && map[bestMove.to];
    if (piece && valuableTargets(map, bestMove.to, piece.type, piece.color).length >= 2) tags.push('missed_fork');
  }

  // back rank — boxed king punished by a check/mate on the back rank
  if (victim && fenAfter && (oppMateAfter || (replyMove && /[+#]/.test(replyMove.san || '')))) {
    const trapped = backRankTrapped(fenAfter, victim);
    const backR = victim === 'w' ? 0 : 7;
    const majorToBack = replyMove && /[qr]/i.test(replyMove.piece || '') && rankIdx(replyMove.to) === backR;
    if (trapped && (oppMateAfter || majorToBack)) tags.push('back_rank');
  }

  // greedy pawn — you took a pawn and it backfired
  if (playedMove && playedMove.captured === 'p' &&
      (tags.includes('hung_piece') || tags.includes('allowed_fork') || tags.includes('allowed_mate'))) {
    tags.push('pawn_grab');
  }

  return [...new Set(tags)];
}

// Aggregate a list of motif arrays into { motif: count }.
export function tallyMotifs(lists) {
  const counts = {};
  for (const arr of lists) for (const t of (arr || [])) counts[t] = (counts[t] || 0) + 1;
  return counts;
}
