import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import EvalBar from '../components/EvalBar.jsx';
import { BOTS } from '../data/bots.js';
import { botMove } from '../playEngine.js';
import { getStockfish, getPlayEngine } from '../stockfish.js';
import { openingName, bookContinuations } from '../data/openingNames.js';
import { fig } from '../figurine.js';
import { useStats } from '../store.js';
import { useSettings, useUi } from '../settings.js';
import { playForMove, sounds } from '../sounds.js';

const TIME_CONTROLS = [
  { id: 'none', label: '∞ Casual', ms: null, inc: 0 },
  { id: '3+2', label: '3+2 Blitz', ms: 180e3, inc: 2e3 },
  { id: '5+0', label: '5 min Blitz', ms: 300e3, inc: 0 },
  { id: '10+0', label: '10 min Rapid', ms: 600e3, inc: 0 },
  { id: '15+10', label: '15+10 Rapid', ms: 900e3, inc: 10e3 },
];

function fmtClock(ms) {
  if (ms == null) return '--:--';
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  if (ms < 20e3) return `${Math.floor(s / 60)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// In-game thinking aid — the every-move checklist from the Training Plan,
// one tap away while you actually play (forcing moves first).
const MOVE_CHECKLIST = [
  'Checks — any check that achieves something?',
  'Threats — am I about to be checked or lose material?',
  'Hanging — is anything of mine (or theirs) undefended?',
  'Tactics — fork, pin, skewer, discovered attack?',
  'Activity — a better square, an outpost, or an open file?',
];
function ChecklistAid() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <h3 style={{ margin: 0 }}>✓ Blunder-check</h3>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </div>
      {open ? (
        <ul className="checklist tight" style={{ margin: '12px 0 4px' }}>
          {MOVE_CHECKLIST.map((t) => <li key={t}>{t}</li>)}
        </ul>
      ) : (
        <p className="small muted" style={{ margin: '6px 0 0' }}>Tap before you move — run the list, most forcing first.</p>
      )}
    </div>
  );
}

export default function Play() {
  const { vsRecord, recordGame, recordSlowGame, savedGame, saveGame, clearSavedGame } = useStats();
  const { evalBarPlay, set: setSettings } = useSettings();
  const requestAnalysis = useUi((u) => u.requestAnalysis);
  const playRequest = useUi((u) => u.playRequest);
  const consumePlay = useUi((u) => u.consumePlay);

  // ---- setup state ----
  const [botId, setBotId] = useState('b1000');
  const [colorChoice, setColorChoice] = useState('white'); // white | black | random
  const [tcId, setTcId] = useState('none');

  // ---- game state ----
  const [phase, setPhase] = useState('setup'); // setup | playing | over
  const gameRef = useRef(new Chess());
  const [, setTick] = useState(0); // re-render trigger after gameRef mutations
  const [userColor, setUserColor] = useState('w');
  const [bot, setBot] = useState(BOTS[3]);
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [premove, setPremove] = useState(null);
  const [hintArrow, setHintArrow] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState(null); // { outcome: 'w'|'d'|'l', reason }
  const [viewPly, setViewPly] = useState(null); // null = live
  const [evalCp, setEvalCp] = useState(null); // white POV, for the eval bar
  const [drawMsg, setDrawMsg] = useState(null);
  const [flipped, setFlipped] = useState(false);

  // clocks
  const [clocks, setClocks] = useState({ w: null, b: null });
  const clockRef = useRef({ w: null, b: null, inc: 0, runningSince: null, turn: 'w' });
  const lowTimeWarned = useRef(false);

  const gameIdRef = useRef(0); // guards async engine replies after reset/new game
  const movesListRef = useRef(null);

  // boot the dedicated play engine in the background — first bot move is instant
  const [engineReady, setEngineReady] = useState(false);
  useEffect(() => {
    let on = true;
    getPlayEngine().then(() => { if (on) setEngineReady(true); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const game = gameRef.current;
  const history = game.history({ verbose: true });
  const live = viewPly == null || viewPly >= history.length;

  const shownFen = useMemo(() => {
    if (live) return game.fen();
    const g = new Chess();
    for (let i = 0; i < viewPly; i++) g.move(history[i].san);
    return g.fen();
  }, [live, viewPly, history.length, game]);

  const shownLastMove = live
    ? lastMove
    : viewPly > 0 ? { from: history[viewPly - 1].from, to: history[viewPly - 1].to } : null;

  const opening = useMemo(() => openingName(history.map((m) => m.san)), [history.length]);

  // ---------- clock machinery ----------
  useEffect(() => {
    if (phase !== 'playing' || clockRef.current.w == null) return;
    const iv = setInterval(() => {
      const c = clockRef.current;
      if (c.runningSince == null) return;
      const elapsed = Date.now() - c.runningSince;
      const remain = c[c.turn] - elapsed;
      setClocks({ w: c.turn === 'w' ? remain : c.w, b: c.turn === 'b' ? remain : c.b });
      if (remain <= 10e3 && !lowTimeWarned.current && c.turn === userColor) {
        lowTimeWarned.current = true;
        sounds.lowTime();
      }
      if (remain <= 0) {
        c[c.turn] = 0;
        c.runningSince = null;
        finishGame(c.turn === userColor ? 'l' : 'w', c.turn === userColor ? 'You ran out of time' : `${bot.name} ran out of time`);
      }
    }, 100);
    return () => clearInterval(iv);
  });

  function clockSwitch(moverColor) {
    const c = clockRef.current;
    if (c.w == null) return;
    if (c.runningSince != null) {
      c[moverColor] = Math.max(0, c[moverColor] - (Date.now() - c.runningSince)) + c.inc;
    }
    c.turn = moverColor === 'w' ? 'b' : 'w';
    c.runningSince = Date.now();
    setClocks({ w: c.w, b: c.b });
  }

  // ---------- game flow ----------
  // opts: { startFen, forceColor, label } — for "play this repertoire position vs a bot"
  function startGame(opts = {}) {
    const chosen = BOTS.find((b) => b.id === botId) || BOTS[0];
    const color = opts.forceColor || (colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice === 'white' ? 'w' : 'b');
    const tc = TIME_CONTROLS.find((t) => t.id === tcId);
    gameIdRef.current += 1;
    const g = new Chess(opts.startFen || undefined);
    g.header('Event', opts.label ? `ChessLab — ${opts.label}` : 'ChessLab vs Bot');
    g.header('Site', 'ChessLab');
    g.header('Date', new Date().toISOString().slice(0, 10).replace(/-/g, '.'));
    g.header('White', color === 'w' ? 'Selim' : `${chosen.name} (${chosen.elo})`);
    g.header('Black', color === 'b' ? 'Selim' : `${chosen.name} (${chosen.elo})`);
    if (opts.startFen) { g.header('SetUp', '1'); g.header('FEN', opts.startFen); }
    g.__startFen = opts.startFen || null;
    g.__label = opts.label || null;
    gameRef.current = g;
    setBot(chosen);
    setUserColor(color);
    setFlippedSafe(false);
    setPhase('playing');
    setResult(null); setLastMove(null); setPremove(null); setHintArrow(null); setHintsUsed(0);
    setViewPly(null); setEvalCp(null); setDrawMsg(null); setThinking(false);
    lowTimeWarned.current = false;
    clockRef.current = { w: tc.ms, b: tc.ms, inc: tc.inc, runningSince: tc.ms ? Date.now() : null, turn: g.turn() };
    setClocks({ w: tc.ms, b: tc.ms });
    sounds.gameStart();
    setTick((t) => t + 1);
    if (g.turn() !== color) scheduleBotMove(g, chosen, gameIdRef.current);
  }
  function setFlippedSafe(v) { setFlipped(v); }

  // "play this position vs a bot" handoff (Opening Explorer)
  useEffect(() => {
    if (playRequest && playRequest.fen && phase !== 'playing') {
      const { fen: f, color: c, name } = playRequest;
      consumePlay();
      startGame({ startFen: f, forceColor: c, label: name });
    }
  }, [playRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  // persist the in-progress game so closing the app never loses it
  function persistGame(g) {
    if (g.__finished) return;
    try {
      const c = clockRef.current;
      saveGame({
        pgn: g.pgn(), botId: bot.id, userColor, tcId,
        clocks: { w: c.runningSince != null && c.turn === 'w' ? c.w - (Date.now() - c.runningSince) : c.w, b: c.runningSince != null && c.turn === 'b' ? c.b - (Date.now() - c.runningSince) : c.b },
        startFen: g.__startFen || null, label: g.__label || null, ts: Date.now(),
      });
    } catch { /* persistence is best-effort */ }
  }

  function resumeSaved() {
    const s = savedGame;
    if (!s) return;
    const chosen = BOTS.find((b) => b.id === s.botId) || BOTS[0];
    gameIdRef.current += 1;
    const g = new Chess();
    try { g.loadPgn(s.pgn); } catch { clearSavedGame(); return; }
    g.__startFen = s.startFen || null;
    g.__label = s.label || null;
    gameRef.current = g;
    setBotId(s.botId);
    setBot(chosen);
    setUserColor(s.userColor);
    setTcId(s.tcId || 'none');
    setPhase('playing');
    setResult(null); setLastMove(null); setPremove(null); setHintArrow(null); setHintsUsed(0);
    setViewPly(null); setEvalCp(null); setDrawMsg(null); setThinking(false); setFlipped(false);
    lowTimeWarned.current = false;
    const tc = TIME_CONTROLS.find((t) => t.id === (s.tcId || 'none'));
    clockRef.current = { w: s.clocks ? s.clocks.w : tc.ms, b: s.clocks ? s.clocks.b : tc.ms, inc: tc.inc, runningSince: (s.clocks && s.clocks.w != null) ? Date.now() : null, turn: g.turn() };
    setClocks({ w: clockRef.current.w, b: clockRef.current.b });
    sounds.gameStart();
    setTick((t) => t + 1);
    if (g.turn() !== s.userColor && !g.isGameOver()) scheduleBotMove(g, chosen, gameIdRef.current);
  }

  function finishGame(outcome, reason) {
    if (gameRef.current.__finished) return;
    gameRef.current.__finished = true;
    clockRef.current.runningSince = null;
    setPhase('over');
    setThinking(false);
    setPremove(null);
    setResult({ outcome, reason });
    const res = outcome === 'w' ? (userColor === 'w' ? '1-0' : '0-1') : outcome === 'l' ? (userColor === 'w' ? '0-1' : '1-0') : '1/2-1/2';
    try { gameRef.current.header('Result', res); } catch { /* ok */ }
    clearSavedGame();
    recordGame(bot.id, outcome, bot.elo);
    // count toward the daily "play a slow game" habit (casual or >= 10 min base time)
    const stc = TIME_CONTROLS.find((t) => t.id === tcId);
    if (stc && (stc.ms == null || stc.ms >= 600e3)) recordSlowGame();
    if (outcome === 'w') sounds.victory(); else if (outcome === 'l') sounds.defeat(); else sounds.draw();
  }

  function checkGameEnd(g, moverIsUser) {
    if (g.isCheckmate()) { finishGame(moverIsUser ? 'w' : 'l', moverIsUser ? `Checkmate — you beat ${bot.name}!` : `Checkmate — ${bot.name} wins`); return true; }
    if (g.isStalemate()) { finishGame('d', 'Draw by stalemate'); return true; }
    if (g.isThreefoldRepetition()) { finishGame('d', 'Draw by threefold repetition'); return true; }
    if (g.isInsufficientMaterial()) { finishGame('d', 'Draw — insufficient material'); return true; }
    if (g.isDraw()) { finishGame('d', 'Draw (50-move rule)'); return true; }
    return false;
  }

  async function refreshEval(g, id) {
    if (!evalBarPlay) return;
    try {
      const sf = await getStockfish();
      const r = await sf.analyze(g.fen(), 200);
      if (gameIdRef.current !== id || gameRef.current.__finished) return;
      const stm = g.turn();
      const cp = r.mate != null ? (r.mate > 0 ? 1200 : -1200) : (r.cp ?? 0);
      setEvalCp(stm === 'w' ? cp : -cp);
    } catch { /* eval bar is best-effort */ }
  }

  function scheduleBotMove(g, chosenBot, id) {
    setThinking(true);
    const started = Date.now();
    // opening book: for the first plies of a from-scratch game, bots play
    // varied human openings instead of the engine's eternal same reply
    if (!g.__startFen && g.history().length < 10) {
      const conts = bookContinuations(g.history());
      const legal = new Set(g.moves().map((s) => s.replace(/[+#]/g, '')));
      const candidates = conts.filter((s) => legal.has(s.replace(/[+#]/g, '')));
      if (candidates.length && Math.random() < 0.92) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        setTimeout(() => {
          if (gameIdRef.current !== id || gameRef.current.__finished) return;
          if (g.isGameOver()) { setThinking(false); return; }
          const m = g.move(pick);
          playForMove(m, g.isCheck());
          setLastMove({ from: m.from, to: m.to });
          clockSwitch(m.color);
          setThinking(false);
          setTick((t) => t + 1);
          if (checkGameEnd(g, false)) return;
          persistGame(g);
          refreshEval(g, id);
          executePremove(g, id);
        }, 350 + Math.random() * 400);
        return;
      }
    }
    botMove(g.fen(), chosenBot.params).then((r) => {
      if (gameIdRef.current !== id || gameRef.current.__finished) return;
      const apply = () => {
        if (gameIdRef.current !== id || gameRef.current.__finished) return;
        if (r && r.san && !g.isGameOver()) {
          const m = g.move(r.san);
          playForMove(m, g.isCheck());
          setLastMove({ from: m.from, to: m.to });
          clockSwitch(m.color);
          setThinking(false);
          setTick((t) => t + 1);
          if (checkGameEnd(g, false)) return;
          persistGame(g);
          refreshEval(g, id);
          executePremove(g, id);
        } else {
          setThinking(false);
        }
      };
      // a touch of "thinking time" so weak bots don't move instantly
      const minDelay = Math.max(0, 300 - (Date.now() - started) + Math.random() * 250);
      setTimeout(apply, minDelay);
    }).catch(() => setThinking(false));
  }

  function executePremove(g, id) {
    setPremove((pm) => {
      if (!pm) return null;
      try {
        const m = g.move({ from: pm.from, to: pm.to, promotion: pm.promotion || 'q' });
        playForMove(m, g.isCheck());
        setLastMove({ from: m.from, to: m.to });
        clockSwitch(m.color);
        setHintArrow(null);
        setTick((t) => t + 1);
        if (!checkGameEnd(g, true)) {
          persistGame(g);
          refreshEval(g, id);
          scheduleBotMove(g, bot, id);
        }
      } catch { /* premove no longer legal — drop it */ }
      return null;
    });
  }

  function onDrop(from, to, promotion) {
    if (phase !== 'playing') return false;
    if (!live) { setViewPly(null); return false; } // snap back to live first
    const g = gameRef.current;
    if (g.turn() !== userColor) {
      // queue a premove if it's one of our pieces
      const p = g.get(from);
      if (p && p.color === userColor) { setPremove({ from, to, promotion }); return false; }
      return false;
    }
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    playForMove(m, g.isCheck());
    setLastMove({ from: m.from, to: m.to });
    setHintArrow(null);
    setDrawMsg(null);
    clockSwitch(m.color);
    setTick((t) => t + 1);
    if (checkGameEnd(g, true)) return true;
    persistGame(g);
    refreshEval(g, gameIdRef.current);
    scheduleBotMove(g, bot, gameIdRef.current);
    return true;
  }

  function takeback() {
    const g = gameRef.current;
    if (phase !== 'playing' || thinking) return;
    const h = g.history();
    if (!h.length) return;
    g.undo();
    if (g.turn() !== userColor && g.history().length) g.undo();
    setLastMove(null); setHintArrow(null); setPremove(null); setViewPly(null);
    setTick((t) => t + 1);
    persistGame(g);
    refreshEval(g, gameIdRef.current);
  }

  async function hint() {
    if (phase !== 'playing' || thinking || gameRef.current.turn() !== userColor) return;
    try {
      const sf = await getPlayEngine(); // idle on the user's turn — instant answer
      const r = await sf.analyze(gameRef.current.fen(), 450);
      if (r.best) {
        setHintArrow([[r.best.slice(0, 2), r.best.slice(2, 4), 'rgba(125,163,224,0.9)']]);
        setHintsUsed((h) => h + 1);
      }
    } catch { /* no hint offline-fallback */ }
  }

  async function offerDraw() {
    if (phase !== 'playing' || thinking) return;
    const g = gameRef.current;
    try {
      const sf = await getPlayEngine();
      const r = await sf.analyze(g.fen(), 200);
      const stm = g.turn();
      const botPov = (stm === userColor ? -1 : 1) * (r.mate != null ? (r.mate > 0 ? 1200 : -1200) : (r.cp ?? 0));
      if (g.history().length >= 24 && botPov < 60) {
        finishGame('d', `${bot.name} accepts the draw.`);
      } else {
        setDrawMsg(`${bot.name} declines. Play on!`);
        setTimeout(() => setDrawMsg(null), 2500);
      }
    } catch {
      setDrawMsg(`${bot.name} is not listening…`);
      setTimeout(() => setDrawMsg(null), 2000);
    }
  }

  function resign() {
    if (phase !== 'playing') return;
    if (gameRef.current.history().length < 2 || confirm(`Resign against ${bot.name}?`)) {
      finishGame('l', 'You resigned');
    }
  }

  function buildPgn() {
    try { return gameRef.current.pgn(); } catch { return ''; }
  }

  // keyboard navigation through the live game
  useEffect(() => {
    function onKey(e) {
      if (phase === 'setup') return;
      const n = history.length;
      if (e.key === 'ArrowLeft') { setViewPly((v) => Math.max(0, (v == null ? n : v) - 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setViewPly((v) => { const nx = (v == null ? n : v) + 1; return nx >= n ? null : nx; }); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setViewPly(0); e.preventDefault(); }
      if (e.key === 'ArrowDown') { setViewPly(null); e.preventDefault(); }
      if (e.key === 'f') setFlipped((f) => !f);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, history.length]);

  useEffect(() => {
    if (movesListRef.current) movesListRef.current.scrollTop = movesListRef.current.scrollHeight;
  }, [history.length]);

  const getMoves = (sq) => {
    if (phase !== 'playing' || !live) return [];
    const g = gameRef.current;
    if (g.turn() !== userColor) return [];
    try { return g.moves({ square: sq, verbose: true }); } catch { return []; }
  };

  const orientation = flipped ? (userColor === 'w' ? 'black' : 'white') : (userColor === 'w' ? 'white' : 'black');
  const youOnBottom = !flipped;
  const rec = vsRecord[bot.id] || { w: 0, d: 0, l: 0 };
  const showClocks = clocks.w != null;
  const oppClock = userColor === 'w' ? clocks.b : clocks.w;
  const myClock = userColor === 'w' ? clocks.w : clocks.b;
  const turnIsUser = phase === 'playing' && game.turn() === userColor;

  // ---------- setup screen ----------
  if (phase === 'setup') {
    return (
      <div>
        <h1 className="page-title">Play <span className="accent">vs Bots</span></h1>
        <p className="page-sub">A full strength ladder from beginner to full-power Stockfish — pick your sparring partner.</p>

        {savedGame && (
          <div className="banner gold big" style={{ marginBottom: 14, maxWidth: 720 }}>
            ♟ Unfinished game vs <b>{(BOTS.find((b) => b.id === savedGame.botId) || {}).name || 'bot'}</b>
            {savedGame.label ? ` (${savedGame.label})` : ''} — saved {new Date(savedGame.ts).toLocaleString()}.
            <div className="btn-row">
              <button className="btn primary" onClick={resumeSaved}>▶ Resume game</button>
              <button className="btn" onClick={clearSavedGame}>Discard</button>
            </div>
          </div>
        )}

        <div className="bot-grid">
          {BOTS.map((b) => {
            const r = vsRecord[b.id] || { w: 0, d: 0, l: 0 };
            const played = r.w + r.d + r.l;
            return (
              <button key={b.id} className={`bot-card ${botId === b.id ? 'active' : ''}`} onClick={() => setBotId(b.id)}>
                <div className="bot-emoji">{b.emoji}</div>
                <div className="bot-name">{b.name}</div>
                <div className="bot-elo">{b.elo === 3200 ? 'MAX' : b.elo}</div>
                <div className="bot-tag">{b.tagline}</div>
                {played > 0 && <div className="bot-rec">+{r.w} ={r.d} −{r.l}</div>}
              </button>
            );
          })}
        </div>

        <div className="panel" style={{ marginTop: 18, maxWidth: 720 }}>
          <h3>Game setup</h3>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <span className="small muted">You play:</span>
            {['white', 'black', 'random'].map((c) => (
              <button key={c} className={`btn ${colorChoice === c ? 'primary' : ''}`} onClick={() => setColorChoice(c)}>
                {c === 'white' ? '⚪ White' : c === 'black' ? '⚫ Black' : '🎲 Random'}
              </button>
            ))}
          </div>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <span className="small muted">Time:</span>
            {TIME_CONTROLS.map((t) => (
              <button key={t.id} className={`btn ${tcId === t.id ? 'primary' : ''}`} onClick={() => setTcId(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={evalBarPlay} onChange={(e) => setSettings({ evalBarPlay: e.target.checked })} />
              Show live eval bar (training wheels)
            </label>
          </div>
          <div className="btn-row">
            <button className="btn primary" style={{ fontSize: 16, padding: '10px 26px' }} onClick={() => startGame()}>
              ▶ Play {(BOTS.find((b) => b.id === botId) || {}).name}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- playing / game over ----------
  return (
    <div>
      <h1 className="page-title">Play <span className="accent">vs {bot.name} {bot.emoji}</span></h1>
      <p className="page-sub">
        {bot.elo === 3200 ? 'Full-power Stockfish' : `~${bot.elo} Elo`} · lifetime vs {bot.name}: +{rec.w} ={rec.d} −{rec.l}
        {game.__label ? <> · <span className="chip blue">from: {game.__label}</span></> : opening ? <> · <b style={{ color: 'var(--gold-soft)' }}>{opening}</b></> : null}
      </p>

      <div className="layout-2col">
        <div className="board-col">
          <div className={`player-bar top ${!turnIsUser && phase === 'playing' ? 'active' : ''}`}>
            <span className="pb-name">{youOnBottom ? `${bot.emoji} ${bot.name}` : '🧑 Selim'} {youOnBottom && thinking && <span className="thinking-dots"><span>·</span><span>·</span><span>·</span></span>}</span>
            {showClocks && <span className={`clock ${(youOnBottom ? oppClock : myClock) < 20e3 ? 'danger' : ''}`}>{fmtClock(youOnBottom ? oppClock : myClock)}</span>}
          </div>

          <div className="board-with-eval">
            {evalBarPlay && evalCp != null && <EvalBar cp={evalCp} flipped={orientation === 'black'} />}
            <div style={{ flex: 1 }}>
              <Board
                fen={shownFen}
                onDrop={onDrop}
                orientation={orientation}
                lastMove={shownLastMove}
                arrows={hintArrow || []}
                draggable={phase === 'playing'}
                getMoves={getMoves}
                premove={premove}
                onPremoveCancel={() => setPremove(null)}
              />
            </div>
          </div>

          <div className={`player-bar bottom ${turnIsUser ? 'active' : ''}`}>
            <span className="pb-name">{youOnBottom ? '🧑 Selim' : `${bot.emoji} ${bot.name}`} {!youOnBottom && thinking && <span className="thinking-dots"><span>·</span><span>·</span><span>·</span></span>}</span>
            {showClocks && <span className={`clock ${(youOnBottom ? myClock : oppClock) < 20e3 ? 'danger' : ''}`}>{fmtClock(youOnBottom ? myClock : oppClock)}</span>}
          </div>

          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
            {phase === 'playing' && <button className="btn" onClick={hint} disabled={thinking || !turnIsUser}>💡 Hint</button>}
            {phase === 'playing' && <button className="btn" onClick={takeback} disabled={thinking || !history.length}>↩ Takeback</button>}
            {phase === 'playing' && <button className="btn" onClick={offerDraw} disabled={thinking}>½ Draw?</button>}
            {phase === 'playing' && <button className="btn" onClick={resign}>🏳 Resign</button>}
            {phase === 'over' && <button className="btn primary" onClick={() => startGame(gameRef.current.__startFen ? { startFen: gameRef.current.__startFen, forceColor: userColor, label: gameRef.current.__label } : {})}>⟳ Rematch</button>}
            {phase === 'over' && <button className="btn" onClick={() => setPhase('setup')}>New opponent</button>}
          </div>
          {thinking && !engineReady && <p className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>⏳ loading Stockfish (first move only)…</p>}
          {premove && <p className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>premove set: {premove.from}→{premove.to} (right-click to cancel)</p>}
          {!live && <p className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>viewing move {Math.ceil(viewPly / 2)} — ↓ or click last move to go live</p>}
        </div>

        <div className="side-col">
          {result && (
            <div className={`gameover-card ${result.outcome === 'w' ? 'win' : result.outcome === 'l' ? 'loss' : 'draw'}`}>
              <div className="go-title">
                {result.outcome === 'w' ? '🏆 You won!' : result.outcome === 'l' ? '💀 You lost' : '🤝 Draw'}
              </div>
              <div className="go-reason">{result.reason}{hintsUsed > 0 ? ` · ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''} used` : ''}</div>
              <div className="btn-row">
                {!gameRef.current.__startFen && <button className="btn primary" onClick={() => requestAnalysis(buildPgn(), userColor)}>⚡ Game Review</button>}
                <button className="btn" onClick={() => { navigator.clipboard && navigator.clipboard.writeText(buildPgn()); }}>📋 Copy PGN</button>
              </div>
            </div>
          )}

          {drawMsg && <div className="banner coach">{drawMsg}</div>}

          <div className="panel">
            <h3>Moves {opening && <span className="muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>· {opening}</span>}</h3>
            <div className="movelist scrolly" ref={movesListRef}>
              {history.length === 0 && <span className="small muted">No moves yet{userColor === 'b' ? ` — ${bot.name} is thinking…` : ' — your move!'}</span>}
              {history.map((m, i) => (
                <React.Fragment key={i}>
                  {i % 2 === 0 && <span className="mvnum">{i / 2 + 1}.</span>}
                  <button
                    className={`mv ${((viewPly == null && i === history.length - 1) || viewPly === i + 1) ? 'current' : ''}`}
                    onClick={() => setViewPly(i + 1 >= history.length ? null : i + 1)}>
                    {fig(m.san)}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {phase === 'playing' && <ChecklistAid />}

          <div className="panel">
            <h3>{bot.emoji} {bot.name}</h3>
            <p className="small muted" style={{ margin: '4px 0' }}>{bot.tagline}</p>
            <p className="small muted" style={{ margin: '4px 0' }}>
              Beat a bot cleanly (no hints) before moving up the ladder. ← → to replay moves · F to flip.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
