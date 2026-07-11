import React, { useState } from 'react';

// In-game thinking aid — the every-move checklist from the Training Plan,
// one tap away while you actually play (forcing moves first).
const MOVE_CHECKLIST = [
  'Checks — any check that achieves something?',
  'Threats — am I about to be checked or lose material?',
  'Hanging — is anything of mine (or theirs) undefended?',
  'Tactics — fork, pin, skewer, discovered attack?',
  'Activity — a better square, an outpost, or an open file?',
];

export default function ChecklistAid() {
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
