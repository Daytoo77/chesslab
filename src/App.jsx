import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { exportBackup, importBackup } from './backup.js';

const SECTIONS = [
  { id: 'play', label: 'Play vs Bots', icon: '♞', comp: Play, group: 'Play' },
  { id: 'tactics', label: 'Tactics Trainer', icon: '⚔', comp: Tactics, group: 'Train' },
  { id: 'openings', label: 'Opening Explorer', icon: '♜', comp: Openings, group: 'Train' },
  { id: 'endgames', label: 'Endgame Drills', icon: '♚', comp: Endgames, group: 'Train' },
  { id: 'train', label: 'Training Plan', icon: '◎', comp: Train, group: 'Train' },
  { id: 'analyzer', label: 'Game Analyzer', icon: '⚡', comp: Analyzer, group: 'Analyze' },
  { id: 'dashboard', label: 'Progress', icon: '◈', comp: Dashboard, group: 'Analyze' },
];
const NAV_GROUPS = ['Play', 'Train', 'Analyze'];

// Enter-only page animation. Deliberately NO AnimatePresence/exit around pages:
// mode="wait" gates the swap on the exit animation finishing, which hangs the
// whole app if rAF is throttled (hidden/zero-size viewport). Enter-only always
// swaps instantly and animates when frames are available.
const PAGE_ANIM = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
};

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
    <motion.div
      className="settings-pop"
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.94, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 4 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
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
        <span>Board highlights</span>
        <select value={settings.boardHl} onChange={(e) => settings.set({ boardHl: e.target.value })}>
          <option value="subtle">subtle</option>
          <option value="normal">normal</option>
          <option value="bold">bold</option>
        </select>
      </label>
      <label className="settings-row">
        <span>Text size</span>
        <select value={settings.uiScale} onChange={(e) => settings.set({ uiScale: +e.target.value })}>
          <option value={90}>compact</option>
          <option value={100}>normal</option>
          <option value={112}>large</option>
        </select>
      </label>
      <label className="settings-row" title="Okabe-Ito palette for move classifications — distinguishable with all common color-vision types">
        <span>Colorblind-safe colors</span>
        <input type="checkbox" checked={settings.cbSafe} onChange={(e) => settings.set({ cbSafe: e.target.checked })} />
      </label>
      <label className="settings-row">
        <span>Sounds</span>
        <input type="checkbox" checked={!muted} onChange={(e) => { setMuted(!e.target.checked); setMutedState(!e.target.checked); }} />
      </label>
      <label className="settings-row">
        <span>Blindfold mode</span>
        <input type="checkbox" checked={blindfold} onChange={toggleBlindfold} />
      </label>
      <label className="settings-row" style={{ display: 'block' }}>
        <span>Gemini API key <span style={{ color: 'var(--sub)' }}>· AI coach</span></span>
        <input type="password" className="key-input" placeholder="stored only on this device"
          value={settings.geminiKey} onChange={(e) => settings.set({ geminiKey: e.target.value })} />
      </label>
      <div className="settings-row" style={{ display: 'block' }}>
        <span>Progress backup <span style={{ color: 'var(--sub)' }}>· all stats & settings</span></span>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn btn-mini" onClick={() => {
            const blob = new Blob([JSON.stringify(exportBackup(localStorage), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `chesslab-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}>⬇ Export</button>
          <button className="btn btn-mini" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json,.json';
            input.onchange = () => {
              const f = input.files && input.files[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                let res;
                try { res = importBackup(JSON.parse(reader.result), localStorage); }
                catch { res = { ok: false, error: 'Could not read that file as JSON.' }; }
                if (res.ok) { alert('Backup restored — reloading.'); location.reload(); }
                else alert(res.error);
              };
              reader.readAsText(f);
            };
            input.click();
          }}>⬆ Import</button>
        </div>
      </div>
      <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Done</button>
    </motion.div>
  );
}

export default function App() {
  const page = useUi((u) => u.page);
  const setPage = useUi((u) => u.setPage);
  const appTheme = useSettings((s) => s.appTheme);
  const uiScale = useSettings((s) => s.uiScale);
  const cbSafe = useSettings((s) => s.cbSafe);
  const [showSettings, setShowSettings] = useState(false);
  // warm the play engine right after first paint — the first bot/coach move
  // must never wait for a wasm boot
  useEffect(() => {
    const t = setTimeout(() => { getPlayEngine().catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = appTheme; }, [appTheme]);
  useEffect(() => { document.documentElement.style.fontSize = `${uiScale || 100}%`; }, [uiScale]);
  useEffect(() => { document.documentElement.dataset.cb = cbSafe ? 'true' : 'false'; }, [cbSafe]);
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
          {NAV_GROUPS.map((g) => (
            <React.Fragment key={g}>
              <div className="nav-group">{g}</div>
              {SECTIONS.filter((s) => s.group === g).map((s) => (
                <button key={s.id} className={page === s.id ? 'active' : ''} onClick={() => setPage(s.id)}>
                  <span className="icon">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ position: 'relative' }}>
            <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>
              ⚙ Settings
            </button>
            <AnimatePresence>
              {showSettings && <Settings onClose={() => setShowSettings(false)} />}
            </AnimatePresence>
          </div>
          <span className="foot-note">Bishop's Opening &middot; Vienna &middot; Alien Gambit &middot; Caro-Kann &middot; Slav</span>
        </div>
      </aside>
      <main className="main">
        <motion.div key={page} {...PAGE_ANIM}>
          <Current />
        </motion.div>
      </main>
    </div>
  );
}
