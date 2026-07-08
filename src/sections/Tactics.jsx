import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { PUZZLES } from '../data/puzzles.js';
import { useStats, dayKey } from '../store.js';
import { playForMove, sounds } from '../sounds.js';

const strip = (s) => s.replace(/[+#!?]/g, '');
const RUSH_TIME = 180;

// Difficulty estimate: longer forced sequences are harder.
export function puzzleElo(p) {
  const userMoves = Math.ceil(p.solution.length / 2);
  return 700 + userMoves * 240;
}

const fmtMs = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export default function Tactics() {
  const day = Math.floor(Date.now() / 864e5);
  const dailyIdx = useMemo(() => [0, 1, 2].map((i) => (day * 3 + i) % PUZZLES.length), [day]);
  const {
    solvedToday, todayKey, streak, rushBest, puzzleRating, myPuzzles, motifStats, woodpecker,
    solvePuzzle, failPuzzle, rushDone, ratePuzzle, recordMotif, removeMyPuzzle, woodpeckerDone,
  } = useStats();

  const [mode, setMode] = useState('daily'); // daily | practice | rush | wood | mine
  const [pIdx, setPIdx] = useState(dailyIdx[0]);
  const [flipped, setFlipped] = useState(false);

  const gameRef = useRef(null);
  const [fen, setFen] = useState(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('playing');
  const [wrong, setWrong] = useState(false);
  const [hint, setHint] = useState(false);
  const [lastMove, setLastMove] = useState(null);

  // rush state
  const [rushOn, setRushOn] = useState(false);
  const [rushLeft, setRushLeft] = useState(RUSH_TIME);
  const [rushScore, setRushScore] = useState(0);
  const rushScoreRef = useRef(0);

  // woodpecker state: the whole library, again and again, faster each cycle
  const [woodOn, setWoodOn] = useState(false);
  const [woodIdx, setWoodIdx] = useState(0);
  const [woodErrors, setWoodErrors] = useState(0);
  const woodErrorsRef = useRef(0);
  const woodStart = useRef(0);
  const [woodNow, setWoodNow] = useState(0);

  const source = mode === 'mine' ? myPuzzles : PUZZLES;
  const puzzle = source[Math.min(pIdx, Math.max(0, source.length - 1))];
  const loadedFor = useRef(null);
  if (puzzle && loadedFor.current !== puzzle.id) {
    loadedFor.current = puzzle.id;
    gameRef.current = new Chess(puzzle.fen);
  }
  const game = gameRef.current;
  const curFen = puzzle && fen && loadedFor.current === puzzle.id ? fen : puzzle ? puzzle.fen : new Chess().fen();
  const side = puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black') : 'white';

  const failedAttempt = useRef(false);

  function selectPuzzle(idx) {
    setPIdx(idx);
    loadedFor.current = null;
    failedAttempt.current = false;
    setFen(null); setStep(0); setStatus('playing'); setWrong(false); setHint(false); setLastMove(null);
  }

  // ----- rush timer -----
  useEffect(() => {
    if (!rushOn) return;
    const t = setInterval(() => {
      setRushLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setRushOn(false);
          rushDone(rushScoreRef.current);
          sounds.fail();
          return 0;
        }
        if (s <= 11) sounds.tick();
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [rushOn]);

  // ----- woodpecker timer (display only) -----
  useEffect(() => {
    if (!woodOn) return;
    const t = setInterval(() => setWoodNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [woodOn]);

  function startRush() {
    setMode('rush');
    rushScoreRef.current = 0;
    setRushScore(0);
    setRushLeft(RUSH_TIME);
    setRushOn(true);
    selectPuzzle(Math.floor(Math.random() * PUZZLES.length));
  }
  function nextRushPuzzle() {
    let n;
    do { n = Math.floor(Math.random() * PUZZLES.length); } while (n === pIdx && PUZZLES.length > 1);
    selectPuzzle(n);
  }

  function startWood() {
    setMode('wood');
    setWoodOn(true);
    setWoodIdx(0);
    woodErrorsRef.current = 0;
    setWoodErrors(0);
    woodStart.current = Date.now();
    setWoodNow(Date.now());
    sounds.gameStart();
    selectPuzzle(0);
  }
  function woodNext() {
    const next = woodIdx + 1;
    if (next >= PUZZLES.length) {
      const ms = Date.now() - woodStart.current;
      woodpeckerDone(ms, woodErrorsRef.current);
      setWoodOn(false);
      sounds.victory();
      return;
    }
    setWoodIdx(next);
    selectPuzzle(next);
  }

  function onDrop(from, to, promotion) {
    if (!puzzle || status !== 'playing' || (mode === 'rush' && !rushOn) || (mode === 'wood' && !woodOn)) return false;
    const expected = puzzle.solution[step];
    let m;
    try { m = game.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    if (strip(m.san) !== strip(expected)) {
      game.undo();
      setWrong(true);
      sounds.fail();
      if (mode === 'rush') setRushLeft((s) => Math.max(1, s - 10));
      else if (mode === 'wood') { woodErrorsRef.current += 1; setWoodErrors(woodErrorsRef.current); }
      else {
        failPuzzle();
        if (!failedAttempt.current) {
          failedAttempt.current = true;
          if (mode !== 'mine') ratePuzzle(puzzleElo(puzzle), false);
          if (puzzle.motif) recordMotif(puzzle.motif, false);
        }
      }
      setTimeout(() => setWrong(false), 1400);
      return false;
    }
    playForMove(m, game.isCheck());
    setFen(game.fen());
    setLastMove({ from: m.from, to: m.to });
    const next = step + 1;
    setStep(next);
    if (next >= puzzle.solution.length) {
      if (mode === 'rush') {
        rushScoreRef.current += 1;
        setRushScore(rushScoreRef.current);
        sounds.success();
        setTimeout(nextRushPuzzle, 450);
      } else if (mode === 'wood') {
        sounds.success();
        setTimeout(woodNext, 300);
      } else {
        setStatus('solved');
        sounds.success();
        solvePuzzle(puzzle.id);
        if (!failedAttempt.current) {
          if (mode !== 'mine') ratePuzzle(puzzleElo(puzzle), true);
          if (puzzle.motif) recordMotif(puzzle.motif, true);
        }
      }
    } else {
      setTimeout(() => {
        const reply = game.move(puzzle.solution[next]);
        playForMove(reply, game.isCheck());
        setFen(game.fen());
        setLastMove({ from: reply.from, to: reply.to });
        setStep(next + 1);
      }, 420);
    }
    return true;
  }

  function reveal() {
    if (!failedAttempt.current) {
      failedAttempt.current = true;
      if (mode !== 'mine') ratePuzzle(puzzleElo(puzzle), false);
      if (puzzle.motif) recordMotif(puzzle.motif, false);
    }
    const remaining = puzzle.solution.slice(step);
    remaining.forEach((san, i) => {
      setTimeout(() => {
        const m = game.move(san);
        playForMove(m, game.isCheck());
        setFen(game.fen());
        setLastMove({ from: m.from, to: m.to });
      }, 500 * (i + 1));
    });
    setTimeout(() => setStatus('revealed'), 500 * remaining.length + 100);
    setStep(puzzle.solution.length);
  }

  const solvedSet = todayKey === dayKey() ? solvedToday : [];
  const finished = status !== 'playing';
  const getMoves = (sq) => { try { return game.moves({ square: sq, verbose: true }); } catch { return []; } };

  const cycles = woodpecker.cycles;
  const lastCycle = cycles[cycles.length - 1];
  const worstMotifs = Object.entries(motifStats)
    .filter(([, v]) => v.tries >= 3)
    .map(([k, v]) => ({ motif: k, pct: Math.round((100 * v.solved) / v.tries), tries: v.tries }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4);

  return (
    <div>
      <h1 className="page-title">Tactics <span className="accent">Trainer</span></h1>
      <p className="page-sub">Daily puzzles, Time Rush — and the Woodpecker: the same set, again and again, until the patterns see themselves.</p>

      <div className="tabs">
        {dailyIdx.map((idx, i) => (
          <button key={i} className={`tab ${mode === 'daily' && pIdx === idx ? 'active' : ''}`}
            onClick={() => { setMode('daily'); setRushOn(false); setWoodOn(false); selectPuzzle(idx); }}>
            Daily {i + 1} {solvedSet.includes(PUZZLES[idx].id) ? '✓' : ''}
          </button>
        ))}
        <button className={`tab ${mode === 'practice' ? 'active' : ''}`} onClick={() => { setMode('practice'); setRushOn(false); setWoodOn(false); }}>
          Practice
        </button>
        <button className={`tab ${mode === 'rush' ? 'active' : ''}`} onClick={startRush}>
          ⚡ Time Rush
        </button>
        <button className={`tab ${mode === 'wood' ? 'active' : ''}`} onClick={() => { setMode('wood'); setRushOn(false); if (!woodOn) setWoodIdx(0); }}>
          🪵 Woodpecker
        </button>
        <button className={`tab ${mode === 'mine' ? 'active' : ''}`} onClick={() => { setMode('mine'); setRushOn(false); setWoodOn(false); if (myPuzzles.length) selectPuzzle(0); }}>
          💥 My blunders {myPuzzles.length ? `(${myPuzzles.length})` : ''}
        </button>
        <span style={{ marginLeft: 'auto' }} className="chip gold-chip">⚡ {puzzleRating}</span>
        <span className="chip">🔥 {streak}d streak</span>
        <span className="chip blue">rush best: {rushBest}</span>
      </div>

      {mode === 'practice' && (
        <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
          {PUZZLES.map((p, i) => (
            <button key={p.id} className={`select-card ${pIdx === i ? 'active' : ''}`} onClick={() => selectPuzzle(i)}>
              <div className="t">{p.title}</div>
              <div className="d">{p.motif} · ~{puzzleElo(p)}{motifStats[p.motif] ? ` · ${Math.round((100 * motifStats[p.motif].solved) / motifStats[p.motif].tries)}% réussite motif` : ''}</div>
            </button>
          ))}
        </div>
      )}

      {mode === 'mine' && myPuzzles.length === 0 && (
        <div className="panel" style={{ maxWidth: 640, marginBottom: 16 }}>
          <p className="small muted">No personal puzzles yet. Analyze a game (Game Analyzer) — every blunder you make becomes a puzzle here automatically. The best training set in the world: your own mistakes.</p>
        </div>
      )}

      {mode === 'mine' && myPuzzles.length > 0 && (
        <div style={{ marginBottom: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 8 }}>
          {myPuzzles.map((p, i) => (
            <div key={p.id} className={`select-card ${pIdx === i ? 'active' : ''}`} style={{ cursor: 'pointer', position: 'relative' }} onClick={() => selectPuzzle(i)}>
              <div className="t">{p.title || `Blunder ${i + 1}`}</div>
              <div className="d">{p.date} · find the move you missed</div>
              <button className="btn" style={{ position: 'absolute', top: 6, right: 6, padding: '0 8px' }}
                onClick={(e) => { e.stopPropagation(); removeMyPuzzle(p.id); if (pIdx >= myPuzzles.length - 1) selectPuzzle(0); }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {mode === 'wood' && !woodOn && (
        <div className="panel" style={{ maxWidth: 640, marginBottom: 16 }}>
          <h3>🪵 The Woodpecker Method</h3>
          <p className="small" style={{ lineHeight: 1.6 }}>
            Solve the SAME {PUZZLES.length} puzzles in one sitting, cycle after cycle (one per day max). Goal: each cycle faster and cleaner than the last —
            that's pattern recognition being burned in. Median gain at your level: <b>+70 Elo</b>.
          </p>
          {cycles.length > 0 && (
            <>
              <div className="bars" style={{ height: 70, maxWidth: 420 }}>
                {cycles.map((c, i) => (
                  <div className="bar-wrap" key={i}>
                    <div className="bar" style={{ height: `${(c.ms / Math.max(...cycles.map((x) => x.ms))) * 100}%` }} />
                    <div className="bl">C{i + 1}<br />{fmtMs(c.ms)}</div>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                Last cycle: {fmtMs(lastCycle.ms)} with {lastCycle.errors} error{lastCycle.errors !== 1 ? 's' : ''}.
                {cycles.length >= 2 && cycles[cycles.length - 1].ms < cycles[cycles.length - 2].ms ? ' Faster than the previous one — it\'s working. 📈' : ''}
              </p>
            </>
          )}
          <div className="btn-row">
            <button className="btn primary" onClick={startWood}>▶ Start cycle {cycles.length + 1}</button>
          </div>
        </div>
      )}

      {(mode !== 'wood' || woodOn) && puzzle && (
        <div className="layout-2col">
          <div className="board-col">
            {mode === 'rush' && (
              <div className={`rush-bar ${rushLeft <= 15 ? 'danger' : ''}`}>
                <span>⏱ {Math.floor(rushLeft / 60)}:{String(rushLeft % 60).padStart(2, '0')}</span>
                <span>score: <b>{rushScore}</b></span>
                {!rushOn && rushLeft === 0 && <span className="chip gold-chip">final: {rushScore}</span>}
              </div>
            )}
            {mode === 'wood' && woodOn && (
              <div className="rush-bar">
                <span>🪵 {woodIdx + 1}/{PUZZLES.length}</span>
                <span>⏱ {fmtMs(woodNow - woodStart.current)}</span>
                <span>errors: <b>{woodErrors}</b></span>
              </div>
            )}
            <Board fen={curFen} onDrop={onDrop} orientation={flipped ? (side === 'white' ? 'black' : 'white') : side}
              lastMove={lastMove} getMoves={getMoves} />
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
              {(mode === 'daily' || mode === 'practice' || mode === 'mine') && !finished && <button className="btn" onClick={() => setHint(true)}>Hint</button>}
              {(mode === 'daily' || mode === 'practice' || mode === 'mine') && !finished && <button className="btn" onClick={reveal}>Reveal</button>}
              {(mode === 'daily' || mode === 'practice' || mode === 'mine') && finished && <button className="btn" onClick={() => selectPuzzle(pIdx)}>Replay</button>}
              {mode === 'rush' && !rushOn && <button className="btn primary" onClick={startRush}>Go again</button>}
              {mode === 'daily' && finished && (
                <button className="btn primary" onClick={() => {
                  const cur = dailyIdx.indexOf(pIdx);
                  if (cur > -1 && cur < 2) selectPuzzle(dailyIdx[cur + 1]);
                }}>Next →</button>
              )}
            </div>
          </div>

          <div className="side-col">
            <div className="panel">
              <h3>{mode === 'rush' ? 'Time Rush' : mode === 'wood' ? `Woodpecker — cycle ${cycles.length + 1}` : puzzle.title || 'My blunder'}</h3>
              {mode === 'rush'
                ? <p className="muted small">Solve as many as you can in 3 minutes. Wrong move = −10 s. Patterns, not calculation.</p>
                : mode === 'wood'
                  ? <p className="muted small">Same set, every cycle. Speed comes from recognition, not rushing — errors count too.</p>
                  : <p className="muted small">{mode !== 'mine' && <span className="chip" style={{ marginRight: 8 }}>~{puzzleElo(puzzle)}</span>}{side === 'white' ? 'White' : 'Black'} to move. Click or drag — legal moves light up.</p>}
              {wrong && <div className="banner err big" style={{ marginTop: 8 }}>✗ Not that one{mode === 'rush' ? ' — −10 seconds!' : mode === 'wood' ? ' — +1 error, keep going.' : '. Checks, captures, threats — in that order.'}</div>}
              {status === 'solved' && <div className="banner ok big" style={{ marginTop: 8 }}>✓ Solved. Pattern banked.</div>}
              {status === 'revealed' && <div className="banner gold big" style={{ marginTop: 8 }}>Solution shown — replay it once from memory.</div>}
              {hint && !finished && (mode === 'daily' || mode === 'practice' || mode === 'mine') && (
                <div className="banner coach big" style={{ marginTop: 10 }}>💡 <b>Hint:</b> {puzzle.hint || 'You played something else in the game — find the move you missed.'}</div>
              )}
            </div>

            {finished && (mode === 'daily' || mode === 'practice' || mode === 'mine') && (
              <div className="panel">
                <h3>Coach's explanation</h3>
                <p><span className="chip">{puzzle.motif || 'from my games'}</span></p>
                <p className="small" style={{ lineHeight: 1.65 }}>{puzzle.explanation || `In your game you missed ${puzzle.solution[0]}. Now it's yours forever.`}</p>
                <p className="small muted">Solution: {puzzle.solution.join(' ')}</p>
              </div>
            )}

            {worstMotifs.length > 0 && mode !== 'rush' && mode !== 'wood' && (
              <div className="panel">
                <h3>Your weakest motifs</h3>
                {worstMotifs.map((m) => (
                  <p key={m.motif} className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">{m.motif}</span>
                    <b style={{ color: m.pct < 60 ? 'var(--bad)' : 'var(--gold-soft)' }}>{m.pct}% ({m.tries})</b>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'wood' && !woodOn && cycles.length > 0 && lastCycle.date === dayKey() && (
        <div className="banner ok big" style={{ maxWidth: 640 }}>
          🏁 Cycle {cycles.length} done today: {fmtMs(lastCycle.ms)}, {lastCycle.errors} error{lastCycle.errors !== 1 ? 's' : ''}. Rest — repetition works BETWEEN sessions. Next cycle tomorrow.
        </div>
      )}
    </div>
  );
}
