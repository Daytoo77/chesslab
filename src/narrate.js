// "Coach's Commentary" — a didactic, Leontxo-García-style writeup of a game,
// built ENTIRELY from the engine analysis we already computed (evals, move
// classifications, mistakes, opening) plus structural facts read off the FENs.
// It never invents a move or an evaluation: every claim traces to real data.
import { Chess } from 'chess.js';
import { winPct } from './accuracy.js';
import { VAL } from './engine.js';
import { MOTIF_META } from './motifs.js';

// short, true plan blurbs by opening family (text only — no lines invented)
const PLANS = [
  { re: /colle|zukertort|queen's pawn|london/i, plan: 'a quiet System setup (d4, e3, Bd3, Nbd2, c3, O-O) aiming for the e3–e4 break and a kingside attack once developed.' },
  { re: /slav/i, plan: 'the Slav: …c6 + …d5 holds the centre while the light-squared bishop gets out to f5 or g4 before …e6 locks it in.' },
  { re: /caro-kann/i, plan: 'the Caro-Kann: a rock-solid …c6/…d5 structure, getting the c8-bishop active early and undermining White\'s centre.' },
  { re: /french/i, plan: 'the French: a solid chain (…e6/…d5) where Black strikes the base with …c5 and …f6.' },
  { re: /sicilian/i, plan: 'the Sicilian: asymmetric play — Black trades a centre pawn for the c-file and queenside counterplay.' },
  { re: /italian|giuoco|two knights/i, plan: 'the Italian: rapid development around the c4-bishop and a central d4 break.' },
  { re: /ruy|spanish/i, plan: 'the Ruy López: pressure on e5 and a slow central build-up.' },
  { re: /queen's gambit|qgd|catalan/i, plan: 'a Queen\'s Gambit structure: central tension and pressure down the c-file.' },
  { re: /king's indian|grünfeld|grunfeld|benoni|nimzo|indian/i, plan: 'an Indian setup: let White build a centre, then strike it with pawn breaks and piece pressure.' },
  { re: /bishop's opening|vienna|king's gambit/i, plan: 'an open king-pawn game: fast development and early pressure on f7.' },
];

// verifiable, correctly-attributed model games — chosen by THEME, never invented
function masterGame({ openingName, worstPhase, hadKingAttack, hadBrilliant }) {
  if (/colle|zukertort/i.test(openingName || '')) return 'Colle vs O\'Hanlon, Nice 1930 — the model Colle Bxh7+ kingside attack.';
  if (worstPhase === 'endgame') return 'Capablanca vs Tartakower, New York 1924 — a clinic in king activity and rook endgames.';
  if (hadKingAttack || hadBrilliant) return 'Morphy\'s "Opera Game" (Paris, 1858) — develop fast, open lines, then sacrifice for mate.';
  if (/slav|caro-kann/i.test(openingName || '')) return 'Open lichess\'s Masters explorer and walk a top game in this exact line — it shows the standard plans better than any single example.';
  return 'Morphy\'s "Opera Game" (Paris, 1858) — the cleanest beginner lesson in development and punishing a lagging king.';
}

const winWords = (whitePct) => {
  if (whitePct >= 82) return 'White is winning';
  if (whitePct >= 62) return 'White is clearly better';
  if (whitePct >= 55) return 'White is a touch better';
  if (whitePct > 45) return 'the position is balanced';
  if (whitePct > 38) return 'Black is a touch better';
  if (whitePct > 18) return 'Black is clearly better';
  return 'Black is winning';
};

function pawnFeatures(fen, color) {
  try {
    const files = { w: [0, 0, 0, 0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0, 0, 0, 0] };
    for (const row of new Chess(fen).board()) for (const sq of row) {
      if (sq && sq.type === 'p') files[sq.color][sq.square.charCodeAt(0) - 97]++;
    }
    const mine = files[color];
    const out = [];
    const NAMES = 'abcdefgh';
    for (let f = 0; f < 8; f++) {
      if (mine[f] >= 2) out.push(`doubled pawns on the ${NAMES[f]}-file`);
      else if (mine[f] === 1 && (f === 0 || mine[f - 1] === 0) && (f === 7 || mine[f + 1] === 0)) out.push(`an isolated ${NAMES[f]}-pawn`);
    }
    let openFile = null;
    for (let f = 0; f < 8; f++) if (files.w[f] === 0 && files.b[f] === 0) { openFile = NAMES[f]; break; }
    return { weaknesses: out.slice(0, 2), openFile };
  } catch { return { weaknesses: [], openFile: null }; }
}

export function narrateGame({ moves, summary, mistakes, opening, color, phases }) {
  if (!moves || !moves.length) return null;
  const meColor = color === 'w' ? 'White' : 'Black';
  const evals = summary && summary.evals;

  // --- opening ---
  const planHit = PLANS.find((p) => p.re.test(opening || ''));
  const openingText = opening
    ? `You played ${meColor} in the ${opening}. The plan here is ${planHit ? planHit.plan : 'to develop your pieces toward the centre, castle, and only then start concrete action.'}`
    : `You played ${meColor}. Develop every piece before attacking, castle early, and keep your king safe.`;

  // --- turning points (real eval swings, white POV) ---
  const turningPoints = [];
  if (evals && evals.length > 2) {
    const wp = evals.map((cp) => winPct(Math.max(-1000, Math.min(1000, cp))));
    const swings = [];
    for (let i = 0; i < moves.length; i++) {
      const before = wp[i], after = wp[i + 1];
      if (before == null || after == null) continue;
      const mv = moves[i];
      // a swing that HURT the side that moved
      const hurt = mv.color === 'w' ? (before - after) : (after - before);
      swings.push({ i, mv, before, after, hurt });
    }
    swings.sort((a, b) => b.hurt - a.hurt);
    for (const s of swings.filter((x) => x.hurt >= 12).slice(0, 3)) {
      const n = Math.floor(s.i / 2) + 1;
      const dots = s.mv.color === 'w' ? '.' : '…';
      const tagMark = s.mv.tag === 'blunder' ? '??' : s.mv.tag === 'mistake' ? '?' : s.mv.tag === 'miss' ? ' (a miss)' : '';
      const who = s.mv.color === color ? 'You' : 'Your opponent';
      const m = mistakes && mistakes.find((x) => x.index === s.i);
      turningPoints.push({
        head: `${n}${dots} ${s.mv.san}${tagMark.length <= 2 ? tagMark : ''}`,
        text: `${who} turned ${winWords(s.before).toLowerCase()} into ${winWords(s.after).toLowerCase()}.`
          + (m ? ` ${m.explanation}` : (s.mv.bestSan ? ` The engine preferred ${s.mv.bestSan}.` : '')),
      });
    }
    turningPoints.sort((a, b) => parseInt(a.head) - parseInt(b.head));
  }

  // --- what it cost: motifs from your mistakes ---
  const mine = (mistakes || []).filter(() => true); // mistakes are already user-color
  const motifs = [];
  // prefer the structured motif tags (concrete: hung piece, missed fork, …)
  const motifCounts = {};
  for (const m of mine) for (const t of (m.motifs || [])) motifCounts[t] = (motifCounts[t] || 0) + 1;
  const ordered = Object.entries(motifCounts).sort((a, b) => b[1] - a[1]);
  for (const [k, c] of ordered.slice(0, 3)) {
    const mm = MOTIF_META[k];
    if (mm) motifs.push(`You ${mm.short}${c > 1 ? ` ${c} times` : ''} — ${mm.advice}`);
  }
  const hung = (motifCounts.hung_piece || 0) || mine.filter((m) => /takes the|wins the/.test(m.explanation || '')).length;
  const missedMate = !!motifCounts.missed_mate || mine.some((m) => m.missedMate);
  // fall back to the old prose if no structured motifs were attached
  if (!motifs.length) {
    if (missedMate) motifs.push('you missed a forced checkmate — when you sense the attack, calculate the checks first');
    if (hung >= 2) motifs.push(`you left material hanging ${hung} times — the opponent only had to take it`);
    else if (hung === 1) motifs.push('you left a piece undefended once and it cost you');
  }

  // --- structure (computed from a middlegame FEN) ---
  const midIdx = Math.min(moves.length - 1, Math.max(0, Math.floor(moves.length * 0.6)));
  const sf = pawnFeatures(moves[midIdx] && moves[midIdx].fenBefore, color);
  const structure = [];
  if (sf.weaknesses.length) structure.push(`Your structure carried ${sf.weaknesses.join(' and ')} — long-term targets to watch.`);
  if (sf.openFile) structure.push(`The ${sf.openFile}-file opened up — whoever doubles rooks on it first controls the game.`);

  // --- takeaways ---
  const takeaways = [];
  if (hung) takeaways.push('Run a 5-second blunder-check every move: "what does my opponent\'s move attack, and is anything of mine hanging?"');
  if (missedMate) takeaways.push('When you\'re attacking, always scan forcing moves (checks and captures) before quiet ones.');
  if (phases) {
    const wAcc = color === 'w' ? 'wAcc' : 'bAcc';
    const worst = ['opening', 'middlegame', 'endgame'].map((p) => ({ p, a: phases[p] && phases[p][wAcc] })).filter((x) => x.a != null).sort((a, b) => a.a - b.a)[0];
    if (worst) takeaways.push(`Your ${worst.p} was the weakest phase this game — spend a session on it.`);
  }
  if (planHit && /colle|slav/i.test(opening || '')) takeaways.push(`Keep drilling the ${/colle/i.test(opening) ? 'Colle' : 'Slav'} plan in the Opening Explorer so the first 10 moves cost you no time.`);
  if (takeaways.length < 2) takeaways.push('Castle early and connect your rooks before launching anything.');

  const worstPhaseKey = phases ? (['opening', 'middlegame', 'endgame']
    .map((p) => ({ p, a: phases[p] && phases[p][color === 'w' ? 'wAcc' : 'bAcc'] }))
    .filter((x) => x.a != null).sort((a, b) => a.a - b.a)[0] || {}).p : null;
  const hadBrilliant = (moves || []).some((m) => m.color === color && m.tag === 'brilliant');
  const hadKingAttack = turningPoints.some((t) => /mate|#/.test(t.head + t.text));

  return {
    opening: openingText,
    turningPoints,
    motifs,
    structure,
    takeaways: takeaways.slice(0, 3),
    masterGame: masterGame({ openingName: opening, worstPhase: worstPhaseKey, hadKingAttack, hadBrilliant }),
  };
}

// On-demand "explain THIS position" — an engine-grounded read of the current
// board: who stands better, the best move and its idea, the main line, and one
// structural fact. Built only from the live engine lines + FEN — never invents
// a move or an evaluation (the honest, offline analog of an AI position chat).
const moveIdea = (san) => {
  if (!san) return 'the most accurate continuation';
  if (/#/.test(san)) return 'delivering checkmate';
  if (/^O-O/.test(san)) return 'castling to safety';
  if (/\+/.test(san)) return 'a check that keeps the initiative';
  if (/=/.test(san)) return 'promoting a pawn';
  if (/x/.test(san)) return 'a capture';
  return 'improving the position';
};

export function explainPosition({ fen, lines, evalWhite, depth }) {
  if (!fen || !lines || !lines.length) return null;
  let stm;
  try { stm = fen.split(' ')[1]; } catch { return null; }
  const mover = stm === 'w' ? 'White' : 'Black';
  const best = lines[0];
  const bestSan = best.sans && best.sans[0] ? best.sans[0].san : null;

  // assessment
  let lead;
  if (best.mate != null) {
    const who = best.mate > 0 ? 'White' : 'Black';
    lead = `${who} has a forced mate in ${Math.abs(best.mate)}.`;
  } else {
    const ev = evalWhite != null ? evalWhite : best.cpWhite;
    const wpW = winPct(Math.max(-1000, Math.min(1000, ev || 0)));
    const num = ev != null ? `${ev >= 0 ? '+' : ''}${(ev / 100).toFixed(1)}` : '';
    lead = `${winWords(wpW)}${num ? ` (${num})` : ''}.`;
  }

  // best move + idea, and the main line a few moves deep
  const move = bestSan ? `${mover}'s best is ${bestSan} — ${moveIdea(bestSan)}.` : null;
  const lineSans = (best.sans || []).slice(0, 5).map((s) => s.san);
  const line = lineSans.length > 1 ? `The main line runs ${lineSans.join(' ')}.` : null;

  // one structural fact for the side to move
  const sf = pawnFeatures(fen, stm);
  let struct = null;
  if (sf.weaknesses.length) struct = `Watch your ${sf.weaknesses[0]} — a long-term target.`;
  else if (sf.openFile) struct = `The ${sf.openFile}-file is open — contest it with a rook.`;

  // a credible alternative if the 2nd line is close
  let alt = null;
  if (lines[1] && lines[1].sans && lines[1].sans[0] && best.mate == null && lines[1].mate == null) {
    if (Math.abs((best.cpWhite || 0) - (lines[1].cpWhite || 0)) <= 30) alt = `${lines[1].sans[0].san} is a reasonable alternative.`;
  }

  return { lead, move, line, struct, alt, depth: depth || best.depth || null };
}
