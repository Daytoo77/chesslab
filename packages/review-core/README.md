# @chesslab/review-core

Engine-agnostic chess game review: win-probability based move classification, per-side accuracy and game rating, mistake-motif tagging, engine-grounded commentary and LLM-coach context, all from a PGN.

```js
import { reviewGame } from '@chesslab/review-core';

const review = await reviewGame(pgn, { engine, color: 'w', movetime: 300 });
// -> plain JSON: { moves[], sides: { w, b }, weaknesses, coachContext, evals, opening, ... }
```

## Engine adapter

The core never loads an engine. You pass an adapter (or an array of them, used as a pool):

```js
const engine = {
  name: 'Stockfish 17.1',
  async analyse(fen, { multipv, movetime }) {
    // best line first; scores from the side to move's point of view
    return [{ cp: 34, mate: null, pv: ['e2e4', 'e7e5'], depth: 18, wdl: null }];
  },
};
```

Return `[]` for a position with no legal moves. With a pool, adapter *k* evaluates positions *k, k+n, k+2n…*, and adapter 0 runs the deep re-check of Brilliant candidates.

## Review shape

- `moves[]`: `ply`, `moveNumber`, `color`, `san`, `fenBefore`, `classification`, `accuracy`, `winDrop`, `cpl`, `evalAfter` (White POV, cp), `bestSan`, `missedMate`, `motifs` (filled for the student's flagged mistakes)
- `sides.w` / `sides.b`: `accuracy`, `rating`, `acpl`, `eloFromAcpl`, `counts`
- `weaknesses`: `motifCounts`, `topMotifs` (with label and advice), `mistakes` (each with its own `coachContext`)
- `coachContext`: a grounding text block for an LLM coach
- `evals`: White-POV cp for every position, clamped

The lower-level pieces (`analyzePgn`, `classifyMove`, `winPct`, `classifyMotifs`, `narrateGame`, `buildCoachContext`, `PARITY_CONFIG`, …) are exported too.

## Tests

`node --test tests/*.test.mjs`. `tests/review.test.mjs` replays six recorded cases against a deterministic fake engine and requires byte-identical output.

## License

GPL-3.0-or-later. See `LICENSE`.
