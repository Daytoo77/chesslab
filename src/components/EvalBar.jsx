import React from 'react';
import { winPct } from '../accuracy.js';

// Vertical evaluation bar. cp/mate are from WHITE's point of view.
// flipped = black at the bottom.
export default function EvalBar({ cp = 0, mate = null, flipped = false, label = true }) {
  let whitePct;
  let text;
  if (mate != null) {
    whitePct = mate > 0 ? 100 : 0;
    text = `M${Math.abs(mate)}`;
  } else {
    whitePct = winPct(cp);
    text = Math.abs(cp) >= 1000 ? (cp > 0 ? '+10+' : '-10+') : `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
  }
  const whiteH = Math.max(4, Math.min(96, whitePct));
  const whiteOnTop = flipped;
  return (
    <div className="evalbar" title={`White ${Math.round(whitePct)}% win`}>
      <div className="evalbar-track">
        <div
          className="evalbar-white"
          style={whiteOnTop
            ? { top: 0, height: `${whiteH}%` }
            : { bottom: 0, height: `${whiteH}%` }}
        />
        <div className="evalbar-mid" />
      </div>
      {label && <div className={`evalbar-label ${(mate != null ? mate > 0 : cp >= 0) ? 'w' : 'b'}`}>{text}</div>}
    </div>
  );
}
