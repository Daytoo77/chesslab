// Accuracy & rating estimation — win-percentage model (same family of
// formulas Lichess publishes; chess.com's CAPS works on the same principle).

// centipawns (side to move POV) -> win probability 0..100
export function winPct(cp) {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

// accuracy of a single move from win% before/after (mover's POV)
export function moveAccuracy(wBefore, wAfter) {
  if (wAfter >= wBefore) return 100;
  const raw = 103.1668 * Math.exp(-0.04354 * (wBefore - wAfter)) - 3.1669;
  return Math.max(0, Math.min(100, raw + 1));
}

export function gameAccuracy(list) {
  if (!list.length) return null;
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  // blend mean with harmonic mean so single disasters weigh in (chess.com-like feel)
  const harm = list.length / list.reduce((a, b) => a + 1 / Math.max(1, b), 0);
  return Math.round(((mean + harm) / 2) * 10) / 10;
}

// chess.com CAPS-style game accuracy: a volatility-weighted mean of per-move
// accuracies blended with their harmonic mean. Moves made in sharp, swingy
// phases count more — so one blunder in a critical moment tanks the score the
// way it does on chess.com. items: [{ acc, weight }].
export function capsAccuracy(items) {
  if (!items.length) return null;
  const wSum = items.reduce((s, x) => s + x.weight, 0) || 1;
  const weighted = items.reduce((s, x) => s + x.acc * x.weight, 0) / wSum;
  const harm = items.length / items.reduce((s, x) => s + 1 / Math.max(1, x.acc), 0);
  return Math.round(((weighted + harm) / 2) * 10) / 10;
}

// volatility weight for a move from the surrounding win% window (std-dev,
// clamped). Sharp phases -> bigger weight.
export function volatilityWeight(winWindow) {
  const n = winWindow.length;
  if (n < 2) return 1;
  const m = winWindow.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(winWindow.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
  return Math.max(0.5, Math.min(10, sd));
}

// ACPL -> estimated performance rating (heuristic interpolation)
const ELO_TABLE = [[5, 2900], [10, 2600], [15, 2400], [20, 2250], [25, 2100], [35, 1900], [45, 1700], [60, 1500], [80, 1300], [100, 1150], [130, 950], [170, 750], [250, 500], [400, 300]];
export function estimateElo(acpl) {
  if (acpl == null) return null;
  if (acpl <= ELO_TABLE[0][0]) return ELO_TABLE[0][1];
  for (let i = 1; i < ELO_TABLE.length; i++) {
    const [a0, e0] = ELO_TABLE[i - 1], [a1, e1] = ELO_TABLE[i];
    if (acpl <= a1) return Math.round(e0 + ((e1 - e0) * (acpl - a0)) / (a1 - a0));
  }
  return 250;
}

// chess.com-style "Game Rating": a per-game performance estimate. Derived from
// accuracy (not ACPL — ACPL hands a clean 13-move mate a 2600 even between
// beginners). Linear fit to chess.com's own numbers across sample games
// (88.7%→~1250, 71%→~900, 57%→~200, 56%→~100), clamped to a believable range.
export function ratingFromAccuracy(acc) {
  if (acc == null) return null;
  return Math.max(150, Math.min(3000, Math.round(36 * acc - 1850)));
}

// move tag from win% drop (when the move is not the engine's best)
export function tagFromWinDrop(drop) {
  if (drop < 5) return 'good';
  if (drop < 10) return 'inaccuracy';
  if (drop < 20) return 'mistake';
  return 'blunder';
}

// chess.com-style move classification.
// Bins follow chess.com's published "expected points lost" table, on the
// win% scale (0-100): Best 0, Excellent <2, Good <5, Inaccuracy <10,
// Mistake <20, Blunder >=20 — plus Brilliant / Great / Miss / Book / Forced.
//
// ctx:
//   isBest        played move == engine's #1
//   winBefore     win% (mover POV) of the position before the move, best play
//   winAfter      win% (mover POV) of the position after the move actually played
//   secondWin     win% (mover POV) the 2nd-best move would have given (or null)
//   sacInvest     NET material (cp) actually invested: what the opponent can
//                 win back minus what this move itself captured. A move that
//                 wins a rook then loses a bishop is NOT a sacrifice.
//   legalCount    number of legal moves in the position
//   inBook        the move is opening theory
//   mateForMover  engine had a forced mate for the mover before the move
//   keptMate      after the move, the mover still has a forced mate
//   prevWasError  the opponent's previous move was an error (gave you a chance)
export function classifyMove(ctx) {
  const {
    isBest, winBefore, winAfter, secondWin, sacInvest = 0,
    legalCount = 99, inBook = false, mateForMover = false, keptMate = false,
    prevWasError = false,
  } = ctx;
  const winLoss = isBest ? 0 : Math.max(0, winBefore - winAfter);

  if (inBook) return 'book';
  if (legalCount <= 1) return 'forced';

  // base bin (official thresholds)
  let base;
  if (isBest || winLoss < 0.5) base = 'best';
  else if (winLoss < 2) base = 'excellent';
  else if (winLoss < 5) base = 'good';
  else if (winLoss < 10) base = 'inaccuracy';
  else if (winLoss < 20) base = 'mistake';
  else base = 'blunder';

  // Brilliant (chess.com: "best OR near-best move, requires a material
  // sacrifice, does not result in a losing position, not awarded if already
  // completely winning"). Near-best = the move is best or within ~1.5% — the
  // deep re-verification pass (sfAnalysis) confirms soundness afterwards.
  if (sacInvest >= 150 && (isBest || winLoss < 1.5) && winAfter >= 50 && winAfter <= 97 && winBefore <= 97) {
    return 'brilliant';
  }

  // Great (chess.com: "change the outcome — lost→equal, equal→winning — or the
  // only good move"). Captured as: the best move, with every alternative clearly
  // worse, in a position that mattered.
  if (base === 'best' && secondWin != null && (winBefore - secondWin) >= 12 && winBefore > 8 && winBefore < 98) {
    return 'great';
  }

  // Miss (chess.com: "missed opportunity to gain a WINNING position, resulting
  // in an equal or worse outcome"). A clearly winning move was available
  // (winBefore high) and the move played drops to equal-or-worse — or a forced
  // mate was thrown away.
  if ((base === 'mistake' || base === 'blunder') && ((winBefore >= 65 && winAfter <= 52) || (mateForMover && !keptMate))) {
    return 'miss';
  }

  // Leniency in already-lost positions: you can't "blunder" what's gone — if
  // you were already losing badly before the move, cap at mistake (chess.com
  // does the same; the win% can't drop much more once you're near 0).
  if (base === 'blunder' && winBefore < 20) return 'mistake';

  return base;
}
