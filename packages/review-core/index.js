// @chesslab/review-core — engine-agnostic game review.
//
//   const review = await reviewGame(pgn, { engine, color: 'w' });
//
// `engine` is an adapter (or an array of adapters, used as a pool):
//
//   {
//     name?: string,
//     analyse(fen, { multipv, movetime }) => Promise<Line[]>,
//   }
//   Line = { cp: number|null, mate: number|null, pv: string[] (UCI),
//            depth: number, wdl?: { w, d, l } | null }
//
// Scores are from the side to move's point of view, best line first. Return
// [] for a position with no legal moves. The core never loads an engine, owns
// no Web Worker and speaks no UCI — wiring one up is the caller's job.
import { Chess } from 'chess.js';
import { analyzePgn } from './src/analysis.js';
import { ratingFromAccuracy } from './src/accuracy.js';
import { MOTIF_META } from './src/motifs.js';
import { buildCoachContext } from './src/coach.js';
import { openingName } from './src/openingBook.js';
import { PARITY_CONFIG } from './src/parityConfig.js';

export { analyzePgn, localToUnified } from './src/analysis.js';
export {
  winPct, calibratedWinPct, moveAccuracy, gameAccuracy, capsAccuracy, volatilityWeight,
  estimateElo, ratingFromAccuracy, tagFromWinDrop, classifyMove,
} from './src/accuracy.js';
export { MOTIF_META, MOTIF_PUZZLE_HINT, classifyMotifs, parseClocks, tallyMotifs } from './src/motifs.js';
export { narrateGame, explainPosition } from './src/narrate.js';
export { buildCoachContext, buildOpeningContext } from './src/coach.js';
export { openingName, bookContinuations } from './src/openingBook.js';
export { PARITY_CONFIG } from './src/parityConfig.js';
export { VAL } from './src/material.js';

export const REVIEW_SCHEMA_VERSION = 1;

// PGN + engine adapter -> plain-JSON review (JSON.stringify-safe, no
// functions, no class instances). `color` is the student's side: it picks
// which side's errors feed the weakness summary and the coach context.
export async function reviewGame(pgn, { engine, color = 'w', movetime = PARITY_CONFIG.analysis.qualityMovetime.fast, onProgress } = {}) {
  const res = await analyzePgn(pgn, color, { engine, movetime, onProgress });
  // white-POV cp per position, clamped (-0 from a mated side folded to 0)
  const evals = res.summary.evals.map((e) => (e === 0 ? 0 : e));

  const motifsAt = new Map(res.mistakes.map((m) => [m.index, m.motifs]));
  const moves = res.moves.map((m) => ({
    ply: m.index,
    moveNumber: Math.floor(m.index / 2) + 1,
    color: m.color,
    san: m.san,
    fenBefore: m.fenBefore,
    classification: m.tag,
    accuracy: m.acc,
    winDrop: m.winDrop,
    cpl: m.cpl,
    evalAfter: evals[m.index + 1],
    bestSan: m.bestSan,
    missedMate: m.missedMate,
    // motifs are computed for the side's flagged mistakes only
    motifs: motifsAt.get(m.index) || [],
  }));

  const side = (c) => ({
    accuracy: res.summary.acc[c],
    rating: ratingFromAccuracy(res.summary.acc[c]),
    acpl: res.summary.acpl[c],
    eloFromAcpl: res.summary.elo[c],
    counts: res.summary.counts[c],
  });

  const topMotifs = Object.entries(res.motifCounts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([motif, count]) => ({
      motif, count,
      label: MOTIF_META[motif] ? MOTIF_META[motif].label : motif,
      advice: MOTIF_META[motif] ? MOTIF_META[motif].advice : null,
    }));

  const mistakes = res.mistakes.map((m) => ({
    ...m,
    coachContext: buildCoachContext({
      fen: m.fenBefore,
      lines: [{ sans: m.pv, cpWhite: evals[m.index] }],
      evalWhite: evals[m.index],
      moves: res.moves,
      cursor: m.index,
      playerColor: color,
    }),
  }));

  const sim = new Chess();
  sim.loadPgn(pgn);
  const finalFen = sim.fen();

  return {
    schemaVersion: REVIEW_SCHEMA_VERSION,
    engine: res.engine,
    color,
    opening: openingName(res.moves.map((m) => m.san)),
    hasClocks: res.hasClocks,
    moves,
    evals,
    sides: { w: side('w'), b: side('b') },
    weaknesses: { motifCounts: res.motifCounts, topMotifs, mistakes },
    coachContext: buildCoachContext({
      fen: finalFen,
      lines: [],
      evalWhite: evals[evals.length - 1],
      moves: res.moves,
      cursor: res.moves.length,
      playerColor: color,
    }),
  };
}
