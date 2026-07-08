import React, { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board from '../components/Board.jsx';
import { buildTree, kvGet, kvSet, nodeAtPath, scorePct, repertoireMoveAt } from '../vault.js';

export default function Vault({ openings }) {
  const [data, setData] = useState(null);
  const [username, setUsername] = useState('');
  const [pgnText, setPgnText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState(null);
  const [path, setPath] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { kvGet('tree').then((d) => { if (d) { setData(d); setUsername(d.username || ''); } }).catch(() => {}); }, []);

  async function onFiles(files) {
    let text = '';
    for (const f of files) text += (await f.text()) + '\n\n';
    setPgnText(text);
    setMsg({ ok: true, text: `${files.length} file(s) loaded (${Math.round(text.length / 1024)} KB). Set your username and build.` });
  }
  async function build() {
    setBusy(true); setMsg(null); setProgress(0);
    try {
      const d = await buildTree(pgnText, username, setProgress);
      if (!d.games) throw new Error('none');
      await kvSet('tree', d);
      setData(d); setPath([]); setPgnText('');
      setMsg({ ok: true, text: `${d.games} games indexed${d.referenceMode ? ' as a reference tree (white POV — no username given)' : ''}${d.capped ? ' — capped at 30k games per run' : ''} (${d.skipped} skipped).` });
    } catch {
      setMsg({ ok: false, text: 'No games matched. Check the username matches the PGN [White]/[Black] headers.' });
    }
    setBusy(false);
  }

  const game = new Chess();
  let lastMove = null;
  for (const san of path) { const m = game.move(san); lastMove = { from: m.from, to: m.to }; }
  const node = data ? nodeAtPath(data.tree, path) : null;
  const children = node ? Object.entries(node.c).sort((a, b) => b[1].n - a[1].n) : [];
  const rep = data ? repertoireMoveAt(openings, path) : null;
  const topMove = children[0] ? children[0][0] : null;
  const deviation = rep && topMove && rep.san.replace(/[+#]/g, '') !== topMove.replace(/[+#]/g, '');

  return (
    <div className="layout-2col">
      <div className="board-col">
        <Board fen={game.fen()} orientation={flipped ? 'black' : 'white'} lastMove={lastMove} draggable={false} />
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setFlipped(!flipped)}>⇅ Flip</button>
          <button className="btn" disabled={!path.length} onClick={() => setPath(path.slice(0, -1))}>◀ Back</button>
          <button className="btn" disabled={!path.length} onClick={() => setPath([])}>⏮ Start</button>
        </div>
      </div>
      <div className="side-col">
        <div className="panel">
          <h3>📂 My games — personal opening tree</h3>
          {!data && <p className="small muted">Two modes: with your username → YOUR stats per move (lichess/chess.com PGN archive). Username left empty → reference tree from any database (e.g. a ChessBase export: select games → right-click → Output → Text file → PGN). White-POV scores in reference mode.</p>}
          {data && <p className="small muted">{data.games} games · {data.username} · first {10} moves indexed{data.skipped ? ` · ${data.skipped} skipped` : ''}</p>}
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <input className="text-input" placeholder="Username — leave EMPTY for a reference database" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input ref={fileRef} type="file" accept=".pgn,.txt" multiple style={{ display: 'none' }} onChange={(e) => onFiles([...e.target.files])} />
            <button className="btn" onClick={() => fileRef.current.click()}>Choose PGN file(s)</button>
            <button className="btn primary" disabled={busy || !pgnText.trim()} onClick={build}>{busy ? 'Indexing…' : 'Build my tree'}</button>
          </div>
          {busy && <div className="progressbar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
          {msg && <div className={`banner ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 10 }}>{msg.text}</div>}
        </div>

        {data && node && (
          <div className="panel">
            <h3>{path.length ? path.map((s, i) => (i % 2 === 0 ? `${i / 2 + 1}.${s}` : s)).join(' ') : 'Starting position'} <span className="chip">{node.n} games · {scorePct(node)}%</span></h3>
            {rep && (
              <div className={`banner ${deviation ? 'gold' : 'coach'} small`} style={{ marginBottom: 8 }}>
                📖 Your repertoire here: <b>{rep.san}</b> ({rep.opening} — {rep.line}){deviation ? ' — but in practice you mostly play differently. Worth a review!' : ''}
              </div>
            )}
            <div className="card-list">
              {children.slice(0, 12).map(([san, ch]) => {
                const pct = scorePct(ch);
                return (
                  <button key={san} className="select-card" onClick={() => setPath([...path, san])}>
                    <div className="t" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{san}{rep && rep.san.replace(/[+#]/g, '') === san.replace(/[+#]/g, '') ? ' 📖' : ''}</span>
                      <span style={{ color: pct >= 55 ? 'var(--good)' : pct <= 45 ? 'var(--bad)' : 'var(--gold-soft)' }}>{pct}%</span>
                    </div>
                    <div className="d">{ch.n} game{ch.n > 1 ? 's' : ''} · +{ch.w} ={ch.d} −{ch.l}</div>
                  </button>
                );
              })}
              {!children.length && <p className="small muted">No deeper games on this path.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
