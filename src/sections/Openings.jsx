import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { OPENINGS } from '../data/openings.js';
import { mergeOpenings } from '../data/openings2.js';
import { useStats, lineDue, srsLabel } from '../store.js';
import { useUi } from '../settings.js';
import { coachMove } from '../playEngine.js';
import { playForMove, sounds } from '../sounds.js';
import Vault from './Vault.jsx';

const strip = (s) => s.replace(/[+#!?]/g, '');

export default function Openings() {
  const { customLines, linesStudied, quizBest, srs, studyLine, quizDone, addCustomLines, removeCustomLine, arrowsByLine, setLineArrows } = useStats();
  const requestPlay = useUi((u) => u.requestPlay);
  const ALL = mergeOpenings(OPENINGS, customLines);

  const [openingId, setOpeningId] = useState(ALL[0].id);
  const opening = ALL.find((o) => o.id === openingId) || ALL[0];
  const [lineId, setLineId] = useState(opening.lines[0] && opening.lines[0].id);
  const line = opening.lines.find((l) => l.id === lineId) || opening.lines[0];
  const [mode, setMode] = useState('study'); // study | quiz | play | import
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // quiz
  const quizGame = useRef(new Chess());
  const [quizPly, setQuizPly] = useState(0);
  const [quizErrors, setQuizErrors] = useState(0);
  const quizErrorsRef = useRef(0);
  const [quizWrong, setQuizWrong] = useState(false);
  const [quizDoneFlag, setQuizDoneFlag] = useState(false);
  const [quizLast, setQuizLast] = useState(null);
  const [quizMsg, setQuizMsg] = useState(null);

  // play vs coach
  const playGame = useRef(new Chess());
  const [playFen, setPlayFen] = useState(null);
  const [playLast, setPlayLast] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [playEval, setPlayEval] = useState(null);

  // import
  const [pgnText, setPgnText] = useState('');
  const [importName, setImportName] = useState('');
  const [importColor, setImportColor] = useState('w');
  const [importMsg, setImportMsg] = useState(null);

  // daily SRS drill: chains a quiz for every line due today
  const [drill, setDrill] = useState(null); // { items, idx, scores, done }
  const drillRef = useRef(null);
  useEffect(() => { drillRef.current = drill; }, [drill]);
  const [drillKick, setDrillKick] = useState(0);
  useEffect(() => {
    if (drillKick > 0 && drillRef.current && !drillRef.current.done) startQuiz();
  }, [drillKick]); // eslint-disable-line react-hooks/exhaustive-deps

  const userColor = line && line.color ? line.color : opening.color;
  const baseOrientation = userColor === 'w' ? 'white' : 'black';
  const orientation = flipped ? (baseOrientation === 'white' ? 'black' : 'white') : baseOrientation;

  function pickOpening(id) {
    setOpeningId(id);
    const o = ALL.find((x) => x.id === id);
    if (o.lines[0]) pickLine(o.lines[0].id, o);
    else setMode(id === 'custom' ? 'import' : 'study');
  }
  function pickLine(id, o = opening) {
    setLineId(id); setPly(0); setMode('study');
  }

  // ----- study -----
  const studyGame = new Chess();
  let lastStudyMove = null;
  if (line) for (let i = 0; i < ply && i < line.moves.length; i++) {
    const m = studyGame.move(line.moves[i].san);
    lastStudyMove = { from: m.from, to: m.to };
  }
  const curMove = line && ply > 0 ? line.moves[ply - 1] : null;
  useEffect(() => {
    if (line && ply >= line.moves.length && line.moves.length > 0) studyLine(line.id);
  }, [ply, line && line.id]);

  // keyboard navigation (study mode)
  useEffect(() => {
    function onKey(e) {
      if (mode !== 'study' || !line) return;
      if (e.key === 'ArrowRight') { setPly((p) => Math.min(p + 1, line.moves.length)); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { setPly((p) => Math.max(p - 1, 0)); e.preventDefault(); }
      if (e.key === 'ArrowUp') { setPly(0); e.preventDefault(); }
      if (e.key === 'ArrowDown') { setPly(line.moves.length); e.preventDefault(); }
      if (e.key === 'f') setFlipped((f) => !f);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, line && line.id, line && line.moves.length]);

  // ----- quiz -----
  function startQuiz() {
    setMode('quiz');
    quizGame.current = new Chess();
    quizErrorsRef.current = 0;
    setQuizPly(0); setQuizErrors(0); setQuizWrong(false); setQuizDoneFlag(false); setQuizLast(null); setQuizMsg(null);
    setTimeout(() => autoplayFrom(0), 350);
  }
  function autoplayFrom(fromPly) {
    let p = fromPly;
    const g = quizGame.current;
    const playNext = () => {
      if (p >= line.moves.length) { finishQuiz(); return; }
      if (g.turn() === userColor) { setQuizPly(p); return; }
      const m = g.move(line.moves[p].san);
      playForMove(m, g.isCheck());
      setQuizLast({ from: m.from, to: m.to });
      p += 1; setQuizPly(p);
      setTimeout(playNext, 430);
    };
    playNext();
  }
  function finishQuiz() {
    setQuizDoneFlag(true);
    const userMoves = line.moves.filter((_, i) => i % 2 === (userColor === 'w' ? 0 : 1)).length;
    const pct = Math.max(0, Math.round(100 * (1 - quizErrorsRef.current / Math.max(1, userMoves))));
    quizDone(line.id, pct);
    sounds.success();
    // drill: record the score, then chain the next due line
    const d = drillRef.current;
    if (d && !d.done) {
      const scores = [...d.scores, pct];
      if (d.idx + 1 < d.items.length) {
        const next = d.items[d.idx + 1];
        setDrill({ ...d, idx: d.idx + 1, scores });
        setOpeningId(next.oid);
        setLineId(next.lid);
        setTimeout(() => setDrillKick((k) => k + 1), 900);
      } else {
        setDrill({ ...d, scores, done: true });
      }
    }
  }

  function startDrill() {
    const items = [];
    for (const o of ALL) for (const l of o.lines) {
      if (l.moves && l.moves.length && lineDue(srs, l.id)) items.push({ oid: o.id, lid: l.id, name: `${o.name} — ${l.name}` });
    }
    if (!items.length) return;
    setDrill({ items, idx: 0, scores: [], done: false });
    setOpeningId(items[0].oid);
    setLineId(items[0].lid);
    setTimeout(() => setDrillKick((k) => k + 1), 200);
  }
  function stopDrill() { setDrill(null); setMode('study'); }
  function onQuizDrop(from, to, promotion) {
    if (quizDoneFlag || mode !== 'quiz') return false;
    const g = quizGame.current;
    if (g.turn() !== userColor) return false;
    const expected = line.moves[quizPly];
    if (!expected) return false;
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    if (strip(m.san) !== strip(expected.san)) {
      g.undo();
      quizErrorsRef.current += 1;
      setQuizErrors(quizErrorsRef.current);
      setQuizWrong(true); sounds.fail();
      setTimeout(() => setQuizWrong(false), 1400);
      return false;
    }
    playForMove(m, g.isCheck());
    setQuizLast({ from: m.from, to: m.to });
    setQuizMsg(expected.why || null);
    const next = quizPly + 1;
    setQuizPly(next);
    if (next >= line.moves.length) { finishQuiz(); return true; }
    setTimeout(() => autoplayFrom(next), 420);
    return true;
  }

  // ----- play vs coach -----
  function startPlay(fromFen) {
    playGame.current = new Chess(fromFen);
    setPlayFen(playGame.current.fen());
    setPlayLast(null); setPlayEval(null); setMode('play');
    maybeEngineMove();
  }
  async function maybeEngineMove() {
    const g = playGame.current;
    if (g.isGameOver() || g.turn() === userColor) return;
    setThinking(true);
    const r = await coachMove(g.fen(), { movetime: 350, elo: 1400 });
    if (r) {
      const m = g.move(r.san);
      playForMove(m, g.isCheck());
      setPlayFen(g.fen());
      setPlayLast({ from: m.from, to: m.to });
      setPlayEval(-r.score); // score was from the coach's POV
    }
    setThinking(false);
  }
  function onPlayDrop(from, to, promotion) {
    const g = playGame.current;
    if (mode !== 'play' || thinking || g.turn() !== userColor || g.isGameOver()) return false;
    let m;
    try { m = g.move({ from, to, promotion: promotion || 'q' }); } catch { return false; }
    playForMove(m, g.isCheck());
    setPlayFen(g.fen());
    setPlayLast({ from: m.from, to: m.to });
    setTimeout(maybeEngineMove, 250);
    return true;
  }

  // ----- PGN import -----
  function doImport() {
    try {
      const games = pgnText.split(/\n\s*\n(?=\[)/).filter((s) => s.trim());
      const newLines = [];
      let n = 0;
      for (const chunk of games.length ? games : [pgnText]) {
        const g = new Chess();
        g.loadPgn(chunk);
        const hist = g.history({ verbose: true });
        if (!hist.length) continue;
        // attach comments to moves by replaying and matching fens
        const comments = {};
        for (const c of g.getComments ? g.getComments() : []) comments[c.fen] = c.comment;
        const replay = new Chess();
        const moves = hist.map((m) => {
          replay.move(m.san);
          return { san: m.san, why: comments[replay.fen()] || undefined };
        });
        n++;
        newLines.push({
          id: 'custom-' + Date.now() + '-' + n,
          name: (importName || 'Imported line') + (games.length > 1 ? ` #${n}` : ''),
          color: importColor,
          moves,
        });
      }
      if (!newLines.length) throw new Error('no moves');
      addCustomLines(newLines);
      setImportMsg({ ok: true, text: `${newLines.length} line${newLines.length > 1 ? 's' : ''} imported — find them under "Imported (PGN)".` });
      setPgnText('');
    } catch {
      setImportMsg({ ok: false, text: 'Could not parse that PGN. Paste plain movetext or a Lichess study export (one or more games).' });
    }
  }

  const fen = mode === 'study' ? studyGame.fen() : mode === 'quiz' ? quizGame.current.fen() : mode === 'play' ? (playFen || new Chess().fen()) : new Chess().fen();
  const activeGame = mode === 'quiz' ? quizGame.current : mode === 'play' ? playGame.current : null;
  const getMoves = activeGame ? (sq) => { try { return activeGame.moves({ square: sq, verbose: true }); } catch { return []; } } : null;
  const dueCount = ALL.reduce((acc, o) => acc + o.lines.filter((l) => lineDue(srs, l.id)).length, 0);

  return (
    <div>
      <h1 className="page-title">Opening <span className="accent">Explorer</span></h1>
      <p className="page-sub">
        Annotated repertoire + quiz with spaced repetition. <span className="chip blue">{dueCount} line{dueCount !== 1 ? 's' : ''} due today</span>
        {dueCount > 0 && !drill && <button className="btn primary" style={{ marginLeft: 10, padding: '4px 14px' }} onClick={startDrill}>🔁 Daily drill ({dueCount})</button>}
        {drill && !drill.done && <span className="chip gold-chip" style={{ marginLeft: 10 }}>Drill {drill.idx + 1}/{drill.items.length}</span>}
        {drill && <button className="btn" style={{ marginLeft: 8, padding: '4px 12px' }} onClick={stopDrill}>✕ Stop drill</button>}
      </p>
      {drill && drill.done && (
        <div className="banner ok big" style={{ marginBottom: 14 }}>
          🏁 Daily drill complete — {drill.items.length} line{drill.items.length > 1 ? 's' : ''}, average <b>{Math.round(drill.scores.reduce((a, b) => a + b, 0) / Math.max(1, drill.scores.length))}%</b>, {drill.scores.filter((s) => s === 100).length} flawless. The SRS has rescheduled everything — come back tomorrow.
        </div>
      )}

      <div className="tabs">
        {ALL.map((o) => (
          <button key={o.id} className={`tab ${o.id === openingId ? 'active' : ''}`} onClick={() => pickOpening(o.id)}>
            {o.name} {o.color === 'w' ? '⚪' : '⚫'}
          </button>
        ))}
        <button className={`tab ${mode === 'vault' ? 'active' : ''}`} onClick={() => setMode('vault')} style={{ marginLeft: 'auto' }}>
          📂 My games
        </button>
        <button className={`tab ${mode === 'import' ? 'active' : ''}`} onClick={() => setMode('import')}>
          ＋ Import PGN
        </button>
      </div>

      {mode === 'vault' ? (
        <Vault openings={ALL} />
      ) : mode === 'import' ? (
        <div className="panel" style={{ maxWidth: 720 }}>
          <h3>Import a repertoire from PGN</h3>
          <p className="small muted">Paste a Lichess study export (or any PGN). Comments {`{like this}`} become move explanations. Multiple games = multiple lines.</p>
          <textarea className="pgn-input" value={pgnText} onChange={(e) => setPgnText(e.target.value)} placeholder="1. d4 d5 2. Bf4 {The London bishop} ..." />
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <input className="text-input" placeholder="Name (e.g. London — Lichess study)" value={importName} onChange={(e) => setImportName(e.target.value)} />
            <button className={`btn ${importColor === 'w' ? 'primary' : ''}`} onClick={() => setImportColor('w')}>I play White</button>
            <button className={`btn ${importColor === 'b' ? 'primary' : ''}`} onClick={() => setImportColor('b')}>I play Black</button>
            <button className="btn primary" disabled={!pgnText.trim()} onClick={doImport}>Import</button>
          </div>
          {importMsg && <div className={`banner ${importMsg.ok ? 'ok' : 'err'}`} style={{ marginTop: 10 }}>{importMsg.text}</div>}
          {customLines.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <h3>Imported lines</h3>
              {customLines.map((l) => (
                <p key={l.id} className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{l.name} ({l.moves.length} plies)</span>
                  <button className="btn" style={{ padding: '2px 10px' }} onClick={() => removeCustomLine(l.id)}>✕</button>
                </p>
              ))}
            </div>
          )}
        </div>
      ) : !line ? (
        <div className="panel"><p className="small muted">No lines here yet — import a PGN.</p></div>
      ) : (
        <div className="layout-2col">
          <div className="board-col">
            <Board fen={fen} orientation={orientation}
              onDrop={mode === 'quiz' ? onQuizDrop : mode === 'play' ? onPlayDrop : null}
              lastMove={mode === 'study' ? lastStudyMove : mode === 'quiz' ? quizLast : playLast}
              draggable={mode === 'quiz' || mode === 'play'}
              getMoves={getMoves}
              arrows={mode === 'study' && line ? arrowsByLine[`${line.id}:${ply}`] || [] : []}
              onArrowsChange={mode === 'study' && line ? (arrs) => {
                const key = `${line.id}:${ply}`;
                const cur = arrowsByLine[key] || [];
                if (JSON.stringify(cur) !== JSON.stringify(arrs)) setLineArrows(key, arrs);
              } : undefined} />
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
              {mode === 'study' && (
                <>
                  <button className="btn" disabled={ply === 0} onClick={() => setPly(0)}>⏮</button>
                  <button className="btn" disabled={ply === 0} onClick={() => setPly(ply - 1)}>◀</button>
                  <button className="btn" disabled={ply >= line.moves.length} onClick={() => setPly(ply + 1)}>▶</button>
                  <button className="btn" disabled={ply >= line.moves.length} onClick={() => setPly(line.moves.length)}>⏭</button>
                  <button className="btn primary" onClick={startQuiz}>Quiz me</button>
                  <button className="btn" onClick={() => startPlay(studyGame.fen())}>▶ Play vs Coach</button>
                </>
              )}
              {mode === 'quiz' && (
                <>
                  <button className="btn" onClick={startQuiz}>Restart</button>
                  <button className="btn" onClick={() => setMode('study')}>Study</button>
                  <span className="chip quiz-score">errors: {quizErrors}</span>
                </>
              )}
              {mode === 'play' && (
                <>
                  <button className="btn" onClick={() => setMode('study')}>← Back to study</button>
                  {thinking && <span className="chip blue">coach thinking…</span>}
                  {playEval != null && <span className="chip">{playEval > 0 ? '+' : ''}{(playEval / 100).toFixed(1)}</span>}
                  {playGame.current.isGameOver() && <span className="chip gold-chip">{playGame.current.isCheckmate() ? (playGame.current.turn() === userColor ? 'Coach mates you' : 'You win!') : 'Draw'}</span>}
                </>
              )}
            </div>
            <p className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>← → step through · F flip · right-click drag to draw arrows (saved per position)</p>
          </div>

          <div className="side-col">
            <div className="panel">
              <h3>{opening.name} — lines</h3>
              <div className="card-list">
                {opening.lines.map((l) => (
                  <button key={l.id} className={`select-card ${l.id === lineId ? 'active' : ''}`} onClick={() => pickLine(l.id)}>
                    <div className="t">
                      {l.name} {linesStudied[l.id] ? '✓' : ''}
                    </div>
                    <div className="d">
                      <span className={`chip ${lineDue(srs, l.id) ? 'red' : 'green'}`} style={{ marginRight: 6 }}>{srsLabel(srs, l.id)}</span>
                      {quizBest[l.id] != null && <span className="chip green">quiz {quizBest[l.id]}%</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {mode === 'study' && (
              <>
                <div className="panel">
                  <h3>Moves</h3>
                  <div className="movelist">
                    {line.moves.map((m, i) => (
                      <React.Fragment key={i}>
                        {i % 2 === 0 && <span className="mvnum">{i / 2 + 1}.</span>}
                        <button className={`mv ${ply === i + 1 ? 'current' : ''}`} onClick={() => setPly(i + 1)}>
                          {m.san}{m.why ? '*' : ''}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="panel">
                  <h3>The idea</h3>
                  {curMove ? (
                    curMove.why
                      ? <div className="banner coach big"><b style={{ color: 'var(--gold-soft)' }}>{Math.floor((ply - 1) / 2) + 1}{(ply - 1) % 2 === 0 ? '.' : '...'} {curMove.san}</b> — {curMove.why}</div>
                      : <p className="small muted">A natural developing move — step forward for the next key idea.</p>
                  ) : (
                    <p className="small" style={{ lineHeight: 1.65 }}>{opening.summary}</p>
                  )}
                  {ply >= line.moves.length && line.moves.length > 0 && (
                    <div className="banner gold big" style={{ marginTop: 10 }}>
                      Line complete. Now prove you understand the position, not just the moves:
                      <div className="btn-row">
                        <button className="btn primary" onClick={() => startPlay(studyGame.fen())}>▶ Play vs Coach</button>
                        <button className="btn" onClick={() => requestPlay(studyGame.fen(), userColor, `${opening.name} — ${line.name}`)}>🤖 Play vs a Bot from here</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'quiz' && (
              <div className="panel">
                <h3>Quiz — {userColor === 'w' ? 'White' : 'Black'} repertoire</h3>
                {quizWrong && <div className="banner err big">✗ Not the repertoire move — try again.</div>}
                {quizMsg && !quizWrong && !quizDoneFlag && <div className="banner coach big" style={{ marginTop: 8 }}>{quizMsg}</div>}
                {quizDoneFlag && (
                  <div className="banner ok big" style={{ marginTop: 8 }}>
                    Line complete — {quizErrors === 0 ? 'flawless. Next review scheduled automatically (SRS).' : `${quizErrors} slip${quizErrors > 1 ? 's' : ''} — it comes back tomorrow.`}
                    <div className="btn-row"><button className="btn primary" onClick={() => startPlay(quizGame.current.fen())}>▶ Play on vs Coach</button></div>
                  </div>
                )}
              </div>
            )}

            {mode === 'play' && (
              <div className="panel">
                <h3>Middlegame test</h3>
                <p className="small" style={{ lineHeight: 1.6 }}>Theory is over — now play the plans: {opening.id === 'vienna' ? 'the f-file, the e5 space, and the kingside storm.' : opening.id === 'caro' ? 'the ...c5 break and the good bishop.' : opening.id === 'alien' ? 'pile every piece on the naked king.' : 'pressure on f7 and the e-file.'} The coach plays at a club level — beat it with ideas, not tricks.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
