import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { getPlayEngine } from '../stockfish.js';
import { DRILLS } from '../data/endgames.js';
import { oppositionInfo, pieceCount, MATE } from '../engine.js';
import { coachMove } from '../playEngine.js';
import { probeTablebase } from '../tablebase.js';
import { useStats } from '../store.js';
import { playForMove, sounds } from '../sounds.js';

export default function Endgames() {
  const { drillsDone, drillDone } = useStats();
  const [drillId, setDrillId] = useState(DRILLS[0].id);
  const drill = DRILLS.find((d) => d.id === drillId);

  const first = useRef(DRILLS[0].gen());
  const gameRef = useRef(new Chess(first.current.fen));
  const [instance, setInstance] = useState(first.current); // { fen, userSide, mirrored }
  const [fen, setFen] = useState(first.current.fen);
  const [coach, setCoach] = useState({ kind: 'coach', text: 'Your move. Technique beats speed.' });
  const [tbInfo, setTbInfo] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [userMoves, setUserMoves] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const baseline = useRef(null);

  const userSide = instance.userSide;
  const baseOrientation = userSide === 'w' ? 'white' : 'black';

  // boot the play engine early — the coach answers without a first-move stall
  useEffect(() => { getPlayEngine().catch(() => {}); }, []);

  function loadDrill(id, regenerate = true) {
    const d = DRILLS.find((x) => x.id === id);
    const inst = regenerate ? d.gen() : instance;
    setDrillId(id);
    setInstance(inst);
    gameRef.current = new Chess(inst.fen);
    setFen(inst.fen);
    setCoach({ kind: 'coach', text: d.brief + (inst.mirrored ? ' (colors mirrored this time — same geometry!)' : '') });
    setDone(false); setThinking(false); setLastMove(null); setUserMoves(0); setTbInfo(null);
    baseline.current = null;
  }

  function checkEnd(g) {
    if (g.isCheckmate()) {
      const winner = g.turn() === 'w' ? 'b' : 'w';
      if (winner === userSide && drill.goal === 'win') {
        setCoach({ kind: 'ok', text: 'Checkmate — drill complete. Run it again: the file will change, the technique won\'t. ✓' });
        sounds.success(); drillDone(drill.id); setDone(true);
      } else {
        setCoach({ kind: 'err', text: 'Checkmated. Reset and re-read the tips.' });
        sounds.fail(); setDone(true);
      }
      return true;
    }
    if (g.isDraw() || g.isStalemate()) {
      if (drill.goal === 'draw') {
        setCoach({ kind: 'ok', text: `Draw secured (${g.isStalemate() ? 'stalemate' : 'drawn position'}) — exactly the goal. ✓` });
        sounds.success(); drillDone(drill.id); setDone(true);
      } else {
        setCoach({ kind: 'err', text: `Only a draw (${g.isStalemate() ? 'stalemate!' : 'repetition / insufficient material'}) — the win slipped.` });
        sounds.fail(); setDone(true);
      }
      return true;
    }
    return false;
  }

  // Tablebase grading: category is from the side-to-move's perspective.
  // After the user's move it is the opponent's turn.
  function tbVerdict(cat) {
    if (!cat) return null;
    const oppWins = cat === 'win' || cat === 'cursed-win';
    const oppLoses = cat === 'loss' || cat === 'blessed-loss';
    if (drill.goal === 'win') {
      if (oppLoses) return { kind: 'good', text: 'Tablebase: still winning ✓' };
      if (cat === 'draw') return { kind: 'bad', text: 'Tablebase: the win is GONE — this position is a theoretical draw.' };
      return { kind: 'bad', text: 'Tablebase: you are losing now!' };
    } else {
      if (cat === 'draw') return { kind: 'good', text: 'Tablebase: theoretical draw held ✓' };
      if (oppWins) return { kind: 'bad', text: 'Tablebase: this is now LOST with best play.' };
      return { kind: 'good', text: 'Tablebase: you are even winning!' };
    }
  }

  async function onDrop(from, to, promotion) {
    const g = gameRef.current;
    if (done || thinking || g.turn() !== userSide) return false;
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    playForMove(m, g.isCheck());
    setFen(g.fen());
    setLastMove({ from: m.from, to: m.to });
    const nUser = userMoves + 1;
    setUserMoves(nUser);
    if (checkEnd(g)) return true;

    setThinking(true);
    setCoach({ kind: 'coach', text: 'Coach is thinking…' });

    // Fire the (throttled, online-only) tablebase probe in the background and
    // play the engine reply IMMEDIATELY — the verdict catches up afterwards.
    const fenAfterUser = g.fen();
    const tbPromise = probeTablebase(fenAfterUser);
    const reply = await coachMove(fenAfterUser, { movetime: pieceCount(fenAfterUser) <= 4 ? 350 : 300 });

    let ended = false;
    if (reply && reply.san && !g.isGameOver()) {
      const rm = g.move(reply.san);
      playForMove(rm, g.isCheck());
      setFen(g.fen());
      setLastMove({ from: rm.from, to: rm.to });
    }
    setThinking(false);
    ended = checkEnd(g);
    if (!ended) setCoach({ kind: 'coach', text: 'Your move.' });

    // verdict arrives async, never blocks the reply
    tbPromise.then((tb) => {
      if (gameRef.current !== g) return; // drill changed meanwhile
      const verdict = tbVerdict(tb && tb.category);
      setTbInfo(verdict);
      const msgs = [];
      if (verdict) {
        msgs.push(verdict.text);
        if (verdict.kind === 'bad') sounds.fail();
      } else {
        // engine fallback grading: reply.score is from the mover's (coach's) POV
        const after = -(reply ? reply.score : 0);
        if (drill.goal === 'win') msgs.push(after > 250 ? 'Engine: still on track.' : 'Engine: the advantage is fading — careful.');
        else msgs.push(after > -120 ? 'Engine: holding.' : 'Engine: the position is getting lost.');
        msgs.push('(offline — tablebase unavailable)');
      }
      if (drill.category === 'King & Pawn') {
        const opp = oppositionInfo(g.fen());
        if (opp && opp.direct) msgs.push(opp.holder === userSide ? 'You hold the opposition. ✓' : 'Your opponent holds the opposition.');
      }
      // success condition: a held draw over 12 accurate moves
      if (!ended && drill.goal === 'draw' && nUser >= 12 && (!verdict || verdict.kind === 'good')) {
        setCoach({ kind: 'ok', text: 'Twelve accurate defensive moves — the fortress holds. ✓ Try a new random position.' });
        sounds.success(); drillDone(drill.id); setDone(true);
        return;
      }
      if (!ended) setCoach({ kind: verdict && verdict.kind === 'bad' ? 'err' : 'coach', text: msgs.join(' ') });
    }).catch(() => { /* verdict is best-effort */ });
    return true;
  }

  const getMoves = (sq) => { try { return gameRef.current.moves({ square: sq, verbose: true }); } catch { return []; } };

  return (
    <div>
      <h1 className="page-title">Endgame <span className="accent">Drills</span></h1>
      <p className="page-sub">Randomized positions, graded against the Syzygy tablebase (when online) — mathematical truth, not engine opinion.</p>

      <div className="layout-2col">
        <div className="board-col">
          <Board fen={fen} onDrop={onDrop} orientation={flipped ? (baseOrientation === 'white' ? 'black' : 'white') : baseOrientation}
            lastMove={lastMove} getMoves={getMoves} />
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
            <button className="btn" onClick={() => loadDrill(drillId)}>🎲 New random position</button>
            <button className="btn" onClick={() => loadDrill(drillId, false)}>Reset</button>
            {thinking && <span className="chip blue">coach thinking…</span>}
            <span className="chip">{drill.goal === 'win' ? 'Goal: WIN' : 'Goal: DRAW'}</span>
            <span className="chip">{userSide === 'w' ? 'You: White' : 'You: Black'}</span>
          </div>
        </div>

        <div className="side-col">
          <div className="panel">
            <h3>Drills</h3>
            <div className="card-list">
              {DRILLS.map((d) => (
                <button key={d.id} className={`select-card ${d.id === drillId ? 'active' : ''}`} onClick={() => loadDrill(d.id)}>
                  <div className="t">{d.name} {drillsDone[d.id] ? `✓×${drillsDone[d.id]}` : ''}</div>
                  <div className="d">{d.category} · {d.goal === 'win' ? 'win it' : 'hold the draw'} · randomized</div>
                </button>
              ))}
            </div>
          </div>

          <div className={`banner big ${coach.kind === 'ok' ? 'ok' : coach.kind === 'err' ? 'err' : 'coach'}`}>
            <b>Coach:</b> {coach.text}
          </div>
          {tbInfo && <div className={`banner ${tbInfo.kind === 'good' ? 'ok' : 'err'}`}>📚 {tbInfo.text}</div>}

          <div className="panel">
            <h3>Technique</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }} className="small">
              {drill.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
