// Endgame drills v2 — randomized templates (file shift + occasional color
// mirror) so you learn the geometry, not the coordinates.
const F = 'abcdefgh';

function fenFrom(pieces, turn) {
  // pieces: [type 'K'|'P'|'R', color 'w'|'b', file 0-7, rank 0-7]
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [t, c, f, r] of pieces) grid[r][f] = c === 'w' ? t.toUpperCase() : t.toLowerCase();
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = grid[r][f];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 1`;
}

// mirror: flip ranks + swap colors + flip side to move
export function mirrorFen(fen) {
  const [placement, turn, ...rest] = fen.split(' ');
  const rows = placement.split('/').reverse().map((row) =>
    row.split('').map((c) => (/[a-z]/.test(c) ? c.toUpperCase() : /[A-Z]/.test(c) ? c.toLowerCase() : c)).join('')
  );
  return `${rows.join('/')} ${turn === 'w' ? 'b' : 'w'} - - 0 1`;
}

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const maybeMirror = (fen, side, allowMirror) => {
  if (allowMirror && Math.random() < 0.35) return { fen: mirrorFen(fen), userSide: side === 'w' ? 'b' : 'w', mirrored: true };
  return { fen, userSide: side, mirrored: false };
};

export const DRILLS = [
  {
    id: 'kp-escort',
    stage: 'basic',
    name: 'K+P: Escort & Opposition',
    category: 'King & Pawn',
    goal: 'win',
    brief: 'Your king is TWO squares in front of its pawn — a guaranteed win, even without the opposition. Prove it: outflank, escort, promote.',
    gen: () => {
      const f = rnd(1, 6); // b..g — rook pawns are a different story
      return maybeMirror(fenFrom([['K', 'w', f, 3], ['P', 'w', f, 1], ['K', 'b', f, 5]], 'w'), 'w', true);
    },
    tips: [
      'The KING leads, the pawn follows. Never push the pawn ahead of your king.',
      'King two ranks ahead of the pawn = always winning. King only ONE square ahead with the defender holding the opposition = only a draw — a tablebase fact worth feeling on the board.',
      'Your secret weapon: the pawn itself. When you run out of useful king moves, a single pawn step passes the obligation to move back to the defender.',
      'The file changes every attempt — the geometry never does.',
    ],
  },
  {
    id: 'kp-rookpawn',
    stage: 'basic',
    name: 'K+P: The Rook-Pawn Fortress (defend)',
    category: 'King & Pawn',
    goal: 'draw',
    brief: 'Rook pawns are special: if the defending king reaches the corner, no force on earth evicts it. Hold the draw.',
    gen: () => {
      const side = Math.random() < 0.5 ? 0 : 7; // a- or h-pawn
      const kf = side === 0 ? 1 : 6;
      return maybeMirror(fenFrom([['K', 'w', kf, 5], ['P', 'w', side, 4], ['K', 'b', kf, 7]], 'b'), 'b', true);
    },
    tips: [
      'Head straight for the corner in front of the pawn. It is an impregnable fortress.',
      "White's only winning try is to keep your king OUT of the corner — do not let that happen.",
      'Stalemate is your friend: in the corner, the pawn arriving on the 7th often stalemates you instantly.',
    ],
  },
  {
    id: 'kp-square',
    stage: 'basic',
    name: 'Rule of the Square: Catch the Pawn',
    category: 'King & Pawn',
    goal: 'draw',
    brief: 'Draw the square from the pawn to its promotion rank. If your king can step inside it, the pawn is caught — no counting needed.',
    gen: () => {
      const pf = Math.random() < 0.5 ? 0 : 7;          // a- or h-pawn race
      const pr = rnd(3, 4);                             // pawn on 4th/5th
      const kf = pf === 0 ? rnd(4, 5) : rnd(2, 3);      // defender king just at the edge of the square
      const kr = 5;
      return maybeMirror(fenFrom([['K', 'w', pf === 0 ? 6 : 1, 0], ['P', 'w', pf, pr], ['K', 'b', kf, kr]], 'b'), 'b', true);
    },
    tips: [
      'Visualize the square: pawn → promotion square → across → back. King inside = pawn caught.',
      "Move DIAGONALLY toward the pawn's path: diagonal king moves gain in two directions at once.",
      'If it is the pawn\'s turn to move first, shrink the square by one rank before judging.',
    ],
  },
  {
    id: 'rook-lucena',
    stage: 'practical',
    name: 'Lucena: Build the Bridge',
    category: 'Rook Endings',
    goal: 'win',
    brief: 'THE winning technique of rook endings: pawn on the 7th, king in front, enemy king cut off. Win with the famous bridge.',
    gen: () => {
      const f = rnd(1, 5); // b..f
      return maybeMirror(
        fenFrom([['K', 'w', f, 7], ['P', 'w', f, 6], ['R', 'w', f + 1, 0], ['K', 'b', f + 2, 6], ['R', 'b', f - 1 >= 0 ? 0 : 7, 1]], 'w'),
        'w', true
      );
    },
    tips: [
      'Step 1: the "mysterious" rook move to the 4th rank (the bridge pillar).',
      'Step 2: bring the king out; walk down through the checks (Kc7, Kb6, Kb5 pattern).',
      'Step 3: when the checks run out, block with the rook on the 4th — the bridge. The pawn promotes.',
      'Why the 4th rank? Close enough that the king reaches shelter exactly when the checks end.',
    ],
  },
  {
    id: 'rook-philidor',
    stage: 'practical',
    name: 'Philidor: The Third-Rank Defense',
    category: 'Rook Endings',
    goal: 'draw',
    brief: 'The drawing technique every player must know: park your rook on YOUR third rank and wait. Hold for 12 moves.',
    gen: () => {
      const f = rnd(2, 5); // c..f
      return maybeMirror(
        fenFrom([['K', 'w', f - 1, 4], ['P', 'w', f, 4], ['R', 'w', Math.min(f + 2, 7), 6], ['K', 'b', f, 7], ['R', 'b', 0, 5]], 'b'),
        'b', true
      );
    },
    tips: [
      'Keep the rook on your third rank (the 6th from White\'s view). It forbids the attacking king from ever crossing.',
      'Do nothing! Shuffle the rook along the rank — patience IS the technique.',
      'The moment the pawn advances (giving up the king\'s shelter), swing the rook behind it and check forever.',
      'Never let your king get pushed off the back rank in front of the pawn.',
    ],
  },
];
