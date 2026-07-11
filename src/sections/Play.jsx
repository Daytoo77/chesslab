import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import EvalBar from '../components/EvalBar.jsx';
import PlayerBar from '../components/play/PlayerBar.jsx';
import SetupScreen from '../components/play/SetupScreen.jsx';
import GameOverCard from '../components/play/GameOverCard.jsx';
import ChecklistAid from '../components/play/ChecklistAid.jsx';
import { BOTS } from '../data/bots.js';
import { getStockfish, getPlayEngine } from '../stockfish.js';
import { openingName } from '../data/openingNames.js';
import { fig } from '../figurine.js';
import { useStats } from '../store.js';
import { useSettings, useUi } from '../settings.js';
import { playForMove, sounds } from '../sounds.js';
import { useGameClock, TIME_CONTROLS } from '../hooks/useGameClock.js';
import { useBotReply } from '../hooks/useBotReply.js';

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
  const [lastMove, setLastMove] = useState(null);
  const [premove, setPremove] = useState(null);
  const [hintArrow, setHintArrow] = useState(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [result, setResult] = useState(null); // { outcome: 'w'|'d'|'l', reason }
  const [viewPly, setViewPly] = useState(null); // null = live
  const [evalCp, setEvalCp] = useState(null); // white POV, for the eval bar
  const [drawMsg, setDrawMsg] = useState(null);
  const [flipped, setFlipped] = useState(false);

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

  // ---------- clock ----------
  const clock = useGameClock({
    active: phase === 'playing',
    userColor,
    onLowTime: () => sounds.lowTime(),
    onFlag: (color) => finishGame(color === userColor ? 'l' : 'w', color === userColor ? 'You ran out of time' : `${bot.name} ran out of time`),
  });
  const { clocks } = clock;

  // ---------- bot move selection ----------
  const { thinking, requestMove, setThinking } = useBotReply();

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
    setFlipped(false);
    setPhase('playing');
    setResult(null); setLastMove(null); setPremove(null); setHintArrow(null); setHintsUsed(0);
    setViewPly(null); setEvalCp(null); setDrawMsg(null); setThinking(false);
    clock.start(tc, g.turn());
    sounds.gameStart();
    setTick((t) => t + 1);
    if (g.turn() !== color) scheduleBotMove(g, chosen, gameIdRef.current);
  }

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
      saveGame({
        pgn: g.pgn(), botId: bot.id, userColor, tcId,
        clocks: clock.snapshot(),
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
    const tc = TIME_CONTROLS.find((t) => t.id === (s.tcId || 'none'));
    clock.resume(s.clocks, tc, g.turn());
    sounds.gameStart();
    setTick((t) => t + 1);
    if (g.turn() !== s.userColor && !g.isGameOver()) scheduleBotMove(g, chosen, gameIdRef.current);
  }

  function finishGame(outcome, reason) {
    if (gameRef.current.__finished) return;
    gameRef.current.__finished = true;
    clock.stop();
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
    requestMove(g, chosenBot, id, {
      isStale: (checkId) => gameIdRef.current !== checkId || g.__finished,
      onPicked: (san) => {
        const m = g.move(san);
        playForMove(m, g.isCheck());
        setLastMove({ from: m.from, to: m.to });
        clock.switchTurn(m.color);
        setTick((t) => t + 1);
        if (checkGameEnd(g, false)) return;
        persistGame(g);
        refreshEval(g, id);
        executePremove(g, id);
      },
    });
  }

  function executePremove(g, id) {
    setPremove((pm) => {
      if (!pm) return null;
      try {
        const m = g.move({ from: pm.from, to: pm.to, promotion: pm.promotion || 'q' });
        playForMove(m, g.isCheck());
        setLastMove({ from: m.from, to: m.to });
        clock.switchTurn(m.color);
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
    clock.switchTurn(m.color);
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
      <SetupScreen
        savedGame={savedGame} resumeSaved={resumeSaved} clearSavedGame={clearSavedGame}
        vsRecord={vsRecord} botId={botId} setBotId={setBotId}
        colorChoice={colorChoice} setColorChoice={setColorChoice}
        tcId={tcId} setTcId={setTcId}
        evalBarPlay={evalBarPlay} setEvalBarPlay={(v) => setSettings({ evalBarPlay: v })}
        onStart={() => startGame()}
      />
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
          <PlayerBar
            position="top"
            name={youOnBottom ? `${bot.emoji} ${bot.name}` : '🧑 Selim'}
            isThinking={youOnBottom && thinking}
            active={!turnIsUser && phase === 'playing'}
            showClock={showClocks}
            clockMs={youOnBottom ? oppClock : myClock}
          />

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

          <PlayerBar
            position="bottom"
            name={youOnBottom ? '🧑 Selim' : `${bot.emoji} ${bot.name}`}
            isThinking={!youOnBottom && thinking}
            active={turnIsUser}
            showClock={showClocks}
            clockMs={youOnBottom ? myClock : oppClock}
          />

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
          <GameOverCard
            result={result} hintsUsed={hintsUsed}
            canReview={!gameRef.current.__startFen}
            onReview={() => requestAnalysis(buildPgn(), userColor)}
            onCopyPgn={() => { navigator.clipboard && navigator.clipboard.writeText(buildPgn()); }}
          />

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
