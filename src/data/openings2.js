// v2 repertoire additions: the London System + extra lines for the
// existing openings. Merged with OPENINGS at runtime (see mergeOpenings).
export const LONDON = {
  id: 'london',
  name: 'London System',
  color: 'w',
  tagline: '1.d4 + Bf4 — the pyramid that never cracks',
  summary:
    "The London in one sentence: build the c3-d4-e3 pyramid with the dark-square bishop OUTSIDE it (Bf4 before e3 — the exact same philosophy as your Caro-Kann's Bf5!), then attack with Ne5, f4 and Bd3 against h7. Same structure every game, so you outlearn your opponent by repetition.",
  lines: [
    {
      id: 'ld-main',
      name: 'Main line vs ...d5 — Ne5 + f4 attack',
      moves: [
        { san: 'd4', why: 'Claim the center; unlike 1.e4, nothing can chase your pieces early.' },
        { san: 'd5' },
        { san: 'Bf4', why: "THE London move: the bishop leaves the pawn chain BEFORE e3 closes it — your Caro-Kann logic with colors reversed. From f4 it eyes c7 and supports Ne5." },
        { san: 'Nf6' },
        { san: 'e3', why: 'Close the wall behind the bishop. The pyramid c3-d4-e3 makes your center unbreakable.' },
        { san: 'c5' },
        { san: 'c3', why: 'Third stone of the pyramid. d4 is now defended twice and cannot be blasted open.' },
        { san: 'Nc6' },
        { san: 'Nd2', why: 'Develop the b1-knight FIRST via d2: it supports e4 ideas and leaves f3 for the other knight.' },
        { san: 'e6' },
        { san: 'Ngf3' },
        { san: 'Bd6', why: 'Black challenges your best piece — never trade it for free.' },
        { san: 'Bg3', why: 'Keep the bishop: if ...Bxg3, hxg3 opens the h-file for your rook — a gift, not a concession.' },
        { san: 'O-O' },
        { san: 'Bd3', why: 'The attacking diagonal: this bishop stares at h7 for the rest of the game.' },
        { san: 'b6' },
        { san: 'Ne5', why: 'The signature jump. Supported by d4, the knight dominates: f7, d7, g6 and c6 all feel it. ...Nxe5 dxe5 just opens lines.' },
        { san: 'Bb7' },
        { san: 'f4', why: 'The stonewall clamp: e5 is locked, and the plan writes itself — Qf3-h3, g4-g5, Rf3. Every London win at club level looks like this.' },
      ],
    },
    {
      id: 'ld-qb6',
      name: 'Poisoned pawn — punishing ...Qb6xb2',
      moves: [
        { san: 'd4' },
        { san: 'Nf6' },
        { san: 'Bf4' },
        { san: 'c5' },
        { san: 'e3' },
        { san: 'Qb6', why: "The critical test: Black hits b2 while your bishop is away from home. Don't panic — this pawn is poisoned." },
        { san: 'Nc3', why: 'The gambit answer: ignore b2 and develop with tempo. The knight is heading to b5.' },
        { san: 'Qxb2' },
        { san: 'Nb5', why: 'The point: Nc7+ forking king and rook is threatened, and the queen on b2 is suddenly very far from home.' },
        { san: 'Na6' },
        { san: 'Rb1', why: 'Hit the queen with tempo — every one of your moves develops or attacks, every one of hers is forced.' },
        { san: 'Qxa2' },
        { san: 'Ra1', why: 'Chase her again. The queen has eaten two pawns and made five moves — that bill is about to arrive.' },
        { san: 'Qb2' },
        { san: 'Rxa6', why: 'The point! Remove the only defender of c7. An exchange is a small price for what comes next.' },
        { san: 'bxa6' },
        { san: 'Nc7+', why: 'The family fork: king and rook. This is why Nb5 was played five moves ago.' },
        { san: 'Kd8' },
        { san: 'Nxa8', why: 'Material is roughly level again — but look at the board: Black\'s king is stuck on d8, the queenside is shredded, and your pieces flow naturally. Practical score from here: overwhelming.' },
      ],
    },
    {
      id: 'ld-kid',
      name: 'vs King\'s Indian setup (…g6)',
      moves: [
        { san: 'd4' },
        { san: 'Nf6' },
        { san: 'Bf4' },
        { san: 'g6', why: 'The fianchetto setup — the London needs one precise move here.' },
        { san: 'e3' },
        { san: 'Bg7' },
        { san: 'h3', why: "The move to know: it gives the bishop an h2 retreat so ...Nh5 never wins the bishop pair. Cheap insurance, big payoff." },
        { san: 'O-O' },
        { san: 'Nf3' },
        { san: 'd6' },
        { san: 'Be2', why: 'Modest square on purpose: d3 would invite ...Nh5-f4 tricks; from e2 the bishop guards everything.' },
        { san: 'Nbd7' },
        { san: 'O-O' },
        { san: 'Qe8', why: 'Black prepares the thematic ...e5 break — let it come.' },
        { san: 'c3' },
        { san: 'e5' },
        { san: 'dxe5' },
        { san: 'dxe5' },
        { san: 'Bg5', why: "Sidestep with tempo: the bishop pins the f6-knight and Black's 'freeing' ...e5 left holes on d5 and d6 that your knights will live in." },
        { san: 'h6' },
        { san: 'Bh4', why: 'Keep the pin. Plans: Nd2-c4-d6 or Qc2 + Rad1 owning the d-file. Quiet position, clear plan — London chess.' },
      ],
    },
  ],
};

export const EXTRA_LINES = {
  bishops: [
    {
      id: 'bo-bc5',
      name: '2...Bc5 — Italian with the extra c3/d4 punch',
      moves: [
        { san: 'e4' },
        { san: 'e5' },
        { san: 'Bc4' },
        { san: 'Bc5', why: 'The symmetric reply — now you get an Italian where YOU chose the move order.' },
        { san: 'd3' },
        { san: 'Nf6' },
        { san: 'Nf3' },
        { san: 'd6' },
        { san: 'c3', why: 'The standard recipe: prepare d4 and the b3/c2 retreat ladder.' },
        { san: 'a6' },
        { san: 'O-O' },
        { san: 'Ba7' },
        { san: 'Re1', why: 'Re1 before d4: the rook supports the center push and discourages tricks on e4.' },
        { san: 'O-O' },
        { san: 'Bb3', why: 'Out of reach of ...Na5 and ...d5 tempo tricks — same prophylaxis as the main line.' },
        { san: 'Nc6' },
        { san: 'Nbd2' },
        { san: 'Be6' },
        { san: 'Nf1', why: 'The famous Italian knight tour: d2–f1–g3–f5. Black can see it coming and still can\'t stop it.' },
        { san: 'Bxb3' },
        { san: 'Qxb3', why: 'The queen lands actively: b7 and f7 are both on the menu. Continue Ng3, d4 with a risk-free pull.' },
        { san: 'Qd7' },
        { san: 'Ng3' },
      ],
    },
  ],
  caro: [
    {
      id: 'ck-fantasy',
      name: 'Fantasy (3.f3) — open the center, pin the knight',
      moves: [
        { san: 'e4' },
        { san: 'c6' },
        { san: 'd4' },
        { san: 'd5' },
        { san: 'f3', why: 'The Fantasy Variation: White wants a big e4-d4 center. The refutation principle: open the position while he lags in development.' },
        { san: 'dxe4', why: 'Take! The point is revealed after the recapture.' },
        { san: 'fxe4' },
        { san: 'e5', why: 'The counterstrike: hit d4 immediately. White\'s f3-f-pawn is gone, so his king is permanently airy.' },
        { san: 'Nf3' },
        { san: 'Bg4', why: 'Develop with a pin — the f3-knight holds White\'s whole center together. Pressure it.' },
        { san: 'Bc4' },
        { san: 'Nd7', why: 'Cold-blooded and necessary: defends e5 and f7-tricks like Bxf7+ no longer work for material.' },
        { san: 'O-O' },
        { san: 'Ngf6' },
        { san: 'c3' },
        { san: 'Be7', why: 'Simple completion: ...O-O next. Black has equal play with the better structure — exactly your kind of game.' },
      ],
    },
  ],
  alien: [],
};

import { MORE_LINES } from './openings3.js';
import { V4_LINES, V4_OPENINGS } from './openings4.js';
import { VIENNA, V5_LINES } from './openings5.js';
import { V6_LINES } from './openings6.js';

// merge helper (v15: the London is retired — the Vienna takes its slot)
export function mergeOpenings(base, customLines = []) {
  const all = base.map((o) => ({
    ...o,
    lines: [...o.lines, ...(EXTRA_LINES[o.id] || []), ...(MORE_LINES[o.id] || []), ...(V4_LINES[o.id] || []), ...(V5_LINES[o.id] || []), ...(V6_LINES[o.id] || [])],
  }));
  all.splice(2, 0, { ...VIENNA, lines: [...VIENNA.lines, ...(V6_LINES.vienna || [])] }); // after Alien, before Caro
  all.push(...V4_OPENINGS.map((o) => ({ ...o, lines: [...o.lines, ...(V5_LINES[o.id] || []), ...(V6_LINES[o.id] || [])] }))); // Slav — the answer to 1.d4
  if (customLines.length) {
    all.push({
      id: 'custom',
      name: 'Imported (PGN)',
      color: 'w',
      tagline: 'Your imported studies',
      summary: 'Lines imported from PGN (e.g. a Lichess study). Color per line is taken from the import settings.',
      lines: customLines,
    });
  }
  return all;
}
