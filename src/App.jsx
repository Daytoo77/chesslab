import React, { useEffect, useState } from 'react';
import { getPlayEngine } from './stockfish.js';
import Play from './sections/Play.jsx';
import Tactics from './sections/Tactics.jsx';
import Openings from './sections/Openings.jsx';
import Analyzer from './sections/Analyzer.jsx';
import Endgames from './sections/Endgames.jsx';
import Train from './sections/Train.jsx';
import Dashboard from './sections/Dashboard.jsx';
import { isMuted, setMuted } from './sounds.js';
import { useStats } from './store.js';
import { useSettings, useUi, BOARD_THEMES } from './settings.js';

const SECTIONS = [
  { id: 'play', label: 'Play vs Bots', icon: '♞', comp: Play },
  { id: 'tactics', label: 'Tactics Trainer', icon: '⚔', comp: Tactics },
  { id: 'openings', label: 'Opening Explorer', icon: '♜', comp: Openings },
  { id: 'analyzer', label: 'Game Analyzer', icon: '⚡', comp: Analyzer },
  { id: 'endgames', label: 'Endgame Drills', icon: '♚', comp: Endgames },
  { id: 'train', label: 'Training Plan', icon: '◎', comp: Train },
  { id: 'dashboard', label: 'Progress', icon: '◈', comp: Dashboard },
];

function Settings({ onClose }) {
  const settings = useSettings();
  const { blindfold, toggleBlindfold } = useStats();
  const [muted, setMutedState] = useState(isMuted());
  const Toggle = ({ k, label }) => (
    <label className="settings-row">
      <span>{label}</span>
      <input type="checkbox" checked={settings[k]} onChange={(e) => settings.set({ [k]: e.target.checked })} />
    </label>
  );
  return (
    <div className="settings-pop" onClick={(e) => e.stopPropagation()}>
      <h3>Settings</h3>
      <div className="settings-row" style={{ display: 'block' }}>
        <span>Board theme</span>
        <div className="theme-swatches">
          {BOARD_THEMES.map((t) => (
            <button key={t.id} title={t.name}
              className={`swatch ${settings.boardTheme === t.id ? 'active' : ''}`}
              onClick={() => settings.set({ boardTheme: t.id })}>
              <span style={{ background: t.light }} />
              <span style={{ background: t.dark }} />
            </button>
          ))}
        </div>
      </div>
      <label className="settings-row">
        <span>App theme</span>
        <select value={settings.appTheme} onChange={(e) => settings.set({ appTheme: e.target.value })}>
          <option value="dark">dark</option>
          <option value="light">light</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Pieces</span>
        <select value={settings.pieceSet} onChange={(e) => settings.set({ pieceSet: e.target.value })}>
          <option value="classic">classic</option>
          <option value="unicode">unicode</option>
        </select>
      </label>
      <Toggle k="showLegal" label="Show legal moves" />
      <Toggle k="coords" label="Board coordinates" />
      <Toggle k="autoQueen" label="Always promote to queen" />
      <label className="settings-row">
        <span>Piece animation</span>
        <select value={settings.animMs} onChange={(e) => settings.set({ animMs: +e.target.value })}>
          <option value={0}>off</option>
          <option value={120}>fast</option>
          <option value={160}>normal</option>
          <option value={280}>slow</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Sounds</span>
        <input type="checkbox" checked={!muted} onChange={(e) => { setMuted(!e.target.checked); setMutedState(!e.target.checked); }} />
      </label>
      <label className="settings-row">
        <span>Blindfold mode</span>
        <input type="checkbox" checked={blindfold} onChange={toggleBlindfold} />
      </label>
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Done</button>
    </div>
  );
}

export default function App() {
  const page = useUi((u) => u.page);
  const setPage = useUi((u) => u.setPage);
  const appTheme = useSettings((s) => s.appTheme);
  const [showSettings, setShowSettings] = useState(false);
  // warm the play engine right after first paint — the first bot/coach move
  // must never wait for a wasm boot
  useEffect(() => {
    const t = setTimeout(() => { getPlayEngine().catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = appTheme; }, [appTheme]);
  const Current = (SECTIONS.find((s) => s.id === page) || SECTIONS[0]).comp;
  return (
    <div className="app" onClick={() => showSettings && setShowSettings(false)}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">♞</span>
          <span className="brand-name">Chess<span className="brand-accent">Lab</span>
            <small>Training Suite</small>
          </span>
        </div>
        <nav className="nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={page === s.id ? 'active' : ''} onClick={() => setPage(s.id)}>
              <span className="icon">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ position: 'relative' }}>
            <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>
              ⚙ Settings
            </button>
            {showSettings && <Settings onClose={() => setShowSettings(false)} />}
          </div>
          <span className="foot-note">Bishop's Opening &middot; Alien Gambit &middot; London &middot; Caro-Kann</span>
        </div>
      </aside>
      <main className="main">
        <Current />
      </main>
    </div>
  );
}
