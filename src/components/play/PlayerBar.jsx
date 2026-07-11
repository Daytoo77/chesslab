import React from 'react';
import { fmtClock } from '../../hooks/useGameClock.js';

// One side's name/thinking-dots + clock — used twice (top and bottom of the board).
export default function PlayerBar({ position, name, isThinking, active, showClock, clockMs }) {
  return (
    <div className={`player-bar ${position} ${active ? 'active' : ''}`}>
      <span className="pb-name">{name} {isThinking && <span className="thinking-dots"><span>·</span><span>·</span><span>·</span></span>}</span>
      {showClock && <span className={`clock ${clockMs < 20e3 ? 'danger' : ''}`}>{fmtClock(clockMs)}</span>}
    </div>
  );
}
