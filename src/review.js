// Game-phase ratings (Opening / Middlegame / Endgame) + a coach comment,
// chess.com Game-Review style. Phase split: opening = while in book (>= a few
// plies), endgame = once material drops, middlegame = the rest.
const PVAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function material(fen) {
  const board = (fen || '').split(' ')[0];
  let s = 0;
  for (const ch of board) { const l = ch.toLowerCase(); if (PVAL[l]) s += PVAL[l]; }
  return s;
}

// map a phase accuracy to a classification icon tier
function phaseTag(acc) {
  if (acc == null) return null;
  if (acc >= 95) return 'great';
  if (acc >= 86) return 'excellent';
  if (acc >= 76) return 'good';
  if (acc >= 64) return 'inaccuracy';
  if (acc >= 50) return 'mistake';
  return 'blunder';
}

const PHASE_MSG = {
  opening: "Your weakest stretch was the opening. Drill your repertoire in the Opening Explorer and you'll start every game on the front foot.",
  middlegame: "The middlegame is where this one turned — that's where games are won and lost. Sharpen your tactics and plans.",
  endgame: "The endgame slipped through your fingers. A few Endgame drills and you'll convert positions like these.",
};

export function reviewExtras(moves, color) {
  if (!moves || !moves.length) return { phases: {}, phaseOf: () => 'middlegame', comment: '' };
  const lastBook = moves.reduce((m, r, i) => (r.tag === 'book' ? i : m), -1);
  const openEnd = Math.min(15, Math.max(7, lastBook)); // 8–16 plies of "opening"
  let egStart = moves.length;
  for (let i = 0; i < moves.length; i++) { if (material(moves[i].fenBefore) <= 22) { egStart = i; break; } }
  const phaseOf = (i) => (i <= openEnd ? 'opening' : i >= egStart ? 'endgame' : 'middlegame');

  const buckets = { opening: { w: [], b: [] }, middlegame: { w: [], b: [] }, endgame: { w: [], b: [] } };
  moves.forEach((r, i) => { if (r.acc != null) buckets[phaseOf(i)][r.color].push(r.acc); });
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

  const phases = {};
  for (const ph of ['opening', 'middlegame', 'endgame']) {
    const wAcc = avg(buckets[ph].w), bAcc = avg(buckets[ph].b);
    phases[ph] = { w: phaseTag(wAcc), b: phaseTag(bAcc), wAcc, bAcc };
  }

  // coach comment for the user's colour
  const side = color === 'w' ? 'wAcc' : 'bAcc';
  const mine = ['opening', 'middlegame', 'endgame']
    .map((ph) => ({ ph, a: phases[ph][side], n: buckets[ph][color].length }))
    .filter((x) => x.n >= 2 && x.a != null);
  let comment;
  if (mine.length) {
    const overall = avg(mine.map((x) => x.a));
    if (overall >= 88) comment = 'Clean, accurate game from start to finish — keep this up!';
    else if (overall >= 78) comment = 'Solid game overall. Tidy up the moments below and the rating climbs.';
    else {
      const worst = mine.reduce((m, x) => (x.a < m.a ? x : m), mine[0]);
      comment = PHASE_MSG[worst.ph];
    }
  } else comment = 'Here is how the game broke down.';
  return { phases, phaseOf, comment };
}
