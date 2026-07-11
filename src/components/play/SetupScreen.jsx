import React from 'react';
import { BOTS } from '../../data/bots.js';
import { TIME_CONTROLS } from '../../hooks/useGameClock.js';

// Bot-choice + game-setup screen shown before a game starts (Play.jsx "setup" phase).
export default function SetupScreen({
  savedGame, resumeSaved, clearSavedGame,
  vsRecord, botId, setBotId,
  colorChoice, setColorChoice, tcId, setTcId,
  evalBarPlay, setEvalBarPlay, onStart,
}) {
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
        {BOTS.map((b, i) => {
          const r = vsRecord[b.id] || { w: 0, d: 0, l: 0 };
          const played = r.w + r.d + r.l;
          return (
            <button key={b.id} style={{ '--i': i }} className={`bot-card ${botId === b.id ? 'active' : ''}`} onClick={() => setBotId(b.id)}>
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
            <input type="checkbox" checked={evalBarPlay} onChange={(e) => setEvalBarPlay(e.target.checked)} />
            Show live eval bar (training wheels)
          </label>
        </div>
        <div className="btn-row">
          <button className="btn primary" style={{ fontSize: 16, padding: '10px 26px' }} onClick={onStart}>
            ▶ Play {(BOTS.find((b) => b.id === botId) || {}).name}
          </button>
        </div>
      </div>
    </div>
  );
}
