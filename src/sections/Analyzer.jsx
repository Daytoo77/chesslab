import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import EvalBar from '../components/EvalBar.jsx';
import ClassBadge from '../components/ClassBadge.jsx';
import CoachChat from '../components/CoachChat.jsx';
import { buildCoachContext } from '../coach.js';
import { reviewExtras } from '../review.js';
import { narrateGame, explainPosition } from '../narrate.js';
import { MOTIF_META } from '../motifs.js';
import { engineAnalyze } from '../engineClient.js';
import { analyzeWithStockfish, localToUnified } from '../sfAnalysis.js';
import { getStockfish } from '../stockfish.js';
import { useBoardEngine } from '../useBoardEngine.js';
import { useStats, dayKey } from '../store.js';
import { useUi } from '../settings.js';
import { coachMove } from '../playEngine.js';
import { winPct, ratingFromAccuracy } from '../accuracy.js';
import { openingName } from '../data/openingNames.js';
import { fig } from '../figurine.js';
import { fetchChessCom, fetchLichess } from '../gameImport.js';
import { sounds, playClassified } from '../sounds.js';
import { PARITY_CONFIG } from '../parityConfig.js';

const SAMPLE_PGN = `[Event "Sample game"]
[White "Selim"]
[Black "Opponent"]

1. e4 e5 2. Bc4 Nf6 3. d3 Bc5 4. Nf3 d6 5. O-O Bg4 6. h3 Bh5 7. g4 Bg6
8. Nh4 Nxe4 9. dxe4 Bxe4 10. Nf3 Qf6 11. Nbd2 Bxf3 12. Nxf3 Nc6 13. Rb1 O-O-O
14. Bg5 Qg6 15. Bxd8 Rxd8 16. Qe2 Nd4 17. Nxd4 Bxd4 18. c3 Bb6 19. a4 Kb8 *`;

// chess.com move-classification system: symbol, css class, display name.
const TAG_META = {
  brilliant: { label: '!!', cls: 'tag-brilliant', name: 'Brilliant' },
  great:     { label: '!',  cls: 'tag-great',     name: 'Great' },
  best:      { label: '★',  cls: 'tag-best',      name: 'Best' },
  excellent: { label: '',   cls: 'tag-excellent', name: 'Excellent' },
  good:      { label: '',   cls: 'tag-good',      name: 'Good' },
  book:      { label: '📖', cls: 'tag-book',      name: 'Book' },
  forced:    { label: '',   cls: 'tag-good',      name: 'Forced' },
  inaccuracy:{ label: '?!', cls: 'tag-inacc',     name: 'Inaccuracy' },
  miss:      { label: '✗',  cls: 'tag-miss',      name: 'Miss' },
  mistake:   { label: '?',  cls: 'tag-mistake',   name: 'Mistake' },
  blunder:   { label: '??', cls: 'tag-blunder',   name: 'Blunder' },
};
const LEGEND_TAGS = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'miss', 'mistake', 'blunder'];
const QUALITY = PARITY_CONFIG.analysis.qualityMovetime;
// right-hand workspace tabs — board stays pinned, you pick the panel you need
const AZ_TABS = [
  ['report', '📊 Report'],
  ['engine', '⚙ Engine'],
  ['mistakes', '✗ Mistakes'],
  ['moves', '☰ Moves'],
  ['coach', '🧑‍🏫 Coach'],
];

// Interactive area chart: hover to scrub (crosshair + tooltip with move, tag and
// eval), critical turning points marked in their classification color, white/black
// advantage areas split around the midline. Click seeks the board.
const GRAPH_TAGS = {
  blunder: 'var(--c-blunder)', miss: 'var(--c-miss)', mistake: 'var(--c-mistake)',
  brilliant: 'var(--c-brilliant)', great: 'var(--c-great)',
};
function EvalGraph({ evals, cursor, moves, onSeek }) {
  const [hover, setHover] = useState(null);
  if (!evals || evals.length < 2) return null;
  const W = 600, H = 96, PAD = 6;
  const n = evals.length;
  const x = (i) => (i / (n - 1)) * W;
  const y = (cp) => H / 2 - (Math.max(-600, Math.min(600, cp)) / 600) * (H / 2 - PAD);
  const pts = evals.map((e, i) => `${x(i).toFixed(1)},${y(e).toFixed(1)}`).join(' ');
  const area = `0,${H / 2} ${pts} ${W},${H / 2}`;
  const marks = (moves || [])
    .map((m, i) => (GRAPH_TAGS[m.tag] ? { i: i + 1, color: GRAPH_TAGS[m.tag] } : null))
    .filter(Boolean);
  const idxFromEvent = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
  };
  const hi = hover;
  const hMove = hi > 0 && moves ? moves[hi - 1] : null;
  const hMeta = hMove && hMove.tag ? TAG_META[hMove.tag] : null;
  const evTxt = (cp) => (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
  const tipW = 128, tipX = hi != null ? Math.min(Math.max(x(hi) - tipW / 2, 4), W - tipW - 4) : 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="eval-graph"
      onClick={(e) => onSeek(idxFromEvent(e))}
      onMouseMove={(e) => setHover(idxFromEvent(e))}
      onMouseLeave={() => setHover(null)}>
      <defs>
        <clipPath id="eg-top"><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
        <clipPath id="eg-bot"><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#120a24" rx="6" />
      <polygon points={area} fill="rgba(232, 234, 240, 0.82)" clipPath="url(#eg-top)" />
      <polygon points={area} fill="rgba(0, 0, 0, 0.5)" clipPath="url(#eg-bot)" />
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="#b07dff" strokeWidth="1.5" />
      {marks.map((m, i) => (
        <circle key={i} cx={x(m.i)} cy={y(evals[m.i])} r={hi === m.i ? 5 : 3.4}
          fill={m.color} stroke="#120a24" strokeWidth="1.2" style={{ transition: 'r 0.12s' }} />
      ))}
      <line x1={x(Math.min(cursor, n - 1))} y1="0" x2={x(Math.min(cursor, n - 1))} y2={H} stroke="#7da3e0" strokeWidth="1.2" />
      {hi != null && (
        <g pointerEvents="none">
          <line x1={x(hi)} y1="0" x2={x(hi)} y2={H} stroke="rgba(212, 184, 255,0.75)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(hi)} cy={y(evals[hi])} r="3.2" fill="#d4b8ff" />
          <g transform={`translate(${tipX}, ${y(evals[hi]) > H / 2 ? 6 : H - 36})`}>
            <rect width={tipW} height="30" rx="6" fill="rgba(21,12,42,0.95)" stroke="rgba(255,255,255,0.16)" />
            <text x="9" y="13" fontSize="10" fill="#f2f3f7" fontWeight="700" style={{ fontFamily: 'var(--mono)' }}>
              {hMove ? `${Math.ceil(hi / 2)}${hi % 2 ? '.' : '…'} ${hMove.san}${hMeta && hMeta.label ? ' ' + hMeta.label : ''}` : 'Start position'}
            </text>
            <text x="9" y="25" fontSize="9" fill="#969db0" style={{ fontFamily: 'var(--mono)' }}>
              {evTxt(evals[hi])}{hMeta ? ` · ${hMeta.name}` : ''}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

// Animated accuracy ring — fills and counts up when the review lands.
function AccuracyRing({ value, label, tone }) {
  const R = 30, C = 2 * Math.PI * R;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      setShown((1 - Math.pow(1 - p, 3)) * (value || 0));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const off = C * (1 - Math.min(100, shown) / 100);
  return (
    <div className={`acc-ring ${tone}`}>
      <svg viewBox="0 0 76 76" width="76" height="76">
        <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="6" />
        <circle cx="38" cy="38" r={R} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 38 38)" />
        <text x="38" y="43" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text)" style={{ fontFamily: 'var(--mono)' }}>
          {(shown || 0).toFixed(1)}
        </text>
      </svg>
      <span className="acc-ring-label" title={label}>{label}</span>
    </div>
  );
}

function pvToSanList(fen, pvUcis, n = 7) {
  const out = [];
  try {
    const g = new Chess(fen);
    for (const u of (pvUcis || []).slice(0, n)) {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      out.push({ from: m.from, to: m.to, san: m.san });
    }
  } catch { /* truncate */ }
  return out;
}

export default function Analyzer() {
  const { analyzeDone, recordProfile, addMyPuzzles, recordWeaknesses } = useStats();
  const analyzeRequest = useUi((u) => u.analyzeRequest);
  const consumeAnalysis = useUi((u) => u.consumeAnalysis);
  const requestTactics = useUi((u) => u.requestTactics);
  const [pgn, setPgn] = useState('');
  const [color, setColor] = useState('w');
  const [quality, setQuality] = useState('strong');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [activeMistake, setActiveMistake] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [guessState, setGuessState] = useState({});
  const [guessWrong, setGuessWrong] = useState(false);
  const [showBest, setShowBest] = useState(true); // engine arrow on the board
  const [sideTab, setSideTab] = useState('report'); // report | engine | moves
  // "don't use the engine as a crutch": hide eval + engine lines until you commit
  // your own assessment of the position, then reveal to check yourself.
  const [assessFirst, setAssessFirst] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [posExplain, setPosExplain] = useState(null); // on-demand "explain this position"

  // online import
  const [importSrc, setImportSrc] = useState('chess.com');
  const [importUser, setImportUser] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState(null);
  const [importedGames, setImportedGames] = useState(null);

  async function run(pgnArg = pgn, colorArg = color) {
    setError(null); setResult(null); setBusy(true); setProgress(0); setActiveMistake(null); setGuessState({});
    try { const t = new Chess(); t.loadPgn(pgnArg); if (!t.history().length) throw new Error(); }
    catch { setError('Could not read that PGN. Paste the full movetext (headers optional) from chess.com or lichess.'); setBusy(false); return; }
    let res = null;
    try {
      setPhase('Loading Stockfish…');
      await getStockfish();
      setPhase('Stockfish evaluating every position…');
      res = await analyzeWithStockfish(pgnArg, colorArg, { movetime: QUALITY[quality], onProgress: setProgress });
    } catch {
      try {
        setPhase('Offline — using the built-in coach engine…');
        const local = await engineAnalyze(pgnArg, colorArg, setProgress);
        res = localToUnified(local, colorArg);
      } catch { setError('Analysis failed — check the PGN.'); setBusy(false); return; }
    }
    setResult(res);
    setCursor(res.moves.length);
    analyzeDone();
    recordProfile(res.moves, colorArg); // feeds the weakness heatmap on the dashboard
    if (res.motifCounts) recordWeaknesses(res.motifCounts); // cross-game weakness profile
    // your blunders become personal puzzles (Tactics → "My blunders")
    const harvested = res.moves
      .filter((m) => m.color === colorArg && (m.tag === 'blunder' || m.tag === 'mistake') && m.bestSan && m.fenBefore)
      .map((m, i) => ({
        id: `mp-${Date.now()}-${i}`,
        fen: m.fenBefore,
        solution: [m.bestSan],
        motif: 'My games',
        title: `Move ${Math.floor(m.index / 2) + 1} — you played ${m.san}`,
        date: dayKey(),
      }));
    if (harvested.length) addMyPuzzles(harvested);
    setBusy(false);
  }

  // "Game Review" handoff from the Play section
  useEffect(() => {
    if (analyzeRequest && analyzeRequest.pgn) {
      setPgn(analyzeRequest.pgn);
      setColor(analyzeRequest.color);
      consumeAnalysis();
      run(analyzeRequest.pgn, analyzeRequest.color);
    }
  }, [analyzeRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doImport() {
    setImportBusy(true); setImportErr(null); setImportedGames(null);
    try {
      const games = importSrc === 'chess.com' ? await fetchChessCom(importUser) : await fetchLichess(importUser);
      setImportedGames(games);
    } catch (e) {
      setImportErr(e.message || 'Import failed — are you online?');
    }
    setImportBusy(false);
  }

  function pickImported(g) {
    setPgn(g.pgn);
    setColor(g.userColor);
    setImportedGames(null);
    run(g.pgn, g.userColor);
  }

  // "Prove it": after finding/seeing the best move, play the position out
  // against Stockfish for 8 of your moves and keep the advantage.
  const [prove, setProve] = useState(null); // { idx, fen, userMoves, thinking, verdict, startWhite }
  const [, setProveTick] = useState(0);
  const proveGame = useRef(null);

  function startProve(i) {
    const m = result.mistakes[i];
    proveGame.current = new Chess(m.fenBefore);
    setProve({ idx: i, userMoves: 0, thinking: false, verdict: null, startWhite: result.summary.evals ? result.summary.evals[m.index] : 0 });
  }
  async function finishProve(g) {
    setProve((p) => ({ ...p, thinking: true }));
    let verdict;
    if (g.isCheckmate()) {
      verdict = g.turn() !== color ? 'win' : 'loss';
    } else {
      try {
        const r = await coachMove(g.fen(), { movetime: 500 });
        const moverIsUser = g.turn() === color;
        const userCp = r ? (moverIsUser ? r.score : -r.score) : 0;
        const povStart = color === 'w' ? (prove ? prove.startWhite : 0) : -(prove ? prove.startWhite : 0);
        verdict = winPct(userCp) >= winPct(povStart) - 12 ? 'held' : 'slipped';
      } catch { verdict = 'held'; }
    }
    setProve((p) => ({ ...p, thinking: false, verdict }));
  }
  function onProveDrop(from, to, promotion) {
    const g = proveGame.current;
    if (!prove || prove.verdict || prove.thinking || g.turn() !== color) return false;
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    setProveTick((t) => t + 1);
    const n = prove.userMoves + 1;
    setProve((p) => ({ ...p, userMoves: n }));
    if (g.isGameOver() || n >= 8) { finishProve(g); return true; }
    setProve((p) => ({ ...p, thinking: true }));
    coachMove(g.fen(), { movetime: 350 }).then((r) => {
      if (r && !g.isGameOver()) g.move(r.san);
      setProveTick((t) => t + 1);
      setProve((p) => (p ? { ...p, thinking: false } : p));
      if (g.isGameOver()) finishProve(g);
    });
    return true;
  }

  useEffect(() => {
    function onKey(e) {
      if (!result) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { setCursor((c) => Math.min(c + 1, result.moves.length)); setActiveMistake(null); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { setCursor((c) => Math.max(c - 1, 0)); setActiveMistake(null); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setCursor(0); setActiveMistake(null); e.preventDefault(); }
      if (e.key === 'ArrowDown') { setCursor(result.moves.length); setActiveMistake(null); e.preventDefault(); }
      if (e.key === 'f') setFlipped((f) => !f);
      if (e.key === 'b') setShowBest((b) => !b);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result]);

  // play the move's classification sound when stepping through the review
  const soundCursor = useRef(-1);
  useEffect(() => {
    if (!result) { soundCursor.current = -1; return; }
    if (soundCursor.current === -1) { soundCursor.current = cursor; return; } // skip auto-jump to end
    if (cursor === soundCursor.current) return;
    soundCursor.current = cursor;
    if (cursor > 0 && cursor <= result.moves.length && !prove) {
      const m = result.moves[cursor - 1];
      playClassified(m.tag, /x/.test(m.san), /[+#]/.test(m.san));
    }
  }, [cursor, result]); // eslint-disable-line react-hooks/exhaustive-deps

  let fen = new Chess().fen();
  let lastMove = null;
  if (result) {
    const g = new Chess();
    for (let i = 0; i < cursor; i++) {
      const m = g.move(result.moves[i].san);
      if (i === cursor - 1) lastMove = { from: m.from, to: m.to };
    }
    fen = g.fen();
  }
  if (prove && proveGame.current) fen = proveGame.current.fen();

  // each time you step to a new position, re-hide the engine (assess-first mode)
  // and clear any on-demand explanation (it's position-specific)
  useEffect(() => { setRevealed(false); setPosExplain(null); }, [cursor]);
  // a fresh analysis lands on the Report tab
  useEffect(() => { if (result) setSideTab('report'); }, [result]);

  // keep the current move visible as you step through the game
  const movesRef = useRef(null);
  useEffect(() => {
    const el = movesRef.current && movesRef.current.querySelector('.mv.current');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [cursor]);
  const engineHidden = assessFirst && !revealed;

  // live engine for the analysis board (engine-lines panel + arrow + eval bar)
  const liveOn = !!result && !prove;
  const live = useBoardEngine(liveOn ? fen : null, liveOn, 3);
  const fenStm = fen.split(' ')[1];
  const liveLines = (live.lines || []).map((l) => ({
    cpWhite: l.mate != null ? (l.mate > 0 ? 10000 : -10000) * (fenStm === 'w' ? 1 : -1) : (fenStm === 'w' ? (l.cp ?? 0) : -(l.cp ?? 0)),
    mate: l.mate != null ? (fenStm === 'w' ? l.mate : -l.mate) : null,
    depth: l.depth,
    uci0: l.pv && l.pv[0],
    sans: pvToSanList(fen, l.pv, 8),
  }));
  // live eval bar value (white POV) — falls back to the precomputed eval
  const liveEvalW = liveLines[0]
    ? (liveLines[0].mate != null ? (liveLines[0].mate > 0 ? 1100 : -1100) : liveLines[0].cpWhite)
    : null;

  const mistake = activeMistake != null && result ? result.mistakes[activeMistake] : null;
  const mState = mistake ? guessState[activeMistake] || 'guessing' : null;
  const atMistakePos = mistake && cursor === mistake.index;
  const showSolution = atMistakePos && (mState === 'solved' || mState === 'revealed');
  let arrows = showSolution && mistake.pv && mistake.pv.length
    ? mistake.pv.map((m, i) => [m.from, m.to, i % 2 === 0 ? '#b07dff' : '#e06c6c'])
    : [];
  // live engine best-move arrow (toggle with ★ / B) — also hidden in assess-first mode
  if (!arrows.length && showBest && !prove && !engineHidden && liveLines[0] && liveLines[0].sans[0]) {
    const f = liveLines[0].sans[0];
    arrows = [[f.from, f.to, 'rgba(111,201,138,0.9)']];
  }

  function jumpToMistake(i) { setActiveMistake(i); setCursor(result.mistakes[i].index); setGuessWrong(false); }

  function onGuessDrop(from, to, promotion) {
    if (!atMistakePos || mState !== 'guessing') return false;
    const g = new Chess(mistake.fenBefore);
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    const ok = mistake.bestMove && m.from === mistake.bestMove.from && m.to === mistake.bestMove.to;
    if (ok) { sounds.success(); setGuessState((s) => ({ ...s, [activeMistake]: 'solved' })); }
    else { sounds.fail(); setGuessWrong(true); setTimeout(() => setGuessWrong(false), 1400); }
    return false;
  }
  const guessGame = atMistakePos ? new Chess(mistake.fenBefore) : null;
  const getMoves = guessGame && mState === 'guessing'
    ? (sq) => { try { return guessGame.moves({ square: sq, verbose: true }); } catch { return []; } } : null;

  // Annotated PGN download: evals + better-move comments inline.
  function exportAnnotated() {
    if (!result) return;
    const g = new Chess();
    let headerObj = {};
    try { g.loadPgn(pgn); headerObj = g.header() || {}; } catch { /* moves only */ }
    const lines = [];
    for (const [k, v] of Object.entries(headerObj)) if (v) lines.push(`[${k} "${v}"]`);
    lines.push('');
    let txt = '';
    for (let i = 0; i < result.moves.length; i++) {
      const m = result.moves[i];
      if (i % 2 === 0) txt += `${i / 2 + 1}. `;
      txt += m.san;
      const meta = TAG_META[m.tag];
      const SYM = new Set(['brilliant', 'great', 'inaccuracy', 'miss', 'mistake', 'blunder']);
      if (meta && meta.label && SYM.has(m.tag)) txt += meta.label;
      const cpw = result.summary.evals ? result.summary.evals[i + 1] : null;
      const notes = [];
      if (cpw != null) notes.push(`[%eval ${(cpw / 100).toFixed(2)}]`);
      if (m.bestSan && (m.tag === 'inaccuracy' || m.tag === 'mistake' || m.tag === 'blunder' || m.tag === 'miss')) notes.push(`${meta.name}. Better: ${m.bestSan}`);
      if (notes.length) txt += ` {${notes.join(' ')}}`;
      txt += ' ';
      if (i % 16 === 15) txt += '\n';
    }
    txt += headerObj.Result && headerObj.Result !== '?' ? headerObj.Result : '*';
    const blob = new Blob([lines.join('\n') + txt + '\n'], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chesslab-annotated.pgn';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const mistakeIndices = result ? new Set(result.mistakes.map((m) => m.index)) : new Set();
  const S = result ? result.summary : null;
  const fmt = (v, suf = '') => (v == null ? '—' : v + suf);
  const opening = result ? openingName(result.moves.map((m) => m.san)) : null;
  const cursorEval = result && S && S.evals ? S.evals[Math.min(cursor, S.evals.length - 1)] : null;
  const boardOrientation = flipped ? (color === 'w' ? 'black' : 'white') : (color === 'w' ? 'white' : 'black');
  const extras = result ? reviewExtras(result.moves, color) : null;
  const commentary = result ? narrateGame({ moves: result.moves, summary: result.summary, mistakes: result.mistakes, opening, color, phases: extras && extras.phases }) : null;
  const headers = useMemo(() => {
    if (!result) return { white: 'White', black: 'Black' };
    try { const g = new Chess(); g.loadPgn(pgn); const h = g.header() || {}; return { white: h.White || 'White', black: h.Black || 'Black' }; }
    catch { return { white: 'White', black: 'Black' }; }
  }, [result, pgn]);
  const PHASES = [['opening', 'Opening'], ['middlegame', 'Middlegame'], ['endgame', 'Endgame']];
  const initial = (n) => (n && n[0] ? n[0].toUpperCase() : '?');
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  return (
    <div>
      <h1 className="page-title">Game <span className="accent">Analyzer</span></h1>
      <p className="page-sub">Stockfish-graded review: accuracy, estimated rating, every move tagged — then you must find the moves you missed.</p>

      {!result && (
        <div className="layout-2col">
          <div className="panel" style={{ flex: 1, minWidth: 320, maxWidth: 600 }}>
            <h3>Paste a game</h3>
            <textarea className="pgn-input" placeholder="Paste PGN here…" value={pgn} onChange={(e) => setPgn(e.target.value)} />
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <span className="small muted">I played:</span>
              <button className={`btn ${color === 'w' ? 'primary' : ''}`} onClick={() => setColor('w')}>White</button>
              <button className={`btn ${color === 'b' ? 'primary' : ''}`} onClick={() => setColor('b')}>Black</button>
              <span className="small muted" style={{ marginLeft: 10 }}>Engine time:</span>
              {Object.keys(QUALITY).map((q) => (
                <button key={q} className={`btn ${quality === q ? 'primary' : ''}`} onClick={() => setQuality(q)}>{q}</button>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn primary" disabled={busy || !pgn.trim()} onClick={() => run()}>{busy ? 'Analyzing…' : '⚡ Analyze game'}</button>
              <button className="btn" disabled={busy} onClick={() => setPgn(SAMPLE_PGN)}>Load sample</button>
            </div>
            {busy && <div className="progressbar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            {busy && <p className="small muted" style={{ marginTop: 6 }}>{phase}</p>}
            {error && <div className="banner err" style={{ marginTop: 12 }}>{error}</div>}
            <p className="small muted" style={{ marginTop: 10 }}>Stockfish 17 lite is embedded in the app — full-strength analysis, fully offline, nothing to download.</p>
          </div>

          <div className="panel" style={{ flex: 1, minWidth: 320, maxWidth: 600 }}>
            <h3>…or fetch your latest games</h3>
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <button className={`btn ${importSrc === 'chess.com' ? 'primary' : ''}`} onClick={() => setImportSrc('chess.com')}>♟ chess.com</button>
              <button className={`btn ${importSrc === 'lichess' ? 'primary' : ''}`} onClick={() => setImportSrc('lichess')}>🐴 lichess</button>
              <input className="text-input" placeholder="username" value={importUser}
                onChange={(e) => setImportUser(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && importUser.trim()) doImport(); }} />
              <button className="btn" disabled={importBusy || !importUser.trim()} onClick={doImport}>{importBusy ? 'Fetching…' : 'Fetch'}</button>
            </div>
            {importErr && <div className="banner err" style={{ marginTop: 10 }}>{importErr}</div>}
            {importedGames && (
              <div className="card-list scrolly" style={{ marginTop: 12, maxHeight: 330 }}>
                {importedGames.map((g) => (
                  <button key={g.id} className="select-card" onClick={() => pickImported(g)}>
                    <div className="t" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⚪ {g.white} · ⚫ {g.black}</span>
                      <span style={{ color: 'var(--gold-soft)', flexShrink: 0 }}>{g.result}</span>
                    </div>
                    <div className="d">{g.speed} · {g.date} · you were {g.userColor === 'w' ? 'White' : 'Black'}</div>
                  </button>
                ))}
              </div>
            )}
            {!importedGames && !importErr && <p className="small muted" style={{ marginTop: 10 }}>Pulls your most recent games straight from the public chess.com / lichess API — click one to analyze it. (Online only.)</p>}
          </div>
        </div>
      )}

      {result && (
        <div className="az-workspace">
          <div className="az-board">
              <div className="board-with-eval">
                {!prove && !engineHidden && (liveEvalW != null || cursorEval != null) && (
                  <EvalBar cp={liveEvalW != null ? liveEvalW : cursorEval} mate={liveLines[0] ? liveLines[0].mate : null} flipped={boardOrientation === 'black'} />
                )}
                <div style={{ flex: 1 }}>
                  <Board fen={fen} orientation={boardOrientation}
                    lastMove={prove ? null : lastMove} arrows={prove ? [] : arrows}
                    onDrop={prove ? onProveDrop : atMistakePos && mState === 'guessing' ? onGuessDrop : null}
                    draggable={!!(prove || (atMistakePos && mState === 'guessing'))}
                    getMoves={prove ? (sq) => { try { return proveGame.current.moves({ square: sq, verbose: true }); } catch { return []; } } : getMoves} />
                </div>
              </div>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
                <button className="btn" disabled={cursor === 0} onClick={() => { setCursor(0); setActiveMistake(null); }}>⏮</button>
                <button className="btn" disabled={cursor === 0} onClick={() => { setCursor(cursor - 1); setActiveMistake(null); }}>◀</button>
                <button className="btn" disabled={cursor >= result.moves.length} onClick={() => { setCursor(cursor + 1); setActiveMistake(null); }}>▶</button>
                <button className="btn" disabled={cursor >= result.moves.length} onClick={() => { setCursor(result.moves.length); setActiveMistake(null); }}>⏭</button>
                <button className={`btn ${showBest ? 'primary' : ''}`} title="Engine's best move as an arrow (B)" onClick={() => setShowBest(!showBest)}>★ Engine arrow</button>
              </div>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                {!prove && (
                  <button className="btn teal" disabled={engineHidden || !liveLines.length}
                    title={engineHidden ? 'Reveal the engine first (assess-first is on)' : 'An engine-grounded read of this exact position'}
                    onClick={() => setPosExplain(explainPosition({ fen, lines: liveLines, evalWhite: liveEvalW, depth: live.depth }))}>
                    💬 Explain this position
                  </button>
                )}
                <button className="btn" onClick={exportAnnotated}>⬇ Annotated PGN</button>
                <button className="btn" onClick={() => { setResult(null); setActiveMistake(null); setProve(null); }}>New analysis</button>
              </div>
              {posExplain && (
                <div className="panel" style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>💬 This position <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{posExplain.depth ? `· depth ${posExplain.depth}` : ''}</span></h3>
                    <button className="btn btn-mini" onClick={() => setPosExplain(null)}>✕</button>
                  </div>
                  <p style={{ margin: '10px 0 0', fontWeight: 600 }}>{posExplain.lead}</p>
                  {posExplain.move && <p className="small" style={{ margin: '6px 0 0' }}>{posExplain.move}</p>}
                  {posExplain.line && <p className="small muted" style={{ margin: '4px 0 0' }}>{posExplain.line}</p>}
                  {posExplain.alt && <p className="small muted" style={{ margin: '4px 0 0' }}>{posExplain.alt}</p>}
                  {posExplain.struct && <p className="small" style={{ margin: '6px 0 0', color: 'var(--gold-soft)' }}>{posExplain.struct}</p>}
                  <p className="small muted" style={{ margin: '8px 0 0', fontStyle: 'italic' }}>Grounded in the live engine line — no invented moves.</p>
                </div>
              )}
              <p className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>← → move · B engine arrow · F flip · click the graph</p>
            </div>

            <div className="az-panel">
              <div className="az-tabs">
                {AZ_TABS.map(([id, label]) => (
                  <button key={id} className={`az-tab ${sideTab === id ? 'active' : ''}`} onClick={() => setSideTab(id)}>
                    {label}{id === 'mistakes' && result.mistakes.length ? ` ${result.mistakes.length}` : ''}
                  </button>
                ))}
              </div>

              {sideTab === 'report' && (
                <div className="gr-wrap">
                  {extras && extras.comment && (
                    <div className="gr-coach">
                      <div className="gr-coach-face">🧑‍🏫</div>
                      <div className="gr-coach-bubble">{extras.comment}</div>
                    </div>
                  )}
                  <div className="report-card gr-graphcard">
                    <div className="rc-head">{result.engine}{opening ? ` · ${opening}` : ''}</div>
                    <EvalGraph evals={S.evals} cursor={cursor} moves={result.moves} onSeek={(i) => { setCursor(i); setActiveMistake(null); }} />
                    <div className="acc-rings">
                      <AccuracyRing value={S.acc.w} label={headers.white} tone="w" />
                      <AccuracyRing value={S.acc.b} label={headers.black} tone="b" />
                    </div>
                  </div>
                  <div className="gr-panel">
                    <div className="gr-row gr-players">
                      <div className="gr-label" />
                      {[['w', headers.white], ['b', headers.black]].map(([c, name]) => (
                        <div className="gr-pcell" key={c}>
                          <div className={`gr-avatar ${c}`}>{initial(name)}</div>
                          <div className="gr-pname" title={name}>{name}</div>
                        </div>
                      ))}
                    </div>
                    <div className="gr-row">
                      <div className="gr-label">Accuracy</div>
                      <div className="gr-pcell"><span className={`gr-accbox ${(S.acc.w || 0) >= (S.acc.b || 0) ? 'hi' : 'lo'}`}>{fmt(S.acc.w)}</span></div>
                      <div className="gr-pcell"><span className={`gr-accbox ${(S.acc.b || 0) > (S.acc.w || 0) ? 'hi' : 'lo'}`}>{fmt(S.acc.b)}</span></div>
                    </div>
                    <div className="gr-sep" />
                    {LEGEND_TAGS.map((t) => (
                      <div className="gr-row gr-classrow" key={t}>
                        <div className="gr-label" style={{ color: `var(--c-${t === 'inaccuracy' ? 'inacc' : t})` }}>{TAG_META[t].name}</div>
                        <div className="gr-cnt" style={{ color: `var(--c-${t === 'inaccuracy' ? 'inacc' : t})` }}>{S.counts.w[t] || 0}</div>
                        <div className="gr-mid"><ClassBadge tag={t} size={26} title={TAG_META[t].name} /></div>
                        <div className="gr-cnt" style={{ color: `var(--c-${t === 'inaccuracy' ? 'inacc' : t})` }}>{S.counts.b[t] || 0}</div>
                      </div>
                    ))}
                    <div className="gr-sep" />
                    <div className="gr-row">
                      <div className="gr-label">Game Rating</div>
                      <div className="gr-pcell"><span className="gr-accbox hi">{fmt(ratingFromAccuracy(S.acc.w))}</span></div>
                      <div className="gr-pcell"><span className="gr-accbox lo">{fmt(ratingFromAccuracy(S.acc.b))}</span></div>
                    </div>
                    {extras && PHASES.map(([ph, lbl]) => (
                      <div className="gr-row gr-phaserow" key={ph}>
                        <div className="gr-label">{lbl}</div>
                        <div className="gr-pcell">{extras.phases[ph] && extras.phases[ph].w ? <ClassBadge tag={extras.phases[ph].w} size={24} /> : <span className="gr-dash">–</span>}</div>
                        <div className="gr-pcell">{extras.phases[ph] && extras.phases[ph].b ? <ClassBadge tag={extras.phases[ph].b} size={24} /> : <span className="gr-dash">–</span>}</div>
                      </div>
                    ))}
                  </div>
                  {commentary && (
                    <div className="gr-commentary panel">
                      <h3>🎙️ Coach's Commentary</h3>
                      <p className="cm-lead">{commentary.opening}</p>
                      {commentary.turningPoints.length > 0 && (
                        <>
                          <h4 className="cm-h">Turning points</h4>
                          {commentary.turningPoints.map((t, i) => (
                            <p key={i} className="cm-tp"><b>{t.head}</b> — {t.text}</p>
                          ))}
                        </>
                      )}
                      {(commentary.motifs.length > 0 || commentary.structure.length > 0) && (
                        <>
                          <h4 className="cm-h">What decided it</h4>
                          {commentary.motifs.map((m, i) => <p key={`m${i}`} className="cm-li">• {cap(m)}.</p>)}
                          {commentary.structure.map((s, i) => <p key={`s${i}`} className="cm-li">• {s}</p>)}
                        </>
                      )}
                      <h4 className="cm-h">Takeaways</h4>
                      {commentary.takeaways.map((t, i) => <p key={i} className="cm-li">✓ {t}</p>)}
                      <h4 className="cm-h">Study a model game</h4>
                      <p className="cm-li">📚 {commentary.masterGame}</p>
                      <p className="cm-foot">Every move and evaluation here is taken from Stockfish's analysis of your game — nothing invented.</p>
                    </div>
                  )}
                </div>
              )}

              {sideTab === 'engine' && (
              <div className="panel engine-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>Engine <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· Stockfish 17 {live.depth ? `· depth ${live.depth}` : '· …'}</span></h3>
                  <label className="crutch-toggle" title="Hide the engine until you've formed your own assessment of the position">
                    <input type="checkbox" checked={assessFirst} onChange={(e) => { setAssessFirst(e.target.checked); setRevealed(false); }} />
                    Assess first
                  </label>
                </div>
                <div className={`crutch-veil ${engineHidden ? 'hidden' : ''}`} style={{ marginTop: 10 }}>
                  <div className="crutch-blur">
                    {liveLines.length === 0 && <p className="small muted">Analyzing…</p>}
                    {liveLines.map((l, i) => (
                      <div key={i} className="engine-line" onClick={() => { if (l.uci0) setCursor(cursor); }}>
                        <b className="engine-eval" style={{ color: l.cpWhite >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                          {l.mate != null ? `M${Math.abs(l.mate)}` : `${l.cpWhite >= 0 ? '+' : ''}${(l.cpWhite / 100).toFixed(2)}`}
                        </b>
                        <span className="engine-pv">{l.sans.map((s) => fig(s.san)).join(' ')}</span>
                      </div>
                    ))}
                  </div>
                  {engineHidden && (
                    <div className="crutch-cover">
                      <div className="cc-title">What's your verdict?</div>
                      <div className="cc-sub">Who stands better, and what's the best move? Decide first — then check the engine.</div>
                      <button className="btn primary btn-mini" onClick={() => setRevealed(true)}>Reveal engine</button>
                    </div>
                  )}
                </div>
              </div>
              )}

              {sideTab === 'mistakes' && (
              <div className="panel">
                <h3>Learn from your mistakes — find the better move</h3>
                {result.mistakes.length === 0 && <p className="small">No serious mistakes for your side — clean game. Raise the engine time for a harsher look.</p>}
                <div className="card-list">
                  {result.mistakes.map((m, i) => {
                    const st = guessState[i] || 'guessing';
                    const active = activeMistake === i;
                    return (
                      <div key={i} className="panel mistake-card" style={{ padding: '12px 14px', cursor: 'pointer', borderColor: active ? 'var(--gold)' : undefined }}
                        onClick={() => jumpToMistake(i)}>
                        <div className="head">
                          {(() => { const mt = TAG_META[result.moves[m.index].tag] || TAG_META.mistake; return <span className={`chip ${mt.cls}`}>{mt.label ? mt.label + ' ' : ''}{mt.name}</span>; })()}
                          <b>{m.moveNumber}{result.moves[m.index].color === 'w' ? '.' : '...'} {fig(m.san)}</b>
                          <span className="sev">{m.missedMate ? 'missed mate' : m.winDrop != null ? `−${m.winDrop}% win` : `−${(m.cpl / 100).toFixed(1)}`}</span>
                          {st === 'solved' && <span className="chip green">found ✓</span>}
                        </div>
                        {m.motifs && m.motifs.length > 0 && (
                          <div className="motif-row">
                            {m.motifs.map((t) => { const mm = MOTIF_META[t]; return mm ? <span key={t} className={`chip ${mm.cls} motif-chip`} title={mm.advice}>{mm.icon} {mm.label}</span> : null; })}
                            <button className="btn btn-mini" title="Jump to Tactics preloaded with this pattern"
                              onClick={(e) => { e.stopPropagation(); requestTactics({ motif: m.motifs[0] }); }}>🧩 Drill this</button>
                            <button className="btn btn-mini" title="Replay puzzles harvested from your own mistakes"
                              onClick={(e) => { e.stopPropagation(); requestTactics({ mode: 'mine' }); }}>💥 My blunders</button>
                          </div>
                        )}
                        {active && st === 'guessing' && (
                          <>
                            <div className="banner gold big" style={{ margin: '8px 0' }}>
                              Here you played <b>{fig(m.san)}</b>{m.missedMate ? ' and missed a forced mate' : ''}. <b>Find the engine's move on the board!</b>
                            </div>
                            {guessWrong && <div className="banner err">✗ Not that — checks, captures, threats.</div>}
                            <button className="btn" onClick={(e) => { e.stopPropagation(); setGuessState((s) => ({ ...s, [i]: 'revealed' })); }}>Give up — show me</button>
                          </>
                        )}
                        {active && st !== 'guessing' && (
                          <>
                            <div className={`banner ${st === 'solved' ? 'ok' : 'coach'} big`} style={{ margin: '8px 0' }}>
                              {st === 'solved' ? '✓ Exactly: ' : 'The move was '}<b>{fig(m.bestSan || '')}</b>. {m.explanation}
                            </div>
                            {m.pv && m.pv.length > 1 && <p className="small muted">Engine line (arrows): {m.pv.map((p) => fig(p.san)).join(' ')}</p>}
                            {(!prove || prove.idx !== i) && (
                              <button className="btn primary" onClick={(e) => { e.stopPropagation(); startProve(i); }}>💪 Prove it — play it out vs Stockfish</button>
                            )}
                            {prove && prove.idx === i && (
                              <div className="banner coach big" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                                {!prove.verdict && <>Play the position on the board — {8 - prove.userMoves} of your moves left. {prove.thinking && <span className="chip blue">SF thinking…</span>}</>}
                                {prove.verdict === 'win' && <b style={{ color: 'var(--good)' }}>Checkmate — proven beyond doubt. ✓</b>}
                                {prove.verdict === 'held' && <b style={{ color: 'var(--good)' }}>✓ Advantage held over 8 moves vs Stockfish — you own this position now.</b>}
                                {prove.verdict === 'slipped' && <b style={{ color: 'var(--bad)' }}>The advantage slipped during the playout — replay it and watch the engine line first.</b>}
                                {prove.verdict === 'loss' && <b style={{ color: 'var(--bad)' }}>Mated in the playout — back to the drawing board.</b>}
                                <div className="btn-row">
                                  {prove.verdict && <button className="btn" onClick={() => startProve(i)}>Try again</button>}
                                  <button className="btn" onClick={() => setProve(null)}>Stop</button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {sideTab === 'moves' && (
              <div className="panel">
                <h3>Moves</h3>
                <div className="movelist scrolly" ref={movesRef}>
                  {result.moves.map((m, i) => {
                    const meta = m.tag ? TAG_META[m.tag] : null;
                    return (
                      <React.Fragment key={i}>
                        {i % 2 === 0 && <span className="mvnum">{i / 2 + 1}.</span>}
                        <button
                          className={`mv ${cursor === i + 1 ? 'current' : ''} ${meta ? meta.cls : ''} ${mistakeIndices.has(i) ? 'mistake' : ''}`}
                          title={meta ? meta.name + (m.bestSan && m.tag !== 'best' && m.tag !== 'brilliant' && m.tag !== 'good' ? ` — better: ${m.bestSan}` : '') : ''}
                          onClick={() => { setCursor(i + 1); setActiveMistake(null); }}>
                          {fig(m.san)}{meta && meta.label ? <sup>{meta.label}</sup> : null}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              )}

              {sideTab === 'coach' && (
                <CoachChat getContext={() => buildCoachContext({ fen, lines: liveLines, evalWhite: liveEvalW, moves: result.moves, cursor, playerColor: color })} />
              )}
            </div>
          </div>
        )}
    </div>
  );
}
